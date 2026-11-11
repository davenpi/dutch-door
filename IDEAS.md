# Ideas considered

Everything that came up on the way to the current plan, kept so nothing is lost
and so the reasoning can be checked later. The current plan is in `BUSINESS.md`.
Drafted by Claude for ID, 2026-11-10.

## Where this started

Agents made finding deals nearly free. A buyer can have agents build lists of
thousands of brokers and listings. Calls, NDAs and follow-ups still run at the
speed of one person's calendar. The bottleneck moved from sourcing to the
handshake. The idea: let each side's agent settle the cheap questions (fit,
price range, seriousness, a standard NDA) before a person on either side spends
time.

## Six shapes of business

| # | Shape | What it is | Status |
|---|---|---|---|
| 1 | One-sided agent | An agent sold to buyers or to sellers. It talks to whoever answers, person or agent. | Partly built: Nottoway is the first buyer-side user. Not the product. |
| 2 | Agent front door | An address every business has, where outside agents ask, get qualified, book time and negotiate inside the owner's rules. | **Building.** `frontdoor/` |
| 3 | Portable verified profile | One credential: who you are, what you can afford, what your agent may commit to. Reused everywhere. | **Building, minimal.** `lib/profile.js`. Verification itself is by hand. |
| 4 | Blind-match arbiter | A neutral agent sees both private limits and reports only whether a deal is possible. | **Building.** `arbiter/` |
| 5 | Clearinghouse | A venue with rules, logs and standard terms where agents transact directly. Charges per match or per close. | Parked. It is what a network of front doors grows into. |
| 6 | Record and dispute layer | A trusted log of what each agent agreed to and on whose authority. | Seeded: the arbiter's commitments and the door's NDA record. Not a product yet. |

Why 2 and 4 first: the front door is the largest, because every small business
will need one, and each door makes the next more useful. The arbiter is the
most novel, because no person can do the job. Together they avoid the cold
start that sinks a marketplace: one broker gets value from one door on day one.

## Markets where the same pattern fits

A market fits when there are many inquiries for every closed deal, when
qualifying is a structured exchange of facts, and when both sides lose hours to
bad fits.

| Market | What the agents settle before people talk | Why not first |
|---|---|---|
| Small-business sales (brokers and buyers) | Fit, funds, NDA, price range | **First.** We are a buyer and know the pain. |
| Construction bidding (contractors and subs, owners and contractors) | Scope, availability, licensing, insurance, rough price | Strong second. We already sell into contracting. |
| Commercial real estate leasing | Space, budget, term, tenant credit | No edge yet. |
| Freight (shippers and carriers) | Lane, date, rate, equipment | High volume, crowded, no edge. |
| Hiring (candidates and recruiters) | Pay range, location, work authorization, start date | Huge, crowded, no edge. |
| Small-business lending | Pre-qualification, documents, terms | Adjacent to deals we will do. Revisit. |
| Commercial insurance (brokers and underwriters) | Submission details, appetite, quote | No edge yet. |
| Custom manufacturing and wholesale quotes | Specs, quantities, lead times, price breaks | No edge yet. |
| Fundraising (founders and investors) | Stage, check size, thesis fit, data-room access | Small market. |
| Franchise sales | Liquidity, territory, experience | Similar buyers to ours. Revisit. |

## Earlier framings, and what happened to them

- **Buyer deal desk.** An agent that runs outreach, NDAs, CIM requests and
  follow-ups for people buying businesses. Still worth having for Nottoway. As
  a product it competes with many sourcing tools and does not need the other
  side to change, which also means it builds no network.
- **Broker inquiry agent.** A screen in front of a broker's inbox. The front
  door is this plus an address agents can use, plus the blind check. Selling
  "inquiry screening" alone would be a feature of a broker CRM.
- **Verified buyer profile as the wedge.** A link a buyer sends with every
  inquiry. Kept as the profile inside the front door. On its own it needs
  brokers to trust a new issuer before it is worth anything.
- **Use it only as Nottoway's private edge.** The fallback. If brokers do not
  want it, the buyer-side tooling still saves our own hours.

## Later, if the first step works

- **Mediator.** Give the arbiter more power: propose a price inside the
  overlap, or trade price against terms. Heavier, and asks both sides for far
  more trust. Yes/no first.
- **More private checks.** "Do this buyer's funds meet the seller's
  requirement" without showing a statement. "Do this business's financials meet
  the buyer's criteria" before the books are handed over. The arbiter already
  supports several dimensions in one check.
- **Removing trust in the operator.** Hardware enclave with attestation, or a
  two-party comparison protocol. See `arbiter/README.md`.
- **A language model at the door.** Turning free text into field names and
  writing better answers, with the release decision left to the rules.
- **The door as a remote MCP server.** So any agent that speaks MCP can use a
  business's door with no custom code. Prototype in `mcp/`.
- **Standards.** Adopt whichever agent identity and delegation format wins,
  in place of the placeholder profile. See `research/market.md`.

## Open questions

- Who verifies a buyer's identity and funds, and who carries the liability for
  getting it wrong?
- Will brokers put a seller's floor into software at all? Many do not know it
  precisely, and some see price discovery as their craft.
- Does a broker's listing agreement or state license law limit what software
  may say to a buyer on the broker's behalf?
- Whether this lives inside Groundwork, inside Nottoway, or as its own company.
