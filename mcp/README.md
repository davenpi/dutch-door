# MCP endpoint for a front door

This folder puts a Model Context Protocol (MCP) endpoint in front of a `FrontDoor`, so an MCP-capable AI agent can use a business's front door without knowing its HTTP API. The agent gets seven tools: read the manifest, ask questions, qualify with a signed profile, run a blind price check through the arbiter, and book a call. It is a thin layer: the rules about what may be released stay in `frontdoor/core.ts`, and the comparison of the two private numbers stays in the arbiter.

## Run it

The core repo has no dependencies. This folder has its own `package.json` so that stays true.

```
cd mcp
npm install
npm test
```

The code is TypeScript and Node runs it as it is, with no build step. That needs Node 22.18 or newer. `npm run typecheck` in this folder checks the types; it uses the TypeScript installed at the repo root, so run `npm install` there first.

To serve it, start an arbiter first (`npm run start:arbiter` in the repo root, with `ARBITER_CREATOR_KEYS` set), then from the repo root:

```
ARBITER_URL=http://127.0.0.1:8787 \
ARBITER_CREATOR_KEY=your-creator-key \
TRUSTED_ISSUERS_FILE=/path/to/issuers.json \
node mcp/http.ts
```

Each business then has its own endpoint at `http://127.0.0.1:8789/b/{slug}/mcp`, for example `/b/example-broker/mcp`. Point an MCP client at that URL using the Streamable HTTP transport.

Environment variables, the same as `frontdoor/server.ts` plus `MCP_PORT`:

| Variable | Meaning |
| --- | --- |
| `MCP_PORT` | Port to listen on. Default 8789. |
| `HOST` | Address to bind. Default 127.0.0.1. Set 0.0.0.0 in a container. |
| `BUSINESS_DIR` | Folder of business configs. Default `frontdoor/businesses`. |
| `ARBITER_URL` | Where the arbiter runs. Required. |
| `ARBITER_PUBLIC_URL` | The arbiter address visitors should use, if different. |
| `ARBITER_CREATOR_KEY` | This server's key at the arbiter. Required. |
| `TRUSTED_ISSUERS_FILE` | JSON file: `{ "issuer id": "public key PEM" }`. Required. |

`PORT` and `OWNER_KEYS` are not used here. There is no owner inbox on this server.

## Files

- `server.ts`: `createFrontDoorMcpServer({ door, arbiterPublicUrl })` returns an MCP server with the tools below.
- `http.ts`: `createMcpHttpServer({ doors, arbiterPublicUrl })` returns a plain `node:http` server that serves `POST /b/:slug/mcp` with the SDK's Streamable HTTP transport, in stateless mode with JSON responses. `createMcpRequestListener` returns just the request listener, for mounting inside another `node:http` server. Also `GET /healthz`.
- `test/mcp.test.ts`: the full flow, driven by the SDK's own client.

Dependencies are pinned to exact versions: `@modelcontextprotocol/sdk` 1.32.2 and `zod` 4.6.7 (the SDK takes tool input schemas as zod schemas).

## Tools

| Tool | Input | What it does |
| --- | --- | --- |
| `get_manifest` | none | Returns the door's manifest: business, offers, public facts, names of gated facts, requirements. |
| `ask` | `offer_id`, optional `fields`, `question`, `session`, `reply_to`, `for_owner` | Reads facts about an offer by field name or plain words. Gated facts need a `session`. A question the door cannot answer, or any question with `for_owner: true`, is passed to the owner. |
| `qualify` | `offer_id`, `profile`, optional `accept_nda` | Checks a signed profile against the owner's requirements. Returns a `session` and the gated facts, or a list of what is missing. |
| `start_blind_match` | `session` | Opens a blind price check. Returns `arbiter_url`, `session_id` and `token`, and tells the agent to call `submit_limit` next. |
| `submit_limit` | `arbiter_url`, `session_id`, `token`, `price` | Sends the visitor's limit to the arbiter with `POST /v1/sessions/:id/submissions`. Does not call the front door. Refuses any `arbiter_url` other than the configured one. |
| `blind_match_result` | `arbiter_url`, `session_id`, `token` | Reads the outcome from the arbiter with `GET /v1/sessions/:id?token=`. Same address rule. |
| `book` | `session`, optional `slot` | Without `slot`, lists open times. With `slot`, books it. Before booking, the door asks the arbiter for the blind check outcome using the owner's token, because the door only learns the outcome when it asks. |

Results are JSON, returned both as text content and as structured content. A failed call has `isError: true` and a body of the form `{"error": {"code": "...", "message": "..."}}`, using the front door's or the arbiter's own error code. Two codes are added here: `arbiter_url_not_allowed` and `arbiter_unreachable`. Arguments that do not fit a tool's schema are refused by the SDK before any tool code runs; that error also has `isError: true`, but its text is a plain sentence, not JSON.

## Limits

This is a prototype. Read these before putting it anywhere that matters.

- **No authentication on the endpoint.** Anyone who can reach the URL can list and call the tools. The only checks are the ones the tools carry themselves: the signed profile for `qualify`, the session token for gated facts, blind match and booking, and the arbiter token for the two arbiter tools.
- **No rate limiting.** Nothing stops a caller from asking thousands of questions or filling the owner's log with questions for the owner. The arbiter's one-check-per-buyer rule still holds, because the arbiter enforces it.
- **The visitor's number does pass through this process.** `submit_limit` forwards it to the arbiter and does not give it to `FrontDoor`, write it to the owner's log, or store or print it. But this server is run by whoever runs the front door, and the number is in its memory for the length of the request. An agent that wants the door's operator to have no chance to see it should POST to the arbiter itself; `start_blind_match` returns everything needed for that. A reverse proxy or request logger placed in front of this server could also record the number.
- **Separate process, separate state.** `node mcp/http.ts` builds its own `FrontDoor` instances, and they keep sessions, bookings and the owner's log in memory. A session from this server does not work on `frontdoor/server.ts`, a slot booked here is still open there, the owner inbox served there does not show visitors who came through MCP, and a restart loses everything. To share state, mount `createMcpRequestListener` in the same process as the front door server, with the same `FrontDoor` instances. That wiring is not done.
- **The arbiter must be reachable at its public URL from this process.** `submit_limit` and `blind_match_result` call the public address, not `ARBITER_URL`.
- **No Host or Origin checks and no CORS headers.** Browser-based MCP clients cannot connect, and there is no DNS rebinding protection for a server bound to localhost.
- **Stateless transport.** No MCP session ids, no server-to-client notifications, no resumable streams. `GET` and `DELETE` on the endpoint return 405.
- **Tools only.** No MCP resources or prompts.
- **Dependency weight.** The SDK installs about 95 packages, including express and hono, which the SDK uses or offers internally. This code uses only `node:http`.
- **Tested with one client.** The tests use the SDK's own client. No other MCP client has been tried.
