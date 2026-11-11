import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Arbiter } from '../arbiter/core.ts';
import type { Outcome } from '../arbiter/core.ts';
import { FrontDoor, FrontDoorError, fieldsForQuestion } from '../frontdoor/core.ts';
import type { Answer, FactValue, Qualified, QualifyResult } from '../frontdoor/core.ts';
import { generateIssuerKeys, issueProfile, verifyProfile, ProfileError } from '../lib/profile.ts';
import type { IssueProfileInput, ProfilePayload } from '../lib/profile.ts';
import { setup, business, OFFER, FLOOR, BEFORE_SLOTS } from './helpers.ts';
import type { TestContext } from './helpers.ts';

const code = (c: string) => (err: unknown): boolean => err instanceof FrontDoorError && err.code === c;
const qualify = (ctx: TestContext, over?: Partial<IssueProfileInput>): QualifyResult => ctx.door.qualify({ offerId: OFFER, profile: ctx.profile(over), accept: { nda: 'standard-v1' } });
/** Qualify, and fail the test if the door says no. */
function qualified(ctx: TestContext, over?: Partial<IssueProfileInput>): Qualified {
  const q = qualify(ctx, over);
  if (q.status !== 'qualified') assert.fail('expected to qualify, missing: ' + q.missing.join(', '));
  return q;
}
const missing = (q: QualifyResult): string[] | undefined => (q.status === 'not_qualified' ? q.missing : undefined);
const value = (a: Answer): FactValue | undefined => (a.status === 'answered' ? a.value : undefined);
const requires = (a: Answer): string[] | undefined => (a.status === 'gated' ? a.requires : undefined);

test('the manifest lists public facts and never the private floor or gated values', () => {
  const { door } = setup();
  const text = JSON.stringify(door.manifest());
  assert.ok(text.includes('3200000'));
  assert.equal(text.includes(String(FLOOR)), false);
  assert.equal(text.includes('Fictional Comfort'), false);
  assert.deepEqual(door.manifest().offers[0].gated_fields, ['business_name', 'customer_concentration', 'financials_summary']);
});

test('public facts are answered by field and in plain words', () => {
  const { door } = setup();
  const byField = door.ask({ offerId: OFFER, fields: ['asking_price_usd', 'employees'] });
  assert.deepEqual(byField.answers.map(value), [3200000, 19]);
  const plain = door.ask({ offerId: OFFER, question: 'Why is the owner selling, and how many employees are there?' });
  assert.deepEqual(plain.answers.map((a) => a.field).sort(), ['employees', 'reason_for_sale']);
});

test('gated facts are held back until the visitor qualifies', () => {
  const ctx = setup();
  const before = ctx.door.ask({ offerId: OFFER, fields: ['business_name'] });
  assert.equal(before.answers[0].status, 'gated');
  assert.deepEqual(requires(before.answers[0]), ['identity_verified', 'funds_usd_at_least', 'nda']);
  const q = qualified(ctx);
  assert.equal(q.status, 'qualified');
  assert.equal(q.released.business_name, 'Fictional Comfort Heating and Air, Inc.');
  const after = ctx.door.ask({ offerId: OFFER, fields: ['business_name'], session: q.session });
  assert.equal(value(after.answers[0]), 'Fictional Comfort Heating and Air, Inc.');
});

test('the private floor cannot be asked for, even by a qualified visitor', () => {
  const ctx = setup();
  const q = qualified(ctx);
  for (const session of [undefined, q.session]) {
    const r = ctx.door.ask({ offerId: OFFER, fields: ['price_floor_usd', 'private', 'private.price_floor_usd'], question: 'What is the lowest price the seller will take?', session });
    assert.equal(JSON.stringify(r).includes(String(FLOOR)), false);
    assert.ok(r.answers.filter((a) => a.field.includes('floor') || a.field.includes('private')).every((a) => a.status === 'not_available'));
  }
});

test('a question about the seller\'s limit gets no asking price and no floor, qualified or not', () => {
  const ctx = setup();
  const q = qualified(ctx);
  for (const session of [undefined, q.session]) {
    const r = ctx.door.ask({ offerId: OFFER, question: 'What is the lowest price the seller will take?', session });
    // The word "price" is in the question, but the public asking price must not come back as if it were the answer.
    assert.deepEqual(r.answers, [{ field: 'price_floor_usd', status: 'not_available' }]);
    const text = JSON.stringify(r);
    assert.equal(text.includes('3200000'), false);
    assert.equal(text.includes(String(FLOOR)), false);
    // Like any question the door cannot answer, it goes to the owner.
    assert.equal(r.escalated?.status, 'escalated');
  }
});

test('floor-style wording is caught however it is put, and takes over the whole reply', () => {
  const ctx = setup();
  const q = qualified(ctx);
  const questions = [
    'Is there a floor on the price?',
    'What is the least the owner would accept for it?',
    'What is the bottom line on price?',
    'At what price does the seller walk away?',
    'What is the minimum price?',
    'What is the rock bottom cost, and what is the revenue?',
  ];
  for (const question of questions) {
    assert.ok(fieldsForQuestion(question).includes('price_floor_usd'), question);
    for (const session of [undefined, q.session]) {
      const r = ctx.door.ask({ offerId: OFFER, question, session });
      assert.deepEqual(r.answers, [{ field: 'price_floor_usd', status: 'not_available' }], question);
      assert.equal(JSON.stringify(r).includes(String(FLOOR)), false, question);
    }
  }
});

test('fields asked for by name are answered one by one, and a private one looks like a missing one', () => {
  const { door } = setup();
  const r = door.ask({ offerId: OFFER, fields: ['asking_price_usd', 'price_floor_usd', 'no_such_field'] });
  assert.deepEqual(r.answers, [
    { field: 'asking_price_usd', status: 'answered', value: 3200000 },
    { field: 'price_floor_usd', status: 'not_available' },
    { field: 'no_such_field', status: 'not_available' },
  ]);
});

test('a floor question gets the same reply whether or not the offer has a floor', () => {
  const withFloor = setup().door.ask({ offerId: OFFER, question: 'What is the lowest price the seller will take?' });
  const config = business();
  delete config.offers[0]!.private;
  const bare = new FrontDoor({ business: config, arbiter: new Arbiter(), arbiterUrl: 'http://arbiter.test', trustedIssuers: {} });
  const withoutFloor = bare.ask({ offerId: OFFER, question: 'What is the lowest price the seller will take?' });
  assert.deepEqual(withoutFloor, withFloor);
});

test('ordinary wording is not mistaken for a floor question', () => {
  assert.deepEqual(fieldsForQuestion('Do they have at least 10 employees?'), ['employees']);
  assert.deepEqual(fieldsForQuestion('What is on the shop floor?'), []);
  assert.deepEqual(fieldsForQuestion('Is there a minimum order size?'), []);
});

test('a private field and a field that does not exist get the same answer', () => {
  const { door } = setup();
  const hidden = door.ask({ offerId: OFFER, fields: ['price_floor_usd'] });
  const unknown = door.ask({ offerId: OFFER, fields: ['no_such_field'] });
  assert.deepEqual(hidden, { offer_id: OFFER, answers: [{ field: 'price_floor_usd', status: 'not_available' }] });
  assert.deepEqual(unknown, { offer_id: OFFER, answers: [{ field: 'no_such_field', status: 'not_available' }] });
});

test('an ordinary price question still returns the asking price', () => {
  const { door } = setup();
  for (const question of ['What is the asking price?', 'How much is it?', 'What does it cost?']) {
    const r = door.ask({ offerId: OFFER, question });
    assert.deepEqual(r, { offer_id: OFFER, answers: [{ field: 'asking_price_usd', status: 'answered', value: 3200000 }] }, question);
  }
});

test('a question the door cannot answer goes to the owner', () => {
  const { door } = setup();
  const r = door.ask({ offerId: OFFER, question: 'Is the crew part of a union?', replyTo: 'agent@buyer.example' });
  assert.equal(r.escalated?.status, 'escalated');
  const event = door.inbox().events.find((e) => e.type === 'question_for_owner');
  assert.equal(event?.detail.reply_to, 'agent@buyer.example');
  // A visitor can also ask for a person when the door answered only part of it.
  const partial = door.ask({ offerId: OFFER, question: 'How many employees are licensed in two states?', forOwner: true });
  assert.equal(partial.answers[0].field, 'employees');
  assert.equal(partial.escalated?.status, 'escalated');
  assert.equal(door.inbox().events.filter((e) => e.type === 'question_for_owner').length, 2);
});

test('qualification fails with the reasons the owner published', () => {
  const ctx = setup();
  assert.deepEqual(missing(ctx.door.qualify({ offerId: OFFER, profile: ctx.profile(), accept: {} })), ['nda_not_accepted']);
  assert.deepEqual(missing(qualify(ctx, { verified: { identity: true, funds_usd_at_least: 100000 } })), ['funds_usd_at_least']);
  assert.deepEqual(missing(qualify(ctx, { verified: { identity: false, funds_usd_at_least: 400000 } })), ['identity_verified']);
  assert.deepEqual(missing(qualify(ctx, { agent: { id: 'agent:x', may: ['book_call'] } })), ['agent_may_not_sign_nda']);
});

test('a forged, foreign or expired profile does not qualify', () => {
  const ctx = setup();
  const other = generateIssuerKeys();
  const forged = issueProfile({ issuer: 'test-issuer', privateKey: other.privateKey, principal: { id: 'x', name: 'x', kind: 'person' }, verified: { identity: true, funds_usd_at_least: 9e9 }, agent: { id: 'a', may: ['sign_nda:standard-v1'] }, now: BEFORE_SLOTS });
  assert.deepEqual(missing(ctx.door.qualify({ offerId: OFFER, profile: forged, accept: { nda: 'standard-v1' } })), ['valid_profile']);
  const foreign = issueProfile({ issuer: 'someone-else', privateKey: other.privateKey, principal: { id: 'x', name: 'x', kind: 'person' }, verified: { identity: true }, agent: { id: 'a', may: [] }, now: BEFORE_SLOTS });
  assert.deepEqual(missing(ctx.door.qualify({ offerId: OFFER, profile: foreign, accept: { nda: 'standard-v1' } })), ['valid_profile']);
  assert.deepEqual(missing(qualify(ctx, { ttlMs: -1 })), ['valid_profile']);
  assert.deepEqual(missing(ctx.door.qualify({ offerId: OFFER, profile: 'garbage', accept: { nda: 'standard-v1' } })), ['valid_profile']);
});

test('a tampered profile fails verification', () => {
  const keys = generateIssuerKeys();
  const token = issueProfile({ issuer: 'i', privateKey: keys.privateKey, principal: { id: 'p', name: 'p', kind: 'person' }, verified: { identity: true, funds_usd_at_least: 1 }, agent: { id: 'a', may: [] } });
  const [body, sig] = token.split('.');
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as ProfilePayload;
  payload.verified.funds_usd_at_least = 5_000_000;
  const tampered = Buffer.from(JSON.stringify(payload)).toString('base64url') + '.' + sig;
  assert.throws(() => verifyProfile(tampered, { i: keys.publicKey }), (e: unknown) => e instanceof ProfileError && e.code === 'bad_signature');
  assert.equal(verifyProfile(token, { i: keys.publicKey }).principal.id, 'p');
});

test('the NDA acceptance is recorded with who, when and on what authority', () => {
  const ctx = setup();
  qualified(ctx);
  const lead = ctx.door.inbox().leads[0];
  assert.equal(lead.nda?.id, 'standard-v1');
  assert.equal(lead.nda?.for_principal, 'buyer:acme-holdings');
  assert.equal(lead.nda?.by_agent, 'agent:acme-1');
  assert.equal(lead.nda?.authority, 'sign_nda:standard-v1');
});

test('blind match: the buyer submits to the arbiter, and the door learns only yes or no', async () => {
  const cases: [ceiling: number, expected: Outcome][] = [[3000000, 'overlap'], [2500000, 'no_overlap']];
  for (const [ceiling, expected] of cases) {
    const ctx = setup();
    const q = qualified(ctx);
    const opened = await ctx.door.startBlindMatch({ session: q.session });
    assert.equal(opened.your_role, 'at_most');
    assert.equal((await ctx.door.blindMatchStatus({ session: q.session })).status, 'open');
    ctx.arbiter.submit({ sessionId: opened.arbiter.session_id, token: opened.arbiter.token, values: { price: ceiling } });
    assert.deepEqual(await ctx.door.blindMatchStatus({ session: q.session }), { status: 'complete', outcome: expected });
    const inbox = JSON.stringify(ctx.door.inbox());
    assert.equal(inbox.includes(String(ceiling)), false);
    assert.equal(inbox.includes(String(FLOOR)), false);
    assert.equal(ctx.door.inbox().leads[0].blind_match, expected);
  }
});

test('blind match cannot be rerun by the same buyer on the same offer', async () => {
  const ctx = setup();
  const first = qualified(ctx);
  const opened = await ctx.door.startBlindMatch({ session: first.session });
  ctx.arbiter.submit({ sessionId: opened.arbiter.session_id, token: opened.arbiter.token, values: { price: 2000000 } });
  const second = qualified(ctx); // same buyer, fresh session
  await assert.rejects(() => ctx.door.startBlindMatch({ session: second.session }), code('blind_match_unavailable'));
});

test('an agent without the authority cannot run a blind match or book', async () => {
  const ctx = setup();
  const q = qualified(ctx, { agent: { id: 'agent:limited', may: ['sign_nda:standard-v1'] } });
  await assert.rejects(() => ctx.door.startBlindMatch({ session: q.session }), code('agent_may_not'));
  await assert.rejects(() => ctx.door.book({ session: q.session }), code('agent_may_not'));
});

test('booking waits for an overlap when the owner requires one, then takes a slot once', async () => {
  const ctx = setup();
  const q = qualified(ctx);
  await assert.rejects(() => ctx.door.book({ session: q.session }), code('overlap_required'));
  const opened = await ctx.door.startBlindMatch({ session: q.session });
  await assert.rejects(() => ctx.door.book({ session: q.session }), code('overlap_required'));
  ctx.arbiter.submit({ sessionId: opened.arbiter.session_id, token: opened.arbiter.token, values: { price: 3000000 } });
  // No explicit status call here: book asks the arbiter itself.
  const choices = await ctx.door.book({ session: q.session });
  assert.equal(choices.status, 'choose_slot');
  assert.equal(choices.slots.length, 3);
  await assert.rejects(() => ctx.door.book({ session: q.session, slot: '2031-01-01T00:00:00Z' }), code('slot_unavailable'));
  const booked = await ctx.door.book({ session: q.session, slot: choices.slots[0] });
  assert.equal(booked.status, 'booked');
  assert.equal(ctx.door.inbox().leads[0].call, choices.slots[0]);
});

test('sessions are required, expire, and are tied to one offer', async () => {
  let t = BEFORE_SLOTS;
  const ctx = setup({ now: () => t });
  await assert.rejects(() => ctx.door.startBlindMatch({ session: 'nope' }), code('bad_session'));
  const q = qualified(ctx);
  t += 8 * 86400000;
  assert.throws(() => ctx.door.ask({ offerId: OFFER, fields: ['business_name'], session: q.session }), code('bad_session'));
  assert.throws(() => ctx.door.ask({ offerId: 'other', fields: [] }), code('no_such_offer'));
});

test('plain-word questions map to the expected fields', () => {
  assert.deepEqual(fieldsForQuestion('What is the asking price?'), ['asking_price_usd']);
  assert.deepEqual(fieldsForQuestion('Is real estate included?'), ['real_estate_included']);
  assert.deepEqual(fieldsForQuestion('Tell me about SBA financing'), ['financing']);
  assert.deepEqual(fieldsForQuestion('xyzzy'), []);
});
