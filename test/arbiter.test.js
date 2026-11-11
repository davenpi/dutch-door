import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Arbiter, ArbiterError, commitmentFor } from '../arbiter/core.js';

const parties = [
  { id: 'buyer:nottoway', role: 'at_most' },
  { id: 'seller:listing-1', role: 'at_least' },
];

function run(arbiter, most, least, dealRef = 'deal-1') {
  const s = arbiter.createSession({ dealRef, parties });
  arbiter.submit({ sessionId: s.sessionId, token: s.tokens['buyer:nottoway'], values: { price: most } });
  arbiter.submit({ sessionId: s.sessionId, token: s.tokens['seller:listing-1'], values: { price: least } });
  return { s, result: arbiter.result({ sessionId: s.sessionId, token: s.tokens['buyer:nottoway'] }) };
}

const code = (c) => (err) => err instanceof ArbiterError && err.code === c;

test('overlap when the buyer ceiling is above the seller floor', () => {
  assert.equal(run(new Arbiter(), 2_400_000, 2_100_000).result.outcome, 'overlap');
});

test('overlap at exactly equal limits', () => {
  assert.equal(run(new Arbiter(), 2_000_000, 2_000_000).result.outcome, 'overlap');
});

test('no overlap when the ceiling is below the floor', () => {
  assert.equal(run(new Arbiter(), 1_800_000, 2_100_000).result.outcome, 'no_overlap');
});

test('both parties see the same outcome and nothing else', () => {
  const a = new Arbiter();
  const { s } = run(a, 2_400_000, 2_100_000);
  const buyer = a.result({ sessionId: s.sessionId, token: s.tokens['buyer:nottoway'] });
  const seller = a.result({ sessionId: s.sessionId, token: s.tokens['seller:listing-1'] });
  assert.deepEqual(buyer, seller);
  assert.deepEqual(Object.keys(buyer).sort(), ['outcome', 'status', 'submitted']);
});

test('no outcome until both sides have submitted', () => {
  const a = new Arbiter();
  const s = a.createSession({ dealRef: 'deal-1', parties });
  const first = a.submit({ sessionId: s.sessionId, token: s.tokens['buyer:nottoway'], values: { price: 5 } });
  assert.equal(first.status, 'waiting');
  const r = a.result({ sessionId: s.sessionId, token: s.tokens['seller:listing-1'] });
  assert.equal(r.status, 'open');
  assert.equal(r.outcome, null);
  assert.deepEqual(r.submitted, { you: false, counterparty: true });
});

test('a submission cannot be changed', () => {
  const a = new Arbiter();
  const s = a.createSession({ dealRef: 'deal-1', parties });
  a.submit({ sessionId: s.sessionId, token: s.tokens['buyer:nottoway'], values: { price: 5 } });
  assert.throws(() => a.submit({ sessionId: s.sessionId, token: s.tokens['buyer:nottoway'], values: { price: 6 } }), code('already_submitted'));
});

test('the same pair cannot repeat the same deal during the cooldown', () => {
  let t = 1_000_000;
  const a = new Arbiter({ now: () => t, cooldownMs: 1000 });
  run(a, 1, 2);
  assert.throws(() => a.createSession({ dealRef: 'deal-1', parties }), code('cooldown'));
  // Swapping the order of the parties does not get around it.
  assert.throws(() => a.createSession({ dealRef: 'deal-1', parties: [...parties].reverse() }), code('cooldown'));
  // A different deal is fine.
  assert.ok(a.createSession({ dealRef: 'deal-2', parties }).sessionId);
  // And the same deal is fine once the cooldown has passed.
  t += 1001;
  assert.ok(a.createSession({ dealRef: 'deal-1', parties }).sessionId);
});

test('only one open check per pair and deal', () => {
  const a = new Arbiter();
  a.createSession({ dealRef: 'deal-1', parties });
  assert.throws(() => a.createSession({ dealRef: 'deal-1', parties }), code('session_open'));
});

test('a wrong token gets nothing', () => {
  const a = new Arbiter();
  const s = a.createSession({ dealRef: 'deal-1', parties });
  assert.throws(() => a.result({ sessionId: s.sessionId, token: 'nope' }), code('not_found'));
  assert.throws(() => a.submit({ sessionId: s.sessionId, token: 'nope', values: { price: 1 } }), code('not_found'));
});

test('bad values are refused', () => {
  const a = new Arbiter();
  const s = a.createSession({ dealRef: 'deal-1', parties });
  const token = s.tokens['buyer:nottoway'];
  for (const values of [{ price: -1 }, { price: '5' }, { price: NaN }, { price: Infinity }, {}, { price: 1, extra: 2 }, null, [1]]) {
    assert.throws(() => a.submit({ sessionId: s.sessionId, token, values }), code('bad_request'));
  }
});

test('an unfinished check expires', () => {
  let t = 0;
  const a = new Arbiter({ now: () => t, sessionTtlMs: 100 });
  const s = a.createSession({ dealRef: 'deal-1', parties });
  a.submit({ sessionId: s.sessionId, token: s.tokens['buyer:nottoway'], values: { price: 5 } });
  t = 101;
  assert.throws(() => a.submit({ sessionId: s.sessionId, token: s.tokens['seller:listing-1'], values: { price: 4 } }), code('expired'));
  assert.equal(a.result({ sessionId: s.sessionId, token: s.tokens['buyer:nottoway'] }).status, 'expired');
});

test('with several dimensions, every one must overlap and the failing one is not named', () => {
  const dims = [{ key: 'price', unit: 'USD' }, { key: 'seller_note_pct' }];
  const a = new Arbiter();
  const s = a.createSession({ dealRef: 'deal-1', parties, dimensions: dims });
  a.submit({ sessionId: s.sessionId, token: s.tokens['buyer:nottoway'], values: { price: 3_000_000, seller_note_pct: 5 } });
  a.submit({ sessionId: s.sessionId, token: s.tokens['seller:listing-1'], values: { price: 2_500_000, seller_note_pct: 10 } });
  const r = a.result({ sessionId: s.sessionId, token: s.tokens['buyer:nottoway'] });
  assert.equal(r.outcome, 'no_overlap');
  assert.equal(JSON.stringify(r).includes('seller_note_pct'), false);
});

test('the audit log never contains a submitted number', () => {
  const a = new Arbiter();
  run(a, 2_417_333, 2_103_777);
  const text = JSON.stringify(a.audit());
  assert.equal(text.includes('2417333'), false);
  assert.equal(text.includes('2103777'), false);
  assert.ok(a.audit().some((e) => e.event === 'completed' && e.outcome === 'overlap'));
});

test('a receipt reproduces the commitment in the audit log', () => {
  const a = new Arbiter();
  const s = a.createSession({ dealRef: 'deal-1', parties });
  const { receipt } = a.submit({ sessionId: s.sessionId, token: s.tokens['buyer:nottoway'], values: { price: 2_400_000 } });
  assert.equal(commitmentFor({ price: 2_400_000 }, receipt.salt), receipt.commitment);
  assert.notEqual(commitmentFor({ price: 2_400_001 }, receipt.salt), receipt.commitment);
  assert.ok(a.audit().some((e) => e.event === 'submitted' && e.commitment === receipt.commitment));
});

test('session setup is validated', () => {
  const a = new Arbiter();
  assert.throws(() => a.createSession({ dealRef: '', parties }), code('bad_request'));
  assert.throws(() => a.createSession({ dealRef: 'd', parties: [parties[0]] }), code('bad_request'));
  assert.throws(() => a.createSession({ dealRef: 'd', parties: [parties[0], { id: 'x', role: 'at_most' }] }), code('bad_request'));
  assert.throws(() => a.createSession({ dealRef: 'd', parties: [parties[0], { id: parties[0].id, role: 'at_least' }] }), code('bad_request'));
  assert.throws(() => a.createSession({ dealRef: 'd', parties, dimensions: [{ key: 'a' }, { key: 'a' }] }), code('bad_request'));
});
