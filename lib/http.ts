// Small HTTP helpers shared by the arbiter and the front door. No dependencies.
import http from 'node:http';
import type { AddressInfo } from 'node:net';

/** A parsed JSON object. Nothing is known about its values until they are checked. */
export type JsonObject = Record<string, unknown>;

export class HttpError extends Error {
  status: number;
  code: string;
  extra: JsonObject;

  constructor(status: number, code: string, message: string, extra: JsonObject = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

/** What a route handler is given. The body and query come from the caller and are untrusted. */
export interface RouteContext {
  params: Record<string, string>;
  query: Record<string, string>;
  body: JsonObject;
  req: http.IncomingMessage;
}

/** A handler answers with JSON (body) or with a page (html). */
export type RouteResult = { status?: number; body: unknown } | { status?: number; html: string };

export type RouteHandler = (context: RouteContext) => RouteResult | Promise<RouteResult>;

export interface Route {
  method: 'GET' | 'POST';
  /** May contain :params, for example "/b/:slug/ask". */
  path: string;
  handler: RouteHandler;
}

interface CompiledPath {
  regex: RegExp;
  names: string[];
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type, authorization',
};

function send(res: http.ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS });
  res.end(text);
}

async function readJson(req: http.IncomingMessage, limit = 64 * 1024): Promise<JsonObject> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, 'too_large', 'Request body is too large.');
    chunks.push(chunk);
  }
  if (size === 0) return {};
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    return parsed as JsonObject;
  } catch {
    throw new HttpError(400, 'bad_json', 'Request body must be a JSON object.');
  }
}

function compile(template: string): CompiledPath {
  const names: string[] = [];
  const pattern = template.replace(/:[a-zA-Z_]+/g, (m) => {
    names.push(m.slice(1));
    return '([^/]+)';
  });
  return { regex: new RegExp('^' + pattern + '$'), names };
}

export function bearer(req: http.IncomingMessage): string | null {
  const header = req.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : null;
}

/**
 * Each route's path may contain :params. Its handler receives
 * { params, query, body, req } and returns { status?, body } for JSON, or
 * { status?, html } for a page.
 */
export function createServer(routes: Route[]): http.Server {
  const compiled = routes.map((r) => ({ ...r, ...compile(r.path) }));
  return http.createServer(async (req, res) => {
    try {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, CORS);
        return res.end();
      }
      const url = new URL(req.url ?? '/', 'http://localhost');
      let pathMatched = false;
      for (const route of compiled) {
        const m = route.regex.exec(url.pathname);
        if (!m) continue;
        pathMatched = true;
        if (route.method !== req.method) continue;
        const params = Object.fromEntries(route.names.map((n, i) => [n, decodeURIComponent(m[i + 1])]));
        const body = req.method === 'POST' ? await readJson(req) : {};
        const out = await route.handler({ params, query: Object.fromEntries(url.searchParams), body, req });
        if ('html' in out && typeof out.html === 'string') {
          res.writeHead(out.status || 200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'" });
          return res.end(out.html);
        }
        return send(res, out.status || 200, 'body' in out ? out.body : undefined);
      }
      if (pathMatched) throw new HttpError(405, 'method_not_allowed', 'That method is not supported on this path.');
      throw new HttpError(404, 'not_found', 'No such path.');
    } catch (err) {
      if (err instanceof HttpError) {
        return send(res, err.status, { error: { code: err.code, message: err.message, ...err.extra } });
      }
      console.error(err);
      return send(res, 500, { error: { code: 'internal', message: 'Something went wrong on our side.' } });
    }
  });
}

/** Start listening. Resolves with the port, which is useful when port 0 asks for any free one. */
export function listen(server: http.Server, port = 0, host = '127.0.0.1'): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    // A TCP server that is listening always has an address with a port.
    server.listen(port, host, () => resolve((server.address() as AddressInfo).port));
  });
}
