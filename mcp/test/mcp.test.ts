// The whole flow through MCP: the SDK's own client over Streamable HTTP, this
// folder's MCP server, a front door, and an arbiter server on its own port.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Arbiter } from '../../arbiter/core.js';
import { createArbiterServer, HttpArbiterClient } from '../../arbiter/server.js';
import { FrontDoor } from '../../frontdoor/core.js';
import { generateIssuerKeys, issueProfile } from '../../lib/profile.js';
import { listen } from '../../lib/http.js';
import { business, OFFER, FLOOR, BEFORE_SLOTS } from '../../test/helpers.js';
import { createMcpHttpServer } from '../http.js';

const TOOLS = ['ask', 'blind_match_result', 'book', 'get_manifest', 'qualify', 'start_blind_match', 'submit_limit'];
const LIMIT = 3050000; // Above the fictional floor.

async function start(t) {
  const now = () => BEFORE_SLOTS;
  const keys = generateIssuerKeys();
  const arbiter = new Arbiter({ now });
  const arbiterServer = createArbiterServer({ arbiter, creatorKeys: ['door-key'] });
  const arbiterUrl = 'http://127.0.0.1:' + (await listen(arbiterServer));
  const door = new FrontDoor({ business: business(), arbiter: new HttpArbiterClient({ url: arbiterUrl, creatorKey: 'door-key' }), arbiterUrl, trustedIssuers: { issuer: keys.publicKey }, now });
  const mcpServer = createMcpHttpServer({ doors: [door], arbiterPublicUrl: arbiterUrl });
  const mcpUrl = 'http://127.0.0.1:' + (await listen(mcpServer));

  const client = new Client({ name: 'test-buyer-agent', version: '0.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(mcpUrl + '/b/example-broker/mcp')));

  t.after(async () => {
    await client.close();
    mcpServer.close();
    arbiterServer.close();
    mcpServer.closeAllConnections();
    arbiterServer.closeAllConnections();
  });

  const profile = (over = {}) =>
    issueProfile({ issuer: 'issuer', privateKey: keys.privateKey, principal: { id: 'buyer:acme', name: 'Acme (fictional)', kind: 'company' }, verified: { identity: true, funds_usd_at_least: 500000 }, agent: { id: 'agent:acme', may: ['sign_nda:standard-v1', 'blind_match', 'book_call'] }, now: now(), ...over });

  /** Call a tool and return { isError, data } where data is the JSON in the text content. */
  const call = async (name, args = {}) => {
    const result = await client.callTool({ name, arguments: args });
    assert.equal(result.content.length, 1);
    assert.equal(result.content[0].type, 'text');
    let data;
    try {
      data = JSON.parse(result.content[0].text);
    } catch {
      data = null; // The SDK's own input validation errors are plain text.
    }
    if (data !== null) assert.deepEqual(result.structuredContent, data, 'structured content matches the text');
    return { isError: result.isError === true, data, text: result.content[0].text };
  };

  return { client, call, profile, door, arbiter, arbiterUrl, mcpUrl };
}

test('buyer agent to booked call, over MCP', async (t) => {
  const { client, call, profile, door, arbiter, arbiterUrl } = await start(t);

  // 0. The tools are there, each with a description and an object schema.
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((x) => x.name).sort(), TOOLS);
  for (const tool of tools) {
    assert.ok(tool.description.length > 40, tool.name + ' has a description');
    assert.equal(tool.inputSchema.type, 'object');
  }
  const submitSchema = tools.find((x) => x.name === 'submit_limit').inputSchema;
  assert.deepEqual([...submitSchema.required].sort(), ['arbiter_url', 'price', 'session_id', 'token']);
  assert.match(client.getInstructions(), /get_manifest/);

  // 1. Discover.
  const manifest = await call('get_manifest');
  assert.equal(manifest.isError, false);
  assert.equal(manifest.data.protocol, 'front-door/0.1');
  assert.equal(manifest.data.offers[0].id, OFFER);

  // 2. Ask. Gated facts stay gated until the visitor qualifies.
  const asked = await call('ask', { offer_id: OFFER, question: 'What is the asking price and the cash flow?', fields: ['business_name'] });
  assert.equal(asked.isError, false);
  assert.deepEqual(asked.data.answers.map((a) => [a.field, a.status]), [['business_name', 'gated'], ['asking_price_usd', 'answered'], ['sde_usd', 'answered']]);
  assert.deepEqual(asked.data.answers.slice(1).map((a) => a.value), [3200000, 1050000]);

  // 3. Qualify. Without the NDA it is a normal answer, not an error.
  const notYet = await call('qualify', { offer_id: OFFER, profile: profile() });
  assert.equal(notYet.isError, false);
  assert.deepEqual(notYet.data, { status: 'not_qualified', missing: ['nda_not_accepted'] });
  const q = await call('qualify', { offer_id: OFFER, profile: profile(), accept_nda: 'standard-v1' });
  assert.equal(q.data.status, 'qualified');
  const session = q.data.session;
  const gated = await call('ask', { offer_id: OFFER, fields: ['business_name'], session });
  assert.equal(gated.data.answers[0].status, 'answered');

  // Booking is closed until the blind check shows an overlap.
  const early = await call('book', { session });
  assert.equal(early.isError, true);
  assert.equal(early.data.error.code, 'overlap_required');

  // 4. Blind match. The limit goes to the arbiter through submit_limit.
  const opened = await call('start_blind_match', { session });
  assert.equal(opened.isError, false);
  assert.equal(opened.data.arbiter_url, arbiterUrl);
  assert.match(opened.data.next, /submit_limit/);
  const where = { arbiter_url: opened.data.arbiter_url, session_id: opened.data.session_id, token: opened.data.token };

  const pending = await call('blind_match_result', where);
  assert.equal(pending.data.status, 'open');
  assert.deepEqual(pending.data.submitted, { you: false, counterparty: true });

  const submitted = await call('submit_limit', { ...where, price: LIMIT });
  assert.equal(submitted.isError, false);
  assert.equal(submitted.data.status, 'complete');
  assert.equal(typeof submitted.data.receipt.commitment, 'string');

  const again = await call('submit_limit', { ...where, price: LIMIT + 1 });
  assert.equal(again.isError, true);
  assert.equal(again.data.error.code, 'closed');

  const result = await call('blind_match_result', where);
  assert.equal(result.isError, false);
  assert.equal(result.data.status, 'complete');
  assert.equal(result.data.outcome, 'overlap');

  // 5. Book.
  const slots = await call('book', { session });
  assert.equal(slots.data.status, 'choose_slot');
  assert.equal(slots.data.slots.length, 3);
  const taken = await call('book', { session, slot: '2031-03-09T09:00:00-05:00' });
  assert.equal(taken.isError, true);
  assert.equal(taken.data.error.code, 'slot_unavailable');
  assert.deepEqual(taken.data.error.slots, slots.data.slots);
  const booked = await call('book', { session, slot: slots.data.slots[1] });
  assert.equal(booked.isError, false);
  assert.deepEqual(booked.data, { status: 'booked', slot: slots.data.slots[1], with: 'Example Business Brokers (fictional)' });

  // 6. The owner sees the lead. Neither number is in the door's log or the arbiter's.
  const inbox = door.inbox();
  assert.equal(inbox.leads[0].blind_match, 'overlap');
  assert.equal(inbox.leads[0].call, slots.data.slots[1]);
  for (const text of [JSON.stringify(inbox), JSON.stringify(arbiter.audit())]) {
    assert.equal(text.includes(String(LIMIT)), false);
    assert.equal(text.includes(String(FLOOR)), false);
  }
});

test('submit_limit and blind_match_result refuse any other arbiter_url', async (t) => {
  const { call, profile, arbiter, arbiterUrl } = await start(t);

  // A second server that records what reaches it. Nothing should.
  const hits = [];
  const other = createArbiterServer({ arbiter: new Arbiter(), creatorKeys: [] });
  other.on('request', (req) => hits.push(req.url));
  const otherUrl = 'http://127.0.0.1:' + (await listen(other));
  t.after(() => other.close());

  const q = await call('qualify', { offer_id: OFFER, profile: profile(), accept_nda: 'standard-v1' });
  const opened = await call('start_blind_match', { session: q.data.session });
  const where = { session_id: opened.data.session_id, token: opened.data.token };

  for (const url of [otherUrl, arbiterUrl + '/v2', arbiterUrl + '?x=1', arbiterUrl.replace('http://', 'http://user@'), 'not a url']) {
    const refused = await call('submit_limit', { ...where, arbiter_url: url, price: LIMIT });
    assert.equal(refused.isError, true, url);
    assert.equal(refused.data.error.code, 'arbiter_url_not_allowed');
    assert.ok(refused.data.error.message.includes(arbiterUrl), 'the error names the allowed address');
    assert.equal(refused.data.error.allowed_arbiter_url, arbiterUrl);
    const read = await call('blind_match_result', { ...where, arbiter_url: url });
    assert.equal(read.isError, true, url);
    assert.equal(read.data.error.code, 'arbiter_url_not_allowed');
  }
  assert.deepEqual(hits, []);

  // A session id that tries to walk to another path is stopped by the schema.
  const walk = await call('submit_limit', { ...where, arbiter_url: arbiterUrl, session_id: '../audit', price: LIMIT });
  assert.equal(walk.isError, true);

  // None of that used up the visitor's one submission. A trailing slash is the same address.
  assert.equal(arbiter.audit().filter((e) => e.event === 'submitted').length, 1);
  const submitted = await call('submit_limit', { ...where, arbiter_url: arbiterUrl + '/', price: FLOOR - 1 });
  assert.equal(submitted.isError, false);
  const result = await call('blind_match_result', { ...where, arbiter_url: arbiterUrl });
  assert.equal(result.data.outcome, 'no_overlap');
});

test('bad input comes back as a tool error, not a thrown error or a stack trace', async (t) => {
  const { call, arbiterUrl, mcpUrl } = await start(t);

  for (const [name, args] of [
    ['start_blind_match', { session: 'nope' }],
    ['book', { session: 'nope' }],
    ['ask', { offer_id: OFFER, fields: ['business_name'], session: 'nope' }],
  ]) {
    const out = await call(name, args);
    assert.equal(out.isError, true, name);
    assert.equal(out.data.error.code, 'bad_session');
    assert.match(out.data.error.message, /Qualify again/);
    assert.deepEqual(Object.keys(out.data.error).sort(), ['code', 'message']);
  }

  const noOffer = await call('ask', { offer_id: 'nothing-here', question: 'price?' });
  assert.equal(noOffer.isError, true);
  assert.equal(noOffer.data.error.code, 'no_such_offer');

  const badProfile = await call('qualify', { offer_id: OFFER, profile: 'garbage' });
  assert.equal(badProfile.isError, false);
  assert.deepEqual(badProfile.data.missing, ['valid_profile']);

  // Arbiter errors keep the arbiter's code.
  const wrongToken = await call('submit_limit', { arbiter_url: arbiterUrl, session_id: 'abc123', token: 'wrong', price: 1 });
  assert.equal(wrongToken.isError, true);
  assert.equal(wrongToken.data.error.code, 'not_found');
  const wrongRead = await call('blind_match_result', { arbiter_url: arbiterUrl, session_id: 'abc123', token: 'wrong' });
  assert.equal(wrongRead.isError, true);
  assert.equal(wrongRead.data.error.code, 'not_found');

  // Arguments that do not fit the schema are refused before any tool code runs.
  for (const [name, args] of [
    ['submit_limit', { arbiter_url: arbiterUrl, session_id: 'abc123', token: 't', price: 'a lot' }],
    ['submit_limit', { arbiter_url: arbiterUrl, session_id: 'abc123', token: 't', price: -5 }],
    ['ask', { question: 'no offer id' }],
    ['ask', { offer_id: OFFER, fields: 'business_name' }],
  ]) {
    const out = await call(name, args);
    assert.equal(out.isError, true, name);
    assert.match(out.text, /Invalid arguments/);
    assert.doesNotMatch(out.text, /\n\s+at /, 'no stack trace');
  }

  // Outside MCP: unknown doors and other methods get plain HTTP errors.
  const nobody = await fetch(mcpUrl + '/b/nobody/mcp', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(nobody.status, 404);
  assert.equal((await nobody.json()).error.code, 'no_such_door');
  assert.equal((await fetch(mcpUrl + '/b/example-broker/mcp')).status, 405);
  assert.equal((await fetch(mcpUrl + '/b/example-broker')).status, 404);
});
