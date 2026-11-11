// The front door: one per business. Outside agents (or people, through a form)
// can ask questions, get qualified against the owner's rules, run a blind
// price check, and book a call. The owner sees a log of all of it.
//
// This file is the logic. server.ts wraps it in HTTP for many businesses.
//
// Three kinds of facts live in a business's config:
//   public   anyone may be told
//   gated    released only after the visitor meets the owner's requirements
//   private  never released to anyone; the only place a private limit goes is
//            the arbiter, as a sealed submission
import { randomBytes } from 'node:crypto';
import { verifyProfile, ProfileError } from '../lib/profile.ts';
import type { AgentAuthority, Principal, ProfilePayload, TrustedIssuers, Verified } from '../lib/profile.ts';
import { isRecord } from '../lib/unchecked.ts';
import type { Unchecked } from '../lib/unchecked.ts';
import type { ArbiterApi, CreatedSession, Outcome, SessionStatus } from '../arbiter/core.ts';

/** One fact about an offer, as written in the business config. */
export type FactValue = string | number | boolean | null;

/** Field name -> fact. */
export type Facts = Record<string, FactValue>;

/** Facts that are never released. The floor goes only to the arbiter, sealed. */
export interface PrivateFacts {
  price_floor_usd?: number;
  [field: string]: FactValue | undefined;
}

/** What a visitor must show before gated facts are released. */
export interface Requirements {
  identity_verified?: boolean;
  funds_usd_at_least?: number;
  /** Id of the NDA to accept, for example "standard-v1". */
  nda?: string;
}

export interface OfferConfig {
  id: string;
  title: string;
  /** Anyone may be told. */
  public?: Facts;
  /** Released only after the visitor meets the requirements. */
  gated?: Facts;
  /** Never released to anyone. */
  private?: PrivateFacts;
  requirements?: Requirements;
  blind_match?: { enabled?: boolean };
  booking?: { requires_overlap?: boolean };
}

/** One business's config. See businesses/*.json. */
export interface BusinessConfig {
  slug: string;
  _note?: string;
  business: { name: string; kind: string; summary: string };
  /** Open call slots, as ISO date-times. */
  availability?: string[];
  offers: OfferConfig[];
}

export interface FrontDoorOptions {
  business: BusinessConfig;
  /** An Arbiter instance or an HttpArbiterClient. */
  arbiter: ArbiterApi;
  /** Where a visitor's agent reaches the arbiter. */
  arbiterUrl: string;
  trustedIssuers: TrustedIssuers;
  now?: () => number;
}

export interface ManifestAction {
  method: 'POST';
  href: string;
}

export interface PriceDimension {
  key: 'price';
  unit: 'USD';
}

export interface ManifestOffer {
  id: string;
  title: string;
  public: Facts;
  gated_fields: string[];
  requirements: Requirements;
  blind_match: { enabled: true; dimensions: PriceDimension[]; visitor_role: 'at_most' } | { enabled: false };
  booking: { requires_overlap: boolean };
}

/** What any visitor may know before saying who they are. */
export interface Manifest {
  protocol: string;
  business: { name: string; kind: string; summary: string };
  accepted_profile_issuers: string[];
  actions: { ask: ManifestAction; qualify: ManifestAction; blind_match: ManifestAction; book: ManifestAction };
  offers: ManifestOffer[];
}

export interface AskInput {
  offerId: string;
  fields?: string[];
  question?: string;
  /** From qualify(). Unlocks gated fields. */
  session?: string | null;
  /** Where the owner can answer something the door could not. */
  replyTo?: string;
  /**
   * Send the question to the owner even if the door answered part of it.
   * Keyword matching can miss the point of a question, so a visitor can always
   * ask for a person.
   */
  forOwner?: boolean;
}

export interface AnsweredField {
  field: string;
  status: 'answered';
  value: FactValue;
}

export interface GatedField {
  field: string;
  status: 'gated';
  /** Names of the requirements to meet first. */
  requires: string[];
}

/** The door will not or cannot say. Private and unknown fields both get this. */
export interface UnavailableField {
  field: string;
  status: 'not_available';
}

export type Answer = AnsweredField | GatedField | UnavailableField;

export interface Escalation {
  status: 'escalated';
  message: string;
}

export interface AskResult {
  offer_id: string;
  answers: Answer[];
  escalated?: Escalation;
}

export interface AccessRequestInput {
  offerId: string;
  name: string;
  email: string;
  message?: string;
}

export interface AccessRequestResult {
  status: 'received';
  message: string;
}

export interface QualifyInput {
  offerId: string;
  /** Signed profile token (lib/profile.ts). */
  profile: string;
  /** Agreements the agent accepts for its principal. */
  accept?: { nda?: string };
}

/** Who accepted the NDA, when, and on what authority. */
export interface NdaRecord {
  id: string;
  accepted_at: string;
  by_agent: string;
  for_principal: string;
  authority: string;
  profile_issuer: string;
}

export interface Qualified {
  status: 'qualified';
  /** Session token. Pass it to ask, startBlindMatch and book. */
  session: string;
  expires_at: string;
  /** The gated facts. */
  released: Facts;
  next: string[];
}

export interface NotQualified {
  status: 'not_qualified';
  missing: string[];
  detail?: string;
}

export type QualifyResult = Qualified | NotQualified;

export interface SessionInput {
  /** Session token from qualify(). */
  session: string;
}

export interface BlindMatchInfo {
  status: 'opened';
  /** Where the visitor's agent sends its own limit. */
  arbiter: { url: string; session_id: string; token: string };
  your_role: 'at_most';
  dimensions: PriceDimension[];
  note: string;
}

export interface BlindMatchStatus {
  status: SessionStatus;
  outcome: Outcome | null;
}

export interface BookInput {
  session: string;
  /** One of the open slots, copied exactly. Leave out to list them. */
  slot?: string;
}

export interface SlotChoices {
  status: 'choose_slot';
  slots: string[];
}

export interface Booked {
  status: 'booked';
  slot: string;
  with: string;
}

export type BookResult = SlotChoices | Booked;

export type DoorEventType = 'asked' | 'question_for_owner' | 'access_requested' | 'not_qualified' | 'qualified' | 'blind_match_opened' | 'blind_match_result' | 'booked';

/** One line of the owner's log. */
export interface DoorEvent {
  at: string;
  type: DoorEventType;
  offer_id: string;
  principal: string | null;
  agent: string | null;
  detail: Record<string, unknown>;
}

/** One line per qualified visitor. */
export interface Lead {
  principal: Principal;
  agent: string;
  offer_id: string;
  verified: Verified;
  nda: NdaRecord | null;
  blind_match: Outcome | 'pending' | 'not_run';
  call: string | null;
}

/** The owner's view. */
export interface Inbox {
  business: string;
  leads: Lead[];
  events: DoorEvent[];
}

/** What the door remembers about a qualified visitor. */
interface VisitorSession {
  offerId: string;
  principal: Principal;
  agent: AgentAuthority;
  verified: Verified;
  nda: NdaRecord | null;
  expiresAt: number;
  blind: { sessionId: string; sellerToken: string; buyerToken: string; outcome: Outcome | null } | null;
  booking: { slot: string } | null;
}

/** Enough of a visitor to name them in the log. */
interface Named {
  principal?: Principal;
  agent?: AgentAuthority;
}

export class FrontDoorError extends Error {
  status: number;
  code: string;
  extra: Record<string, unknown>;

  constructor(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export const PROTOCOL = 'front-door/0.1';
const WEEK = 7 * 86400000;

// Plain-words questions mapped to fact keys. This is keyword matching, on
// purpose: it is predictable and cannot be talked into anything. A language
// model can sit in front of it to turn free text into fields, but the decision
// about what may be released stays in the rules below.
const VOCAB: [field: string, words: string[]][] = [
  ['asking_price_usd', ['asking price', 'price', 'how much', 'cost']],
  // Wording that asks for the seller's limit. These are phrases, not single
  // words, so "at least 10 employees" or "the shop floor" do not match.
  ['price_floor_usd', ['lowest', 'floor price', 'price floor', 'floor on the price', 'bottom line', 'walk away', 'walk-away', 'rock bottom', 'minimum price', 'least the', 'least they', 'least he', 'least she', 'would accept', 'will accept', 'willing to accept', 'willing to take', 'really take', 'actually take', 'take less']],
  ['revenue_usd', ['revenue', 'sales', 'top line', 'gross']],
  ['sde_usd', ['sde', 'cash flow', 'owner earnings', 'earnings', 'profit', 'ebitda']],
  ['employees', ['employees', 'staff', 'headcount', 'how many people']],
  ['region', ['where', 'location', 'located', 'region', 'what area', 'which state', 'city']],
  ['industry', ['industry', 'what kind', 'type of business', 'what does it do']],
  ['years_in_business', ['how long', 'how old', 'established', 'founded', 'years in business']],
  ['reason_for_sale', ['why', 'reason for', 'selling because']],
  ['real_estate_included', ['real estate', 'property', 'building', 'lease']],
  ['financing', ['sba', 'financing', 'seller note', 'seller financing', 'loan']],
  ['owner_role', ['owner involved', 'owner role', 'owner work', 'absentee', 'owner do']],
  ['business_name', ['name of the business', 'business name', 'which company', 'company name']],
  ['customer_concentration', ['customer concentration', 'largest customer', 'top customer', 'biggest customer']],
  ['financials_summary', ['financials', 'p&l', 'tax returns', 'statements', 'the books']],
];

// Fields that plain-word questions may reach for but no door ever releases.
// A question that matches one of these gets "not available" for it and
// nothing else, whether or not this offer has such a value. That way the
// reply never reveals that a limit exists, and "what is the lowest price?"
// is never answered with the asking price just because it says "price".
const RESERVED = new Set(['price_floor_usd']);

/** The question is untrusted text. It is only searched for known words. */
export function fieldsForQuestion(question: unknown): string[] {
  const q = String(question || '').toLowerCase();
  const found: string[] = [];
  for (const [key, words] of VOCAB) {
    if (words.some((w) => q.includes(w))) found.push(key);
  }
  return found;
}

/**
 * The door checks every argument itself, so its methods take unchecked input.
 * The interfaces above (AskInput and so on) say what a caller should send.
 */
export class FrontDoor {
  #business: BusinessConfig;
  #arbiter: ArbiterApi;
  #arbiterUrl: string;
  #issuers: TrustedIssuers;
  #now: () => number;
  #sessions = new Map<string, VisitorSession>();
  #events: DoorEvent[] = [];
  #taken = new Set<string>();

  constructor({ business, arbiter, arbiterUrl, trustedIssuers, now = Date.now }: FrontDoorOptions) {
    if (!business?.slug || !Array.isArray(business.offers)) throw new Error('business config needs a slug and offers');
    this.#business = business;
    this.#arbiter = arbiter;
    this.#arbiterUrl = arbiterUrl;
    this.#issuers = trustedIssuers || {};
    this.#now = now;
  }

  get slug(): string {
    return this.#business.slug;
  }

  /** What any visitor may know before saying who they are. */
  manifest(): Manifest {
    const b = this.#business;
    const base = '/b/' + b.slug;
    return {
      protocol: PROTOCOL,
      business: { name: b.business.name, kind: b.business.kind, summary: b.business.summary },
      accepted_profile_issuers: Object.keys(this.#issuers),
      actions: {
        ask: { method: 'POST', href: base + '/ask' },
        qualify: { method: 'POST', href: base + '/qualify' },
        blind_match: { method: 'POST', href: base + '/blind-match' },
        book: { method: 'POST', href: base + '/book' },
      },
      offers: b.offers.map((o) => ({
        id: o.id,
        title: o.title,
        public: { ...o.public },
        gated_fields: Object.keys(o.gated || {}),
        requirements: { ...(o.requirements || {}) },
        blind_match: o.blind_match?.enabled ? { enabled: true, dimensions: [{ key: 'price', unit: 'USD' }], visitor_role: 'at_most' } : { enabled: false },
        booking: { requires_overlap: Boolean(o.booking?.requires_overlap) },
      })),
    };
  }

  /** Ask for facts, by field name or in plain words. See AskInput. */
  ask({ offerId, fields, question, session, replyTo, forOwner }: Unchecked<AskInput>): AskResult {
    const offer = this.#offer(offerId);
    const visitor = session ? this.#session(session, offerId) : null;
    const listed: unknown[] = Array.isArray(fields) ? fields : [];
    const fromQuestion = fieldsForQuestion(question);
    const reserved = fromQuestion.filter((field) => RESERVED.has(field));
    // A question about a reserved field is answered for that field alone.
    // Fields asked for by name are each answered on their own.
    const wanted = reserved.length ? reserved : [...new Set([...listed, ...fromQuestion])].filter((f): f is string => typeof f === 'string');
    const requires = Object.keys(offer.requirements || {});

    const answers: Answer[] = wanted.map((field) => {
      if (RESERVED.has(field)) return { field, status: 'not_available' };
      if (Object.hasOwn(offer.public || {}, field)) return { field, status: 'answered', value: (offer.public || {})[field] };
      if (Object.hasOwn(offer.gated || {}, field)) {
        return visitor ? { field, status: 'answered', value: (offer.gated || {})[field] } : { field, status: 'gated', requires };
      }
      // Private fields and fields this offer does not have look the same.
      return { field, status: 'not_available' };
    });

    let escalated: Escalation | null = null;
    if (question && (forOwner || answers.every((a) => a.status === 'not_available'))) {
      escalated = { status: 'escalated', message: 'This was passed to the owner. Give a reply address to get an answer.' };
      // The question text is untrusted input. It is stored for a person to read
      // and must never be treated as an instruction by anything that reads the log.
      this.#log('question_for_owner', offer.id, visitor, { question: String(question).slice(0, 500), reply_to: replyTo ? String(replyTo).slice(0, 200) : null });
    }
    this.#log('asked', offer.id, visitor, { fields: wanted });
    return { offer_id: offer.id, answers, ...(escalated ? { escalated } : {}) };
  }

  /**
   * A person (not an agent) asks to be considered. During the pilot a human
   * checks their paperwork and issues a profile by hand, so this only records
   * the request for the owner. Everything in it is untrusted input.
   */
  requestAccess({ offerId, name, email, message }: Unchecked<AccessRequestInput>): AccessRequestResult {
    const offer = this.#offer(offerId);
    const clean = (v: unknown, max: number): string => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
    const e = clean(email, 200);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new FrontDoorError(400, 'bad_email', 'A working email address is needed so the broker can reply.');
    const n = clean(name, 120);
    if (!n) throw new FrontDoorError(400, 'bad_name', 'Please give your name.');
    this.#log('access_requested', offer.id, null, { name: n, email: e, message: clean(message, 1000) });
    return { status: 'received', message: 'Your request was passed to the broker.' };
  }

  /** Check a visitor against the owner's requirements. See QualifyInput. */
  qualify({ offerId, profile, accept }: Unchecked<QualifyInput>): QualifyResult {
    const offer = this.#offer(offerId);
    const req = offer.requirements || {};
    let p: ProfilePayload;
    try {
      p = verifyProfile(profile, this.#issuers, this.#now());
    } catch (err) {
      if (err instanceof ProfileError) return { status: 'not_qualified', missing: ['valid_profile'], detail: err.message };
      throw err;
    }

    const missing: string[] = [];
    if (req.identity_verified && !p.verified?.identity) missing.push('identity_verified');
    if (req.funds_usd_at_least != null && !((p.verified?.funds_usd_at_least ?? -1) >= req.funds_usd_at_least)) missing.push('funds_usd_at_least');
    let nda: NdaRecord | null = null;
    if (req.nda) {
      const may = Array.isArray(p.agent?.may) && p.agent.may.includes('sign_nda:' + req.nda);
      const accepted = isRecord(accept) ? accept.nda : undefined;
      if (accepted !== req.nda) missing.push('nda_not_accepted');
      else if (!may) missing.push('agent_may_not_sign_nda');
      else nda = { id: req.nda, accepted_at: new Date(this.#now()).toISOString(), by_agent: p.agent.id, for_principal: p.principal.id, authority: 'sign_nda:' + req.nda, profile_issuer: p.iss };
    }

    if (missing.length) {
      this.#log('not_qualified', offer.id, { principal: p.principal, agent: p.agent }, { missing });
      return { status: 'not_qualified', missing };
    }

    const token = randomBytes(24).toString('hex');
    const visitor: VisitorSession = { offerId: offer.id, principal: p.principal, agent: p.agent, verified: p.verified, nda, expiresAt: Math.min(p.exp, this.#now() + WEEK), blind: null, booking: null };
    this.#sessions.set(token, visitor);
    this.#log('qualified', offer.id, visitor, { verified: p.verified, nda });
    return { status: 'qualified', session: token, expires_at: new Date(visitor.expiresAt).toISOString(), released: { ...(offer.gated || {}) }, next: ['blind_match', 'book'] };
  }

  /**
   * Open a blind price check. The door submits the owner's floor to the arbiter
   * straight away; the visitor's agent submits its ceiling to the arbiter itself.
   * The door never sees the visitor's number.
   */
  async startBlindMatch({ session }: Unchecked<SessionInput>): Promise<BlindMatchInfo> {
    const visitor = this.#session(session);
    const offer = this.#offer(visitor.offerId);
    const floor = offer.private?.price_floor_usd;
    if (!offer.blind_match?.enabled || floor == null) throw new FrontDoorError(409, 'blind_match_off', 'The owner has not turned on the blind price check for this offer.');
    if (!visitor.agent.may?.includes('blind_match')) throw new FrontDoorError(403, 'agent_may_not', 'This agent is not allowed to run a blind price check for its principal.');
    if (visitor.blind) return this.#blindInfo(visitor.blind);

    const sellerId = 'seller:' + this.slug + '/' + offer.id;
    let created: CreatedSession;
    try {
      created = await this.#arbiter.createSession({
        dealRef: this.slug + '/' + offer.id,
        parties: [{ id: visitor.principal.id, role: 'at_most' }, { id: sellerId, role: 'at_least' }],
        dimensions: [{ key: 'price', unit: 'USD' }],
      });
    } catch (err) {
      const code = isRecord(err) ? err.code : undefined;
      if (code === 'cooldown' || code === 'session_open') throw new FrontDoorError(429, 'blind_match_unavailable', 'A blind price check for this buyer and offer was already run. It cannot be repeated yet.');
      throw err;
    }
    await this.#arbiter.submit({ sessionId: created.sessionId, token: created.tokens[sellerId], values: { price: floor } });
    visitor.blind = { sessionId: created.sessionId, sellerToken: created.tokens[sellerId], buyerToken: created.tokens[visitor.principal.id], outcome: null };
    this.#log('blind_match_opened', offer.id, visitor, {});
    return this.#blindInfo(visitor.blind);
  }

  /** Outcome of the blind price check, as the door sees it: yes, no, or not yet. */
  async blindMatchStatus({ session }: Unchecked<SessionInput>): Promise<BlindMatchStatus> {
    const visitor = this.#session(session);
    if (!visitor.blind) throw new FrontDoorError(409, 'no_blind_match', 'No blind price check has been opened in this session.');
    const r = await this.#arbiter.result({ sessionId: visitor.blind.sessionId, token: visitor.blind.sellerToken });
    if (r.status === 'complete' && !visitor.blind.outcome) {
      visitor.blind.outcome = r.outcome;
      this.#log('blind_match_result', visitor.offerId, visitor, { outcome: r.outcome });
    }
    return { status: r.status, outcome: r.outcome };
  }

  /** Book an intro call in one of the owner's open slots. */
  async book({ session, slot }: Unchecked<BookInput>): Promise<BookResult> {
    const visitor = this.#session(session);
    const offer = this.#offer(visitor.offerId);
    if (!visitor.agent.may?.includes('book_call')) throw new FrontDoorError(403, 'agent_may_not', 'This agent is not allowed to book calls for its principal.');
    // The door learns the blind check outcome only by asking the arbiter. Ask
    // now, so a visitor who already read the result there is not turned away.
    if (offer.booking?.requires_overlap && visitor.blind && !visitor.blind.outcome) await this.blindMatchStatus({ session });
    if (offer.booking?.requires_overlap && visitor.blind?.outcome !== 'overlap') {
      throw new FrontDoorError(409, 'overlap_required', 'The owner takes calls on this offer only after a blind price check shows a deal is possible.');
    }
    if (visitor.booking) return { status: 'booked', slot: visitor.booking.slot, with: this.#business.business.name };
    const open = (this.#business.availability || []).filter((s) => !this.#taken.has(s) && Date.parse(s) > this.#now());
    if (!slot) return { status: 'choose_slot', slots: open };
    if (typeof slot !== 'string' || !open.includes(slot)) throw new FrontDoorError(409, 'slot_unavailable', 'That time is not open.', { slots: open });
    this.#taken.add(slot);
    visitor.booking = { slot };
    this.#log('booked', offer.id, visitor, { slot });
    return { status: 'booked', slot, with: this.#business.business.name };
  }

  /** The owner's view: every event, and one line per qualified visitor. */
  inbox(): Inbox {
    const leads = [...this.#sessions.values()].map((v): Lead => ({
      principal: v.principal,
      agent: v.agent.id,
      offer_id: v.offerId,
      verified: v.verified,
      nda: v.nda,
      blind_match: v.blind ? v.blind.outcome || 'pending' : 'not_run',
      call: v.booking ? v.booking.slot : null,
    }));
    return { business: this.#business.business.name, leads, events: this.#events.map((e) => ({ ...e })) };
  }

  #blindInfo(blind: NonNullable<VisitorSession['blind']>): BlindMatchInfo {
    return {
      status: 'opened',
      arbiter: { url: this.#arbiterUrl, session_id: blind.sessionId, token: blind.buyerToken },
      your_role: 'at_most',
      dimensions: [{ key: 'price', unit: 'USD' }],
      note: 'Send your limit to the arbiter, not to this door. Both sides learn only whether a deal is possible. One check per buyer per offer.',
    };
  }

  #offer(id: unknown): OfferConfig {
    const offer = this.#business.offers.find((o) => o.id === id);
    if (!offer) throw new FrontDoorError(404, 'no_such_offer', 'No such offer at this door.');
    return offer;
  }

  #session(token: unknown, offerId?: unknown): VisitorSession {
    const v = typeof token === 'string' ? this.#sessions.get(token) : null;
    if (!v || v.expiresAt <= this.#now() || (offerId && v.offerId !== offerId)) throw new FrontDoorError(401, 'bad_session', 'Session is missing, expired, or for a different offer. Qualify again.');
    return v;
  }

  #log(type: DoorEventType, offerId: string, visitor: Named | null, detail: Record<string, unknown>): void {
    this.#events.push({ at: new Date(this.#now()).toISOString(), type, offer_id: offerId, principal: visitor?.principal?.id || null, agent: visitor?.agent?.id || null, detail });
  }
}
