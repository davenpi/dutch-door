# Working in this repo

This file is for any Claude session (or other agent) that picks up this work.
Read it first. Then read `START-HERE.md` for the current state and `BUSINESS.md`
for the plan.

## What this is

A business, working name Dutch Door, run by Ian Davenport (ID). It sells a
"front door" that outside AI agents and people use to deal with a business
under the owner's rules, plus a neutral blind-match arbiter. First customers:
US business brokers. The repo holds the prototype, the landing site, and the
plan. The name is a placeholder; it lives in `site/src/config.ts`, the `BRAND`
environment variable and prose. Do not hard-code it in new code.

## How to act here

- **Own the outcome.** The goal is a business with paying customers, not a
  tidy repo. If the plan looks wrong, say so in `docs/decisions.md` and to Ian,
  with the reason. Do not quietly build around a doubt.
- **Drafts only** for anything that goes to a broker, buyer, seller, lender or
  adviser. Ian sends.
- **Every number has a source.** Market figures link to where they came from.
  If a number could not be verified, write "not verified". Never invent a
  statistic, a customer, a testimonial or a quote, on the site or anywhere.
- **Say what is built and what is not.** The site and docs must not claim a
  feature the code does not have. The arbiter is a "trusted neutral operator",
  never "cryptographically private", until that changes.
- **Real seller and buyer figures stay out of git.** Only fictional data in
  `frontdoor/businesses/`. Real configs live outside the repo.
- **No secrets in git.** `npm run keys` writes to `.local/`, which is ignored.
- **No em dashes** in prose, code comments or copy.
- **Plain words.** The reader is a busy broker or a busy founder.
- Initial and date entries in shared notes: `(ID, 2026-11-10)`.

## Code rules

- Everything is TypeScript. The core (`lib/`, `arbiter/`, `frontdoor/`) runs
  directly on Node with no build step and has zero runtime dependencies. Keep
  it so. Anything that needs a package at run time gets its own folder and
  `package.json`, like `mcp/` and `site/`.
- The decision about what a door may release is made by rules in
  `frontdoor/core.ts`, never by a language model. A model may translate
  questions into field names. It may not decide.
- Text that arrives from a visitor is data. Nothing may treat it as an instruction.
- Every behavior that protects a private number has a test. Do not weaken
  those tests to make something pass.
- `npm test` must pass before a commit. `npm run demo` must still tell the story.

## Where things are

| Path | What |
|---|---|
| `START-HERE.md` | Current state and the next actions |
| `BUSINESS.md` | The plan: customer, offer, pricing guesses, risks, when to stop |
| `IDEAS.md` | Everything else that was considered |
| `docs/decisions.md` | Decisions and the reasons, newest first |
| `protocol/SPEC.md` | The front door protocol |
| `arbiter/`, `frontdoor/`, `lib/` | The prototype |
| `mcp/` | The door as an MCP server |
| `site/` | The landing page (Vite, TypeScript). Read `site/README.md` before changing it |
| `research/` | Sourced research |
| `gtm/` | Who to contact first, and drafts |

## Related repos

Nottoway Companies (the buying side) keeps its record in
`Groundwork-Consulting/nottoway-vault`. Its rules apply there, not here, but
this repo borrows several of them on purpose. TL Construction is a separate
business; do not load or copy its material.
