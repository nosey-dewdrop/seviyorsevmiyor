// Change point detection: rank-CUSUM + binary segmentation, significance by circular block
// permutation. Pure functions, no DOM — runs identically in Node and the worker.
//
// Why not PELT: its BIC penalty assumes iid Gaussian errors. Reply-latency series are heavy-tailed
// and autocorrelated (someone slow today is slow tomorrow), so the penalty is misspecified and the
// segmentation over-splits. Hand-tuning beta to compensate is arbitrary.
// Why not Bayesian online CPD: it needs a hazard rate and a conjugate prior the user cannot supply,
// and its output is a run-length posterior — collapsing that to one headline date throws away the
// very thing that made it principled.
// Permutation testing assumes only exchangeability under the null, and it yields a number we can
// say out loud: "shuffled 1000 times, this split was beaten 3 times".

export const MIN_EVENTS = 60;
export const MAX_DEPTH = 3;
export const ALPHA = 0.01;

// xorshift128+ — seeded so the same export always produces the same date.
export function makeRng(seed) {
  let s0 = (seed ^ 0x9e3779b9) >>> 0 || 1;
  let s1 = (seed * 0x85ebca6b + 0x165667b1) >>> 0 || 2;
  return function next() {
    let x = s0, y = s1;
    s0 = y;
    x ^= x << 23; x >>>= 0;
    x ^= x >>> 17;
    x ^= y ^ (y >>> 26); x >>>= 0;
    s1 = x;
    return ((s0 + s1) >>> 0) / 4294967296;
  };
}

// Average ranks (ties shared). Feeding ranks instead of raw values is what stops one three-day
// outlier from manufacturing a break, at ~95% of the mean-shift test's power.
export function rankTransform(x) {
  const n = x.length;
  const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => x[a] - x[b]);
  const r = new Float64Array(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && x[idx[j + 1]] === x[idx[i]]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k]] = avg;
    i = j + 1;
  }
  return r;
}

function prefix(r) {
  const p = new Float64Array(r.length + 1);
  for (let i = 0; i < r.length; i++) p[i + 1] = p[i] + r[i];
  return p;
}

// Scan every admissible split in one pass using prefix sums. O(n).
export function maxCusum(P, lo, hi, kmin, sd) {
  const n = hi - lo;
  let best = 0, bk = -1;
  for (let k = lo + kmin; k <= hi - kmin; k++) {
    const m1 = (P[k] - P[lo]) / (k - lo);
    const m2 = (P[hi] - P[k]) / (hi - k);
    const w = Math.sqrt(((k - lo) * (hi - k)) / n);
    const t = (w * Math.abs(m1 - m2)) / sd;
    if (t > best) { best = t; bk = k; }
  }
  return { T: best, k: bk };
}

// Autocorrelation-aware block length. Plain permutation would destroy the serial dependence, narrow
// the null, and report a slow drift as a break.
export function blockLength(r) {
  const n = r.length;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += r[i];
  mean /= n;
  let c0 = 0;
  for (let i = 0; i < n; i++) { const d = r[i] - mean; c0 += d * d; }
  if (c0 === 0) return 1;
  const maxLag = Math.min(50, Math.floor(n / 4));
  for (let lag = 1; lag <= maxLag; lag++) {
    let c = 0;
    for (let i = lag; i < n; i++) c += (r[i] - mean) * (r[i - lag] - mean);
    if (c / c0 < 0.1) return Math.max(1, Math.min(Math.floor(n / 10), 2 * lag));
  }
  return Math.max(1, Math.min(Math.floor(n / 10), 2 * maxLag));
}

function circularBlockShuffle(src, out, b, rnd) {
  const n = src.length;
  const nb = Math.ceil(n / b);
  let w = 0;
  for (let i = 0; i < nb; i++) {
    const start = Math.floor(rnd() * n);
    for (let j = 0; j < b && w < n; j++, w++) out[w] = src[(start + j) % n];
  }
}

export function blockPermTest(r, Tobs, b, B, rnd, kminFrac) {
  const n = r.length;
  // Subsampling keeps the cost flat on long chats; T is normalised by n, so the null still holds.
  const CAP = 4000;
  let base = r;
  if (n > CAP) {
    base = new Float64Array(CAP);
    for (let i = 0; i < CAP; i++) base[i] = r[Math.floor((i * n) / CAP)];
  }
  const m = base.length;
  const kmin = Math.max(5, Math.floor(kminFrac * m));
  if (m - 2 * kmin < 1) return 1;
  const buf = new Float64Array(m);
  let sd = 0, mean = 0;
  for (let i = 0; i < m; i++) mean += base[i];
  mean /= m;
  for (let i = 0; i < m; i++) { const d = base[i] - mean; sd += d * d; }
  sd = Math.sqrt(sd / m) || 1;
  let ge = 0;
  for (let t = 0; t < B; t++) {
    circularBlockShuffle(base, buf, b, rnd);
    const P = prefix(buf);
    if (maxCusum(P, 0, m, kmin, sd).T >= Tobs) ge++;
  }
  return (1 + ge) / (B + 1);
}

// Block permutation preserves local dependence but NOT a global trend, so a series that merely
// drifts still produces a huge CUSUM against its shuffled null — measured at ~50% false positives
// on pure drift. That failure mode is the worst one this product can have: a relationship that
// slowly cools would be handed a fabricated "it changed on this date".
//
// So a candidate must also beat the boring explanation. Fit two models to the segment and compare
// residual sums of squares:
//   step  — two constants split at k
//   line  — one straight line over the whole segment
// A genuine step is fit badly by a line; a pure drift is fit badly by a step. Returns
// RSS_step / RSS_line — below 1 means the break explains the data better than a trend does.
export function stepVsTrend(r, lo, hi, k) {
  const n = hi - lo;
  if (n < 4 || k <= lo || k >= hi) return Infinity;
  let m1 = 0, m2 = 0;
  for (let i = lo; i < k; i++) m1 += r[i];
  for (let i = k; i < hi; i++) m2 += r[i];
  m1 /= (k - lo); m2 /= (hi - k);
  let rssStep = 0;
  for (let i = lo; i < k; i++) { const d = r[i] - m1; rssStep += d * d; }
  for (let i = k; i < hi; i++) { const d = r[i] - m2; rssStep += d * d; }

  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { const y = r[lo + i]; sx += i; sy += y; sxx += i * i; sxy += i * y; }
  const den = n * sxx - sx * sx;
  const slope = den === 0 ? 0 : (n * sxy - sx * sy) / den;
  const icpt = (sy - slope * sx) / n;
  let rssLine = 0;
  for (let i = 0; i < n; i++) { const d = r[lo + i] - (icpt + slope * i); rssLine += d * d; }
  if (rssLine <= 0) return Infinity;
  return rssStep / rssLine;
}

function median(a) {
  if (!a.length) return NaN;
  const s = Float64Array.from(a).sort();
  const h = s.length >> 1;
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
}

// Percentile CI for the change index, by RESIDUAL block bootstrap. A single date is not an honest
// answer, because k-hat is an estimate and carries its own spread.
//
// Shuffling the segment itself (an earlier version did) destroys the very step whose position is
// being measured, so every replicate puts k somewhere random and the interval swallows the whole
// chat. Measured: a break located to within one day came back with a two year interval, which the
// honesty layer then refused to print. The fix is to keep the fitted step and resample only what is
// left over: take residuals around the two regime means, block-resample those, add the step back,
// and re-estimate k on the reconstruction.
function bootstrapIndexCi(x, lo, hi, k0, b, B, rnd, kmin) {
  const m = hi - lo;
  if (m < 8 || k0 <= lo || k0 >= hi) return null;
  let m1 = 0, m2 = 0;
  for (let i = lo; i < k0; i++) m1 += x[i];
  for (let i = k0; i < hi; i++) m2 += x[i];
  m1 /= (k0 - lo); m2 /= (hi - k0);

  const fitted = new Float64Array(m);
  const resid = new Float64Array(m);
  for (let i = 0; i < m; i++) {
    const abs = lo + i;
    fitted[i] = abs < k0 ? m1 : m2;
    resid[i] = x[abs] - fitted[i];
  }

  const buf = new Float64Array(m);
  const rebuilt = new Float64Array(m);
  const ks = [];
  for (let t = 0; t < B; t++) {
    circularBlockShuffle(resid, buf, b, rnd);
    for (let i = 0; i < m; i++) rebuilt[i] = fitted[i] + buf[i];
    const r = rankTransform(rebuilt);
    let mean = 0; for (let i = 0; i < m; i++) mean += r[i];
    mean /= m;
    let sd = 0; for (let i = 0; i < m; i++) { const d = r[i] - mean; sd += d * d; }
    sd = Math.sqrt(sd / m) || 1;
    const { k } = maxCusum(prefix(r), 0, m, kmin, sd);
    if (k >= 0) ks.push(k + lo);
  }
  if (ks.length < 20) return null;
  ks.sort((p, q) => p - q);
  return { lo: ks[Math.floor(ks.length * 0.05)], hi: ks[Math.floor(ks.length * 0.95)] };
}

/**
 * @param x       numeric series, event-indexed (NOT calendar-binned)
 * @param tsList  naive-minute stamp for each event, same length as x
 * @param opts    { seed, minEffect, B, Bboot, label }
 */
export function detectChangePoints(x, tsList, opts = {}) {
  const {
    seed = 1, minEffect = Math.LN2, B = 999, Bboot = 300, label = '',
    // 0.95 measured, not guessed: a threshold sweep (train/cpd_check.mjs) put drift false positives
    // at 27.5% when the step merely had to tie a line (1.00) and at 0.0% here, with power on a real
    // 4x jump unchanged at 72%. Tightening further buys nothing and costs power fast (0.90 -> 51%).
    minSpanDays = 21, trendRatio = 0.95,
  } = opts;
  const n = x.length;
  if (n < MIN_EVENTS) return { status: 'veri_yetersiz', n, need: MIN_EVENTS, points: [] };

  const rnd = makeRng(seed);
  const r = rankTransform(x);
  const b = blockLength(r);
  const kminFrac = 0.05;
  const points = [];

  const segment = (lo, hi, depth) => {
    const m = hi - lo;
    const kmin = Math.max(30, Math.floor(kminFrac * m));
    if (depth >= MAX_DEPTH || m < 2 * kmin) return;

    const sub = r.slice(lo, hi);
    let mean = 0; for (let i = 0; i < m; i++) mean += sub[i];
    mean /= m;
    let sd = 0; for (let i = 0; i < m; i++) { const d = sub[i] - mean; sd += d * d; }
    sd = Math.sqrt(sd / m) || 1;

    const { T, k } = maxCusum(prefix(sub), 0, m, kmin, sd);
    if (k < 0) return;
    const kAbs = k + lo;

    // Calendar guard: a split must separate real stretches of time, not just event counts.
    const daysL = (tsList[kAbs - 1] - tsList[lo]) / 1440;
    const daysR = (tsList[hi - 1] - tsList[kAbs]) / 1440;
    if (daysL < minSpanDays || daysR < minSpanDays) return;

    // Reject candidates that a straight line explains at least as well (see stepVsTrend).
    const svt = stepVsTrend(r, lo, hi, kAbs);
    if (!(svt < trendRatio)) return;

    const p = blockPermTest(sub, T, b, B, rnd, kminFrac);
    if (p >= ALPHA) return;

    const before = median(x.slice(lo, kAbs));
    const after = median(x.slice(kAbs, hi));
    // Significance is not a story. At 15k events a 2% shift is p<0.001 and not worth a sentence.
    if (Math.abs(after - before) < minEffect) return;

    const ci = bootstrapIndexCi(x, lo, hi, kAbs, b, Bboot, rnd, kmin);
    points.push({
      label,
      index: kAbs,
      ts: tsList[kAbs],
      tsLo: ci ? tsList[Math.max(lo, ci.lo)] : null,
      tsHi: ci ? tsList[Math.min(hi - 1, ci.hi)] : null,
      p, before, after, n: m, T,
    });
    segment(lo, kAbs, depth + 1);
    segment(kAbs, hi, depth + 1);
  };

  segment(0, n, 0);
  points.sort((a, c) => a.index - c.index);
  return { status: points.length ? 'bulundu' : 'yok', n, block: b, points };
}

// Holm-Bonferroni across signals. Each signal contributes its smallest p.
//
// A permutation test cannot report a p below 1/(B+1). With m candidates, Holm multiplies the
// smallest by m, so if m/(B+1) >= ALPHA NOTHING can ever be significant — the engine would go
// silent and look like it simply found nothing. That is a lie by omission, so it is reported.
export function holmAdjust(results, B = 999) {
  const flat = [];
  for (const res of results) for (const pt of res.points) flat.push(pt);
  flat.sort((a, b) => a.p - b.p);
  const m = flat.length;
  const floorP = m / (B + 1);
  const underpowered = m > 0 && floorP >= ALPHA;
  let running = 0;
  flat.forEach((pt, i) => {
    running = Math.max(running, Math.min(1, pt.p * (m - i)));
    pt.pAdj = running;
    pt.significant = running < ALPHA;
    pt.underpowered = underpowered;
  });
  return { results, m, underpowered, needB: Math.ceil(m / ALPHA) };
}

/**
 * Joint claim: how surprising is it that k independent signals broke inside the same window?
 * Upper bound C(S,k) * (2W/T)^(k-1). This is the number that defends "the relationship changed
 * on this date" — a single signal never does.
 */
export function jointClaim(points, spanDays, windowDays = 14) {
  const sig = points.filter((p) => p.significant !== false);
  if (sig.length < 2) return null;
  // "A ends the conversation" and "B ends the conversation" are one fact seen from two sides, and
  // counting them as two independent witnesses inflates the joint probability by a whole factor.
  // Collapse each concept to its stem before counting.
  const concept = (l) => String(l).replace(/_[AB]$/, '');
  let best = null;
  for (const anchor of sig) {
    const near = sig.filter((p) => Math.abs(p.ts - anchor.ts) / 1440 <= windowDays);
    const labels = new Set(near.map((p) => concept(p.label)));
    if (labels.size < 2) continue;
    const k = labels.size;
    const S = new Set(sig.map((p) => concept(p.label))).size;
    const prob = Math.min(1, choose(S, k) * Math.pow((2 * windowDays) / Math.max(spanDays, 1), k - 1));
    if (!best || prob < best.prob) {
      best = {
        ts: Math.round(near.reduce((a, p) => a + p.ts, 0) / near.length),
        k, S, windowDays, prob, labels: [...labels],
      };
    }
  }
  return best;
}

function choose(n, k) {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}
