// Run with: npm run serve:demo
//
// Starts an arbiter and a front door for the fictional example broker on your
// own machine, with throwaway keys, so you can click through the listing page
// and call the API by hand. Not for production: keys are printed, nothing is saved.
import fs from 'node:fs';
import { Arbiter } from '../arbiter/core.js';
import { createArbiterServer, HttpArbiterClient } from '../arbiter/server.js';
import { FrontDoor } from '../frontdoor/core.js';
import { createFrontDoorServer } from '../frontdoor/server.js';
import { generateIssuerKeys, issueProfile } from '../lib/profile.js';
import { listen } from '../lib/http.js';

// The example listing's call slots are in 2031; pretend it is just before them.
const now = () => Date.parse('2031-03-01T12:00:00-05:00');
const business = JSON.parse(fs.readFileSync(new URL('../frontdoor/businesses/example-broker.json', import.meta.url), 'utf8'));
const issuer = generateIssuerKeys();

const arbiterPort = await listen(createArbiterServer({ arbiter: new Arbiter({ now }), creatorKeys: ['local-door-key'] }), Number(process.env.ARBITER_PORT || 8787));
const arbiterUrl = 'http://127.0.0.1:' + arbiterPort;
const door = new FrontDoor({ business, arbiter: new HttpArbiterClient({ url: arbiterUrl, creatorKey: 'local-door-key' }), arbiterUrl, trustedIssuers: { 'local-verifier': issuer.publicKey }, now });
const doorPort = await listen(createFrontDoorServer({ doors: [door], ownerKeys: { [business.slug]: 'local-owner-key' } }), Number(process.env.PORT || 8788));
const doorUrl = 'http://127.0.0.1:' + doorPort;

const profile = issueProfile({
  issuer: 'local-verifier',
  privateKey: issuer.privateKey,
  principal: { id: 'buyer:local-test', name: 'Local Test Buyer (fictional)', kind: 'company' },
  verified: { identity: true, funds_usd_at_least: 500000 },
  agent: { id: 'agent:local-test', may: ['sign_nda:standard-v1', 'blind_match', 'book_call'] },
  now: now(),
});

console.log(`Listing page for a person:  ${doorUrl}/b/${business.slug}/o/${business.offers[0].id}`);
console.log(`Manifest for an agent:      ${doorUrl}/b/${business.slug}/.well-known/front-door.json`);
console.log(`Owner's inbox:              curl -H "authorization: Bearer local-owner-key" ${doorUrl}/b/${business.slug}/inbox`);
console.log(`Arbiter:                    ${arbiterUrl}`);
console.log('\nA test buyer profile you can paste into POST /qualify:\n' + profile);
console.log('\nCtrl-C to stop.');
