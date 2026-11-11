// The hero. Inquiries drift in from the left, tangled and slow. They meet a
// door that is open at the top and shut at the bottom. What passes the open
// half leaves fast, straight and blue. What meets the shut half turns back.
// Drag the handle to move the split.

interface Particle {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  /** 0 outside, 1 through the door, 2 turned back */
  state: 0 | 1 | 2;
  life: number;
  seed: number;
  speed: number;
}

export interface FlowOptions {
  container: HTMLElement;
  canvas: HTMLCanvasElement;
  handle: HTMLButtonElement;
  labelOpen: HTMLElement;
  labelShut: HTMLElement;
  /** The light that falls through the open half. */
  glow: HTMLElement;
  /** Where the door's split should start, in pixels from the container's top. */
  initialSplit: () => number | null;
}

const INK = '18,20,24';
const BLUE = '21,51,255';
const FADE = 0.08;

export function startFlow(o: FlowOptions): void {
  const ctx = o.canvas.getContext('2d');
  if (!ctx) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0;
  let H = 0;
  let dpr = 1;
  let doorX = 0;
  let split = 0;
  let splitFrac = 0.5;
  let userMoved = false;
  let scale = 1;
  let particles: Particle[] = [];
  let running = false;
  let visible = true;
  let raf = 0;
  let last = 0;
  let t = 0;

  const rand = (a: number, b: number): number => a + Math.random() * (b - a);

  function spawn(p: Particle, anywhere: boolean): void {
    p.x = anywhere ? rand(-20, doorX) : rand(-60, -5);
    p.y = rand(0, H);
    p.px = p.x;
    p.py = p.y;
    p.vx = rand(0.2, 0.8) * scale;
    p.vy = 0;
    p.state = 0;
    p.life = 1;
    p.seed = rand(0, 6.283);
    p.speed = rand(0.75, 1.25);
  }

  function layout(): void {
    const r = o.container.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    o.canvas.width = Math.round(W * dpr);
    o.canvas.height = Math.round(H * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    const wide = W >= 900;
    doorX = Math.round(W * (wide ? 0.66 : 0.6));
    scale = Math.min(1.35, Math.max(0.7, W / 1280));
    if (!userMoved) {
      const s = wide ? o.initialSplit() : null;
      splitFrac = s === null ? 0.5 : Math.min(0.8, Math.max(0.2, s / H));
    }
    split = Math.round(H * splitFrac);
    const count = Math.round(Math.min(2300, Math.max(520, (W * H) / 520)));
    particles = Array.from({ length: count }, () => {
      const p = {} as Particle;
      spawn(p, true);
      return p;
    });
    ctx!.clearRect(0, 0, W, H);
    place();
  }

  function place(): void {
    o.handle.style.left = `${doorX}px`;
    o.handle.style.top = `${split}px`;
    o.handle.setAttribute('aria-valuenow', String(Math.round(splitFrac * 100)));
    o.labelOpen.style.left = `${doorX + 22}px`;
    o.labelOpen.style.top = `${split - 14}px`;
    o.labelShut.style.left = `${doorX + 22}px`;
    o.labelShut.style.top = `${split + 14}px`;
    o.glow.style.left = `${doorX}px`;
    o.glow.style.height = `${split}px`;
  }

  function step(dt: number): void {
    t += dt;
    for (const p of particles) {
      p.px = p.x;
      p.py = p.y;
      if (p.state === 1) {
        p.vx += (17 * scale * p.speed - p.vx) * 0.03 * dt;
        p.vy *= 0.86;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.x > W + 30) spawn(p, false);
        continue;
      }
      const th = (Math.sin(p.x * 0.0036 + t * 0.006 + p.seed) + Math.sin(p.y * 0.0054 - t * 0.004 + p.x * 0.0013)) * Math.PI;
      const drift = p.state === 0 ? 1.05 : -0.3;
      const swirl = p.state === 0 ? 1.55 : 1.9;
      p.vx += ((drift + Math.cos(th) * swirl) * scale * p.speed - p.vx) * 0.07 * dt;
      p.vy += (Math.sin(th) * swirl * scale * p.speed - p.vy) * 0.07 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.y < -4) { p.y += H + 8; p.py = p.y; }
      if (p.y > H + 4) { p.y -= H + 8; p.py = p.y; }
      if (p.state === 0) {
        if (p.x >= doorX) {
          if (p.y < split) {
            p.state = 1;
            p.vx = Math.max(p.vx, 1.6 * scale);
          } else {
            p.state = 2;
            p.x = doorX - 1.5;
            p.vx = -Math.abs(p.vx) - 0.6 * scale;
          }
        }
      } else {
        p.life -= 0.0055 * dt;
        if (p.x >= doorX - 1) { p.x = doorX - 1.5; p.vx = -Math.abs(p.vx); }
        if (p.life <= 0 || p.x < -30) spawn(p, false);
      }
    }
  }

  function draw(fade: number): void {
    const c = ctx!;
    // Fade what is already drawn by erasing a little of it. The canvas is
    // transparent, so old trails thin out to nothing and leave no tint.
    c.globalCompositeOperation = 'destination-out';
    c.fillStyle = `rgba(0,0,0,${fade})`;
    c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'source-over';

    c.lineCap = 'round';
    c.lineWidth = 1;
    c.strokeStyle = `rgba(${INK},0.4)`;
    c.beginPath();
    for (const p of particles) if (p.state === 0) { c.moveTo(p.px, p.py); c.lineTo(p.x, p.y); }
    c.stroke();

    c.strokeStyle = `rgba(${INK},0.3)`;
    c.beginPath();
    for (const p of particles) if (p.state === 2) { c.moveTo(p.px, p.py); c.lineTo(p.x, p.y); }
    c.stroke();

    // What got through: a long faint tail and a short bright head, never
    // reaching back past the door.
    c.lineWidth = 1.2;
    c.strokeStyle = `rgba(${BLUE},0.32)`;
    c.beginPath();
    for (const p of particles) if (p.state === 1) { c.moveTo(Math.max(doorX, p.x - p.vx * 15), p.y); c.lineTo(p.x, p.y); }
    c.stroke();
    c.lineWidth = 1.9;
    c.strokeStyle = `rgba(${BLUE},0.95)`;
    c.beginPath();
    for (const p of particles) if (p.state === 1) { c.moveTo(Math.max(doorX, p.x - p.vx * 4), p.y); c.lineTo(p.x, p.y); }
    c.stroke();

    // The door: nothing above the split, a solid leaf below it, a small shelf between.
    c.lineCap = 'butt';
    c.strokeStyle = `rgb(${INK})`;
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(doorX, split);
    c.lineTo(doorX, H);
    c.stroke();
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(doorX - 26, split);
    c.lineTo(doorX + 3, split);
    c.stroke();
    c.lineWidth = 1;
    c.strokeStyle = `rgba(${INK},0.22)`;
    c.setLineDash([2, 7]);
    c.beginPath();
    c.moveTo(doorX, 0);
    c.lineTo(doorX, split);
    c.stroke();
    c.setLineDash([]);
  }

  function frame(now: number): void {
    if (!running) return;
    const dt = Math.min(2.5, (now - last) / 16.67 || 1);
    last = now;
    step(dt);
    draw(FADE);
    raf = requestAnimationFrame(frame);
  }

  function setRunning(on: boolean): void {
    if (reduced) return;
    if (on && !running) {
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    } else if (!on && running) {
      running = false;
      cancelAnimationFrame(raf);
    }
  }

  function still(): void {
    // For people who asked for less motion: one settled frame, no animation.
    for (let i = 0; i < 260; i++) { step(1); draw(FADE); }
  }

  function moveSplit(clientY: number): void {
    const r = o.container.getBoundingClientRect();
    setSplit((clientY - r.top) / H);
  }

  function setSplit(frac: number): void {
    userMoved = true;
    splitFrac = Math.min(0.86, Math.max(0.14, frac));
    split = Math.round(H * splitFrac);
    o.handle.classList.add('moved');
    place();
    if (reduced) { ctx!.clearRect(0, 0, W, H); still(); }
  }

  o.handle.setAttribute('role', 'slider');
  o.handle.setAttribute('aria-orientation', 'vertical');
  o.handle.setAttribute('aria-valuemin', '14');
  o.handle.setAttribute('aria-valuemax', '86');
  o.handle.addEventListener('pointerdown', (e) => {
    o.handle.setPointerCapture(e.pointerId);
    o.handle.classList.add('dragging');
    e.preventDefault();
  });
  o.handle.addEventListener('pointermove', (e) => {
    if (o.handle.hasPointerCapture(e.pointerId)) moveSplit(e.clientY);
  });
  const release = (e: PointerEvent): void => {
    if (o.handle.hasPointerCapture(e.pointerId)) o.handle.releasePointerCapture(e.pointerId);
    o.handle.classList.remove('dragging');
  };
  o.handle.addEventListener('pointerup', release);
  o.handle.addEventListener('pointercancel', release);
  o.handle.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') { setSplit(splitFrac - 0.04); e.preventDefault(); }
    if (e.key === 'ArrowDown') { setSplit(splitFrac + 0.04); e.preventDefault(); }
  });

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => { layout(); if (reduced) still(); }, 120);
  });
  document.addEventListener('visibilitychange', () => setRunning(visible && !document.hidden));
  new IntersectionObserver((entries) => {
    visible = entries.some((en) => en.isIntersecting);
    setRunning(visible && !document.hidden);
  }).observe(o.container);

  layout();
  if (reduced) still();
  else {
    // Start with the field already in motion, not an empty page filling up.
    for (let i = 0; i < 140; i++) { step(1); draw(FADE); }
    setRunning(true);
  }
}
