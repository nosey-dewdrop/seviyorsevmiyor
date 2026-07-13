// A sea of little chat bubbles behind the page. They drift, and they flee from your cursor / touch.
// Pure canvas, cheap. Respects prefers-reduced-motion (draws a still scatter, no loop, no pointer).

const cvs = document.getElementById('bubbleSea');
if (cvs) {
  const ctx = cvs.getContext('2d');
  const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // confetti pastels (approved palette — pink, coral, yellow, green, blue, lavender)
  const COLORS = ['#F7B8C4', '#F6A99A', '#F4D06F', '#9BD8A0', '#A6C8F0', '#C9B8E8', '#F2A6C2', '#8FE0C6'];

  let W = 0, H = 0, DPR = 1;
  let bubbles = [];
  const pointer = { x: -9999, y: -9999, on: false };

  function rand(a, b) { return a + Math.random() * (b - a); }

  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = cvs.clientWidth; H = cvs.clientHeight;
    cvs.width = Math.round(W * DPR); cvs.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const target = Math.min(52, Math.max(14, Math.round((W * H) / 26000)));
    if (bubbles.length !== target) spawn(target);
  }

  function spawn(n) {
    bubbles = [];
    for (let i = 0; i < n; i++) {
      const w = rand(34, 96);
      bubbles.push({
        x: rand(0, W), y: rand(0, H), w, h: w * rand(0.62, 0.78),
        vx: rand(-0.18, 0.18), vy: rand(-0.16, 0.16),
        color: COLORS[i % COLORS.length], alpha: rand(0.55, 0.9),
      });
    }
  }

  function bubblePath(x, y, w, h) {
    const r = Math.min(w, h) * 0.42;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    // little tail, bottom-left
    ctx.moveTo(x + r * 0.7, y + h - 1);
    ctx.lineTo(x + 1, y + h + h * 0.26);
    ctx.lineTo(x + r * 1.7, y + h - 1);
    ctx.closePath();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (const b of bubbles) {
      ctx.globalAlpha = b.alpha;
      ctx.fillStyle = b.color;
      bubblePath(b.x, b.y, b.w, b.h);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function step() {
    for (const b of bubbles) {
      b.x += b.vx; b.y += b.vy;
      // flee the pointer
      if (pointer.on) {
        const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
        const dx = cx - pointer.x, dy = cy - pointer.y;
        const d2 = dx * dx + dy * dy;
        const R = 150;
        if (d2 < R * R) {
          const d = Math.sqrt(d2) || 1;
          const f = (1 - d / R) * 1.6;
          b.vx += (dx / d) * f; b.vy += (dy / d) * f;
        }
      }
      // gentle damping back toward a slow drift
      b.vx *= 0.96; b.vy *= 0.96;
      if (Math.abs(b.vx) < 0.05) b.vx += rand(-0.02, 0.02);
      if (Math.abs(b.vy) < 0.05) b.vy += rand(-0.02, 0.02);
      // wrap around the edges
      if (b.x > W + 10) b.x = -b.w; else if (b.x + b.w < -10) b.x = W;
      if (b.y > H + 10) b.y = -b.h; else if (b.y + b.h < -10) b.y = H;
    }
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
