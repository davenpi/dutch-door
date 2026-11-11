import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FrontDoorError, fieldsForQuestion } from '../frontdoor/core.js';
import { generateIssuerKeys, issueProfile, verifyProfile, ProfileError } from '../lib/profile.js';
import { setup, OFFER, FLOOR, BEFORE_SLOTS } from './helpers.js';

const code = (c) => (err) => err instanceof FrontDoorError && err.code === c;
const qualified = (ctx, over) => ctx.door.qualify({ offerId: OFFER, profile: ctx.profile(over), accept: { nda: 'standard-v1' } });

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
  assert.deepEqual(byField.answers.map((a) => a.value), [3200000, 19]);
  const plain = door.ask({ offerId: OFFER, question: 'Why is the owner selling, and how many employees are there?' });
  assert.deepEqual(plain.answers.map((a) => a.field).sort(), ['employees', 'reason_for_sale']);
});

test('gated facts are held back until the visitor qualifies', () => {
  const ctx = setup();
  const before = ctx.door.ask({ offerId: OFFER, fields: ['business_name'] });
  assert.equal(before.answers[0].status, 'gated');
  assert.deepEqual(before.answers[0].requires, ['identity_verified', 'funds_usd_at_least', 'nda']);
  const q = qualified(ctx);
  assert.equal(q.status, 'qualified');
  assert.equal(q.released.business_name, 'Fictional Comfort Heating and Air, Inc.');
  const after = ctx.door.ask({ offerId: OFFER, fields: ['business_name'], session: q.session });
  assert.equal(after.answers[0].value, 'Fictional Comfort Heating and Air, Inc.');
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

test('a question the door cannot answer goes to the owner', () => {
  const { door } = setup();
  const r = door.ask({ offerId: OFFER, question: 'Is the crew part of a union?', replyTo: 'agent@buyer.example' });
  assert.equal(r.escalated.status, 'escalated');
  const event = door.inbox().events.find((e) => e.type === 'question_for_owner');
  assert.equal(event.detail.reply_to, 'agent@buyer.example');
  // A visitor can also ask for a person when the door answered only part of it.
  const partial = door.ask({ offerId: OFFER, question: 'How many employees are licensed in two states?', forOwner: true });
  assert.equal(partial.answers[0].field, 'employees');
  assert.equal(partial.escalated.status, 'escalated');
  assert.equal(door.inbox().events.filter((e) => e.type === 'question_for_owner').length, 2);
});

test('qualification fails with the reasons the owner published', () => {
  const ctx = setup();
  assert.deepEqual(ctx.door.qualify({ offerId: OFFER, profile: ctx.profile(), accept: {} }).missing, ['nda_not_accepted']);
  assert.deepEqual(qualified(ctx, { verified: { identity: true, funds_usd_at_least: 100000 } }).missing, ['funds_usd_at_least']);
  assert.deepEqual(qualified(ctx, { verified: { identity: false, funds_usd_at_least: 400000 } }).missing, ['identity_verified']);
  assert.deepEqual(qualified(ctx, { agent: { id: 'agent:x', may: ['book_call'] } }).missing, ['agent_may_not_sign_nda']);
});

test('a forged, foreign or expired profile does not qualify', () => {
  const ctx = setup();
  const other = generateIssuerKeys();
  const forged = issueProfile({ issuer: 'test-issuer', privateKey: other.privateKey, principal: { id: 'x', name: 'x', kind: 'person' }, verified: { identity: true, funds_usd_at_least: 9e9 }, agent: { id: 'a', may: ['sign_nda:standard-v1'] }, now: BEFORE_SLOTS });
  assert.deepEqual(ctx.door.qualify({ offerId: OFFER, profile: forged, accept: { nda: 'standard-v1' } }).missing, ['valid_profile']);
  const foreign = issueProfile({ issuer: 'someone-else', privateKey: other.privateKey, principal: { id: 'x', name: 'x', kind: 'person' }, verified: { identity: true }, agent: { id: 'a', may: [] }, now: BEFORE_SLOTS });
  assert.deepEqual(ctx.door.qualify({ offerId: OFFER, profile: foreign, accept: { nda: 'standard-v1' } }).missing, ['valid_profile']);
  assert.deepEqual(qualified(ctx, { ttlMs: -1 }).missing, ['valid_profile']);
  assert.deepEqual(ctx.door.qualify({ offerId: OFFER, profile: 'garbage', accept: { nda: 'standard-v1' } }).missing, ['valid_profile']);
});

test('a tampered profile fails verification', () => {
  const keys = generateIssuerKeys();
  const token = issueProfile({ issuer: 'i', privateKey: keys.privateKey, principal: { id: 'p', name: 'p', kind: 'person' }, verified: { identity: true, funds_usd_at_least: 1 }, agent: { id: 'a', may: [] } });
  const [body, sig] = token.split('.');
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
  payload.verified.funds_usd_at_least = 5_000_000;
  const tampered = Buffer.from(JSON.stringify(payload)).toString('base64url') + '.' + sig;
  assert.throws(() => verifyProfile(tampered, { i: keys.publicKey }), (e) => e instanceof ProfileError && e.code === 'bad_signature');
  assert.equal(verifyProfile(token, { i: keys.publicKey }).principal.id, 'p');
});

test('the NDA acceptance is recorded with who, when and on what authority', () => {
  const ctx = setup();
  qualified(ctx);
  const lead = ctx.door.inbox().leads[0];
  assert.equal(lead.nda.id, 'standard-v1');
  assert.equal(lead.nda.for_principal, 'buyer:acme-holdings');
  assert.equal(lead.nda.by_agent, 'agent:acme-1');
  assert.equal(lead.nda.authority, 'sign_nda:standard-v1');
});

test('blind match: the buyer submits to the arbiter, and the door learns only yes or no', async () => {
  for (const [ceiling, expected] of [[3000000, 'overlap'], [2500000, 'no_overlap']]) {
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
