import '@fontsource-variable/anybody/wdth.css';
import '@fontsource-variable/instrument-sans/wdth.css';
import './style.css';
import { config } from './config';
import { ask, blindMatch, type Reply } from './door';
import { startFlow } from './flow';

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
};
const all = (selector: string): HTMLElement[] => Array.from(document.querySelectorAll<HTMLElement>(selector));

/* ---------- config ---------- */

function fillConfig(): void {
  const brand = config.brand.trim();
  const email = config.email.trim();
  if (brand) {
    all('[data-brand]').forEach((el) => (el.textContent = brand));
    document.title = `${brand}: a front door for AI agents`;
  }
  if (email) {
    const subject = encodeURIComponent(`${brand || 'Front door'} pilot`);
    all('[data-email-text]').forEach((el) => (el.textContent = email));
    all('[data-email-link]').forEach((el) => el.setAttribute('href', `mailto:${email}?subject=${subject}`));
  }
  if (config.founder.trim()) {
    all('[data-founder]').forEach((el) => (el.textContent = config.founder.trim()));
    all('[data-founder-wrap]').forEach((el) => (el.hidden = false));
  }
  if (config.calendarUrl.trim()) {
    all('[data-calendar]').forEach((el) => {
      el.setAttribute('href', config.calendarUrl.trim());
      el.setAttribute('rel', 'noopener');
      el.hidden = false;
    });
  }
  if (config.postalAddress.trim()) {
    all('[data-postal]').forEach((el) => {
      el.textContent = config.postalAddress.trim();
      el.hidden = false;
    });
  }
}

/* ---------- headline: two lines set to one measure ----------
   "Open" is set light and wide. "Shut" is set heavy and tight. Each line's
   width axis is solved so both end on the same right edge. */

function fitHeadline(): void {
  const h1 = $('headline');
  const lines = [$('l1'), $('l2')];
  h1.style.fontSize = '';
  const measure = h1.clientWidth;
  const widthAt = (el: HTMLElement, wdth: number): number => {
    el.style.fontVariationSettings = `"wdth" ${wdth}`;
    return el.getBoundingClientRect().width;
  };
  // Shrink the type only if the tighter line cannot fit at its narrowest.
  for (let i = 0; i < 6; i++) {
    const tightest = Math.max(...lines.map((l) => widthAt(l, 50)));
    if (tightest <= measure) break;
    const size = parseFloat(getComputedStyle(h1).fontSize);
    h1.style.fontSize = `${Math.floor(size * (measure / tightest) * 0.99)}px`;
  }
  for (const line of lines) {
    let lo = 50;
    let hi = 150;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      if (widthAt(line, mid) > measure) hi = mid;
      else lo = mid;
    }
    widthAt(line, lo);
  }
}

/* ---------- ask the door ---------- */

function setUpAsk(): void {
  const form = $<HTMLFormElement>('ask-form');
  const input = $<HTMLInputElement>('ask-input');
  const out = $('answers');

  const render = (question: string, replies: Reply[]): void => {
    out.textContent = '';
    const asked = document.createElement('p');
    asked.className = 'asked';
    asked.textContent = question;
    out.append(asked);
    replies.forEach((r, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'answer';
      wrap.dataset.status = r.status;
      wrap.style.animationDelay = `${i * 90}ms`;
      const who = document.createElement('p');
      who.className = 'who';
      who.textContent = r.label;
      const said = document.createElement('p');
      said.className = 'said';
      said.textContent = r.text;
      wrap.append(who, said);
      out.append(wrap);
    });
  };

  const run = (question: string): void => {
    const q = question.trim();
    if (!q) return;
    render(q, ask(q));
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    run(input.value);
  });
  $('chips').addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName !== 'BUTTON') return;
    input.value = target.textContent ?? '';
    run(input.value);
  });
}

/* ---------- blind match ---------- */

function setUpMatch(): void {
  const buyer = $<HTMLInputElement>('buyer-most');
  const seller = $<HTMLInputElement>('seller-least');
  const buyerOut = $('buyer-out');
  const sellerOut = $('seller-out');
  const verdict = $('verdict');
  const word = $('word');
  const money = (n: number): string => '$' + n.toLocaleString('en-US');
  const SEAL = '▮▮▮▮▮▮▮';
  let timer = 0;

  const show = (): void => {
    buyerOut.textContent = money(Number(buyer.value));
    sellerOut.textContent = money(Number(seller.value));
  };
  const reset = (): void => {
    window.clearTimeout(timer);
    verdict.dataset.state = 'idle';
    word.textContent = '';
    buyer.disabled = false;
    seller.disabled = false;
    show();
  };

  buyer.addEventListener('input', show);
  seller.addEventListener('input', show);
  $('again').addEventListener('click', reset);
  $('seal').addEventListener('click', () => {
    const result = blindMatch(Number(buyer.value), Number(seller.value));
    buyer.disabled = true;
    seller.disabled = true;
    buyerOut.textContent = SEAL;
    sellerOut.textContent = SEAL;
    verdict.dataset.state = 'sealing';
    const quick = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    timer = window.setTimeout(() => {
      word.textContent = result === 'overlap' ? 'Possible.' : 'No overlap.';
      verdict.dataset.state = result;
    }, quick ? 0 : 700);
  });
  show();
}

/* ---------- boot ---------- */

function boot(): void {
  fillConfig();
  setUpAsk();
  setUpMatch();
  fitHeadline();

  const flow = $('flow');
  startFlow({
    container: flow,
    canvas: $<HTMLCanvasElement>('flow-canvas'),
    handle: $<HTMLButtonElement>('handle'),
    labelOpen: $('label-open'),
    labelShut: $('label-shut'),
    glow: $('glow'),
    // Start the door's split on the seam between the two headline lines.
    initialSplit: () => {
      const seam = $('l2').getBoundingClientRect().top;
      const top = flow.getBoundingClientRect().top;
      return seam > top ? seam - top : null;
    },
  });

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(fitHeadline, 80);
  });
}

// The headline is measured, so wait for the display face before fitting it.
document.fonts.load('900 100px "Anybody Variable"').then(boot, boot);
