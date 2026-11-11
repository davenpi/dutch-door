# Site

The landing page. TypeScript, built with Vite into plain static files. No
framework, no analytics, no cookies, no outside requests: the two typefaces are
bundled with the site.

## What is on the page

- **The hero** is a live flow field (`src/flow.ts`). Inquiries drift in tangled
  and grey, meet a door that is open at the top and shut at the bottom, and
  what gets through leaves fast and blue. The handle on the door moves the
  split. The two headline lines are set to one measure by solving each line's
  width axis (`fitHeadline` in `src/main.ts`).
- **Ask it something** runs the door's release rule in the browser against a
  fictional listing (`src/door.ts`): public facts are answered, gated facts
  are held back, the seller's floor is never released.
- **Two numbers in, one word out** is the blind price check, as a demonstration.
- Everything else is one short line and a way to write to us.

People who ask their system for less motion get one settled frame of the hero
and no animation.

## Change the name, domain or email

Edit `src/config.ts`. It is the only file that holds them. Replace the two
`example.com` placeholders before going live.

## Run it

```
npm install
npm run dev        # local preview with live reload
npm run build      # type-checks, then writes the site to dist/
npm run preview    # serves dist/ locally
```

## Deploy

Any static host works. On Cloudflare Pages, connected to this repo:

| Setting | Value |
|---|---|
| Root directory | `site` |
| Build command | `npm run build` |
| Build output directory | `dist` |

These settings were not tested end to end. The rest of the morning's steps are
in the repo's top-level `START-HERE.md`.

## Keep it honest

The page makes no claim beyond the pilot: no testimonials, no customer names,
no statistics. The listing is labeled as made up and the price check as a
demonstration. Keep it that way until there are real ones.
