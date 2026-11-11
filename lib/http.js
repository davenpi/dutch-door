// Small HTTP helpers shared by the arbiter and the front door. No dependencies.
import http from 'node:http';

export class HttpError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type, authorization',
};

function send(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS });
  res.end(text);
}

async function readJson(req, limit = 64 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, 'too_large', 'Request body is too large.');
    chunks.push(chunk);
  }
  if (size === 0) return {};
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    return parsed;
  } catch {
    throw new HttpError(400, 'bad_json', 'Request body must be a JSON object.');
  }
}

function compile(template) {
  const names = [];
  const pattern = template.replace(/:[a-zA-Z_]+/g, (m) => {
    names.push(m.slice(1));
    return '([^/]+)';
  });
  return { regex: new RegExp('^' + pattern + '$'), names };
}

export function bearer(req) {
  const header = req.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : null;
}

/**
 * routes: [{ method, path, handler }] where path may contain :params and
 * handler receives { params, query, body, req } and returns { status?, body }
 * for JSON, or { status?, html } for a page.
 */
export function createServer(routes) {
  const compiled = routes.map((r) => ({ ...r, ...compile(r.path) }));
  return http.createServer(async (req, res) => {
    try {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, CORS);
        return res.end();
      }
      const url = new URL(req.url, 'http://localhost');
      let pathMatched = false;
      for (const route of compiled) {
        const m = route.regex.exec(url.pathname);
        if (!m) continue;
        pathMatched = true;
        if (route.method !== req.method) continue;
        const params = Object.fromEntries(route.names.map((n, i) => [n, decodeURIComponent(m[i + 1])]));
        const body = req.method === 'POST' ? await readJson(req) : {};
        const out = await route.handler({ params, query: Object.fromEntries(url.searchParams), body, req });
        if (typeof out.html === 'string') {
          res.writeHead(out.status || 200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'" });
          return res.end(out.html);
        }
        return send(res, out.status || 200, out.body);
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

export function listen(server, port = 0, host = '127.0.0.1') {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve(server.address().port));
  });
}
