# Names and morning setup

Researched 2026-11-10. Numbers in square brackets point to the source list in section 4.

## Read this first

- **Domain availability could not be checked.** This session's network policy refused connections to `rdap.verisign.com`, and the fetch tool would not open RDAP URLs. Every domain below says either "taken" (I found a live site on it) or "availability not checked". Nothing here says a domain is free. Run the RDAP check yourself before buying: `https://rdap.verisign.com/com/v1/domain/NAME.com` returns 404 when a .com is unregistered.
- **Trademarks were not checked with USPTO** for any name. The "risk" notes below come only from web searches for companies using the name.
- **Biggest finding on names:** `vestibule.com` belongs to a 2025 New York startup that sells commercial real estate software [1]. That is a direct conflict with the working name.
- **Biggest finding on setup:** Google says Gmail "Send as" for third-party addresses ends in January 2027, and that Gmail may already restrict new setups [50], [51]. Do not build your reply flow on it. Use a real mailbox (Option B).

## 1. Name candidates

### The five working names

| Name | Same-name companies found | Trademark risk | Fit | Domains |
|---|---|---|---|---|
| **Vestibule** | Vestibule, New York, founded 2025. Lease management and rent collection software for commercial real estate. Sells payments, a tenant portal and a portfolio tool to landlords [1]. | Not checked with USPTO. Obvious risk: same word, software, real estate, same city. | Good meaning. Hard to say and spell on a phone. The conflict is disqualifying. | `vestibule.com`: taken (live site) [1]. `vestibule.io`: taken (a page is indexed there; not opened). `vestibule.ai`, `vestibule.co`, `getvestibule.com`, `vestibulehq.com`: availability not checked. |
| **Transom** | Transom Capital Group, a private equity firm with portfolio companies [2]. TRANSOM at transom.co, a hiring and background-screening platform [3]. Transom, a Seattle creative agency [4]. | Not checked with USPTO. The private equity firm works in the same deal world as brokers. It sells investing, not software. | Deal people say "over the transom" for unsolicited inbound interest. That is the product. (This is my own knowledge of the phrase, no source checked.) Some people will not know the word. | `transom.co`: taken (live site) [3]. `transom.com`, `transom.ai`, `gettransom.com`, `transomhq.com`: availability not checked. |
| **Wicket** | Wicket (wicketsoft.com): facial authentication for venue entry, payment and secure areas [5]. Wicket (wicket.io): a "Member Data Platform" for associations [6], [7]. | Not checked with USPTO. One same-name company is in identity, which is close to what a front door does. | Short and easy to say. Most people hear cricket, not a small gate. | `wicket.io`: taken (live site) [7]. `wicket.com`, `wicket.ai`, `getwicket.com`, `wickethq.com`: availability not checked. |
| **Parley** | Parley (parley.so): Y Combinator Summer 2024 legal AI agent [8]. Parley Pro: contract negotiation software, now listed under Ontra [9]. Parley (parley.io): customer messaging software, Dutch [10]. | Not checked with USPTO. A same-name product already sells negotiation software [9]. | Best meaning for the arbiter: a talk between two sides. Crowded. Sounds like "Parler" on a call (my opinion). | `parley.com`: taken (it redirects to parley.tv, observed during fetch). `parley.io`: taken (live site) [10]. `parley.ai`, `getparley.com`, `parleyhq.com`: availability not checked. |
| **Gatehouse** | Gatehouse by Surehand (gatehouse.run): "The control layer for enterprise AI agents" [11]. GateHouse (gatehouse.ai): governed data access platform with agent and settlement modules [12]. Gatehouse Satcom and Gatehouse Maritime (gatehouse.com) [13]. Gatehouse SSO Login Hub, a Shopify identity app [14]. | Not checked with USPTO. Two same-name products already sit in AI agents and one in identity. | Plain word, easy to say. The most crowded of the five in your exact space. | `gatehouse.com`: taken (live site) [13]. `gatehouse.ai`: taken (live site) [12]. `getgatehouse.com`, `gatehousehq.com`, `gatehouse.co`: availability not checked. |

### Five ideas of my own

| Name | Same-name companies found | Trademark risk | Fit | Domains |
|---|---|---|---|---|
| **Dutch Door** | None found in software, AI agents, identity, real estate or business brokerage. Searches returned only door makers. | Not checked with USPTO. No obvious conflict found. | A door cut in half. You open the top to talk and pass things across. The bottom stays shut. That is the product in one picture. Two plain words. Easy to say and spell. | `dutchdoor.com`, `dutchdoorhq.com`, `getdutchdoor.com`, `dutchdoor.ai`, `dutchdoor.co`: availability not checked. |
| **Inquire Within** | No software company found. inquirewithin.com is a site for a spiritual self-help book [15]. inquirewithin.co is a therapy practice [16]. | Not checked with USPTO. No obvious conflict found in software. | The sign on a shop door. Every broker knows it. It says "ask your questions here". Long for a domain and an email address. | `inquirewithin.com`: taken (live site) [15]. `inquirewithin.co`: taken (live site) [16]. `inquirewithin.ai`, `getinquirewithin.com`, `inquirewithinhq.com`: availability not checked. |
| **Knock First** | KnockFirst, a small "family status" app launched in 2025 [17]. Close neighbor: Knock AI, a B2B agent that chats with prospects and qualifies them [18]. | Not checked with USPTO. The "Knock" family is crowded and Knock AI does similar work [18]. | States the rule: agents knock first. Friendly and short. Weaker than Dutch Door because of Knock AI. | `knockfirst.com`, `knockfirst.ai`, `getknockfirst.com`, `knockfirsthq.com`: availability not checked. |
| **Doorman** | DOOR (door.com) markets an AI "DOORMAN" for residential buildings [19]. Doorman (doorman.co), a last-mile delivery company [20]. | Not checked with USPTO. Same word already used for AI in real estate [19]. | Perfect meaning: screens visitors by the owner's rules. The real estate conflict hurts. | `doorman.co`: taken (live site) [20]. `doorman.com`, `doorman.ai`, `getdoorman.com`, `doormanhq.com`: availability not checked. |
| **Usher** | Usher, an identity product (push login, workstation unlock) on experience.usher.com [22]. usher.com is held by MicroStrategy and offered only for "strategic transactions", no price shown [21]. | Not checked with USPTO. Same word already used for identity software. | Easy word. Shows people in. The identity conflict and the locked .com rule it out. | `usher.com`: taken, not for normal sale [21]. `usher.ai`: taken (a for-sale page is indexed there; not opened). `getusher.com`, `usherhq.com`: availability not checked. |

Looked at and dropped: **Stoop** (a New York neighborhood app that already sells to small businesses [23]). **Anteroom** (anteroom.ai is a self-hosted AI gateway [24]; its PyPI package is archived [25]). **Screen Door** (ScreenDoor.ai does AI phone screening for recruiting [26]). **Lintel** (LintelAI is landlord software [27]). **Side Door** (Sidedoor is a job-referral tool [28]).

### Ranked top three

1. **Dutch Door.** Buy `dutchdoor.com` if the RDAP check returns 404. If it is taken, buy `dutchdoorhq.com`. Availability not checked for either.
2. **Transom.** Buy `transomhq.com`. Availability not checked. I assume `transom.com` is taken because one-word .com names usually are, but I did not check it. Go in knowing a private equity firm shares the name [2].
3. **Inquire Within.** `inquirewithin.com` is taken [15]. Buy `inquirewithin.ai`. Availability not checked. Cloudflare sells .ai and .co names at registry cost [34], [35]; the .ai price and minimum term are not verified.

Drop Vestibule as the public name. The .com owner sells real estate software in New York [1].

## 2. Morning setup, fastest reliable path

**Recommendation: Option B for email, with Cloudflare for the domain and the site.** Option A's reply path depends on a Gmail feature Google is removing.

### Shared steps (both options): domain and site on Cloudflare

Total hands-on time: about 25 to 35 minutes (my estimate).

**Step 1. Cloudflare account. About 5 minutes (my estimate).**
Create a Cloudflare account and verify the account email. Cloudflare requires a verified account email to register a domain [29].

**Step 2. Register the domain. About 5 minutes (my estimate).**
1. In the Cloudflare dashboard, go to the **Register domains** page [29].
2. Type the name. Select **Search** [29].
3. Select **Purchase** on the domain. Cloudflare runs a final availability check here [29].
4. Pick the term in the **Payment option** drop-down [29].
5. Enter contact details [29].
6. Under **Payment**, pick or enter a payment method [29].
7. Select **Complete purchase**. Registration may take up to 30 seconds [29].

Price: Cloudflare sells at registry plus ICANN cost with no markup [30], [31]. Cloudflare's own pages that I could open show no price list. A third-party tracker listed Cloudflare's .com at $10.46 a year, checked 2026-10-20 [32]. The .com wholesale fee then rose from $10.26 to $10.97 on 2026-11-01 [33]. So expect about $11.17 a year (my arithmetic, not verified). The checkout shows the real price.

Things to know: domains registered here must use Cloudflare nameservers [31]. Auto-renew is on by default [29]. ICANN blocks transfers for 60 days after registration [31].

**Step 3. Put the site on Cloudflare Pages from the GitHub repo. About 10 minutes (my estimate).**
The repo has the site in `site/` with no build step.
1. In the dashboard, go to **Workers & Pages** [36].
2. Select **Create application** [36].
3. Select the **Pages** tab [36].
4. Select **Import an existing Git repository** [36]. Approve GitHub access when asked.
5. Choose the repo. Select **Begin setup** [36].
6. In **Set up builds and deployments**: production branch `main`, build command `exit 0`, build output directory `site` [36]. Cloudflare says to use `exit 0` when there is no build, and that the build output directory is "where your application's content lives" [36], [37].
7. Leave **Root directory** alone. It defaults to the repo root [37].
8. Save and deploy. You get a `*.pages.dev` address.

Cost: Pages is on all plans [40]. The Free plan allows 500 builds a month, 20,000 files per site and 25 MiB per file [39].

Note: the Pages overview now carries a banner that says "Start new projects with Workers" [40]. Pages still works and its docs are current. If you prefer Workers: add a `wrangler.jsonc` at the repo root with `"name"`, `"compatibility_date"` and `"assets": { "directory": "./site" }` [43]. Then **Workers & Pages** > **Create application** > **GitHub** > pick the repo > **Save and Deploy** [41]. The Worker name in the dashboard must match `name` in the config [41]. The default deploy command is `npx wrangler deploy` [42]. Requests to static assets are free and unlimited [44]. Custom domain steps for Workers are in [45]; I did not open that page, so those steps are not verified.

**Step 4. Point the domain at the site. About 5 minutes (my estimate).**
1. **Workers & Pages** > your Pages project > **Custom domains** [38].
2. Select **Set up a domain** [38].
3. Enter the bare domain (for example `dutchdoor.com`). Select **Continue** [38].
4. Cloudflare creates the CNAME record for you, because the domain already uses Cloudflare nameservers [38].
5. Repeat for `www`.

Do not add the CNAME by hand first. That causes a 522 error [38]. The docs give no activation time [38].

### Option A: Cloudflare for everything, including email forwarding

**Cost:** domain only (about $11 a year, see above). Email Routing is unlimited on the free plan [48].

**Step A1. Turn on Email Routing. About 10 minutes (my estimate).**
1. In the dashboard go to **Compute** > **Email Service** > **Email Routing**. Select **Onboard Domain** [46]. Cloudflare adds the records for you [46]: three MX records (`route1.mx.cloudflare.net`, `route2.mx.cloudflare.net`, `route3.mx.cloudflare.net`), an SPF TXT record `v=spf1 include:_spf.mx.cloudflare.net ~all`, and a DKIM TXT record at `cf2024-1._domainkey` [46].
2. Go to **Destination Addresses**. Enter your personal Gmail address [47].
3. Open the email from Cloudflare. Select **Verify email address** [47]. Rules stay disabled until you do [47].
4. Go to **Routing Rules** > **Create routing rule** [47].
5. In **Email pattern** type the name part (for example `ian`). Pick the domain [47].
6. **Action**: **Send to an email**. **Destination**: your verified Gmail [47].

Mail sent to you@yourdomain now lands in your Gmail.

**Step A2. Replying from the new address. This is the weak point.**
- Email Routing only receives and forwards. To send, Gmail "Send mail as" needs an SMTP server and a login for it [50].
- **Google is ending this.** Its help page says: "Starting January 2027, Gmail will no longer support the 'Send as' feature for third-party email addresses" [50]. Google's timeline says existing setups keep working through Q3 and Q4 2026, but Gmail "may restrict new configurations" now [51].
- Google's pages do not say whether a custom-domain address sent through `smtp.gmail.com` with an app password counts as "third-party" [51]. **Not verified.** A forwarding provider's guide says that method "will stop working" in January 2027 and "lacks proper email authentication" [53].
- If you try it anyway, the commonly described settings are: server `smtp.gmail.com`, port 587 with TLS, your Gmail address as username, and a Google app password [53]. App passwords need 2-Step Verification, and Google says they "aren't recommended" [52]. Guides also tell you to change SPF to `v=spf1 include:_spf.mx.cloudflare.net include:_spf.google.com ~all` and add a DMARC record with `p=none` [54]. I did not test any of this. Treat it as not verified and short-lived.
- Cloudflare now has its own sending product in beta. It has an SMTP server at `smtp.mx.cloudflare.net`, port 465, username `api_token`, password a Cloudflare API token [49]. Sending to arbitrary recipients needs the Workers Paid plan [48], which has a $5 a month minimum [44]. It includes 3,000 emails a month [48]. Whether Gmail "Send mail as" accepts it today is not verified, and the January 2027 removal would hit it too.

**Verdict on A:** fine for receiving mail tomorrow. Not reliable for sending.

**SPF, DKIM and DMARC for Option A:** Cloudflare adds SPF and DKIM for routing when you onboard the domain [46]. Add DMARC yourself: a TXT record named `_dmarc` with value `v=DMARC1; p=none; rua=mailto:you@yourdomain.com`. Cloudflare recommends `p=none` for new setups [46].

### Option B: a real mailbox (Google Workspace Business Starter) plus Cloudflare Pages

**Cost:** $7.00 per user per month on an annual plan, or $8.40 per user per month on the flexible plan [56]. There is a 14-day trial, and Starter includes 30 GB pooled storage per user [55]. Plus the domain. Pages stays free.

Do the shared steps 1 to 4 first. **Do not turn on Cloudflare Email Routing in this option.** Google says to remove any MX records that are not Google's [58].

Hands-on time: about 30 to 40 minutes (my estimate), plus waiting periods that Google states below.

Where DNS records go: in the Cloudflare dashboard, open the domain, then **DNS** > **Records** > **Add record**. (Menu names from memory, not verified today.)

**Step B1. Sign up. About 10 minutes (my estimate).**
Start at the Workspace pricing page [55]. Pick Business Starter. Say you already own the domain. Create your user (for example `ian@yourdomain.com`). The exact signup screens are not verified.

**Step B2. Verify the domain. About 5 minutes of work.**
1. In the Google Admin console go to **Account** > **Domains** > **Manage domains** [57].
2. Select **Verify domain**, then **Get started**. Choose "My domain uses a different host". Select **Continue** [57].
3. Copy the TXT value. It starts with `google-site-verification=` [57].
4. In Cloudflare add a TXT record. Name `@`. Value: the copied text [57].
5. Back in the Admin console select **Confirm** [57].
Google says this "can take up to 72 hours" [57]. It is usually much faster on Cloudflare DNS (my experience, not verified).

**Step B3. MX record and turn on Gmail. About 5 minutes of work.**
1. In Cloudflare, delete any other MX records [58].
2. Add one MX record: name `@`, priority `1`, value `smtp.google.com` [58].
3. In the Admin console go to **Account** > **Domains** > **Manage domains**. Select **Activate Gmail** [58].
Google allows up to 72 hours for this to spread [58].

**Step B4. SPF. About 2 minutes.**
Add a TXT record. Name `@`. Value `v=spf1 include:_spf.google.com ~all` [59]. Google says it can take up to 48 hours to start working [59].

**Step B5. DKIM. About 5 minutes of work, but there may be a wait first.**
1. Admin console > **Apps** > **Google Workspace** > **Gmail** [60].
2. Select **Authenticate email** [60].
3. Pick your domain in **Selected domain** [60].
4. Select **Generate New Record**. Choose 2048-bit. Keep the default prefix `google`. Select **Generate** [60].
5. In Cloudflare add a TXT record named `google._domainkey` with the value shown [60].
6. Back in the Admin console select **Start authentication** [60].
Google says you "must wait 24 to 72 hours" after turning on Gmail before you can get the key, and that DKIM can take up to 48 hours to start working [60]. So DKIM may not be live on day one. Gmail's rule for small senders is SPF or DKIM, not both [63].

**Step B6. DMARC. About 2 minutes.**
Add a TXT record. Name `_dmarc`. Value `v=DMARC1; p=none; rua=mailto:you@yourdomain.com`. Google recommends starting with `p=none` and always including `rua` [61]. Google says to allow 48 hours after SPF and DKIM before adding DMARC [61].

**Step B7. Test. About 5 minutes.**
Send a message from the new address to a personal Gmail and to one non-Gmail address. In Gmail open "Show original" and look for SPF and DKIM results. (General practice, no source checked.)

### Could you host on GitHub Pages instead?

Yes, but it is more work for a `site/` folder. Branch publishing only serves the repo root or `/docs` [62]. Any other folder needs a GitHub Actions workflow that uses `actions/upload-pages-artifact` and `actions/deploy-pages` [62]. On GitHub Free it only works for public repos [62]. Cloudflare Pages takes `site` as a setting, so it is the faster path.

## 3. Sending the first dozen emails from a brand-new domain

**The volume is not the problem.** Gmail's bulk rules start at more than 5,000 messages a day to Gmail accounts [63]. Twelve hand-written emails are nowhere near that. Every sender still needs SPF or DKIM, TLS, and a spam complaint rate under 0.3% [63]. Workspace covers the first two once B4 is done.

**The age of the domain is the problem.**
- Spamhaus puts every newly registered domain on its Zero Reputation Domains list for 24 hours. It does not accept removal requests [64].
- Spamhaus also tells senders not to use a newly registered domain as a From domain "unless the domain is properly warmed up", and suggests waiting 30 days [65]. That advice is written with larger senders in mind (my reading).
- I did not verify whether filters that use this list also act on a new domain when it appears only as a link in the body.

**Day one: send from your existing personal address.** It has history. The new domain has none and is on a blocklist for its first 24 hours [64]. Sign with your name and the company name. If you can, leave the new domain's link out of these first emails, or buy the domain tonight so the 24 hours have passed by morning. Use your real name and say plainly who you are. The main anti-abuse industry group calls cold email that hides behind lookalike domains or disguises itself as personal mail an abusive practice [67].

**From day two or three: move to the new domain.** Wait until the 24 hours have passed [64] and a test message shows SPF passing. DKIM is better still, once Google lets you turn it on [60]. Then send a few a day. Spamhaus says to "start sending slowly, and consistently" and not to send the whole day's volume in one burst [65]. Gmail says the same: start low and increase slowly [63].

**What to avoid.**
- **Link shorteners.** Spamhaus: "Do not use free or unbranded URL shorteners" [65]. Postmark says filters may flag them [66]. Gmail wants links "visible and easy to understand" [63].
- **Attachments.** Postmark: "If you can avoid it, don't use attachments" [66]. Link to a page on your own site instead [66].
- **Tracking pixels and click tracking.** The sources I read do not rule on open pixels. Not verified. My advice is to skip them: they add hidden content and rewritten links, and Gmail says not to hide content and to keep links visible [63].
- **Mail-merge tools and sending all twelve at once.** Write each one. Spread them through the day [65].
- **Sales words in the subject.** Postmark says to remove spammy words from the subject and body [66].
- Plain text, one visible full link at most, a real signature.

**CAN-SPAM for a one-to-one B2B email.** This is a summary of the FTC guide, not legal advice.
- The law "covers all commercial messages" and "makes no exception for business-to-business email" [68]. The FTC says it "doesn't apply just to bulk email" [68]. A message is commercial when its primary purpose is to advertise or promote a product or service [68].
- **Honest headers.** Your From, Reply-To and routing information must be accurate and identify you [68].
- **Honest subject.** The subject must reflect the content [68].
- **Say it is an ad.** The law gives "a lot of leeway" in how, but it must be clear [68]. A plain sentence saying you are writing to introduce your product does this (my reading).
- **Physical postal address.** It must be a valid one: your current street address, a PO box registered with the Postal Service, or a private mailbox registered with a commercial mail receiving agency [68]. So you do not have to use a home address.
- **Opt-out.** Tell the reader how to stop future emails. A reply email is an acceptable method [68]. You cannot charge a fee or ask for more than a reply or one web page [68]. The opt-out must work for at least 30 days, and you must honor a request within 10 business days [68]. Keep a simple do-not-contact list from day one.
- **Penalty.** Up to $53,088 for each email in violation [68].

A footer that covers it: your name, company name, postal address, and one line such as "If you would rather not hear from me again, reply and say so."

## 4. Sources

Names:

1. Vestibule, About. https://vestibule.com/about/
2. Transom Capital Group. https://transomcap.com/?p=15
3. TRANSOM (transom.co). https://www.transom.co/home-archive/
4. Crunchbase, Transom (creative agency). https://www.crunchbase.com/organization/transom
5. Wicket, Who We Are. https://www.wicketsoft.com/who-we-are
6. G2, Wicket. https://www.g2.com/products/wicket
7. Wicket (member data platform). https://wicket.io/
8. Y Combinator, Parley. https://ycombinator.com/companies/parley
9. Stork.ai, Ontra (Parley Pro). https://www.stork.ai/en/ontra-parley-pro
10. Parley (parley.io). https://www.parley.io/
11. AI Agents Directory, Gatehouse. https://aiagentsdirectory.com/agent/gatehouse
12. GateHouse, Security and trust. https://gatehouse.ai/security
13. Gatehouse Satcom and Gatehouse Maritime. https://gatehouse.com/
14. Shopify App Store, Gatehouse SSO Login Hub. https://apps.shopify.com/gatehouse
15. Inquire Within: A Guide to Living in Spirit. https://www.inquirewithin.com/
16. Inquire Within (therapy services). https://inquirewithin.co/services
17. Product Hunt, KnockFirst. https://www.producthunt.com/posts/knockfirst
18. Knock AI. https://knock-ai.com/pricing
19. The DOOR App, Doorman AI. https://door.com/pages/services-doorman-ai
20. Doorman (delivery), About. https://www.doorman.co/about/
21. usher.com. https://usher.com/
22. Experience Usher. https://experience.usher.com/
23. Stoop for Small Businesses. https://www.stoophq.com/for-businesses
24. Anteroom. https://anteroom.ai/
25. PyPI, anteroom. https://pypi.org/project/anteroom/1.159.0/
26. Village, ScreenDoor.ai. https://village.ai/company/screendoor-ai
27. G2, LintelAI. https://www.g2.com/products/lintelai/reviews
28. AI Indigo, Sidedoor. https://aiindigo.com/tool/sidedoor

Setup:

29. Cloudflare Registrar docs, Register a new domain. https://developers.cloudflare.com/registrar/get-started/register-domain/
30. Cloudflare Registrar docs, Overview. https://developers.cloudflare.com/registrar/
31. Cloudflare Registrar docs, FAQ. https://developers.cloudflare.com/registrar/faq/
32. CostGoat, .com registrar price comparison (third party). https://costgoat.com/compare/domains/com
33. Openprovider, .com price increase 2026 (third party). https://www.openprovider.com/blog/com-price-increase-domain-resellers
34. Cloudflare, Buy .ai domains. https://www.cloudflare.com/application-services/products/registrar/buy-ai-domains/
35. Cloudflare, Buy .co domains. https://www.cloudflare.com/application-services/products/registrar/buy-co-domains/
36. Cloudflare Pages docs, Static HTML. https://developers.cloudflare.com/pages/framework-guides/deploy-anything/
37. Cloudflare Pages docs, Build configuration. https://developers.cloudflare.com/pages/configuration/build-configuration/
38. Cloudflare Pages docs, Custom domains. https://developers.cloudflare.com/pages/configuration/custom-domains/
39. Cloudflare Pages docs, Limits. https://developers.cloudflare.com/pages/platform/limits/
40. Cloudflare Pages docs, Overview. https://developers.cloudflare.com/pages/
41. Cloudflare Workers docs, Builds. https://developers.cloudflare.com/workers/ci-cd/builds/
42. Cloudflare Workers docs, Builds configuration. https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
43. Cloudflare Workers docs, static site migration guide (wrangler example). https://developers.cloudflare.com/workers/static-assets/migration-guides/vercel-to-workers/static-site/
44. Cloudflare Workers docs, Pricing. https://developers.cloudflare.com/workers/platform/pricing/
45. Cloudflare Workers docs, Custom Domains (not opened). https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
46. Cloudflare Email Service docs, Domain configuration. https://developers.cloudflare.com/email-service/configuration/domains/
47. Cloudflare Email Service docs, Email routing rules and addresses. https://developers.cloudflare.com/email-service/configuration/email-routing-addresses/
48. Cloudflare Email Service docs, Pricing. https://developers.cloudflare.com/email-service/platform/pricing/
49. Cloudflare changelog, Authenticated SMTP submission now available in beta (2026-06-08). https://developers.cloudflare.com/changelog/post/2026-06-08-smtp-submission/
50. Gmail Help, Send emails from a different address or alias. https://support.google.com/mail/answer/22370?hl=en
51. Gmail Help, Learn about changes to third-party email account support in Gmail. https://support.google.com/mail/answer/17101213?hl=en
52. Google Account Help, Sign in with app passwords. https://support.google.com/accounts/answer/185833?hl=en
53. ImprovMX, Sending emails using Gmail's "send mail as" (third party). https://improvmx.com/guides/gmail-smtp-faq
54. Boris Mann, Using Gmail SMTP with Cloudflare Email Routing (third party). https://bmannconsulting.com/notes/using-gmail-smtp-with-cloudflare-email-routing/
55. Google Workspace, pricing page. https://workspace.google.com/pricing
56. Google Workspace Admin Help, price updates. https://support.google.com/a/answer/15400543
57. Google Workspace Help, Verify your domain with a TXT record. https://knowledge.workspace.google.com/admin/domains/verify-your-domain-with-a-txt-record
58. Google Workspace Help, Set up MX records for Google Workspace. https://knowledge.workspace.google.com/admin/domains/set-up-mx-records-for-google-workspace?hl=en
59. Google Workspace Help, Set up SPF. https://knowledge.workspace.google.com/admin/security/set-up-spf
60. Google Workspace Help, Set up DKIM. https://knowledge.workspace.google.com/admin/security/set-up-dkim
61. Google Workspace Help, Set up DMARC. https://knowledge.workspace.google.com/admin/security/set-up-dmarc
62. GitHub Docs, Configuring a publishing source for your GitHub Pages site. https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

Sending:

63. Gmail Help, Email sender guidelines. https://support.google.com/mail/answer/81126?hl=en
64. Spamhaus, Zero Reputation Domain (ZRD) FAQ. https://www.spamhaus.org/faqs/zero-reputation-domain-zrd/
65. Spamhaus, Sender Guidelines. https://www.spamhaus.org/sender-guidelines/
66. Postmark, 13 reasons why your emails go into the spam folder. https://postmarkapp.com/blog/why-are-my-emails-going-to-spam
67. M3AAWG, Position on Cold Email (November 2025). https://www.m3aawg.org/sites/default/files/doc_files/m3aawg_position_on_cold_email.2025_0.pdf
68. FTC, CAN-SPAM Act: A Compliance Guide for Business. https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business

Blocked during research: `https://rdap.verisign.com/com/v1/domain/...` (refused by this session's network policy, so no RDAP lookups ran).

[1]: https://vestibule.com/about/
[2]: https://transomcap.com/?p=15
[3]: https://www.transom.co/home-archive/
[4]: https://www.crunchbase.com/organization/transom
[5]: https://www.wicketsoft.com/who-we-are
[6]: https://www.g2.com/products/wicket
[7]: https://wicket.io/
[8]: https://ycombinator.com/companies/parley
[9]: https://www.stork.ai/en/ontra-parley-pro
[10]: https://www.parley.io/
[11]: https://aiagentsdirectory.com/agent/gatehouse
[12]: https://gatehouse.ai/security
[13]: https://gatehouse.com/
[14]: https://apps.shopify.com/gatehouse
[15]: https://www.inquirewithin.com/
[16]: https://inquirewithin.co/services
[17]: https://www.producthunt.com/posts/knockfirst
[18]: https://knock-ai.com/pricing
[19]: https://door.com/pages/services-doorman-ai
[20]: https://www.doorman.co/about/
[21]: https://usher.com/
[22]: https://experience.usher.com/
[23]: https://www.stoophq.com/for-businesses
[24]: https://anteroom.ai/
[25]: https://pypi.org/project/anteroom/1.159.0/
[26]: https://village.ai/company/screendoor-ai
[27]: https://www.g2.com/products/lintelai/reviews
[28]: https://aiindigo.com/tool/sidedoor
[29]: https://developers.cloudflare.com/registrar/get-started/register-domain/
[30]: https://developers.cloudflare.com/registrar/
[31]: https://developers.cloudflare.com/registrar/faq/
[32]: https://costgoat.com/compare/domains/com
[33]: https://www.openprovider.com/blog/com-price-increase-domain-resellers
[34]: https://www.cloudflare.com/application-services/products/registrar/buy-ai-domains/
[35]: https://www.cloudflare.com/application-services/products/registrar/buy-co-domains/
[36]: https://developers.cloudflare.com/pages/framework-guides/deploy-anything/
[37]: https://developers.cloudflare.com/pages/configuration/build-configuration/
[38]: https://developers.cloudflare.com/pages/configuration/custom-domains/
[39]: https://developers.cloudflare.com/pages/platform/limits/
[40]: https://developers.cloudflare.com/pages/
[41]: https://developers.cloudflare.com/workers/ci-cd/builds/
[42]: https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
[43]: https://developers.cloudflare.com/workers/static-assets/migration-guides/vercel-to-workers/static-site/
[44]: https://developers.cloudflare.com/workers/platform/pricing/
[45]: https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
[46]: https://developers.cloudflare.com/email-service/configuration/domains/
[47]: https://developers.cloudflare.com/email-service/configuration/email-routing-addresses/
[48]: https://developers.cloudflare.com/email-service/platform/pricing/
[49]: https://developers.cloudflare.com/changelog/post/2026-06-08-smtp-submission/
[50]: https://support.google.com/mail/answer/22370?hl=en
[51]: https://support.google.com/mail/answer/17101213?hl=en
[52]: https://support.google.com/accounts/answer/185833?hl=en
[53]: https://improvmx.com/guides/gmail-smtp-faq
[54]: https://bmannconsulting.com/notes/using-gmail-smtp-with-cloudflare-email-routing/
[55]: https://workspace.google.com/pricing
[56]: https://support.google.com/a/answer/15400543
[57]: https://knowledge.workspace.google.com/admin/domains/verify-your-domain-with-a-txt-record
[58]: https://knowledge.workspace.google.com/admin/domains/set-up-mx-records-for-google-workspace?hl=en
[59]: https://knowledge.workspace.google.com/admin/security/set-up-spf
[60]: https://knowledge.workspace.google.com/admin/security/set-up-dkim
[61]: https://knowledge.workspace.google.com/admin/security/set-up-dmarc
[62]: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
[63]: https://support.google.com/mail/answer/81126?hl=en
[64]: https://www.spamhaus.org/faqs/zero-reputation-domain-zrd/
[65]: https://www.spamhaus.org/sender-guidelines/
[66]: https://postmarkapp.com/blog/why-are-my-emails-going-to-spam
[67]: https://www.m3aawg.org/sites/default/files/doc_files/m3aawg_position_on_cold_email.2025_0.pdf
[68]: https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business
