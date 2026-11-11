# Decisions

Newest first. Each entry says what was decided, why, and what would change it.
Entries marked **Ian to confirm** were made by Claude overnight so the work
could proceed; they are easy to reverse.

## 2026-11-11

**The landing page was rebuilt, and the whole repo moved to TypeScript.** (ID)
Ian's reaction to the first page was that it looked like a wall of text, and
he was right: about 750 words and no picture of the product. He asked for
TypeScript throughout and for something that looks like it belongs to the
next era, not a template. The new page is about 170 words. Its hero is the
product's idea drawn live: a flow that meets a door open at the top and shut
at the bottom. The two demos run real logic in the browser. The design is one
bright field, graphite ink and a single blue, with a variable-width display
face doing the work that illustrations would otherwise do.

**The page now leads with the idea, not with brokers.** Ian to confirm.
The headline and hero speak to any business. Brokers are named once, at the
end. That fits the ambition and costs some directness for the broker reading
it tomorrow. If the first replies show brokers do not see themselves in it,
add a broker-specific line under the headline.

## 2026-11-10

**Start with business brokers, not "every business".** (Claude for ID)
The front door is meant for every business, but a product for everyone is a
product nobody recognizes as theirs. Brokers have the sharpest version of the
problem (many inquiries, a hard confidentiality gate, a private price on both
sides) and Ian is on the other side of their inbox as a buyer. Change this if
the first dozen conversations show brokers do not feel the pain, or will not
put a listing behind software. Contracting is the second market to try.

**The door decides by rule, not by model.** (Claude for ID)
What may be released is a lookup: public, gated or private. A language model
can translate a question into field names but never makes the release
decision. A door that can be talked into something is worse than no door. The
cost is clumsy question matching, covered by "send this to the owner".

**The arbiter is a trusted operator, and we say so.** (Claude for ID)
Building real cryptographic privacy first would take weeks and would not tell
us whether anyone wants a blind price check. The honest wording is on the site
and in `arbiter/README.md`. Change this before any broker enters a real
seller's floor at scale.

**One blind check per buyer per listing, with a cooldown.** (Claude for ID)
Without it either side could find the other's number in a few tries. This
makes the check a commitment, which is the point.

**People are verified by hand during the pilot.** Ian to confirm.
The site says a person on our side checks each buyer's NDA and proof of funds.
That is work and some liability. The alternative is to leave verification with
the broker and only organize the paperwork for them. Decide before the first
real listing goes live.

**No charge during the pilot.** Ian to confirm.
It is on the site. It is the only pricing commitment anywhere.

**Working name: Dutch Door.** Ian to confirm.
A Dutch door is cut in half: the top opens so you can talk to whoever knocks,
the bottom stays shut. That is the product in one picture, and a broker can
say it and spell it on a phone call. The first working name was Vestibule; it
was dropped the same night because vestibule.com belongs to a New York
startup, founded in 2025, that sells lease software for commercial real
estate. No company named Dutch Door turned up in software, AI agents, identity
or brokerage, but **domain availability and trademarks were not checked**
(`research/names-and-setup.md`). The name appears in `site/src/config.ts`,
the `BRAND` environment variable, package names and prose.

**Zero dependencies in the core.** (Claude for ID)
The arbiter and the door are a few hundred lines each and should stay
readable in one sitting by someone deciding whether to trust them. The MCP
adapter needs the official SDK, so it lives in `mcp/` with its own packages.

**Private repo, fictional data only.** (Claude for ID)
Real seller figures are confidential and never go in git.
