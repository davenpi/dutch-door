# Front door

One address per business where outside agents and people can ask questions, get
qualified against the owner's rules, run a blind price check and book a call.

- `core.js`: the logic for one business.
- `server.js`: HTTP for many businesses on one server, under `/b/{slug}`.
- `listing-page.js`: the page a person sees at `/b/{slug}/o/{offer_id}`.
- `businesses/*.json`: one config file per business. `example-broker.json` is fictional.

## Try it on your machine

```
npm run serve:demo
```

That starts an arbiter and a front door with throwaway keys and prints the
links. Open the listing page in a browser, or call the API by hand.

## Run it for real

```
npm run keys                      # writes secrets to .local/ (git-ignored)
set -a; . .local/env; set +a
ARBITER_URL=http://127.0.0.1:8787 \
ARBITER_CREATOR_KEY=$ARBITER_CREATOR_KEYS \
npm run start:frontdoor           # in a second terminal: npm run start:arbiter
```

`Dockerfile` at the repo root builds one image for both services.

## Setting up a business

Copy `businesses/example-broker.json` and edit:

- `public`: what anyone may be told. For a broker, this is the blind teaser.
- `gated`: what is released once a buyer meets the requirements.
- `private.price_floor_usd`: the seller's floor. It is never sent to a visitor.
  It goes to the arbiter as a sealed submission when a blind check is opened.
- `requirements`: `identity_verified`, `funds_usd_at_least`, `nda`.
- `booking.requires_overlap`: if true, no call is booked until a blind check
  says a deal is possible.
- `availability`: times the owner is open for a first call.

Real seller figures are confidential. Do not commit a real business config to
this repo. Keep real configs outside git and point `BUSINESS_DIR` at them.

## How questions are answered

By rule, not by a language model. A question in plain words is mapped to fact
names by keyword (`fieldsForQuestion` in `core.js`), and the release decision
is a lookup: public, gated or private. That makes the door predictable and
impossible to talk into releasing something. The cost is that it misreads some
questions, so a visitor can always send a question to the owner (`for_owner`).

A language model belongs in front of this, turning free text into field names
and writing friendlier answers. It should never be the thing that decides what
may be released.

## Limits of the prototype

State is in memory and is lost on restart. There are no rate limits. The owner
key is a single shared secret. Booking does not talk to a real calendar. People
without an agent are verified by hand.
