// CPD acceptance gate. Run: node train/cpd_check.mjs
// The product's whole claim is "this date is not made up", so the gate that matters is the FALSE
// POSITIVE rate on series where nothing happened. Power is reported too, but FP is the veto.
import { detectChangePoints, makeRng, rankTransform, blockLength, jointClaim, holmAdjust } from '../web/js/time/cpd.js';

const rnd = makeRng(20260815);
function gauss() { // Box-Muller on the seeded stream
  let u = 0, v = 0;
  while (u === 0) u = rnd();
  while (v === 0) v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Reply latencies are lognormal and autocorrelated: slow today, slow tomorrow. A null generator
// without that AR(1) structure would make the test far too easy and hide over-detection.
function nullSeries(n, phi = 0.35, sigma = 1.0) {
  const x = new Float64Array(n);
  let e = gauss() * sigma;
  for (let i = 0; i < n; i++) {
    e = phi * e + Math.sqrt(1 - phi * phi) * gauss() * sigma;
    x[i] = e;
  }
  return x;
}
function shiftedSeries(n, at, delta, phi = 0.35, sigma = 1.0) {
  const x = nullSeries(n, phi, sigma);
  for (let i = at; i < n; i++) x[i] += delta;
  return x;
}
// Slow drift, no break. This is the case naive permutation gets wrong.
function driftSeries(n, total = 1.5, phi = 0.35) {
  const x = nullSeries(n, phi);
  for (let i = 0; i < n; i++) x[i] += (total * i) / n;
  return x;
}
// Event stamps spread over `days`, so the calendar guard has something real to check.
function stampsFor(n, days = 900) {
  const t = new Float64Array(n);
  for (let i = 0; i < n; i++) t[i] = Math.round((i * days * 1440) / n);
  return t;
}

const B = 199;     // permutations per test (gate runs many trials; production uses 999)
const TRIALS = 200;

console.log(`CPD kapısı — ${TRIALS} deneme, B=${B} permütasyon, AR(1) phi=0.35\n`);

// ---- 1. FALSE POSITIVE (the veto) ----
let fp = 0;
for (let t = 0; t < TRIALS; t++) {
  const n = 400;
  const x = nullSeries(n);
  const res = detectChangePoints(x, stampsFor(n), { seed: 1000 + t, B, Bboot: 60, minEffect: Math.LN2 });
  if (res.points.length) fp++;
}
const fpRate = fp / TRIALS;
console.log(`1) NULL seri (değişim YOK)      → yanlış pozitif: ${fp}/${TRIALS} = %${(fpRate * 100).toFixed(1)}   hedef ≤ %1`);

// ---- 2. DRIFT must not be called a break ----
let dfp = 0;
for (let t = 0; t < TRIALS; t++) {
  const n = 400;
  const res = detectChangePoints(driftSeries(n), stampsFor(n), { seed: 2000 + t, B, Bboot: 60, minEffect: Math.LN2 });
  if (res.points.length) dfp++;
}
console.log(`2) YAVAŞ SÜRÜKLENME (kırılma yok)→ yanlış pozitif: ${dfp}/${TRIALS} = %${((dfp / TRIALS) * 100).toFixed(1)}`);

// ---- 3. POWER: a real 4x latency jump (ln4 = 1.39) ----
let hit = 0, within = 0, ciCover = 0;
for (let t = 0; t < TRIALS; t++) {
  const n = 400, at = 200;
  const x = shiftedSeries(n, at, Math.log(4));
  const ts = stampsFor(n);
  const res = detectChangePoints(x, ts, { seed: 3000 + t, B, Bboot: 60, minEffect: Math.LN2 });
  if (res.points.length) {
    hit++;
    const best = res.points.reduce((a, p) => (a && a.T > p.T ? a : p), null);
    if (Math.abs(best.index - at) <= 20) within++;
    if (best.tsLo != null && best.tsLo <= ts[at] && ts[at] <= best.tsHi) ciCover++;
  }
}
console.log(`3) GERÇEK 4x sıçrama (n=400)     → tespit: ${hit}/${TRIALS} = %${((hit / TRIALS) * 100).toFixed(1)}`);
console.log(`   tespit edilenlerin ±20 olay içinde doğru yeri: ${within}/${hit || 1}`);
{
  const cov = (ciCover / (hit || 1)) * 100;
  const okCal = cov >= 84 && cov <= 96;   // nominal 90% (5-95 percentile); 100% would mean useless width
  console.log(`   tarih CI kapsama (nominal %90)               : ${ciCover}/${hit || 1} = %${cov.toFixed(1)} ${okCal ? 'kalibre' : '*** kalibrasyon bozuk'}`);
}

// ---- 4. small effect must be refused by the effect gate ----
let smallFp = 0;
for (let t = 0; t < 100; t++) {
  const n = 400;
  const x = shiftedSeries(n, 200, 0.15);   // ~16% shift: significant at scale, not worth saying
  const res = detectChangePoints(x, stampsFor(n), { seed: 4000 + t, B, Bboot: 60, minEffect: Math.LN2 });
  if (res.points.length) smallFp++;
}
console.log(`4) KÜÇÜK etki (%16) etki kapısı  → geçen: ${smallFp}/100 (düşük olmalı)`);

// ---- 5. calendar guard: many events crammed into a few days must be refused ----
{
  const n = 400;
  const x = shiftedSeries(n, 200, Math.log(4));
  const res = detectChangePoints(x, stampsFor(n, 10), { seed: 5, B, Bboot: 60 });
  console.log(`5) 10 GÜNE sıkışmış 400 olay     → nokta: ${res.points.length} (0 olmalı, takvim kapısı)`);
}

// ---- 6. too few events ----
{
  const res = detectChangePoints(nullSeries(40), stampsFor(40), { seed: 6, B: 99 });
  console.log(`6) n=40 (< 60)                   → durum: ${res.status} (veri_yetersiz olmalı)`);
}

// ---- 7. determinism ----
{
  const n = 400, x = shiftedSeries(n, 200, Math.log(4)), ts = stampsFor(n);
  const a = JSON.stringify(detectChangePoints(x, ts, { seed: 7, B, Bboot: 60 }));
  const b = JSON.stringify(detectChangePoints(x, ts, { seed: 7, B, Bboot: 60 }));
  console.log(`7) Belirlenimcilik (aynı tohum)  → ${a === b ? 'BİT-AYNI' : 'FARKLI ***'}`);
}

// ---- 8. joint claim (uretim B=999 ile: permutasyon tabani Holm'u kaldirmali) ----
{
  const n = 400, ts = stampsFor(n), BP = 999;
  const results = ['gecikme', 'baslatma', 'uzunluk', 'gece'].map((lbl, i) =>
    detectChangePoints(shiftedSeries(n, 200, Math.log(4)), ts, { seed: 11 + i, B: BP, Bboot: 60, label: lbl }));
  const h = holmAdjust(results, BP);
  const pts = results.flatMap((r) => r.points);
  const j = jointClaim(pts, 900, 14);
  console.log(`8) Birlesik iddia (B=999)        → ${j ? `${j.k}/${j.S} sinyal ayni pencerede, olasilik ${j.prob.toExponential(1)}` : 'yok ***'}`);
  console.log(`   Holm: ${pts.filter((p) => p.significant).length}/${pts.length} anlamli, yetersiz-guc=${h.underpowered}`);
}

// ---- 9. dusuk B sessizce her seyi oldurur mu, yoksa soyler mi ----
{
  const n = 400, ts = stampsFor(n), BP = 199;
  const results = ['gecikme', 'baslatma', 'uzunluk', 'gece'].map((lbl, i) =>
    detectChangePoints(shiftedSeries(n, 200, Math.log(4)), ts, { seed: 11 + i, B: BP, Bboot: 60, label: lbl }));
  const h = holmAdjust(results, BP);
  console.log(`9) B=199 yetersiz-guc bayragi    → ${h.underpowered ? `EVET, B>=${h.needB} gerek` : 'HAYIR *** sessizce oluyor'}`);
}

console.log('');
if (fpRate > 0.01) {
  console.log(`*** KAPI KAPALI: yanlış pozitif %${(fpRate * 100).toFixed(1)} > %1. Motor bu haliyle tarih söyleyemez.`);
  process.exit(1);
}
console.log(`KAPI AÇIK: yanlış pozitif %${(fpRate * 100).toFixed(1)} ≤ %1.`);
