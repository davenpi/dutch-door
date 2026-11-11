// Streamable HTTP mount for the front door MCP tools, on plain node:http.
// One door per slug, at POST /b/:slug/mcp.
//
// Stateless: every request gets a new MCP server and a new transport, and no
// MCP session id is issued. The state that matters (door sessions, bookings,
// blind checks) lives in the FrontDoor instances and at the arbiter.
//
// Run with: node mcp/http.js   (or "npm start" inside mcp/)
//
// Environment, same as frontdoor/server.js plus MCP_PORT:
//   MCP_PORT              default 8789
//   HOST                  default 127.0.0.1 (set 0.0.0.0 in a container)
//   BUSINESS_DIR          folder of business configs, default frontdoor/businesses
//   ARBITER_URL           where the arbiter runs, for example http://127.0.0.1:8787
//   ARBITER_PUBLIC_URL    the arbiter address visitors should use, if different
//   ARBITER_CREATOR_KEY   this server's key at the arbiter
//   TRUSTED_ISSUERS_FILE  JSON file: { "issuer id": "public key PEM" }
// PORT and OWNER_KEYS are not used here: this server has no owner inbox.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { FrontDoor } from '../frontdoor/core.js';
import { loadBusinesses } from '../frontdoor/server.js';
import { HttpArbiterClient } from '../arbiter/server.js';
import { listen } from '../lib/http.js';
import { createFrontDoorMcpServer } from './server.js';

const MCP_PATH = /^\/b\/([^/]+)\/mcp\/?$/;
const MAX_BODY_BYTES = 64 * 1024;

function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
}

const rpcError = (code, message) => ({ jsonrpc: '2.0', error: { code, message }, id: null });

/**
 * A node:http request listener that serves MCP for many doors. Use this to
 * mount MCP inside another node:http server in the same process, so that it
 * shares FrontDoor instances (and so sessions and the owner's log) with it.
 *
 * @param {object} o
 * @param {import('../frontdoor/core.js').FrontDoor[]} o.doors
 * @param {string} o.arbiterPublicUrl  The arbiter address visitors use. Must be the
 *   arbiterUrl the doors were built with.
 * @returns {(req: http.IncomingMessage, res: http.ServerResponse) => Promise<void>}
 */
export function createMcpRequestListener({ doors, arbiterPublicUrl }) {
  const bySlug = new Map(doors.map((d) => [d.slug, d]));
  // Build one server per door now, so a bad arbiterPublicUrl fails at startup
  // and not on the first request.
  for (const door of bySlug.values()) createFrontDoorMcpServer({ door, arbiterPublicUrl });

  return async (req, res) => {
    let pathname;
    try {
      pathname = new URL(req.url, 'http://localhost').pathname;
    } catch {
      return sendJson(res, 400, { error: { code: 'bad_request', message: 'Bad request URL.' } });
    }
    if (pathname === '/healthz' && req.method === 'GET') return sendJson(res, 200, { ok: true, doors: bySlug.size });

    const match = MCP_PATH.exec(pathname);
    if (!match) return sendJson(res, 404, { error: { code: 'not_found', message: 'No such path. MCP endpoints are at /b/{slug}/mcp.' } });
    let slug = null;
    try {
      slug = decodeURIComponent(match[1]);
    } catch {
      slug = null;
    }
    const door = slug === null ? undefined : bySlug.get(slug);
    if (!door) return sendJson(res, 404, { error: { code: 'no_such_door', message: 'No business at this address.' } });

    // Stateless mode has no server-to-client stream to open (GET) and no MCP
    // session to end (DELETE).
    if (req.method !== 'POST') return sendJson(res, 405, rpcError(-32000, 'Method not allowed. Send MCP requests with POST.'), { allow: 'POST' });

    const server = createFrontDoorMcpServer({ door, arbiterPublicUrl });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true, maxRequestBodySize: MAX_BODY_BYTES });
    res.on('close', () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (err) {
      // Class name only. The request body may hold a private number.
      console.error('mcp request failed: ' + (err?.name || 'Error'));
      if (!res.headersSent) sendJson(res, 500, rpcError(-32603, 'Internal server error.'));
      else res.end();
    }
  };
}

/**
 * @param {object} o
 * @param {import('../frontdoor/core.js').FrontDoor[]} o.doors
 * @param {string} o.arbiterPublicUrl
 * @returns {http.Server}  Not yet listening.
 */
export function createMcpHttpServer({ doors, arbiterPublicUrl }) {
  return http.createServer(createMcpRequestListener({ doors, arbiterPublicUrl }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const env = process.env;
  for (const name of ['ARBITER_URL', 'ARBITER_CREATOR_KEY', 'TRUSTED_ISSUERS_FILE']) {
    if (!env[name]) {
      console.error('Missing ' + name + '. See mcp/README.md.');
      process.exit(1);
    }
  }
  const arbiterPublicUrl = env.ARBITER_PUBLIC_URL || env.ARBITER_URL;
  const arbiter = new HttpArbiterClient({ url: env.ARBITER_URL, creatorKey: env.ARBITER_CREATOR_KEY });
  const trustedIssuers = JSON.parse(fs.readFileSync(env.TRUSTED_ISSUERS_FILE, 'utf8'));
  const doors = loadBusinesses(env.BUSINESS_DIR || path.join(here, '..', 'frontdoor', 'businesses')).map(
    (business) => new FrontDoor({ business, arbiter, arbiterUrl: arbiterPublicUrl, trustedIssuers }),
  );
  const port = await listen(createMcpHttpServer({ doors, arbiterPublicUrl }), Number(env.MCP_PORT || 8789), env.HOST || '127.0.0.1');
  console.log('MCP listening on port ' + port + ' at /b/{slug}/mcp for: ' + doors.map((d) => d.slug).join(', '));
}
