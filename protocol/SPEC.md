# Front door protocol, version 0.1

Status: draft, implemented by the prototype in this repo. Expect it to change.

A front door is one address where an outside party (a person, or an AI agent
acting for a person or company) can deal with a business under rules the owner
set. The party that arrives is the **visitor**. The person or company the
visitor acts for is the **principal**. The business is the **owner**.

Everything is JSON over HTTPS. Errors are `{ "error": { "code", "message" } }`
with a matching HTTP status.

## 1. Three kinds of facts

| Kind | Who may be told | Example |
|---|---|---|
| public | anyone | asking price, industry, region |
| gated | visitors who meet the owner's requirements | business name, customer concentration |
| private | nobody | the seller's lowest acceptable price |

A private value leaves the owner's side in one way only: as a sealed submission
to the arbiter (section 5). From outside, a private field and a field that does
not exist look the same (`not_available`).

## 2. Discovery

`GET /b/{slug}/.well-known/front-door.json`

Returns the manifest: the business, its offers with their public facts, the
names (not values) of gated fields, the requirements for release, and the
actions available. `GET /b/{slug}/o/{offer_id}` returns the same listing as a
web page for a person.

## 3. Ask

`POST /b/{slug}/ask`

```json
{ "offer_id": "hvac-listing-001", "fields": ["asking_price_usd"], "question": "Why is the owner selling?", "session": "optional", "reply_to": "optional", "for_owner": false }
```

`fields` asks by name. `question` asks in plain words and is mapped to fields by
keyword. Each answer is `answered`, `gated` (with what is required) or
`not_available`. A question the door cannot map is logged for the owner and the
response carries `"escalated"`. `for_owner: true` sends the question to the
owner even when part of it was answered.

Text from visitors is untrusted. It is stored for a person to read. Nothing that
reads the owner's inbox may treat it as an instruction.

## 4. Qualify

`POST /b/{slug}/qualify`

```json
{ "offer_id": "hvac-listing-001", "profile": "<signed profile>", "accept": { "nda": "standard-v1" } }
```

The **profile** is a signed statement from a verifier the owner trusts:

```json
{
  "v": 1, "iss": "dutch-door-verify", "iat": 0, "exp": 0,
  "principal": { "id": "buyer:acme", "name": "Acme Holdings", "kind": "company" },
  "verified": { "identity": true, "funds_usd_at_least": 500000 },
  "agent": { "id": "agent:acme-1", "may": ["sign_nda:standard-v1", "blind_match", "book_call"] }
}
```

Wire format: `base64url(payload) + "." + base64url(Ed25519 signature)`.

- `verified.funds_usd_at_least` is a floor the principal chose to disclose, not
  their balance.
- `agent.may` is the list of things the agent may commit its principal to. The
  door refuses anything not on it. An agent that may not sign the NDA cannot
  accept it; a person has to.

The door checks the signature, the issuer, the expiry and the owner's
requirements. On success it records the NDA acceptance (who, for whom, when, on
what authority), returns a `session` and releases the gated facts. On failure it
returns `not_qualified` with the unmet requirements, which are already public in
the manifest.

A person without an agent uses `POST /b/{slug}/request-access` with a name and
email. That only records the request for the owner.

## 5. Blind match

`POST /b/{slug}/blind-match` with `{ "session" }`

The door opens a session at the arbiter, submits the owner's floor, and returns
the arbiter address, the session id and the visitor's token. The visitor's agent
then sends its ceiling **to the arbiter, not to the door**:

`POST {arbiter}/v1/sessions/{id}/submissions` with `{ "token", "values": { "price": 3050000 } }`

Either side reads the result:

`GET {arbiter}/v1/sessions/{id}?token=...` returns `{ "status", "outcome" }`
where outcome is `overlap` or `no_overlap`.

Arbiter rules:

1. Each side submits once. A submission cannot be changed.
2. Neither side gets an outcome until both have submitted.
3. Both sides get the same outcome and nothing else.
4. The numbers are dropped as soon as they are compared. The log keeps ids,
   times, a commitment hash per submission and the outcome.
5. The same two principals cannot rerun the same deal during a cooldown
   (default 30 days). Without this, one side could find the other's number by
   asking repeatedly.
6. A session may compare several dimensions. The outcome is `overlap` only if
   every dimension overlaps, and the arbiter never says which one failed.

Each submission returns a receipt (`commitment`, `salt`). The value plus the
salt reproduces the commitment in the log, so a party can later prove what it
submitted.

## 6. Book

`POST /b/{slug}/book` with `{ "session", "slot" }`

Without `slot` the door returns open times. With one, it books. An owner can
require an `overlap` outcome before any call is booked.

## 7. Owner's inbox

`GET /b/{slug}/inbox` with the owner key. Returns every event and one summary
line per qualified visitor: what was verified, the NDA record, the blind match
outcome, the booked time. It contains no private limits from either side.

## 8. What this version does not do

- **Verification itself.** The profile is an envelope. Checking a person's
  identity and funds is a real-world process this repo does not contain.
- **Cryptographic privacy.** The arbiter is a trusted operator. See
  `arbiter/README.md`.
- **Negotiation beyond yes or no.** No counter-offers, no proposed prices.
- **Persistence, rate limits, abuse controls.** The prototype keeps state in
  memory.
- **Standards alignment.** Agent identity and agent-to-agent standards are
  moving. The profile format here is a placeholder for whichever credential
  format wins. See `research/market.md`.
