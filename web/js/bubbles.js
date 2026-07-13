// A sea of little chat bubbles behind the page. They are SOLID: they collide and never overlap,
// they bounce off the walls, they keep clear of the big center message box, and they flee the
// cursor / touch. Pure canvas, cheap. Respects prefers-reduced-motion (still scatter, no loop).

const cvs = document.getElementById('bubbleSea');
if (cvs) {
  const ctx = cvs.getContext('2d');
  const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cards = () => document.querySelectorAll('.card-bubble');

  // confetti pastels (approved palette) — used in light mode
  const COLORS = ['#F7B8C4', '#F6A99A', '#F4D06F', '#9BD8A0', '#A6C8F0', '#C9B8E8', '#F2A6C2', '#8FE0C6'];
  // Damla's hand-generated textured ivory bubbles (dark mode sprites)
  const sprites = Array.from({ length: 14 }, (_, i) => {
    const im = new Image(); im.src = `./assets/bubbles/b${String(i).padStart(2, '0')}.png?v=9`; return im;
  });
  const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';

  let W = 0, H = 0, DPR = 1;
  let bubbles = [];                          // each: {x,y = CENTER, w, h, r, vx, vy, color, alpha}
  const pointer = { x: -9999, y: -9999, on: false };

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = cvs.clientWidth; H = cvs.clientHeight;
    cvs.width = Math.round(W * DPR); cvs.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    // fewer, so a solid sea has room to breathe without constant gridlock
    const target = Math.min(34, Math.max(10, Math.round((W * H) / 42000)));
    if (bubbles.length !== target) spawn(target);
  }

  function spawn(n) {
    bubbles = [];
    let guard = 0;
    while (bubbles.length < n && guard++ < n * 60) {
      const w = rand(52, 118), h = w * rand(0.7, 0.82), r = Math.max(w, h) / 2;
      const x = rand(r, W - r), y = rand(r, H - r);
      if (bubbles.some((b) => Math.hypot(b.x - x, b.y - y) < b.r + r + 6)) continue; // no overlap at birth
      bubbles.push({ x, y, w, h, r, vx: rand(-0.2, 0.2), vy: rand(-0.18, 0.18),
        color: COLORS[bubbles.length % COLORS.length], alpha: rand(0.6, 0.9),
        sprite: sprites[Math.floor(Math.random() * sprites.length)] });
    }
  }

  function bubblePath(cx, cy, w, h) {
    const x = cx - w / 2, y = cy - h / 2, r = Math.min(w, h) * 0.42;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.moveTo(x + r * 0.7, y + h - 1);          // little tail, bottom-left
    ctx.lineTo(x + 1, y + h + h * 0.26);
    ctx.lineTo(x + r * 1.7, y + h - 1);
    ctx.closePath();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const dark = isDark();
    for (const b of bubbles) {
      ctx.globalAlpha = b.alpha;
      const s = b.sprite;
      if (dark && s && s.complete && s.naturalWidth) {
        const dw = b.w * 2, dh = dw * (s.naturalHeight / s.naturalWidth);
        ctx.drawImage(s, b.x - dw / 2, b.y - dh / 2, dw, dh);
      } else {
        ctx.fillStyle = b.color;
        bubblePath(b.x, b.y, b.w, b.h); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function collide() {
    for (let i = 0; i < bubbles.length; i++) {
      for (let j = i + 1; j < bubbles.length; j++) {
        const a = bubbles[i], b = bubbles[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        let d = Math.hypot(dx, dy); const min = a.r + b.r;
        if (d < min && d > 0) {
          const nx = dx / d, ny = dy / d, push = (min - d) / 2;
          a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
          const p = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;   // exchange along normal (equal mass)
          if (p < 0) { a.vx += p * nx; a.vy += p * ny; b.vx -= p * nx; b.vy -= p * ny; }
        }
      }
    }
  }

  // Keep the sea out of every message-box bubble on the page.
  function avoidRect(b, rc) {
    const pad = 10;
    const l = rc.left - pad, t = rc.top - pad, rr = rc.right + pad, bo = rc.bottom + pad;
    if (b.x + b.r < l || b.x - b.r > rr || b.y + b.r < t || b.y - b.r > bo) return;
    const nx = clamp(b.x, l, rr), ny = clamp(b.y, t, bo);
    let dx = b.x - nx, dy = b.y - ny, d = Math.hypot(dx, dy);
    if (d > 0.001) {                                 // outside the rect, near an edge
      if (d < b.r) { const ov = b.r - d; b.x += (dx / d) * ov; b.y += (dy / d) * ov;
        const p = b.vx * (dx / d) + b.vy * (dy / d); if (p < 0) { b.vx -= 2 * p * (dx / d) * 0.6; b.vy -= 2 * p * (dy / d) * 0.6; } }
    } else {                                          // center inside the box → shove to nearest edge
      const toL = b.x - l, toR = rr - b.x, toT = b.y - t, toB = bo - b.y;
      const m = Math.min(toL, toR, toT, toB);
      if (m === toL) { b.x = l - b.r; b.vx = -Math.abs(b.vx); }
      else if (m === toR) { b.x = rr + b.r; b.vx = Math.abs(b.vx); }
      else if (m === toT) { b.y = t - b.r; b.vy = -Math.abs(b.vy); }
      else { b.y = bo + b.r; b.vy = Math.abs(b.vy); }
    }
  }

  function step() {
    for (const b of bubbles) {
      if (pointer.on) {                              // flee the pointer
        const dx = b.x - pointer.x, dy = b.y - pointer.y, d2 = dx * dx + dy * dy, R = 150;
        if (d2 < R * R) { const d = Math.sqrt(d2) || 1, f = (1 - d / R) * 1.4; b.vx += (dx / d) * f; b.vy += (dy / d) * f; }
      }
      b.x += b.vx; b.y += b.vy;
      b.vx *= 0.985; b.vy *= 0.985;                  // gentle damping
      if (Math.abs(b.vx) < 0.04) b.vx += rand(-0.015, 0.015);
      if (Math.abs(b.vy) < 0.04) b.vy += rand(-0.015, 0.015);
      const vmax = 3.2; b.vx = clamp(b.vx, -vmax, vmax); b.vy = clamp(b.vy, -vmax, vmax);
      if (b.x - b.r < 0) { b.x = b.r; b.vx = Math.abs(b.vx); }         // bounce off walls
      if (b.x + b.r > W) { b.x = W - b.r; b.vx = -Math.abs(b.vx); }
      if (b.y - b.r < 0) { b.y = b.r; b.vy = Math.abs(b.vy); }
      if (b.y + b.r > H) { b.y = H - b.r; b.vy = -Math.abs(b.vy); }
    }
    collide();
    const rects = [...cards()].map((c) => c.getBoundingClientRect());
    for (const b of bubbles) for (const rc of rects) avoidRect(b, rc);
    draw();
    raf = requestAnimationFrame(step);
  }

  let raf = 0;
  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', (e) => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.on = true; });
  window.addEventListener('pointerdown', (e) => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.on = true; });
  window.addEventListener('pointerleave', () => { pointer.on = false; });
  window.addEventListener('blur', () => { pointer.on = false; });

  resize();
  if (REDUCED) draw(); else step();
}
