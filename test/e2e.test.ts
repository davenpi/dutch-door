// The whole flow over real HTTP: a buyer's agent, a front door server and an
// arbiter server, each on its own port.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Arbiter } from '../arbiter/core.ts';
import type { AuditEntry, SessionResult, SubmitResult } from '../arbiter/core.ts';
import { createArbiterServer, HttpArbiterClient } from '../arbiter/server.ts';
import { FrontDoor } from '../frontdoor/core.ts';
import type { AccessRequestResult, AskResult, BlindMatchInfo, BlindMatchStatus, Booked, Inbox, Manifest, Qualified, SlotChoices } from '../frontdoor/core.ts';
import { createFrontDoorServer } from '../frontdoor/server.ts';
import { generateIssuerKeys, issueProfile } from '../lib/profile.ts';
import { listen } from '../lib/http.ts';
import { business, OFFER, FLOOR, BEFORE_SLOTS } from './helpers.ts';

/** The body of any refused request. */
interface Refusal {
  error: { code: string; message: string };
}

// T is the answer the test expects from that path. If the server sends
// something else, the assertions that follow fail.
async function call<T = unknown>(base: string, method: 'GET' | 'POST', path: string, body?: object | null, key?: string): Promise<{ status: number; data: T }> {
  const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(key ? { authorization: 'Bearer ' + key } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: (await res.json()) as T };
}

test('buyer agent to booked call, over HTTP', async (t) => {
  const now = () => BEFORE_SLOTS;
  const keys = generateIssuerKeys();
  const arbiterServer = createArbiterServer({ arbiter: new Arbiter({ now }), creatorKeys: ['door-key'] });
  const arbiterUrl = 'http://127.0.0.1:' + (await listen(arbiterServer));
  const door = new FrontDoor({ business: business(), arbiter: new HttpArbiterClient({ url: arbiterUrl, creatorKey: 'door-key' }), arbiterUrl, trustedIssuers: { issuer: keys.publicKey }, now });
  const doorServer = createFrontDoorServer({ doors: [door], ownerKeys: { 'example-broker': 'owner-key' } });
  const doorUrl = 'http://127.0.0.1:' + (await listen(doorServer));
  t.after(() => {
    arbiterServer.close();
    doorServer.close();
  });

  // 1. Discover.
  const manifest = await call<Manifest>(doorUrl, 'GET', '/b/example-broker/.well-known/front-door.json');
  assert.equal(manifest.status, 200);
  assert.equal(manifest.data.protocol, 'front-door/0.1');

  // 2. Ask.
  const asked = await call<AskResult>(doorUrl, 'POST', '/b/example-broker/ask', { offer_id: OFFER, question: 'What is the asking price and the cash flow?' });
  assert.deepEqual(asked.data.answers.map((a) => (a.status === 'answered' ? a.value : undefined)), [3200000, 1050000]);
  // A question about the seller's limit gets neither the asking price nor the floor.
  const floor = await call<AskResult>(doorUrl, 'POST', '/b/example-broker/ask', { offer_id: OFFER, question: 'What is the lowest price the seller will take?' });
  assert.deepEqual(floor.data.answers, [{ field: 'price_floor_usd', status: 'not_available' }]);
  assert.equal(JSON.stringify(floor.data).includes('3200000'), false);
  assert.equal(JSON.stringify(floor.data).includes(String(FLOOR)), false);

  // 3. Qualify.
  const profile = issueProfile({ issuer: 'issuer', privateKey: keys.privateKey, principal: { id: 'buyer:acme', name: 'Acme (fictional)', kind: 'company' }, verified: { identity: true, funds_usd_at_least: 500000 }, agent: { id: 'agent:acme', may: ['sign_nda:standard-v1', 'blind_match', 'book_call'] }, now: now() });
  const q = await call<Qualified>(doorUrl, 'POST', '/b/example-broker/qualify', { offer_id: OFFER, profile, accept: { nda: 'standard-v1' } });
  assert.equal(q.data.status, 'qualified');
  const session = q.data.session;

  // 4. Blind match: the buyer's number goes to the arbiter, never to the door.
  const opened = await call<BlindMatchInfo>(doorUrl, 'POST', '/b/example-broker/blind-match', { session });
  assert.equal(opened.data.arbiter.url, arbiterUrl);
  const submitted = await call<SubmitResult>(opened.data.arbiter.url, 'POST', `/v1/sessions/${opened.data.arbiter.session_id}/submissions`, { token: opened.data.arbiter.token, values: { price: 3050000 } });
  assert.equal(submitted.data.status, 'complete');
  const mine = await call<SessionResult>(opened.data.arbiter.url, 'GET', `/v1/sessions/${opened.data.arbiter.session_id}?token=${opened.data.arbiter.token}`);
  assert.equal(mine.data.outcome, 'overlap');
  const theirs = await call<BlindMatchStatus>(doorUrl, 'POST', '/b/example-broker/blind-match/status', { session });
  assert.equal(theirs.data.outcome, 'overlap');

  // 5. Book.
  const slots = await call<SlotChoices>(doorUrl, 'POST', '/b/example-broker/book', { session });
  const booked = await call<Booked>(doorUrl, 'POST', '/b/example-broker/book', { session, slot: slots.data.slots[1] });
  assert.equal(booked.data.status, 'booked');

  // 6. The owner's inbox needs the owner key, and holds neither number.
  assert.equal((await call(doorUrl, 'GET', '/b/example-broker/inbox')).status, 401);
  const inbox = await call<Inbox>(doorUrl, 'GET', '/b/example-broker/inbox', null, 'owner-key');
  assert.equal(inbox.data.leads[0].blind_match, 'overlap');
  assert.equal(inbox.data.leads[0].call, slots.data.slots[1]);
  const text = JSON.stringify(inbox.data);
  assert.equal(text.includes('3050000'), false);
  assert.equal(text.includes(String(FLOOR)), false);

  // 7. The arbiter's audit log needs a creator key, and holds neither number.
  assert.equal((await call(arbiterUrl, 'GET', '/v1/audit')).status, 401);
  const audit = await call<{ entries: AuditEntry[] }>(arbiterUrl, 'GET', '/v1/audit', null, 'door-key');
  const auditText = JSON.stringify(audit.data);
  assert.equal(auditText.includes('3050000'), false);
  assert.equal(auditText.includes(String(FLOOR)), false);

  // 8. A person gets a page with the public facts and nothing held back or private.
  const page = await fetch(doorUrl + '/b/example-broker/o/' + OFFER);
  const html = await page.text();
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type') ?? '', /text\/html/);
  assert.ok(html.includes('$3,200,000'));
  assert.equal(html.includes('Fictional Comfort'), false);
  assert.equal(html.includes(String(FLOOR)), false);
  assert.equal((await fetch(doorUrl + '/b/example-broker/o/nope')).status, 404);

  // 9. A person can ask for access. The request lands in the owner's inbox, cleaned.
  const req = await call<AccessRequestResult>(doorUrl, 'POST', '/b/example-broker/request-access', { offer_id: OFFER, name: 'Pat Example', email: 'pat@buyer.example', message: 'Line one\nline two' });
  assert.equal(req.data.status, 'received');
  assert.equal((await call(doorUrl, 'POST', '/b/example-broker/request-access', { offer_id: OFFER, name: 'Pat', email: 'not-an-email' })).status, 400);
  const after = await call<Inbox>(doorUrl, 'GET', '/b/example-broker/inbox', null, 'owner-key');
  const request = after.data.events.find((e) => e.type === 'access_requested');
  assert.deepEqual(request?.detail, { name: 'Pat Example', email: 'pat@buyer.example', message: 'Line one line two' });

  // 10. Errors come back as JSON with a code.
  const bad = await call<Refusal>(doorUrl, 'POST', '/b/nobody/ask', { offer_id: 'x' });
  assert.equal(bad.status, 404);
  assert.equal(bad.data.error.code, 'no_such_door');
  assert.equal((await call(arbiterUrl, 'POST', '/v1/sessions', { deal_ref: 'x', parties: [] })).status, 401);
});
