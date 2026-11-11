# Start here

For Ian, the morning of 2026-11-11. Written by Claude overnight (ID, 2026-11-10).

## Where things stand

You asked for a business you could pursue by morning: buy a domain, put the
site up, get an email address, write to the first dozen. Here is what exists.

| Thing | State |
|---|---|
| Name | **Dutch Door**, a working name for you to confirm. Vestibule was dropped: vestibule.com is a New York commercial real estate software startup. |
| Site | Rebuilt in TypeScript on 2026-11-11 after the first version read as a wall of text. Lives in `site/`, builds to static files, one config file. A private preview is in your Claude artifacts ("Dutch Door Site Preview"). |
| Prototype | Works and is tested: front door, blind-match arbiter, signed buyer profiles, a listing page for people, an MCP endpoint for agents. `npm run demo`. |
| Plan | `BUSINESS.md`. Read the "How big this is" and "Risks" sections before you send anything. |
| First dozen | `gtm/first-dozen.md`, with 20 researched brokers behind it and a drafted opening line for each. |
| Drafts | `gtm/outreach.md`: first email, short version, follow-up, call questions, scorecard. Nothing has been sent. |
| Other ideas | `IDEAS.md`. |

## The one thing that will not work as you pictured it

**Do not send the first emails from the new domain on the day you buy it.**
A newly registered domain sits on a major spam blocklist for its first 24
hours, and Google makes you wait 24 to 72 hours before you can turn on email
signing for a new mailbox (`research/names-and-setup.md`, sections 2 and 3).
Twelve careful emails could land in spam and you would not know.

So the morning looks like this: buy the domain, put the site up, start the
mailbox, and send the first four emails from an address you already use. Move
to the new address on day three.

## This morning, in order

About 90 minutes of hands-on time. Time estimates are mine.

**1. Decide the name. 5 minutes.**
Dutch Door is my recommendation: the top opens so you can talk, the bottom
stays shut. Check `dutchdoor.com` before you fall for it. I could not check
availability from here. Open
`https://rdap.verisign.com/com/v1/domain/dutchdoor.com` in a browser: a 404
means it is unregistered. Fallbacks: `dutchdoorhq.com`, `getdutchdoor.com`.
Trademarks were not checked. Other candidates and what each collides with are
in `research/names-and-setup.md`, section 1.

**2. Get the repo onto GitHub. 5 minutes.**
I could not create a repository from my session, only push to ones that exist.
See "Pushing the repo" at the bottom.

**3. Buy the domain on Cloudflare. 10 minutes.**
Steps are in `research/names-and-setup.md`, section 2, "Shared steps". A .com
should cost about $11 a year. The exact price was not verified; the checkout
shows it.

**4. Edit `site/src/config.ts`. 5 minutes.**
Set `domain`, `email` and `postalAddress`. If you change the name, set
`brand`. Commit and push.

**5. Deploy the site on Cloudflare Pages. 15 minutes.**
Workers & Pages, Create application, Pages, Import an existing Git repository.
Production branch `main`, root directory `site`, build command
`npm run build`, build output directory `dist`. Then add the custom domain
from the Pages project, not by hand in DNS. These build settings were not
tested end to end.
I expect this works with a private repo once you approve GitHub access, but
that was not verified.

**6. Start a real mailbox. 30 minutes, plus waiting.**
Google Workspace Business Starter: $7 per user per month on the annual plan,
$8.40 on the flexible plan. Verify the domain, add the MX and SPF records,
turn on Gmail. Add DKIM when Google lets you (24 to 72 hours). Steps B1 to B7
in the research file. Do not build on Gmail's free "send mail as": Google is
ending it in January 2027.

**7. Get a postal address you are willing to put in an email. 5 minutes.**
US law asks for one in commercial email, including one-to-one. A street
address, a PO box or a registered private mailbox all count, so it does not
have to be your home.

**8. Read `gtm/first-dozen.md`, then send the first four. 30 minutes.**
From an address you already use. Check each name against Nottoway's own list
first; that file explains why.

## Decisions I made for you, to confirm or reverse

Each has its reasoning in `docs/decisions.md`.

1. The name, Dutch Door.
2. Brokers first, not "every business".
3. "No charge during the pilot" is on the site.
4. The site says a person on our side checks each buyer's NDA and proof of
   funds for now. That is your time and some liability.
5. Send order: weaker prospects first, strongest last.

## Three things I think you should hear plainly

1. **Brokers are a small market.** About 3,200 firms in the US. This is a
   place to prove the door works, then move to contractors and others. It is
   not, alone, a large business. Numbers are in `BUSINESS.md`.
2. **The best targets are also Nottoway's deal sources.** The brokers who fit
   this product list exactly the companies Nottoway wants to buy. Pitching
   them a product and asking them for deals in the same month weakens both.
   Decide broker by broker, and talk to Eric before you send.
3. **Nobody has measured the problem.** Every broker complains about
   unqualified buyers and no one has published how many or how many hours.
   Your first calls are the data. Ask before you show anything.

## What I could not do or check

- Create the GitHub repository (my session cannot).
- Check whether any domain is available, or any trademark.
- Hear the narration on last night's video. I only saw the frames.
- Confirm every contact detail. I spot-checked three of the twelve.
- Verify that listing sites let a broker point buyers to an outside page.
- Get a lawyer's view on broker licensing. Illinois and California define
  licensed activity broadly. Do this before you take money.

## To show it on a call

```
npm run serve:demo
```

It prints a link to a listing page for a fictional HVAC company. Ask it a
question, try the business name, request access. Then `npm run demo` in a
terminal shows three buyers' agents going through the same door.

## Next engineering steps, when a broker says yes

1. Save state to disk so a restart loses nothing.
2. Run the door, the arbiter and the MCP endpoint as one deployable service.
3. Let a person sign the NDA and upload proof of funds on the listing page.
4. Email the broker the summary instead of making them read an inbox endpoint.
5. Real calendar booking.

## Pushing the repo

Create an empty private repository on GitHub (no README, no license), named
`dutch-door` or whatever you prefer. Then either:

**If this session is still open,** tell Claude the repo name and it will push.

**Or do it yourself** from the bundle file Claude sent in the chat
(`dutch-door.bundle`):

```
git clone dutch-door.bundle dutch-door
cd dutch-door
git remote set-url origin https://github.com/davenpi/dutch-door.git
git push -u origin main
```
