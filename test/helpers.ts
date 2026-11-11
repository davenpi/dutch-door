import fs from 'node:fs';
import { Arbiter } from '../arbiter/core.ts';
import type { ArbiterOptions } from '../arbiter/core.ts';
import { FrontDoor } from '../frontdoor/core.ts';
import type { BusinessConfig } from '../frontdoor/core.ts';
import { generateIssuerKeys, issueProfile } from '../lib/profile.ts';
import type { IssueProfileInput, IssuerKeys } from '../lib/profile.ts';

export const business = (): BusinessConfig => JSON.parse(fs.readFileSync(new URL('../frontdoor/businesses/example-broker.json', import.meta.url), 'utf8')) as BusinessConfig;
export const OFFER = 'hvac-listing-001';
export const FLOOR = 2850000;
export const BEFORE_SLOTS = Date.parse('2031-03-01T12:00:00-05:00');

export interface SetupOptions {
  now?: () => number;
  arbiterOptions?: ArbiterOptions;
}

/** A door, its arbiter, and a way to issue profiles the door trusts. */
export interface TestContext {
  keys: IssuerKeys;
  arbiter: Arbiter;
  door: FrontDoor;
  /** A good profile for a fictional buyer. Pass fields to replace. */
  profile: (over?: Partial<IssueProfileInput>) => string;
}

export function setup({ now = () => BEFORE_SLOTS, arbiterOptions = {} }: SetupOptions = {}): TestContext {
  const keys = generateIssuerKeys();
  const arbiter = new Arbiter({ now, ...arbiterOptions });
  const door = new FrontDoor({ business: business(), arbiter, arbiterUrl: 'http://arbiter.test', trustedIssuers: { 'test-issuer': keys.publicKey }, now });
  const profile = (over: Partial<IssueProfileInput> = {}): string =>
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
