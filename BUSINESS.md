# The business

Drafted by Claude for ID, 2026-11-10. This is a proposal to test, not a
forecast. Numbers link to `research/market.md`, which links to the sources.
Anything marked "guess" is a guess.

## In one paragraph

Every business will soon be contacted by other people's AI agents, the way it
is contacted by email and phone today. Dutch Door (working name) gives a
business a front door for that: one address where an outside agent or person
can ask questions, prove who they are, and book time, all inside rules the
owner set. Next to it sits a neutral arbiter that can compare two private
numbers and say only whether a deal is possible. We start with business
brokers, because their inbox is where this hurts today and because we are on
the other side of it as buyers.

## The first customer

A US business broker who sells local service and construction companies for
roughly $1M to $5M and runs several listings at once.

What we believe about them, and how well we know it:

| Belief | Evidence |
|---|---|
| Each listing draws many inquiries, most from people who will never buy. | BizBuySell says "dozens" per quality listing and that most respondents never purchase. Nobody has published a measured rate. More than half of surveyed buyers have never owned a business. (`research/market.md`, section 2) |
| Screening costs the broker real hours. | **Not verified.** The only figures are from a vendor's marketing page with no data behind it. |
| The steps are standard enough to automate: teaser, NDA, buyer profile, proof of funds, package. | Yes. Brokers and BizBuySell describe the same sequence. (section 2) |
| Brokers already pay for tools near this. | Yes. Listing memberships, CRMs, and one managed inquiry service at $300 a month plus $1,500 setup. (sections 3 and 5) |
| A broker would enter a seller's floor into software. | **Unknown.** This is the riskiest belief about the arbiter. |

The honest summary: the problem is widely described and nowhere measured. The
first dozen conversations are the measurement. `gtm/outreach.md` has the
questions and the scorecard.

## The offer during the pilot

One listing, set up by hand, at no charge:

1. A page and an agent address for the listing, built from the blind teaser.
2. The broker's rules: what is public, what is held back, what a buyer must
   show.
3. A person on our side checks each buyer's NDA and proof of funds for now.
4. The broker gets a short summary and a call only for buyers who pass.
5. Optional: a blind price check before the call.

## How big this is, honestly

**Brokers alone are a small market.** There are about 3,237 brokerage firms in
the US (`research/market.md`, section 1). If every one of them paid $300 a
month, that would be about $11.7M a year. At a tenth of them, about $1.2M a
year. (My arithmetic on a guessed price: 3,237 x $300 x 12, and 324 x $300 x 12.)
That is a fine first market and a poor only market.

So brokers are the place to prove three things, not the destination:

1. An owner will put a real asset behind a front door.
2. Outside parties, people and agents, will use it.
3. Someone will pay.

Where it gets bigger if those hold:

- **Other businesses with the same shape.** Contractors and subcontractor
  bidding first, because we already sell to contractors. See `IDEAS.md` for
  the list.
- **The buyer's side.** Buyers pay for an edge today (one listing site sells a
  buyer membership from $20 a month). A verified profile that gets a buyer to
  the front of every broker's line is something a serious buyer would pay for.
- **The arbiter as its own service**, used by doors we did not build.

## Pricing

Nothing is charged during the pilot. Two guesses to test in conversation, both
from `research/market.md`, section 5:

- **A. Flat subscription**, about $199 per broker per month, all listings.
- **B. Per listing**, about $99 per active listing per month, plus a flat fee
  per blind check.

I would lead with A. It is the simplest thing to say on a call, and a flat
software fee paid by a licensed broker is the shape with the least licensing
risk (see Risks). Whatever the model, **never take a fee tied to a closing.**

## Why us

- We are buyers. We send the inquiries brokers complain about, and we know
  what a serious buyer wishes a broker's inbox did.
- We already sell software to small-business owners in contracting, which is
  the second market.
- The prototype exists and runs. A broker can see their own listing behind a
  door within a day of saying yes.

## Risks, most serious first

1. **Brokers may not change how they work.** Many are one or two people with
   habits that close deals. A page of facts and a form may be all they want,
   and their CRM may already do that. The test is whether they put one listing
   behind it, not whether they say it is interesting.
2. **Listing sites own the inquiry.** Most inquiries start on a listing site
   and arrive in the broker's email. The door only helps if the broker's first
   reply points buyers to it. Whether listing sites restrict that is **not
   verified**. A listing site could also build this itself.
3. **Licensing.** Sixteen states require a real estate license to broker a
   business sale, and Illinois and California define the licensed activity
   broadly enough that paid help with finding or negotiating with buyers could
   be covered (`research/market.md`, section 4). Selling software to a licensed
   broker for a flat fee is the safer shape. Get a lawyer's view before taking
   money. Not legal advice.
4. **Agents signing NDAs.** The law allows a software agent to form a contract
   for a person, but who is bound when an AI agent does it has not been tested
   in a reported US case (section 4). During the pilot, have a person sign the
   NDA. Keep agent acceptance for when the broker and buyer both ask for it.
5. **The arbiter rests on trust in us.** We could read a number in memory. We
   say so. A broker may still refuse to enter a seller's floor, and a buyer may
   refuse to enter a ceiling. If most refuse, the arbiter waits and the door
   stands on its own.
6. **Verification is work and liability.** If we say a buyer's funds are
   verified and they are not, that is on us. See `docs/decisions.md`.
7. **Timing.** Few buyers have agents today. The door has to be worth having
   for human buyers now. The agent side is why it grows, not why a broker
   says yes this month.
8. **Small market.** Covered above. It caps the downside of being wrong and
   the upside of being right.
9. **Attention.** This is one more thing next to a job, Groundwork and
   Nottoway. The plan below is sized to be answerable in four weeks so it
   does not quietly become a third full commitment.

## The next four weeks, and when to stop

| Week | Do | Enough to continue |
|---|---|---|
| 1 | Send the first dozen. Follow up once. Hold the calls you get. | 4 or more calls from 12 emails. |
| 2 | Set up one listing each for the first two brokers who say yes. | 2 brokers give you a real teaser and rules. |
| 3 | Watch real buyers use them. Fix what breaks. Second dozen emails, sharper. | Buyers complete the steps. Brokers read the summaries. |
| 4 | Ask for money: a paid month at the price they named. | 1 broker pays or commits in writing. |

Stop, or move the same door to contracting, if after two dozen emails fewer
than 4 brokers will talk, or none will put a listing behind it. Those
thresholds are a proposal. Set your own before you send the first email, and
write them in `docs/decisions.md` so they cannot drift.

## What exists and what does not

Built and tested: the arbiter, the front door (API, listing page, owner's
inbox), signed profiles, an MCP endpoint, a demo, the landing site.

Not built: saving state (everything is in memory), a real calendar, a way for
people to sign the NDA and upload proof of funds on the page, any real
identity or funds check, rate limits, a language model at the door, alignment
with the agent identity standards that are forming.

## Open questions for the owners

- Is this part of Groundwork, part of Nottoway, or its own company? The
  brokers we write to are the same people Nottoway needs as a buyer.
- Who answers a broker when they reply, and how fast?
- Which state do we operate from, and what does counsel say about licensing?
