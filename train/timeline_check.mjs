// Timeline harness: does the segmentation recover structure we deliberately planted?
// Run: node train/timeline_check.mjs
import { buildTimeline, estimateTau, sleepWindow, sleepOverlap, timezoneShift } from '../web/js/time/timeline.js';

let pass = 0, fail = 0; const fails = [];
function ok(name, cond, detail = '') {
  if (cond) { pass++; return; }
  fail++; fails.push(`${name}${detail ? '\n    ' + detail : ''}`);
}

// Seeded RNG so every run is bit-identical (the whole product claim rests on this).
function rng(seed) {
  let s = seed >>> 0;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

// Synthesize a chat: bursts of conversation separated by long silences.
// withinGap = minutes between messages inside a conversation, betweenGap = minutes between them.
function synth({ seed = 1, sessions = 120, turnsPer = 8, withinGap = 4, betweenGap = 1800, sleepFor = null }) {
  const r = rng(seed);
  const msgs = [];
  let t = 0;
  for (let s = 0; s < sessions; s++) {
    for (let k = 0; k < turnsPer; k++) {
      const sp = k % 2 === 0 ? 'A' : 'B';
      msgs.push({ speaker: sp, text: 'x'.repeat(10 + Math.floor(r() * 20)), ts: Math.round(t), media: false });
      t += withinGap * (0.4 + r() * 1.4);
    }
    t += betweenGap * (0.5 + r());
    if (sleepFor) {
      // push time forward so nobody writes inside the sleep window
      const h = Math.floor((t % 1440) / 60);
      if (h >= sleepFor.start && h < sleepFor.start + sleepFor.len) t += (sleepFor.start + sleepFor.len - h) * 60;
    }
  }
  return msgs;
}

// --- tau recovery: planted 4 min within / 30 h between → tau must land between them
{
  const msgs = synth({ seed: 7, withinGap: 4, betweenGap: 1800 });
  const { tau, fallback } = estimateTau(msgs.map((m) => m.ts));
  ok('tau: iki tepe arasına düşer', !fallback && tau > 20 && tau < 360, `tau=${tau} fallback=${fallback}`);
}

// --- tau adapts: a slow-texting pair (25 min within) must get a bigger tau than a fast pair
{
  const fast = estimateTau(synth({ seed: 3, withinGap: 2, betweenGap: 2880 }).map((m) => m.ts));
  const slow = estimateTau(synth({ seed: 3, withinGap: 30, betweenGap: 4320 }).map((m) => m.ts));
  ok('tau: yavaş çifte daha büyük tau', slow.tau >= fast.tau, `fast=${fast.tau} slow=${slow.tau}`);
}

// --- tau falls back honestly when there is no second mode
{
  const flat = []; let t = 0;
  for (let i = 0; i < 300; i++) { flat.push(t); t += 60; }   // perfectly uniform: no bimodality
  const r = estimateTau(flat);
  ok('tau: tek tepede dürüst fallback', r.fallback === true, `reason=${r.reason} tau=${r.tau}`);
}

// --- turns: a burst of 5 from one speaker is ONE turn
{
  const msgs = [
    { speaker: 'A', text: 'a', ts: 0, media: false },
    { speaker: 'A', text: 'a', ts: 1, media: false },
    { speaker: 'A', text: 'a', ts: 2, media: false },
    { speaker: 'B', text: 'b', ts: 40, media: false },
    { speaker: 'A', text: 'a', ts: 45, media: false },
  ];
  const tl = buildTimeline(msgs);
  ok('tur: ardışık blok tek tur', tl.ok && tl.turns.length === 3, `turns=${tl.ok ? tl.turns.length : 'yok'}`);
  ok('tur: blok mesaj sayısı korunur', tl.ok && tl.turns[0].n === 3, `n=${tl.ok ? tl.turns[0].n : '-'}`);
}

// --- sessions: planted session count must be recovered within 5%
{
  const msgs = synth({ seed: 11, sessions: 100, turnsPer: 10, withinGap: 3, betweenGap: 2400 });
  const tl = buildTimeline(msgs);
  const err = Math.abs(tl.sessions.length - 100) / 100;
  ok('oturum: ekilen sayı ±%5 içinde geri bulunur', tl.ok && err <= 0.05,
    `bulunan=${tl.ok ? tl.sessions.length : '-'} ekilen=100 hata=${(err * 100).toFixed(1)}%`);
}

// --- sleep window detection
{
  const hist = new Array(24).fill(100);
  for (let h = 2; h < 9; h++) hist[h] = 0;            // asleep 02:00–09:00
  const w = sleepWindow(hist);
  ok('uyku: pencere bulunur', w && w.start === 2 && w.len === 7, JSON.stringify(w));
}
{
  const hist = new Array(24).fill(100);
  for (const h of [23, 0, 1, 2, 3, 4]) hist[h] = 0;   // wraps midnight
  const w = sleepWindow(hist);
  ok('uyku: gece yarısını saran pencere tek parça', w && w.len === 6 && w.start === 23, JSON.stringify(w));
}
{
  const w = sleepWindow(new Array(24).fill(50));       // always awake → no window
  ok('uyku: düz histogramda pencere yok', w === null, JSON.stringify(w));
}

// --- sleep overlap arithmetic
{
  const win = { start: 2, len: 7 };                    // 02:00–09:00
  ok('uyku düşümü: tam pencere içinde geçen süre', sleepOverlap(2 * 60, 9 * 60, win) === 7 * 60,
    String(sleepOverlap(2 * 60, 9 * 60, win)));
  ok('uyku düşümü: pencere dışı sıfır', sleepOverlap(10 * 60, 12 * 60, win) === 0,
    String(sleepOverlap(10 * 60, 12 * 60, win)));
  // 23:00 → 10:00 next day covers the whole 7h window once
  ok('uyku düşümü: gece boyu tek pencere', sleepOverlap(23 * 60, 34 * 60, win) === 7 * 60,
    String(sleepOverlap(23 * 60, 34 * 60, win)));
}

// --- timezone shift
{
  const a = new Array(24).fill(0); for (let h = 9; h < 23; h++) a[h] = 10;
  const b = a.map((_, h) => a[(h - 6 + 24) % 24]);     // B lives 6 hours later
  const tz = timezoneShift(a, b);
  ok('tz: 6 saatlik kayma bulunur', tz.shift === 6 && tz.suspect, JSON.stringify(tz));
  ok('tz: aynı histogramda kayma yok', timezoneShift(a, a).shift === 0 && !timezoneShift(a, a).suspect);
}

// --- determinism
{
  const a = JSON.stringify(buildTimeline(synth({ seed: 42 })).sessions.length);
  const b = JSON.stringify(buildTimeline(synth({ seed: 42 })).sessions.length);
  ok('belirlenimcilik: aynı girdi aynı çıktı', a === b, `${a} vs ${b}`);
}

// --- honest refusal
{
  const tl = buildTimeline([{ speaker: 'A', text: 'a', ts: null, media: false }]);
  ok('damgasız girdi reddedilir', tl.ok === false && tl.reason === 'damga_yok', JSON.stringify(tl));
}

console.log(`timeline_check: ${pass} geçti, ${fail} kaldı`);
if (fail) { console.log('\nKALANLAR:\n  ' + fails.join('\n  ')); process.exit(1); }
