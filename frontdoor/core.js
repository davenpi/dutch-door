// The front door: one per business. Outside agents (or people, through a form)
// can ask questions, get qualified against the owner's rules, run a blind
// price check, and book a call. The owner sees a log of all of it.
//
// This file is the logic. server.js wraps it in HTTP for many businesses.
//
// Three kinds of facts live in a business's config:
//   public   anyone may be told
//   gated    released only after the visitor meets the owner's requirements
//   private  never released to anyone; the only place a private limit goes is
//            the arbiter, as a sealed submission
import { randomBytes } from 'node:crypto';
import { verifyProfile, ProfileError } from '../lib/profile.js';

export class FrontDoorError extends Error {
  constructor(status, code, message, extra = {}) {
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
const VOCAB = [
  ['asking_price_usd', ['asking price', 'price', 'how much', 'cost']],
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

export function fieldsForQuestion(question) {
  const q = String(question || '').toLowerCase();
  const found = [];
  for (const [key, words] of VOCAB) {
    if (words.some((w) => q.includes(w))) found.push(key);
  }
  return found;
}

export class FrontDoor {
  #business;
  #arbiter;
  #arbiterUrl;
  #issuers;
  #now;
  #sessions = new Map();
  #events = [];
  #taken = new Set();

  /**
   * @param {object} o
   * @param {object} o.business         Parsed business config (see businesses/*.json).
   * @param {object} o.arbiter          Something with createSession, submit, result
   *                                    (an Arbiter instance or HttpArbiterClient).
   * @param {string} o.arbiterUrl       Where a visitor's agent reaches the arbiter.
   * @param {Record<string,string>} o.trustedIssuers  Profile issuer id -> public key PEM.
   * @param {() => number} [o.now]
   */
  constructor({ business, arbiter, arbiterUrl, trustedIssuers, now = Date.now }) {
    if (!business?.slug || !Array.isArray(business.offers)) throw new Error('business config needs a slug and offers');
    this.#business = business;
    this.#arbiter = arbiter;
    this.#arbiterUrl = arbiterUrl;
    this.#issuers = trustedIssuers || {};
    this.#now = now;
  }

  get slug() {
    return this.#business.slug;
  }

  /** What any visitor may know before saying who they are. */
  manifest() {
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

  /**
   * Ask for facts, by field name or in plain words.
   * @param {object} p
   * @param {string} p.offerId
   * @param {string[]} [p.fields]
   * @param {string} [p.question]
   * @param {string} [p.session]   From qualify(). Unlocks gated fields.
   * @param {string} [p.replyTo]   Where the owner can answer something the door could not.
   * @param {boolean} [p.forOwner] Send the question to the owner even if the door
   *   answered part of it. Keyword matching can miss the point of a question,
   *   so a visitor can always ask for a person.
   */
  ask({ offerId, fields, question, session, replyTo, forOwner }) {
    const offer = this.#offer(offerId);
    const visitor = session ? this.#session(session, offerId) : null;
    const wanted = [...new Set([...(Array.isArray(fields) ? fields : []), ...fieldsForQuestion(question)])].filter((f) => typeof f === 'string');
    const requires = Object.keys(offer.requirements || {});

    const answers = wanted.map((field) => {
      if (Object.hasOwn(offer.public || {}, field)) return { field, status: 'answered', value: offer.public[field] };
      if (Object.hasOwn(offer.gated || {}, field)) {
        return visitor ? { field, status: 'answered', value: offer.gated[field] } : { field, status: 'gated', requires };
      }
      // Private and unknown fields look the same from outside.
      return { field, status: 'not_available' };
    });

    let escalated = null;
    if (question && (forOwner || answers.every((a) => a.status === 'not_available'))) {
      escalated = { status: 'escalated', message: 'This was passed to the owner. Give a reply address to get an answer.' };
      // The question text is untrusted input. It is stored for a person to read
      // and must never be treated as an instruction by anything that reads the log.
      this.#log('question_for_owner', offerId, visitor, { question: String(question).slice(0, 500), reply_to: replyTo ? String(replyTo).slice(0, 200) : null });
    }
    this.#log('asked', offerId, visitor, { fields: wanted });
    return { offer_id: offerId, answers, ...(escalated ? { escalated } : {}) };
  }

  /**
   * A person (not an agent) asks to be considered. During the pilot a human
   * checks their paperwork and issues a profile by hand, so this only records
   * the request for the owner. Everything in it is untrusted input.
   */
  requestAccess({ offerId, name, email, message }) {
    this.#offer(offerId);
    const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
    const e = clean(email, 200);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new FrontDoorError(400, 'bad_email', 'A working email address is needed so the broker can reply.');
    const n = clean(name, 120);
    if (!n) throw new FrontDoorError(400, 'bad_name', 'Please give your name.');
    this.#log('access_requested', offerId, null, { name: n, email: e, message: clean(message, 1000) });
    return { status: 'received', message: 'Your request was passed to the broker.' };
  }

  /**
   * Check a visitor against the owner's requirements.
   * @param {object} p
   * @param {string} p.offerId
   * @param {string} p.profile   Signed profile token (lib/profile.js).
   * @param {{nda?:string}} [p.accept]  Agreements the agent accepts for its principal.
   */
  qualify({ offerId, profile, accept }) {
    const offer = this.#offer(offerId);
    const req = offer.requirements || {};
    let p;
    try {
      p = verifyProfile(profile, this.#issuers, this.#now());
    } catch (err) {
      if (err instanceof ProfileError) return { status: 'not_qualified', missing: ['valid_profile'], detail: err.message };
      throw err;
    }

    const missing = [];
    if (req.identity_verified && !p.verified?.identity) missing.push('identity_verified');
    if (req.funds_usd_at_least != null && !((p.verified?.funds_usd_at_least ?? -1) >= req.funds_usd_at_least)) missing.push('funds_usd_at_least');
    let nda = null;
    if (req.nda) {
      const may = Array.isArray(p.agent?.may) && p.agent.may.includes('sign_nda:' + req.nda);
      if (accept?.nda !== req.nda) missing.push('nda_not_accepted');
      else if (!may) missing.push('agent_may_not_sign_nda');
      else nda = { id: req.nda, accepted_at: new Date(this.#now()).toISOString(), by_agent: p.agent.id, for_principal: p.principal.id, authority: 'sign_nda:' + req.nda, profile_issuer: p.iss };
    }

    if (missing.length) {
      this.#log('not_qualified', offerId, { principal: p.principal, agent: p.agent }, { missing });
      return { status: 'not_qualified', missing };
    }

    const token = randomBytes(24).toString('hex');
    const visitor = { offerId, principal: p.principal, agent: p.agent, verified: p.verified, nda, expiresAt: Math.min(p.exp, this.#now() + WEEK), blind: null, booking: null };
    this.#sessions.set(token, visitor);
    this.#log('qualified', offerId, visitor, { verified: p.verified, nda });
    return { status: 'qualified', session: token, expires_at: new Date(visitor.expiresAt).toISOString(), released: { ...(offer.gated || {}) }, next: ['blind_match', 'book'] };
  }

  /**
   * Open a blind price check. The door submits the owner's floor to the arbiter
   * straight away; the visitor's agent submits its ceiling to the arbiter itself.
   * The door never sees the visitor's number.
   */
  async startBlindMatch({ session }) {
    const visitor = this.#session(session);
    const offer = this.#offer(visitor.offerId);
    if (!offer.blind_match?.enabled || offer.private?.price_floor_usd == null) throw new FrontDoorError(409, 'blind_match_off', 'The owner has not turned on the blind price check for this offer.');
    if (!visitor.agent.may?.includes('blind_match')) throw new FrontDoorError(403, 'agent_may_not', 'This agent is not allowed to run a blind price check for its principal.');
    if (visitor.blind) return this.#blindInfo(visitor);

    const sellerId = 'seller:' + this.slug + '/' + offer.id;
    let created;
    try {
      created = await this.#arbiter.createSession({
        dealRef: this.slug + '/' + offer.id,
        parties: [{ id: visitor.principal.id, role: 'at_most' }, { id: sellerId, role: 'at_least' }],
        dimensions: [{ key: 'price', unit: 'USD' }],
      });
    } catch (err) {
      if (err?.code === 'cooldown' || err?.code === 'session_open') throw new FrontDoorError(429, 'blind_match_unavailable', 'A blind price check for this buyer and offer was already run. It cannot be repeated yet.');
      throw err;
    }
    await this.#arbiter.submit({ sessionId: created.sessionId, token: created.tokens[sellerId], values: { price: offer.private.price_floor_usd } });
    visitor.blind = { sessionId: created.sessionId, sellerToken: created.tokens[sellerId], buyerToken: created.tokens[visitor.principal.id], outcome: null };
    this.#log('blind_match_opened', offer.id, visitor, {});
    return this.#blindInfo(visitor);
  }

  /** Outcome of the blind price check, as the door sees it: yes, no, or not yet. */
  async blindMatchStatus({ session }) {
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
  book({ session, slot }) {
    const visitor = this.#session(session);
    const offer = this.#offer(visitor.offerId);
    if (!visitor.agent.may?.includes('book_call')) throw new FrontDoorError(403, 'agent_may_not', 'This agent is not allowed to book calls for its principal.');
    if (offer.booking?.requires_overlap && visitor.blind?.outcome !== 'overlap') {
      throw new FrontDoorError(409, 'overlap_required', 'The owner takes calls on this offer only after a blind price check shows a deal is possible.');
    }
    if (visitor.booking) return { status: 'booked', slot: visitor.booking.slot, with: this.#business.business.name };
    const open = (this.#business.availability || []).filter((s) => !this.#taken.has(s) && Date.parse(s) > this.#now());
    if (!slot) return { status: 'choose_slot', slots: open };
    if (!open.includes(slot)) throw new FrontDoorError(409, 'slot_unavailable', 'That time is not open.', { slots: open });
    this.#taken.add(slot);
    visitor.booking = { slot };
    this.#log('booked', offer.id, visitor, { slot });
    return { status: 'booked', slot, with: this.#business.business.name };
  }

  /** The owner's view: every event, and one line per qualified visitor. */
  inbox() {
    const leads = [...this.#sessions.values()].map((v) => ({
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

  #blindInfo(visitor) {
    return {
      status: 'opened',
      arbiter: { url: this.#arbiterUrl, session_id: visitor.blind.sessionId, token: visitor.blind.buyerToken },
      your_role: 'at_most',
      dimensions: [{ key: 'price', unit: 'USD' }],
      note: 'Send your limit to the arbiter, not to this door. Both sides learn only whether a deal is possible. One check per buyer per offer.',
    };
  }

  #offer(id) {
    const offer = this.#business.offers.find((o) => o.id === id);
    if (!offer) throw new FrontDoorError(404, 'no_such_offer', 'No such offer at this door.');
    return offer;
  }

  #session(token, offerId) {
    const v = typeof token === 'string' ? this.#sessions.get(token) : null;
    if (!v || v.expiresAt <= this.#now() || (offerId && v.offerId !== offerId)) throw new FrontDoorError(401, 'bad_session', 'Session is missing, expired, or for a different offer. Qualify again.');
    return v;
  }

  #log(type, offerId, visitor, detail) {
    this.#events.push({ at: new Date(this.#now()).toISOString(), type, offer_id: offerId, principal: visitor?.principal?.id || null, agent: visitor?.agent?.id || null, detail });
  }
}
