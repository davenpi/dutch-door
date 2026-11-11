import fs from 'node:fs';
import { Arbiter } from '../arbiter/core.js';
import { FrontDoor } from '../frontdoor/core.js';
import { generateIssuerKeys, issueProfile } from '../lib/profile.js';

export const business = () => JSON.parse(fs.readFileSync(new URL('../frontdoor/businesses/example-broker.json', import.meta.url), 'utf8'));
export const OFFER = 'hvac-listing-001';
export const FLOOR = 2850000;
export const BEFORE_SLOTS = Date.parse('2031-03-01T12:00:00-05:00');

export function setup({ now = () => BEFORE_SLOTS, arbiterOptions = {} } = {}) {
  const keys = generateIssuerKeys();
  const arbiter = new Arbiter({ now, ...arbiterOptions });
  const door = new FrontDoor({ business: business(), arbiter, arbiterUrl: 'http://arbiter.test', trustedIssuers: { 'test-issuer': keys.publicKey }, now });
  const profile = (over = {}) =>
    issueProfile({
      issuer: 'test-issuer',
      privateKey: keys.privateKey,
      principal: { id: 'buyer:acme-holdings', name: 'Acme Holdings (fictional)', kind: 'company' },
      verified: { identity: true, funds_usd_at_least: 400000 },
      agent: { id: 'agent:acme-1', may: ['sign_nda:standard-v1', 'blind_match', 'book_call'] },
      now: now(),
      ...over,
    });
  return { keys, arbiter, door, profile };
}
