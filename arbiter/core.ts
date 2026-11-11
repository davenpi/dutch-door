// Blind-match arbiter: both sides hand over a private limit, both learn only
// whether a deal is possible. This file is the logic; server.ts wraps it in HTTP.
//
// What the arbiter keeps: who took part (as ids), when, a commitment hash of
// each submission, and the yes/no outcome. What it does not keep: the numbers.
// They are held in memory until the second side submits, compared, then dropped.
//
// Trust model, stated plainly: this is a trusted neutral operator, not
// cryptography. Whoever runs this process could read a number while it is in
// memory. See arbiter/README.md for the threat model and what comes next.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { isRecord } from '../lib/unchecked.ts';
import type { Unchecked } from '../lib/unchecked.ts';

const DAY = 86400000;
const MAX_VALUE = 1e15;

/** at_most is the side with a ceiling (a buyer's most). at_least is the side with a floor (a seller's least). */
export type Role = 'at_most' | 'at_least';

export interface PartyInput {
  id: string;
  role: Role;
}

/** One thing that is compared, as a caller names it. */
export interface DimensionInput {
  key: string;
  unit?: string;
}

export interface Dimension {
  key: string;
  unit: string | null;
}

/** One private limit per dimension key. */
export type Values = Record<string, number>;

export type SessionStatus = 'open' | 'complete' | 'expired';
export type Outcome = 'overlap' | 'no_overlap';

export interface ArbiterOptions {
  now?: () => number;
  /**
   * After a completed check, the same pair cannot run the same deal again for
   * this long. This is what stops one side from finding the other's number by
   * asking over and over. Default 30 days.
   */
  cooldownMs?: number;
  /** How long an unfinished session stays open. Default 1 day. */
  sessionTtlMs?: number;
}

export interface CreateSessionInput {
  /** Stable reference to the thing being negotiated. */
  dealRef: string;
  /** Exactly two, one at_most and one at_least. */
  parties: PartyInput[];
  /**
   * What is compared. With several, the outcome is overlap only if every one
   * overlaps, and the arbiter never says which one failed. Default: price in USD.
   */
  dimensions?: DimensionInput[];
}

export interface CreatedSession {
  sessionId: string;
  /** Party id -> the token that party submits with. */
  tokens: Record<string, string>;
  /** In milliseconds. */
  expiresAt: number;
  dimensions: Dimension[];
}

export interface SubmitInput {
  sessionId: string;
  token: string;
  values: Values;
}

/**
 * Keep the receipt: value + salt reproduces the commitment in the audit log,
 * which lets a party prove later what it submitted.
 */
export interface Receipt {
  commitment: string;
  salt: string;
}

export interface SubmitResult {
  status: 'waiting' | 'complete';
  receipt: Receipt;
}

export interface ResultInput {
  sessionId: string;
  token: string;
}

export interface SessionResult {
  status: SessionStatus;
  outcome: Outcome | null;
  submitted: { you: boolean; counterparty: boolean };
}

export type AuditEvent = 'created' | 'submitted' | 'completed' | 'expired';

/** One line of what the arbiter remembers. There is no limit in it. */
export interface AuditEntry {
  at: string;
  session_id: string;
  deal_ref: string;
  event: AuditEvent;
  party: string | null;
  commitment: string | null;
  outcome: Outcome | null;
}

/**
 * What a front door needs from an arbiter. The Arbiter below fits, and so does
 * a client that reaches one over HTTP.
 */
export interface ArbiterApi {
  createSession(input: CreateSessionInput): CreatedSession | Promise<CreatedSession>;
  submit(input: SubmitInput): SubmitResult | Promise<SubmitResult>;
  result(input: ResultInput): SessionResult | Promise<SessionResult>;
}

interface Party {
  id: string;
  role: Role;
  tokenHash: string;
  /** Held only until the other side submits, then dropped. */
  values: Values | null;
  commitment: string | null;
}

interface Session {
  id: string;
  pairKey: string;
  dealRef: string;
  dimensions: Dimension[];
  status: SessionStatus;
  outcome: Outcome | null;
  createdAt: number;
  expiresAt: number;
  parties: [Party, Party];
}

export class ArbiterError extends Error {
  code: string;
  extra: Record<string, unknown>;

  constructor(code: string, message: string, extra: Record<string, unknown> = {}) {
    super(message);
    this.code = code;
    this.extra = extra;
  }
}

const sha = (text: string): string => createHash('sha256').update(text).digest('hex');
const sameHash = (a: string, b: string): boolean => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const canonical = (values: Values): string => JSON.stringify(Object.keys(values).sort().map((k) => [k, values[k]]));
const isRole = (value: unknown): value is Role => value === 'at_most' || value === 'at_least';

/**
 * The arbiter checks every argument itself, so its methods take unchecked
 * input. That is what lets the HTTP wrapper hand a request body straight over.
 */
export class Arbiter {
  #sessions = new Map<string, Session>();
  #cooldowns = new Map<string, number>();
  #audit: AuditEntry[] = [];
  #now: () => number;
  #cooldownMs: number;
  #sessionTtlMs: number;

  constructor({ now = Date.now, cooldownMs = 30 * DAY, sessionTtlMs = DAY }: ArbiterOptions = {}) {
    this.#now = now;
    this.#cooldownMs = cooldownMs;
    this.#sessionTtlMs = sessionTtlMs;
  }

  /** Open a check between two parties. See CreateSessionInput for what to send. */
  createSession({ dealRef, parties, dimensions = [{ key: 'price', unit: 'USD' }] }: Unchecked<CreateSessionInput>): CreatedSession {
    if (typeof dealRef !== 'string' || !dealRef) throw new ArbiterError('bad_request', 'dealRef is required.');
    if (!Array.isArray(parties) || parties.length !== 2) throw new ArbiterError('bad_request', 'Exactly two parties are required.');
    const [a, b]: unknown[] = parties;
    if (!isRecord(a) || !isRecord(b) || typeof a.id !== 'string' || typeof b.id !== 'string' || !a.id || !b.id || a.id === b.id) {
      throw new ArbiterError('bad_request', 'Parties need two different ids.');
    }
    if (!isRole(a.role) || !isRole(b.role) || a.role === b.role) throw new ArbiterError('bad_request', 'One party must be at_most and the other at_least.');
    const pair: [PartyInput, PartyInput] = [{ id: a.id, role: a.role }, { id: b.id, role: b.role }];
    if (!Array.isArray(dimensions) || dimensions.length === 0) throw new ArbiterError('bad_request', 'At least one dimension is required.');
    const compared: Dimension[] = [];
    for (const d of dimensions as unknown[]) {
      const key = isRecord(d) ? d.key : undefined;
      if (typeof key !== 'string' || !key || compared.some((c) => c.key === key)) {
        throw new ArbiterError('bad_request', 'Dimension keys must be unique, non-empty strings.');
      }
      compared.push({ key, unit: isRecord(d) && typeof d.unit === 'string' && d.unit ? d.unit : null });
    }

    const now = this.#now();
    const pairKey = sha(dealRef + '\n' + [pair[0].id, pair[1].id].sort().join('\n'));
    const until = this.#cooldowns.get(pairKey);
    if (until && until > now) {
      throw new ArbiterError('cooldown', 'These two parties already ran this check. It cannot be repeated yet.', { retry_after_ms: until - now });
    }
    for (const s of this.#sessions.values()) {
      if (s.pairKey === pairKey && s.status === 'open' && s.expiresAt > now) {
        throw new ArbiterError('session_open', 'A check between these two parties for this deal is already open.');
      }
    }

    const sessionId = randomBytes(12).toString('hex');
    const tokens: Record<string, string> = {};
    const seat = (p: PartyInput): Party => {
      const token = randomBytes(24).toString('hex');
      tokens[p.id] = token;
      return { id: p.id, role: p.role, tokenHash: sha(token), values: null, commitment: null };
    };
    const session: Session = {
      id: sessionId,
      pairKey,
      dealRef,
      dimensions: compared,
      status: 'open',
      outcome: null,
      createdAt: now,
      expiresAt: now + this.#sessionTtlMs,
      parties: [seat(pair[0]), seat(pair[1])],
    };
    this.#sessions.set(sessionId, session);
    this.#log(session, 'created', null);
    return { sessionId, tokens, expiresAt: session.expiresAt, dimensions: session.dimensions };
  }

  /** One submission per party, and it cannot be changed. Keep the receipt. */
  submit({ sessionId, token, values }: Unchecked<SubmitInput>): SubmitResult {
    const { session, party, other } = this.#authenticate(sessionId, token);
    if (session.status !== 'open') throw new ArbiterError('closed', 'This check is already finished.');
    if (session.expiresAt <= this.#now()) throw new ArbiterError('expired', 'This check has expired.');
    if (party.commitment) throw new ArbiterError('already_submitted', 'A limit was already submitted and cannot be changed.');

    const keys = session.dimensions.map((d) => d.key);
    if (!isRecord(values) || Array.isArray(values)) throw new ArbiterError('bad_request', 'values must be an object.');
    const given = Object.keys(values);
    if (given.length !== keys.length || !keys.every((k) => given.includes(k))) {
      throw new ArbiterError('bad_request', 'values must have exactly these keys: ' + keys.join(', ') + '.');
    }
    const clean: Values = {};
    for (const k of keys) {
      const v = values[k];
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > MAX_VALUE) {
        throw new ArbiterError('bad_request', 'Each value must be a number from 0 to ' + MAX_VALUE + '.');
      }
      clean[k] = v;
    }

    const salt = randomBytes(16).toString('hex');
    const commitment = sha(salt + ':' + canonical(clean));
    party.commitment = commitment;
    party.values = clean;
    this.#log(session, 'submitted', party);

    const theirs = other.values;
    if (theirs) {
      const most = party.role === 'at_most' ? clean : theirs;
      const least = party.role === 'at_least' ? clean : theirs;
      const overlap = keys.every((k) => most[k] >= least[k]);
      // The numbers are dropped here. Only the outcome survives.
      party.values = null;
      other.values = null;
      session.status = 'complete';
      session.outcome = overlap ? 'overlap' : 'no_overlap';
      this.#cooldowns.set(session.pairKey, this.#now() + this.#cooldownMs);
      this.#log(session, 'completed', null);
    }
    return { status: session.status === 'complete' ? 'complete' : 'waiting', receipt: { commitment, salt } };
  }

  /** Either party can ask. They get the same answer. */
  result({ sessionId, token }: Unchecked<ResultInput>): SessionResult {
    const { session, party, other } = this.#authenticate(sessionId, token);
    if (session.status === 'open' && session.expiresAt <= this.#now()) {
      session.status = 'expired';
      party.values = null;
      other.values = null;
      this.#log(session, 'expired', null);
    }
    return {
      status: session.status,
      outcome: session.outcome,
      submitted: { you: Boolean(party.commitment), counterparty: Boolean(other.commitment) },
    };
  }

  /** Everything the arbiter remembers. There are no limits in here. */
  audit(): AuditEntry[] {
    return this.#audit.map((e) => ({ ...e }));
  }

  #authenticate(sessionId: unknown, token: unknown): { session: Session; party: Party; other: Party } {
    const session = typeof sessionId === 'string' ? this.#sessions.get(sessionId) : undefined;
    if (!session || typeof token !== 'string') throw new ArbiterError('not_found', 'No such check, or the token is wrong.');
    const hash = sha(token);
    const [first, second] = session.parties;
    if (sameHash(first.tokenHash, hash)) return { session, party: first, other: second };
    if (sameHash(second.tokenHash, hash)) return { session, party: second, other: first };
    throw new ArbiterError('not_found', 'No such check, or the token is wrong.');
  }

  #log(session: Session, event: AuditEvent, party: Party | null): void {
    this.#audit.push({
      at: new Date(this.#now()).toISOString(),
      session_id: session.id,
      deal_ref: session.dealRef,
      event,
      party: party ? party.id : null,
      commitment: party ? party.commitment : null,
      outcome: event === 'completed' ? session.outcome : null,
    });
  }
}

/** Recompute a commitment from a receipt, for disputes. */
export function commitmentFor(values: Values, salt: string): string {
  return sha(salt + ':' + canonical(values));
}
