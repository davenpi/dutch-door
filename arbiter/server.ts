// HTTP wrapper around the arbiter. Run with: npm run start:arbiter
//
// Environment:
//   PORT                   default 8787
//   HOST                   default 127.0.0.1 (set 0.0.0.0 in a container)
//   ARBITER_CREATOR_KEYS   comma-separated keys allowed to open a check
//                          (each front door gets one)
import type http from 'node:http';
import { fileURLToPath } from 'node:url';
import { Arbiter, ArbiterError } from './core.ts';
import type { ArbiterApi, CreateSessionInput, CreatedSession, Dimension, ResultInput, SessionResult, SubmitInput, SubmitResult } from './core.ts';
import { createServer, listen, HttpError, bearer } from '../lib/http.ts';
import { isRecord } from '../lib/unchecked.ts';

const STATUS: Record<string, number> = { bad_request: 400, not_found: 404, cooldown: 429, session_open: 409, already_submitted: 409, closed: 409, expired: 410 };

function wrap<T>(fn: () => T): T {
  try {
    return fn();
  } catch (err) {
    if (err instanceof ArbiterError) throw new HttpError(STATUS[err.code] || 400, err.code, err.message, err.extra);
    throw err;
  }
}

export interface ArbiterServerOptions {
  arbiter?: Arbiter;
  /** Keys allowed to open a check and read the audit log. Each front door gets one. */
  creatorKeys?: string[];
}

export function createArbiterServer({ arbiter = new Arbiter(), creatorKeys = [] }: ArbiterServerOptions = {}): http.Server {
  const keys = new Set(creatorKeys);
  const requireCreator = (req: http.IncomingMessage): void => {
    const key = bearer(req);
    if (!key || !keys.has(key)) throw new HttpError(401, 'unauthorized', 'A valid creator key is required.');
  };

  // Request bodies are untrusted. They go to the arbiter unchecked, and the
  // arbiter checks every field before it uses it.
  return createServer([
    { method: 'GET', path: '/healthz', handler: () => ({ body: { ok: true } }) },
    {
      method: 'POST',
      path: '/v1/sessions',
      handler: ({ body, req }) => {
        requireCreator(req);
        const out = wrap(() => arbiter.createSession({ dealRef: body.deal_ref, parties: body.parties, dimensions: body.dimensions }));
        return { status: 201, body: { session_id: out.sessionId, tokens: out.tokens, expires_at: new Date(out.expiresAt).toISOString(), dimensions: out.dimensions } };
      },
    },
    {
      method: 'POST',
      path: '/v1/sessions/:id/submissions',
      handler: ({ params, body }) => ({ body: wrap(() => arbiter.submit({ sessionId: params.id, token: body.token, values: body.values })) }),
    },
    {
      method: 'GET',
      path: '/v1/sessions/:id',
      handler: ({ params, query }) => ({ body: wrap(() => arbiter.result({ sessionId: params.id, token: query.token })) }),
    },
    {
      method: 'GET',
      path: '/v1/audit',
      handler: ({ req }) => {
        requireCreator(req);
        return { body: { entries: arbiter.audit() } };
      },
    },
  ]);
}

export interface HttpArbiterClientOptions {
  /** Where the arbiter runs, for example http://127.0.0.1:8787. */
  url: string;
  /** This front door's key at the arbiter. */
  creatorKey: string;
}

/** The answer to POST /v1/sessions, as it travels. */
interface CreatedSessionWire {
  session_id: string;
  tokens: Record<string, string>;
  expires_at: string;
  dimensions: Dimension[];
}

/** Client used by a front door to talk to an arbiter over HTTP. */
export class HttpArbiterClient implements ArbiterApi {
  url: string;
  creatorKey: string;

  constructor({ url, creatorKey }: HttpArbiterClientOptions) {
    this.url = url.replace(/\/$/, '');
    this.creatorKey = creatorKey;
  }

  // T is what the arbiter documents for the path. The arbiter is the one
  // service this door was set up to trust, so a good answer is taken as it is.
  async #call<T>(method: 'GET' | 'POST', path: string, body?: object, auth?: boolean): Promise<T> {
    const res = await fetch(this.url + path, {
      method,
      headers: { 'content-type': 'application/json', ...(auth ? { authorization: 'Bearer ' + this.creatorKey } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data: unknown = await res.json();
    if (!res.ok) {
      const error = isRecord(data) && isRecord(data.error) ? data.error : {};
      throw new ArbiterError(typeof error.code === 'string' && error.code ? error.code : 'arbiter_error', typeof error.message === 'string' && error.message ? error.message : 'Arbiter call failed.', error);
    }
    return data as T;
  }

  async createSession({ dealRef, parties, dimensions }: CreateSessionInput): Promise<CreatedSession> {
    const out = await this.#call<CreatedSessionWire>('POST', '/v1/sessions', { deal_ref: dealRef, parties, dimensions }, true);
    return { sessionId: out.session_id, tokens: out.tokens, expiresAt: Date.parse(out.expires_at), dimensions: out.dimensions };
  }

  submit({ sessionId, token, values }: SubmitInput): Promise<SubmitResult> {
    return this.#call<SubmitResult>('POST', `/v1/sessions/${sessionId}/submissions`, { token, values });
  }

  result({ sessionId, token }: ResultInput): Promise<SessionResult> {
    return this.#call<SessionResult>('GET', `/v1/sessions/${sessionId}?token=${encodeURIComponent(token)}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const creatorKeys = (process.env.ARBITER_CREATOR_KEYS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (creatorKeys.length === 0) {
    console.error('Set ARBITER_CREATOR_KEYS to at least one key. Run "npm run keys" to make one.');
    process.exit(1);
  }
  const port = await listen(createArbiterServer({ creatorKeys }), Number(process.env.PORT || 8787), process.env.HOST || '127.0.0.1');
  console.log('Arbiter listening on port ' + port);
}
