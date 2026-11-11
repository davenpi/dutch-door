// Run with: npm run demo
//
// Three buyers' agents arrive at one broker's front door, over real HTTP.
// One gets a call. Two do not, and the broker spends no time on them.
// Everything here is fictional: the broker, the listing, the buyers, the numbers.
import fs from 'node:fs';
import { Arbiter } from '../arbiter/core.ts';
import type { AuditEntry } from '../arbiter/core.ts';
import { createArbiterServer, HttpArbiterClient } from '../arbiter/server.ts';
import { FrontDoor } from '../frontdoor/core.ts';
import type { AskResult, BlindMatchInfo, BlindMatchStatus, Booked, BusinessConfig, Inbox, QualifyResult, SlotChoices } from '../frontdoor/core.ts';
import { createFrontDoorServer } from '../frontdoor/server.ts';
import { generateIssuerKeys, issueProfile } from '../lib/profile.ts';
import { listen } from '../lib/http.ts';

const money = (n: number): string => '$' + n.toLocaleString('en-US');
const say = (who: string, text: string): void => console.log(('  ' + who).padEnd(16) + text);
const rule = (title: string): void => console.log('\n' + title + '\n' + '-'.repeat(title.length));

// T is the answer the demo expects from that path. The demo talks only to the
// two servers it started itself.
async function call<T>(base: string, method: 'GET' | 'POST', path: string, body?: object | null, key?: string): Promise<T> {
  const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(key ? { authorization: 'Bearer ' + key } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return (await res.json()) as T;
}

// The demo listing has call slots in 2031, so the clock is set just before them.
const now = () => Date.parse('2031-03-01T12:00:00-05:00');
const business = JSON.parse(fs.readFileSync(new URL('../frontdoor/businesses/example-broker.json', import.meta.url), 'utf8')) as BusinessConfig;
const offer = business.offers[0];
const issuer = generateIssuerKeys();

const arbiterServer = createArbiterServer({ arbiter: new Arbiter({ now }), creatorKeys: ['demo-door-key'] });
const arbiterUrl = 'http://127.0.0.1:' + (await listen(arbiterServer));
const door = new FrontDoor({ business, arbiter: new HttpArbiterClient({ url: arbiterUrl, creatorKey: 'demo-door-key' }), arbiterUrl, trustedIssuers: { 'demo-verifier': issuer.publicKey }, now });
const doorServer = createFrontDoorServer({ doors: [door], ownerKeys: { [business.slug]: 'demo-owner-key' } });
const doorUrl = 'http://127.0.0.1:' + (await listen(doorServer));
const base = '/b/' + business.slug;

console.log('Front door demo. All names and numbers are fictional.');
console.log('Listing: ' + offer.title + ', asking ' + money(Number(offer.public?.asking_price_usd)) + '.');
console.log("The seller's private floor is known only to the broker's door and, briefly, the arbiter.");

const buyers = [
  { name: 'Buyer A', id: 'buyer:a', funds: 500000, ceiling: 3050000, question: 'What is the asking price, the cash flow, and why is the owner selling?' },
  { name: 'Buyer B', id: 'buyer:b', funds: 60000, ceiling: 3300000, question: 'How much is it and is SBA financing possible?' },
  { name: 'Buyer C', id: 'buyer:c', funds: 450000, ceiling: 2400000, question: 'How many employees, and is real estate included?' },
];

for (const b of buyers) {
  rule(b.name + "'s agent (verified funds of at least " + money(b.funds) + ', private ceiling ' + money(b.ceiling) + ')');

  const asked = await call<AskResult>(doorUrl, 'POST', base + '/ask', { offer_id: offer.id, question: b.question });
  say('agent asks', b.question);
  for (const a of asked.answers) {
    const value = a.status === 'answered' ? a.value : undefined;
    say('door answers', a.field + ': ' + (typeof value === 'number' && a.field.endsWith('_usd') ? money(value) : value));
  }

  const gated = await call<AskResult>(doorUrl, 'POST', base + '/ask', { offer_id: offer.id, fields: ['business_name'] });
  const held = gated.answers[0];
  say('agent asks', 'What is the name of the business?');
  say('door answers', 'Held back. Requires: ' + (held.status === 'gated' ? held.requires : []).join(', ') + '.');

  const profile = issueProfile({
    issuer: 'demo-verifier',
    privateKey: issuer.privateKey,
    principal: { id: b.id, name: b.name + ' (fictional)', kind: 'company' },
    verified: { identity: true, funds_usd_at_least: b.funds },
    agent: { id: 'agent:' + b.id, may: ['sign_nda:standard-v1', 'blind_match', 'book_call'] },
    now: now(),
  });
  const q = await call<QualifyResult>(doorUrl, 'POST', base + '/qualify', { offer_id: offer.id, profile, accept: { nda: 'standard-v1' } });
  say('agent', 'Presents its verified profile and accepts the standard NDA.');
  if (q.status !== 'qualified') {
    say('door', 'Not qualified. Missing: ' + q.missing.join(', ') + '. Nothing confidential is released.');
    continue;
  }
  say('door', 'Qualified. Releases the business name: ' + q.released.business_name);

  const opened = await call<BlindMatchInfo>(doorUrl, 'POST', base + '/blind-match', { session: q.session });
  say('door', "Opens a blind price check and seals the seller's floor with the arbiter.");
  await call<unknown>(opened.arbiter.url, 'POST', `/v1/sessions/${opened.arbiter.session_id}/submissions`, { token: opened.arbiter.token, values: { price: b.ceiling } });
  say('agent', "Seals the buyer's ceiling with the arbiter. The door never sees it.");
  const result = await call<BlindMatchStatus>(doorUrl, 'POST', base + '/blind-match/status', { session: q.session });
  say('arbiter', result.outcome === 'overlap' ? 'A deal is possible.' : 'No overlap.');

  if (result.outcome !== 'overlap') {
    say('door', 'No call is booked. Neither side learned the other number.');
    continue;
  }
  const slots = await call<SlotChoices>(doorUrl, 'POST', base + '/book', { session: q.session });
  const booked = await call<Booked>(doorUrl, 'POST', base + '/book', { session: q.session, slot: slots.slots[0] });
  say('door', 'Books an intro call: ' + booked.slot);
}

rule("What the broker sees in the morning (the owner's inbox)");
const inbox = await call<Inbox>(doorUrl, 'GET', base + '/inbox', null, 'demo-owner-key');
const turnedAway = inbox.events.filter((e) => e.type === 'not_qualified').length;
console.log('  ' + buyers.length + ' buyers came to the door. ' + turnedAway + ' did not meet your requirements and got nothing confidential.');
for (const lead of inbox.leads) {
  const price = lead.blind_match === 'overlap' ? 'a deal is possible' : 'no overlap on price';
  console.log('  ' + lead.principal.name + ': identity verified, funds of at least ' + money(lead.verified.funds_usd_at_least ?? 0) + ', NDA accepted, ' + price + (lead.call ? ', call booked for ' + lead.call : ', no call booked') + '.');
}

rule('What the arbiter remembers (its whole audit log for the last check)');
const audit = await call<{ entries: AuditEntry[] }>(arbiterUrl, 'GET', '/v1/audit', null, 'demo-door-key');
for (const e of audit.entries.slice(-4)) console.log('  ' + e.at + '  ' + e.event.padEnd(11) + (e.party || '').padEnd(40) + (e.outcome || (e.commitment ? 'commitment ' + e.commitment.slice(0, 12) + '...' : '')));
console.log('  There are no prices in it.');

arbiterServer.close();
doorServer.close();
