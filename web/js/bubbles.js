// A sea of little chat bubbles behind the page. v21 (mockup 21 kuralı): sayı SABİT 10-12
// (yük başına rastgele değil, deterministik), balonlar kenarlarda doğar ve kenarlarda kalır;
// ortadaki içerik sütununun üzerine asla gelmezler. Sprite'lar ve davranış aynı: çarpışır,
// duvardan seker, imleçten kaçar. Respects prefers-reduced-motion (still scatter, no loop).

const cvs = document.getElementById('bubbleSea');
if (cvs) {
  const ctx = cvs.getContext('2d');
  const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // confetti pastels (approved palette) — fallback while a sprite loads
  const COLORS = ['#F7B8C4', '#F6A99A', '#F4D06F', '#9BD8A0', '#A6C8F0', '#C9B8E8', '#F2A6C2', '#8FE0C6'];
  // Damla's hand-generated textured ivory bubble sprites
  const sprites = Array.from({ length: 14 }, (_, i) => {
    const im = new Image(); im.src = `./assets/bubbles/b${String(i).padStart(2, '0')}.png?v=22`; return im;
  });
  let W = 0, H = 0, DPR = 1;
  let bubbles = [];
  const pointer = { x: -9999, y: -9999, on: false };

  // deterministik tohumlu üreteç: her yüklemede aynı yerleşim (mulberry32, sabit tohum)
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const jitter = (a, b) => a + Math.random() * (b - a);   // sadece sürüklenme gürültüsü

  // ortadaki içerik sütunu: balonların yasak bölgesi
  function centerRect() {
    const colW = Math.min(1000, W * 0.66);
    return { left: (W - colW) / 2, right: (W + colW) / 2, top: -40, bottom: H + 40 };
  }

  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = cvs.clientWidth; H = cvs.clientHeight;
    cvs.width = Math.round(W * DPR); cvs.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const target = W < 700 ? 10 : 12;   // SABİT: dar ekranda 10, genişte 12
    spawn(target);
  }

  function spawn(n) {
    const rnd = mulberry32(21);        // sabit tohum → deterministik yerleşim
    bubbles = [];
    const rc = centerRect();
    let guard = 0;
    while (bubbles.length < n && guard++ < n * 200) {
      const w = 52 + rnd() * 66, h = w * (0.7 + rnd() * 0.12), r = Math.max(w, h) / 2;
      // kenar bandında doğ: sol ya da sağ şerit, içerik sütununun dışında
      const leftBand = rnd() < 0.5;
      const bandW = Math.max(r * 2 + 8, leftBand ? rc.left : W - rc.right);
      if (bandW < r * 2 + 4) continue;
      const x = leftBand ? clamp(r + rnd() * (rc.left - r * 1.2 - 6), r, Math.max(r, rc.left - r))
        : clamp(rc.right + r + rnd() * (W - rc.right - r * 2), Math.min(W - r, rc.right + r), W - r);
      const y = r + rnd() * Math.max(1, H - r * 2);
      if (bubbles.some((b) => Math.hypot(b.x - x, b.y - y) < b.r + r + 6)) continue;
      bubbles.push({ x, y, w, h, r,
        vx: (rnd() - 0.5) * 0.4, vy: (rnd() - 0.5) * 0.36,
        color: COLORS[bubbles.length % COLORS.length], alpha: 0.6 + rnd() * 0.3,
        sprite: sprites[bubbles.length % sprites.length] });
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
    ctx.moveTo(x + r * 0.7, y + h - 1);
    ctx.lineTo(x + 1, y + h + h * 0.26);
    ctx.lineTo(x + r * 1.7, y + h - 1);
    ctx.closePath();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (const b of bubbles) {
      const s = b.sprite;
      if (s && s.complete && s.naturalWidth) {
        ctx.globalAlpha = 0.55;
        const dw = b.r * 2, dh = dw * (s.naturalHeight / s.naturalWidth);
        ctx.drawImage(s, b.x - dw / 2, b.y - dh / 2, dw, dh);
      } else {
        ctx.globalAlpha = b.alpha * 0.6;
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
          const p = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (p < 0) { a.vx += p * nx; a.vy += p * ny; b.vx -= p * nx; b.vy -= p * ny; }
        }
      }
    }
  }

  // içerik sütunundan dışarı it: balon şeridin içine girerse en yakın kenara geri
  function keepOutCenter(b) {
    const rc = centerRect();
    if (b.x + b.r < rc.left || b.x - b.r > rc.right) return;
    if (b.x < (rc.left + rc.right) / 2) { b.x = rc.left - b.r; if (b.vx > 0) b.vx = -Math.abs(b.vx); }
    else { b.x = rc.right + b.r; if (b.vx < 0) b.vx = Math.abs(b.vx); }
  }

  function step() {
    for (const b of bubbles) {
      if (pointer.on) {
        const dx = b.x - pointer.x, dy = b.y - pointer.y, d2 = dx * dx + dy * dy, R = 150;
        if (d2 < R * R) { const d = Math.sqrt(d2) || 1, f = (1 - d / R) * 1.4; b.vx += (dx / d) * f; b.vy += (dy / d) * f; }
      }
      b.x += b.vx; b.y += b.vy;
      b.vx *= 0.985; b.vy *= 0.985;
      if (Math.abs(b.vx) < 0.04) b.vx += jitter(-0.015, 0.015);
      if (Math.abs(b.vy) < 0.04) b.vy += jitter(-0.015, 0.015);
      const vmax = 2.2; b.vx = clamp(b.vx, -vmax, vmax); b.vy = clamp(b.vy, -vmax, vmax);
      if (b.x - b.r < 0) { b.x = b.r; b.vx = Math.abs(b.vx); }
      if (b.x + b.r > W) { b.x = W - b.r; b.vx = -Math.abs(b.vx); }
      if (b.y - b.r < 0) { b.y = b.r; b.vy = Math.abs(b.vy); }
      if (b.y + b.r > H) { b.y = H - b.r; b.vy = -Math.abs(b.vy); }
      keepOutCenter(b);
    }
    collide();
    for (const b of bubbles) keepOutCenter(b);
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
