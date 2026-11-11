# Blind-match arbiter

Two sides each hand over a private limit. Both learn one thing: whether a deal
is possible. Neither learns the other's number.

- `core.ts`: the logic, with no I/O.
- `server.ts`: the HTTP wrapper and the client a front door uses.

## Run it

```
ARBITER_CREATOR_KEYS=some-long-random-key npm run start:arbiter
```

A creator key lets a front door open checks. Give each front door its own.

## Why this is worth building

A human go-between cannot do this job. Once a person has heard your walk-away
price they cannot unsee it, and you have to trust that it will not color what
they say next. A program can be built to compare two numbers, answer yes or no,
and keep neither.

## Threat model, stated plainly

**What a party can learn.** One bit: whether the other side's limit is on the
right side of yours. If you submit a ceiling of 2.4M and hear "no overlap", you
know their floor is above 2.4M. That is the product, not a leak.

**Probing.** If a party could rerun the check with different numbers, a handful
of tries would pin down the other side's limit. Three things prevent it: a
submission cannot be changed, an outcome appears only after both submit, and the
same two principals cannot rerun the same deal during the cooldown.

**Fake identities.** The cooldown is keyed on principal ids, so it is only as
strong as the ids. This is why blind match sits behind qualification: the
front door only opens a check for a principal with a verified profile.

**The same asset under a new name.** A seller could relist under a new deal
reference to probe a buyer again. The buyer's agent should refuse a second
check on what is plainly the same business. Not enforced here.

**The operator.** This is the weak point and it is not hidden: whoever runs the
arbiter process could read a number while it sits in memory waiting for the
other side. The design limits the exposure (numbers are never written to disk
or to the log, and are dropped at comparison) but it rests on trusting the
operator. Ways to remove that trust, roughly in order of effort:

1. Run the arbiter as its own company or under a third party both sides know.
2. Run it inside a hardware enclave with remote attestation, so both sides can
   verify the exact code that saw their numbers.
3. Replace it with a two-party protocol (secure comparison) where no single
   machine ever holds both numbers.

Until one of those is done, say "trusted neutral operator" and never
"cryptographically private".

## What is logged

Session id, deal reference, party ids, event times, a commitment hash per
submission, and the outcome. `npm test` includes a test that fails if a
submitted number ever appears in the log.
