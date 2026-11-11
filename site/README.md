# Site

The landing page. Plain static files: no build step, no dependencies. The only
outside load is Google Fonts.

| File | What it is |
|---|---|
| `index.html` | The page |
| `styles.css` | All styling, light and dark themes |
| `app.js` | Fills in the config values and runs the price check demo |
| `config.js` | The values you change |
| `favicon.svg` | Browser tab icon |

## Change the name, domain or email

Edit `config.js`. It is the only file that holds them.

| Value | What it does |
|---|---|
| `BRAND` | The business name, shown in the header, footer, page title and email subject |
| `DOMAIN` | The domain the site is served from |
| `EMAIL` | The address every contact link opens |
| `FOUNDER` | Optional. A name shown under "Where this stands". Empty hides it |
| `CALENDAR_URL` | Optional. A scheduling link. Empty hides the "Book a 15-minute call" button |
| `POSTAL_ADDRESS` | Optional. A postal address in the footer. Empty hides it |

Before going live, replace the two `example.com` placeholders (`DOMAIN` and
`EMAIL`).

## Preview on your computer

From this folder:

```
python3 -m http.server 8000
```

Then open http://localhost:8000. Opening `index.html` straight from disk also
works.

## Deploy

Deployment steps live in the repo's top-level `START-HERE.md`. Any static host
works: point it at this `site/` folder with no build command.

## Notes

- Contact is a plain `mailto:` link. There is no form, no analytics, no
  cookies and no tracking.
- The price check on the page is a demonstration. It runs in the visitor's
  browser and sends nothing anywhere. The real arbiter lives in `arbiter/`.
- The page makes no claims beyond the pilot: no testimonials, no customer
  names, no statistics. Keep it that way until there are real ones.
