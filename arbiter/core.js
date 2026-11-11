// Blind-match arbiter: both sides hand over a private limit, both learn only
// whether a deal is possible. This file is the logic; server.js wraps it in HTTP.
//
// What the arbiter keeps: who took part (as ids), when, a commitment hash of
// each submission, and the yes/no outcome. What it does not keep: the numbers.
// They are held in memory until the second side submits, compared, then dropped.
//
// Trust model, stated plainly: this is a trusted neutral operator, not
// cryptography. Whoever runs this process could read a number while it is in
// memory. See arbiter/README.md for the threat model and what comes next.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const DAY = 86400000;
const MAX_VALUE = 1e15;

export class ArbiterError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.code = code;
    this.extra = extra;
  }
}

const sha = (text) => createHash('sha256').update(text).digest('hex');
const sameHash = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const canonical = (values) => JSON.stringify(Object.keys(values).sort().map((k) => [k, values[k]]));

export class Arbiter {
  #sessions = new Map();
  #cooldowns = new Map();
  #audit = [];
  #now;
  #cooldownMs;
  #sessionTtlMs;

  /**
   * @param {object} [o]
   * @param {() => number} [o.now]
   * @param {number} [o.cooldownMs]   After a completed check, the same pair cannot
   *   run the same deal again for this long. This is what stops one side from
   *   finding the other's number by asking over and over. Default 30 days.
   * @param {number} [o.sessionTtlMs] How long an unfinished session stays open. Default 1 day.
   */
  constructor({ now = Date.now, cooldownMs = 30 * DAY, sessionTtlMs = DAY } = {}) {
    this.#now = now;
    this.#cooldownMs = cooldownMs;
    this.#sessionTtlMs = sessionTtlMs;
  }

  /**
   * @param {object} p
   * @param {string} p.dealRef   Stable reference to the thing being negotiated.
   * @param {{id:string, role:'at_most'|'at_least'}[]} p.parties  Exactly two. The
   *   at_most side is the one with a ceiling (a buyer's most); the at_least
   *   side has a floor (a seller's least).
   * @param {{key:string, unit?:string}[]} [p.dimensions]  What is compared. With
   *   several, the outcome is overlap only if every one overlaps, and the
   *   arbiter never says which one failed.
   */
  createSession({ dealRef, parties, dimensions = [{ key: 'price', unit: 'USD' }] }) {
    if (typeof dealRef !== 'string' || !dealRef) throw new ArbiterError('bad_request', 'dealRef is required.');
    if (!Array.isArray(parties) || parties.length !== 2) throw new ArbiterError('bad_request', 'Exactly two parties are required.');
    const [a, b] = parties;
    if (!a?.id || !b?.id || a.id === b.id) throw new ArbiterError('bad_request', 'Parties need two different ids.');
    const roles = [a.role, b.role].sort().join(',');
    if (roles !== 'at_least,at_most') throw new ArbiterError('bad_request', 'One party must be at_most and the other at_least.');
    if (!Array.isArray(dimensions) || dimensions.length === 0) throw new ArbiterError('bad_request', 'At least one dimension is required.');
    const keys = dimensions.map((d) => d?.key);
    if (keys.some((k) => typeof k !== 'string' || !k) || new Set(keys).size !== keys.length) {
      throw new ArbiterError('bad_request', 'Dimension keys must be unique, non-empty strings.');
    }

    const now = this.#now();
    const pairKey = sha(dealRef + '\n' + [a.id, b.id].sort().join('\n'));
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
    const tokens = {};
    const session = {
      id: sessionId,
      pairKey,
      dealRef,
      dimensions: dimensions.map((d) => ({ key: d.key, unit: d.unit || null })),
      status: 'open',
      outcome: null,
      createdAt: now,
      expiresAt: now + this.#sessionTtlMs,
      parties: parties.map((p) => {
        const token = randomBytes(24).toString('hex');
        tokens[p.id] = token;
        return { id: p.id, role: p.role, tokenHash: sha(token), values: null, commitment: null };
      }),
    };
    this.#sessions.set(sessionId, session);
    this.#log(session, 'created', null);
    return { sessionId, tokens, expiresAt: session.expiresAt, dimensions: session.dimensions };
  }

  /**
   * One submission per party, and it cannot be changed.
   * @returns {{status:'waiting'|'complete', receipt:{commitment:string, salt:string}}}
   *   Keep the receipt: value + salt reproduces the commitment in the audit log,
   *   which lets a party prove later what it submitted.
   */
  submit({ sessionId, token, values }) {
    const { session, party } = this.#authenticate(sessionId, token);
    if (session.status !== 'open') throw new ArbiterError('closed', 'This check is already finished.');
    if (session.expiresAt <= this.#now()) throw new ArbiterError('expired', 'This check has expired.');
    if (party.commitment) throw new ArbiterError('already_submitted', 'A limit was already submitted and cannot be changed.');

    const keys = session.dimensions.map((d) => d.key);
    if (values === null || typeof values !== 'object' || Array.isArray(values)) throw new ArbiterError('bad_request', 'values must be an object.');
    const given = Object.keys(values);
    if (given.length !== keys.length || !keys.every((k) => given.includes(k))) {
      throw new ArbiterError('bad_request', 'values must have exactly these keys: ' + keys.join(', ') + '.');
    }
    const clean = {};
    for (const k of keys) {
      const v = values[k];
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > MAX_VALUE) {
        throw new ArbiterError('bad_request', 'Each value must be a number from 0 to ' + MAX_VALUE + '.');
      }
      clean[k] = v;
    }

    const salt = randomBytes(16).toString('hex');
    party.commitment = sha(salt + ':' + canonical(clean));
    party.values = clean;
    this.#log(session, 'submitted', party);

    const other = session.parties.find((p) => p !== party);
    if (other.values) {
      const most = party.role === 'at_most' ? party : other;
      const least = party.role === 'at_least' ? party : other;
      const overlap = keys.every((k) => most.values[k] >= least.values[k]);
      // The numbers are dropped here. Only the outcome survives.
      party.values = null;
      other.values = null;
      session.status = 'complete';
      session.outcome = overlap ? 'overlap' : 'no_overlap';
      this.#cooldowns.set(session.pairKey, this.#now() + this.#cooldownMs);
      this.#log(session, 'completed', null);
    }
    return { status: session.status === 'complete' ? 'complete' : 'waiting', receipt: { commitment: party.commitment, salt } };
  }

  /** Either party can ask. They get the same answer. */
  result({ sessionId, token }) {
    const { session, party } = this.#authenticate(sessionId, token);
    const other = session.parties.find((p) => p !== party);
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
  audit() {
    return this.#audit.map((e) => ({ ...e }));
  }

  #authenticate(sessionId, token) {
    const session = this.#sessions.get(sessionId);
    if (!session || typeof token !== 'string') throw new ArbiterError('not_found', 'No such check, or the token is wrong.');
    const hash = sha(token);
    const party = session.parties.find((p) => sameHash(p.tokenHash, hash));
    if (!party) throw new ArbiterError('not_found', 'No such check, or the token is wrong.');
    return { session, party };
  }

  #log(session, event, party) {
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
export function commitmentFor(values, salt) {
  return sha(salt + ':' + canonical(values));
}
