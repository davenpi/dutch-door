# Dutch Door

A front door for AI agents, and a neutral arbiter for private numbers.
Working name. Private repo. **If you are Ian, open `START-HERE.md`.**

A Dutch door is cut in half. The top opens so you can talk to whoever knocks.
The bottom stays shut. This repo is that, for a business: outside agents and
people can ask, prove who they are and book time, and nothing confidential
gets out until the owner's conditions are met.

## What is here

| Path | What |
|---|---|
| `START-HERE.md` | Where things stand and what to do next |
| `BUSINESS.md` | The plan, the numbers, the risks, when to stop |
| `IDEAS.md` | Everything else that was considered |
| `site/` | The landing page. Static files, one config file |
| `frontdoor/` | The door: ask, qualify, blind match, book, owner's inbox |
| `arbiter/` | Two sealed numbers in, one yes or no out |
| `lib/profile.js` | Signed, portable buyer profile |
| `mcp/` | The door as an MCP server, so any MCP agent can use it |
| `protocol/SPEC.md` | The protocol, version 0.1 |
| `examples/` | The demo |
| `gtm/` | Who to write to first, and the drafts |
| `research/` | Sourced market, naming and setup research |
| `docs/decisions.md` | What was decided and why |

## See it work

Needs Node 20 or newer. The core has no dependencies, so there is nothing to
install.

```
npm run demo         # three fictional buyers arrive at one broker's door
npm test             # 31 tests
npm run serve:demo   # runs it locally and prints links to click
```

The MCP endpoint has its own packages:

```
cd mcp && npm install && npm test
```

## What the demo shows

Three buyers' agents ask about a listing. All three get answers from the
public facts and are refused the business name. One cannot show enough funds
and is turned away with nothing confidential. Two qualify and run a blind
price check: each seals a number with the arbiter, and each side learns only
whether a deal is possible. One overlaps and gets a call booked. One does not,
and no call is booked. The broker's inbox shows three visitors, two qualified
buyers and one call. Nobody's private number appears in any log.

## Status

A working prototype and a plan. No customers. State is kept in memory.
`BUSINESS.md` lists what is built and what is not.
