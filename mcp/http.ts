// Streamable HTTP mount for the front door MCP tools, on plain node:http.
// One door per slug, at POST /b/:slug/mcp.
//
// Stateless: every request gets a new MCP server and a new transport, and no
// MCP session id is issued. The state that matters (door sessions, bookings,
// blind checks) lives in the FrontDoor instances and at the arbiter.
//
// Run with: node mcp/http.ts   (or "npm start" inside mcp/)
//
// Environment, same as frontdoor/server.ts plus MCP_PORT:
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
import { FrontDoor } from '../frontdoor/core.ts';
import { loadBusinesses } from '../frontdoor/server.ts';
import { HttpArbiterClient } from '../arbiter/server.ts';
import { listen } from '../lib/http.ts';
import type { TrustedIssuers } from '../lib/profile.ts';
import { isRecord } from '../lib/unchecked.ts';
import { createFrontDoorMcpServer } from './server.ts';

const MCP_PATH = /^\/b\/([^/]+)\/mcp\/?$/;
const MAX_BODY_BYTES = 64 * 1024;

function sendJson(res: http.ServerResponse, status: number, body: unknown, headers: http.OutgoingHttpHeaders = {}): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
}

const rpcError = (code: number, message: string) => ({ jsonrpc: '2.0', error: { code, message }, id: null });

export interface McpHttpOptions {
  doors: FrontDoor[];
  /** The arbiter address visitors use. Must be the arbiterUrl the doors were built with. */
  arbiterPublicUrl: string;
}

/**
 * A node:http request listener that serves MCP for many doors. Use this to
 * mount MCP inside another node:http server in the same process, so that it
 * shares FrontDoor instances (and so sessions and the owner's log) with it.
 */
export function createMcpRequestListener({ doors, arbiterPublicUrl }: McpHttpOptions): (req: http.IncomingMessage, res: http.ServerResponse) => Promise<void> {
  const bySlug = new Map(doors.map((d) => [d.slug, d]));
  // Build one server per door now, so a bad arbiterPublicUrl fails at startup
  // and not on the first request.
  for (const door of bySlug.values()) createFrontDoorMcpServer({ door, arbiterPublicUrl });

  return async (req, res) => {
    let pathname: string;
    try {
      pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
    } catch {
      return sendJson(res, 400, { error: { code: 'bad_request', message: 'Bad request URL.' } });
    }
    if (pathname === '/healthz' && req.method === 'GET') return sendJson(res, 200, { ok: true, doors: bySlug.size });

    const match = MCP_PATH.exec(pathname);
    if (!match) return sendJson(res, 404, { error: { code: 'not_found', message: 'No such path. MCP endpoints are at /b/{slug}/mcp.' } });
    let slug: string | null = null;
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
      console.error('mcp request failed: ' + ((isRecord(err) && typeof err.name === 'string' && err.name) || 'Error'));
      if (!res.headersSent) sendJson(res, 500, rpcError(-32603, 'Internal server error.'));
      else res.end();
    }
  };
}

/** A server for the listener above. Not yet listening. */
export function createMcpHttpServer({ doors, arbiterPublicUrl }: McpHttpOptions): http.Server {
  return http.createServer(createMcpRequestListener({ doors, arbiterPublicUrl }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const env = process.env;
  const need = (name: string): string => {
    const value = env[name];
    if (!value) {
      console.error('Missing ' + name + '. See mcp/README.md.');
      process.exit(1);
    }
    return value;
  };
  const arbiterUrl = need('ARBITER_URL');
  const creatorKey = need('ARBITER_CREATOR_KEY');
  const issuersFile = need('TRUSTED_ISSUERS_FILE');
  const arbiterPublicUrl = env.ARBITER_PUBLIC_URL || arbiterUrl;
  const arbiter = new HttpArbiterClient({ url: arbiterUrl, creatorKey });
  const trustedIssuers = JSON.parse(fs.readFileSync(issuersFile, 'utf8')) as TrustedIssuers;
  const doors = loadBusinesses(env.BUSINESS_DIR || path.join(here, '..', 'frontdoor', 'businesses')).map(
    (business) => new FrontDoor({ business, arbiter, arbiterUrl: arbiterPublicUrl, trustedIssuers }),
  );
  const port = await listen(createMcpHttpServer({ doors, arbiterPublicUrl }), Number(env.MCP_PORT || 8789), env.HOST || '127.0.0.1');
  console.log('MCP listening on port ' + port + ' at /b/{slug}/mcp for: ' + doors.map((d) => d.slug).join(', '));
}
