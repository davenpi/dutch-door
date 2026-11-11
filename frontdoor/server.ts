// HTTP wrapper: many businesses, one server. Run with: npm run start:frontdoor
//
// Environment:
//   PORT                  default 8788
//   HOST                  default 127.0.0.1 (set 0.0.0.0 in a container)
//   BUSINESS_DIR          folder of business configs, default frontdoor/businesses
//   ARBITER_URL           where the arbiter runs, for example http://127.0.0.1:8787
//   ARBITER_PUBLIC_URL    the arbiter address visitors should use, if different
//   ARBITER_CREATOR_KEY   this server's key at the arbiter
//   TRUSTED_ISSUERS_FILE  JSON file: { "issuer id": "public key PEM" }
//   OWNER_KEYS            slug=key pairs, comma-separated, for reading inboxes
//   BRAND                 name shown on listing pages, default Dutch Door
import fs from 'node:fs';
import type http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FrontDoor, FrontDoorError } from './core.ts';
import type { BusinessConfig } from './core.ts';
import { listingPage } from './listing-page.ts';
import { HttpArbiterClient } from '../arbiter/server.ts';
import { createServer, listen, HttpError, bearer } from '../lib/http.ts';
import type { RouteContext } from '../lib/http.ts';
import type { TrustedIssuers } from '../lib/profile.ts';

async function wrap<T>(fn: () => T | Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof FrontDoorError) throw new HttpError(err.status, err.code, err.message, err.extra);
    throw err;
  }
}

export interface FrontDoorServerOptions {
  doors: FrontDoor[];
  /** Slug -> the key that reads that door's inbox. */
  ownerKeys?: Record<string, string>;
  /** Name shown on the pages people see. */
  brand?: string;
}

export function createFrontDoorServer({ doors, ownerKeys = {}, brand = 'Dutch Door' }: FrontDoorServerOptions): http.Server {
  const bySlug = new Map(doors.map((d) => [d.slug, d]));
  const door = (slug: string): FrontDoor => {
    const d = bySlug.get(slug);
    if (!d) throw new HttpError(404, 'no_such_door', 'No business at this address.');
    return d;
  };
  const session = ({ body, req }: RouteContext): unknown => body.session || bearer(req);

  // Request bodies are untrusted. Their fields go to the door unchecked, and
  // the door checks each one before it uses it.
  return createServer([
    { method: 'GET', path: '/healthz', handler: () => ({ body: { ok: true, doors: bySlug.size } }) },
    { method: 'GET', path: '/b/:slug/.well-known/front-door.json', handler: ({ params }) => ({ body: door(params.slug).manifest() }) },
    { method: 'GET', path: '/b/:slug', handler: ({ params }) => ({ body: door(params.slug).manifest() }) },
    {
      method: 'POST',
      path: '/b/:slug/ask',
      handler: (c) => wrap(() => ({ body: door(c.params.slug).ask({ offerId: c.body.offer_id, fields: c.body.fields, question: c.body.question, session: session(c), replyTo: c.body.reply_to, forOwner: c.body.for_owner === true }) })),
    },
    {
      // The page a person sees. Agents use the JSON routes.
      method: 'GET',
      path: '/b/:slug/o/:offer',
      handler: ({ params }) => {
        const html = listingPage({ manifest: door(params.slug).manifest(), offerId: params.offer, slug: params.slug, brand });
        if (!html) throw new HttpError(404, 'no_such_offer', 'No such offer at this door.');
        return { html };
      },
    },
    {
      method: 'POST',
      path: '/b/:slug/request-access',
      handler: (c) => wrap(() => ({ body: door(c.params.slug).requestAccess({ offerId: c.body.offer_id, name: c.body.name, email: c.body.email, message: c.body.message }) })),
    },
    {
      method: 'POST',
      path: '/b/:slug/qualify',
      handler: (c) => wrap(() => ({ body: door(c.params.slug).qualify({ offerId: c.body.offer_id, profile: c.body.profile, accept: c.body.accept }) })),
    },
    {
      method: 'POST',
      path: '/b/:slug/blind-match',
      handler: (c) => wrap(async () => ({ body: await door(c.params.slug).startBlindMatch({ session: session(c) }) })),
    },
    {
      method: 'POST',
      path: '/b/:slug/blind-match/status',
      handler: (c) => wrap(async () => ({ body: await door(c.params.slug).blindMatchStatus({ session: session(c) }) })),
    },
    {
      method: 'POST',
      path: '/b/:slug/book',
      handler: (c) => wrap(async () => ({ body: await door(c.params.slug).book({ session: session(c), slot: c.body.slot }) })),
    },
    {
      method: 'GET',
      path: '/b/:slug/inbox',
      handler: ({ params, req }) => {
        const d = door(params.slug);
        const key = bearer(req);
        if (!key || ownerKeys[params.slug] !== key) throw new HttpError(401, 'unauthorized', 'The owner key for this door is required.');
        return { body: d.inbox() };
      },
    },
  ]);
}

/** Read every business config in a folder. The owner wrote these files, so they are trusted. */
export function loadBusinesses(dir: string): BusinessConfig[] {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as BusinessConfig);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const env = process.env;
  const need = (name: string): string => {
    const value = env[name];
    if (!value) {
      console.error('Missing ' + name + '. See frontdoor/README.md.');
      process.exit(1);
    }
    return value;
  };
  const arbiterUrl = need('ARBITER_URL');
  const creatorKey = need('ARBITER_CREATOR_KEY');
  const issuersFile = need('TRUSTED_ISSUERS_FILE');
  const arbiter = new HttpArbiterClient({ url: arbiterUrl, creatorKey });
  const trustedIssuers = JSON.parse(fs.readFileSync(issuersFile, 'utf8')) as TrustedIssuers;
  const doors = loadBusinesses(env.BUSINESS_DIR || path.join(here, 'businesses')).map(
    (business) => new FrontDoor({ business, arbiter, arbiterUrl: env.ARBITER_PUBLIC_URL || arbiterUrl, trustedIssuers }),
  );
  const ownerKeys = Object.fromEntries((env.OWNER_KEYS || '').split(',').map((s) => s.trim()).filter(Boolean).map((pair): [string, string] => {
    const [slug, key] = pair.split('=');
    return [slug, key];
  }));
  const port = await listen(createFrontDoorServer({ doors, ownerKeys, brand: env.BRAND || 'Dutch Door' }), Number(env.PORT || 8788), env.HOST || '127.0.0.1');
  console.log('Front door listening on port ' + port + ' for: ' + doors.map((d) => d.slug).join(', '));
}
