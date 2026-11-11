// The same front door, for a person in a browser. It shows the public facts,
// answers plain-word questions from them, and takes a request for access.
// Checking a person's NDA and proof of funds is done by hand during the pilot.

import type { Manifest } from './core.ts';

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (v: unknown): string => String(v).replace(/[&<>"']/g, (c) => ESCAPES[c]);

const LABELS: Record<string, string> = {
  industry: 'Industry',
  region: 'Where',
  asking_price_usd: 'Asking price',
  revenue_usd: 'Revenue',
  sde_usd: "Owner's earnings (SDE)",
  employees: 'Employees',
  years_in_business: 'Years in business',
  reason_for_sale: 'Reason for sale',
  real_estate_included: 'Real estate included',
  financing: 'Financing',
  owner_role: "Owner's role",
  business_name: 'Business name',
  customer_concentration: 'Customer concentration',
  financials_summary: 'Financials',
  identity_verified: 'Verified identity',
  funds_usd_at_least: 'Proof of funds',
  nda: 'Signed NDA',
};

export const label = (key: string): string => LABELS[key] || key.replace(/_usd$/, '').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

export function show(key: string, value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number' && key.includes('_usd')) return '$' + value.toLocaleString('en-US');
  if (typeof value === 'number') return value.toLocaleString('en-US');
  return String(value);
}

export interface ListingPageInput {
  /** The door's manifest. */
  manifest: Manifest;
  offerId: string;
  slug: string;
  brand?: string;
}

/** The page for one offer, or null if the door has no such offer. */
export function listingPage({ manifest, offerId, slug, brand = 'Dutch Door' }: ListingPageInput): string | null {
  const offer = manifest.offers.find((o) => o.id === offerId);
  if (!offer) return null;
  const facts = Object.entries(offer.public).map(([k, v]) => `<tr><th scope="row">${esc(label(k))}</th><td>${esc(show(k, v))}</td></tr>`).join('');
  const needs = Object.entries(offer.requirements).map(([k, v]) => `<li>${esc(label(k))}${k === 'funds_usd_at_least' ? ' of at least ' + esc(show(k, v)) : ''}</li>`).join('');
  const held = offer.gated_fields.map((k) => esc(label(k))).join(', ');
  const labels = JSON.stringify(LABELS).replace(/</g, '\\u003c');
  const ids = JSON.stringify({ slug, offerId }).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(offer.title)}</title>
<style>
:root{--bg:#EEF1F2;--surface:#FFFFFF;--text:#14222B;--muted:#586872;--line:#D2DADE;--accent:#8A5E00;--accent-2:#1B7672;
--body:-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;--display:Georgia,"Times New Roman",serif}
@media (prefers-color-scheme:dark){:root{--bg:#0F1A22;--surface:#17262F;--text:#ECE6D8;--muted:#8FA0AA;--line:#2C3E4A;--accent:#F0B341;--accent-2:#56C5C0;color-scheme:dark}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font-family:var(--body);font-size:17px;line-height:1.55}
main{max-width:760px;margin:0 auto;padding:36px 20px 64px;display:flex;flex-direction:column;gap:28px}
.eyebrow{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
h1{font-family:var(--display);font-weight:400;font-size:clamp(30px,6vw,44px);line-height:1.1;margin:6px 0 0;text-wrap:balance}
h2{font-size:19px;margin:0 0 10px}
section{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:22px}
table{border-collapse:collapse;width:100%}
th,td{text-align:left;vertical-align:top;padding:9px 0;border-top:1px solid var(--line)}
tr:first-child th,tr:first-child td{border-top:0}
th{font-weight:400;color:var(--muted);width:42%;padding-right:16px}
td{font-variant-numeric:tabular-nums}
p{margin:0 0 10px} ul{margin:0;padding-left:20px} .muted{color:var(--muted);font-size:15px}
label{display:block;font-size:15px;font-weight:600;margin:12px 0 4px}
input,textarea{width:100%;font:inherit;color:var(--text);background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:10px 12px}
textarea{min-height:84px;resize:vertical}
button{font:inherit;font-weight:600;margin-top:14px;padding:10px 18px;border-radius:8px;border:1px solid var(--accent);background:var(--accent);color:var(--bg);cursor:pointer}
input:focus-visible,textarea:focus-visible,button:focus-visible{outline:2px solid var(--accent-2);outline-offset:2px}
.out{margin-top:14px;padding-top:14px;border-top:1px solid var(--line)} .out:empty{display:none}
.out dt{color:var(--muted);font-size:15px} .out dd{margin:0 0 10px}
code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:14px;overflow-wrap:anywhere}
</style>
</head>
<body>
<main>
  <header>
    <div class="eyebrow">${esc(manifest.business.name)}</div>
    <h1>${esc(offer.title)}</h1>
  </header>

  <section aria-labelledby="facts"><h2 id="facts">What we can share now</h2><table>${facts}</table></section>

  <section aria-labelledby="ask">
    <h2 id="ask">Ask a question</h2>
    <p class="muted">Answers come from the facts above. Anything else goes to the broker.</p>
    <form id="ask-form">
      <label for="q">Your question</label>
      <input id="q" name="q" maxlength="300" required placeholder="Why is the owner selling?">
      <button type="submit">Ask</button>
    </form>
    <dl class="out" id="ask-out" aria-live="polite"></dl>
  </section>

  <section aria-labelledby="more">
    <h2 id="more">To see more</h2>
    <p>Held back for now: ${held || 'nothing'}. The broker releases these to buyers who provide:</p>
    <ul>${needs}</ul>
    <form id="access-form">
      <label for="name">Your name</label><input id="name" name="name" maxlength="120" required autocomplete="name">
      <label for="email">Email</label><input id="email" name="email" type="email" maxlength="200" required autocomplete="email">
      <label for="msg">Anything the broker should know (optional)</label><textarea id="msg" name="msg" maxlength="1000"></textarea>
      <button type="submit">Request access</button>
    </form>
    <p class="out" id="access-out" aria-live="polite"></p>
  </section>

  <p class="muted">Using an AI agent? It can use this same listing at <code>/b/${esc(slug)}/.well-known/front-door.json</code>. Front door by ${esc(brand)}.</p>
</main>
<script>
const LABELS = ${labels};
const IDS = ${ids};
const base = '/b/' + encodeURIComponent(IDS.slug);
const label = (k) => LABELS[k] || k.replace(/_usd$/, '').replace(/_/g, ' ');
const show = (k, v) => typeof v === 'boolean' ? (v ? 'Yes' : 'No') : (typeof v === 'number' && k.includes('_usd')) ? '$' + v.toLocaleString('en-US') : String(v);
async function post(path, body) {
  const res = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { ok: res.ok, data: await res.json() };
}
function line(out, term, text) {
  const dt = document.createElement('dt'); dt.textContent = term;
  const dd = document.createElement('dd'); dd.textContent = text;
  out.append(dt, dd);
}
document.getElementById('ask-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const out = document.getElementById('ask-out');
  out.textContent = '';
  try {
    const { data } = await post('/ask', { offer_id: IDS.offerId, question: document.getElementById('q').value });
    const answered = (data.answers || []).filter((a) => a.status !== 'not_available');
    for (const a of answered) line(out, label(a.field), a.status === 'answered' ? show(a.field, a.value) : 'Held back until the broker\\u2019s requirements are met.');
    if (data.escalated || answered.length === 0) line(out, 'For the broker', 'That one needs a person. Use the form below so the broker can reply.');
  } catch { line(out, 'Problem', 'The question did not go through. Please try again.'); }
});
document.getElementById('access-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const out = document.getElementById('access-out');
  try {
    const { ok, data } = await post('/request-access', { offer_id: IDS.offerId, name: document.getElementById('name').value, email: document.getElementById('email').value, message: document.getElementById('msg').value });
    out.textContent = ok ? 'Sent. The broker will reply by email with the NDA and next steps.' : (data.error && data.error.message) || 'That did not go through.';
    if (ok) e.target.reset();
  } catch { out.textContent = 'That did not go through. Please try again.'; }
});
</script>
</body>
</html>`;
}
