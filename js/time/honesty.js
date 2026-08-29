// Thresholds and intervals. "Not enough data" is a first class result here, printed with its own
// numbers ("41 replies, 100 needed"), because a silent engine and a confident engine look identical
// to the person reading the screen.

export const NEED = {
  anyTimeClaim: { messages: 500, days: 60 },
  replyLatency: 100,      // within-session replies per side
  segmentReplies: 40,     // per side of a change point
  initiation: 50,         // sessions
  lastWord: 50,           // sessions
  night: 30,              // night messages
  lastWordLift: 0.15,
  ciDaysMax: 60,          // wider than this and the date is not shown at all
};

const Z = 2.575829303548901;   // 99%

// Wilson score interval. Wald is wrong at the edges: it runs outside [0,1] and collapses to zero
// width on a zero count, which reads as certainty the data does not contain.
export function wilson(k, n, z = Z) {
  if (n === 0) return { lo: 0, hi: 1, p: null, n: 0 };
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const s = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return { p, lo: Math.max(0, (c - s) / d), hi: Math.min(1, (c + s) / d), n };
}

// Distribution free CI for a median, from the binomial order statistics.
export function medianCi(values, z = Z) {
  const n = values.length;
  if (n < 8) return null;
  const s = Array.from(values).sort((a, b) => a - b);
  const half = n / 2;
  const off = (z * Math.sqrt(n)) / 2;
  const lo = Math.max(0, Math.floor(half - off) - 1);
  const hi = Math.min(n - 1, Math.ceil(half + off) - 1);
  return { median: s[n >> 1], lo: s[lo], hi: s[hi], n };
}

// Whether the whole time layer is allowed to say anything at all.
export function gateOverall(sum) {
  const reasons = [];
  if (sum.messages < NEED.anyTimeClaim.messages) {
    reasons.push({ what: 'mesaj', have: sum.messages, need: NEED.anyTimeClaim.messages });
  }
  if (sum.spanDays < NEED.anyTimeClaim.days) {
    reasons.push({ what: 'gun', have: Math.round(sum.spanDays), need: NEED.anyTimeClaim.days });
  }
  return { ok: reasons.length === 0, reasons };
}

export function gateSignal(key, sum) {
  const side = key.endsWith('_A') ? 'A' : key.endsWith('_B') ? 'B' : null;
  const s = side ? sum[side] : null;
  if (key.startsWith('gecikme')) {
    return { ok: s.replies >= NEED.replyLatency, have: s.replies, need: NEED.replyLatency, what: 'cevap' };
  }
  if (key.startsWith('baslatma')) {
    return { ok: sum.sessions >= NEED.initiation, have: sum.sessions, need: NEED.initiation, what: 'oturum' };
  }
  if (key.startsWith('bitiren')) {
    return { ok: sum.sessions >= NEED.lastWord, have: sum.sessions, need: NEED.lastWord, what: 'oturum' };
  }
  if (key.startsWith('gece')) {
    return { ok: s.nightMessages >= NEED.night, have: s.nightMessages, need: NEED.night, what: 'gece mesaji' };
  }
  return { ok: true, have: null, need: null, what: null };
}

// "Who ends conversations" as lift over that side's message share, with a binomial test against
// share as the null. The raw rate on its own just restates who talks more.
export function lastWordLift(sum, side) {
  const other = side === 'A' ? 'B' : 'A';
  const total = sum[side].messages + sum[other].messages;
  if (!total || !sum.sessions) return null;
  const share = sum[side].messages / total;
  const rate = sum[side].ends / sum.sessions;
  const ci = wilson(sum[side].ends, sum.sessions);
  return {
    share, rate, lift: rate - share, ci,
    // significant only when the whole interval sits clear of the share
    significant: (ci.lo > share || ci.hi < share) && Math.abs(rate - share) >= NEED.lastWordLift,
  };
}

// A change point sitting inside a long silence is a break in contact, not a change of feeling.
// Same numbers, different sentence.
export function classifyPoint(pt, gapSignal, marginDays = 3) {
  if (!gapSignal || !gapSignal.raw) return 'degisim';
  for (let i = 0; i < gapSignal.raw.length; i++) {
    if (gapSignal.raw[i] < 7 * 1440) continue;
    const start = gapSignal.ts[i] - gapSignal.raw[i];
    if (pt.ts >= start - marginDays * 1440 && pt.ts <= gapSignal.ts[i] + marginDays * 1440) {
      return 'kesinti';
    }
  }
  return 'degisim';
}

// Date is only shown when the bootstrap interval is tight enough to mean something.
export function dateShowable(pt) {
  if (pt.tsLo == null || pt.tsHi == null) return false;
  return (pt.tsHi - pt.tsLo) / 1440 <= NEED.ciDaysMax;
}

// Asymmetry between the two sides, reported only when the interval clears zero. Otherwise the
// screen says there is no difference rather than inventing a "slight lean".
export function asymmetry(aVals, bVals) {
  const ca = medianCi(aVals), cb = medianCi(bVals);
  if (!ca || !cb) return null;
  const ratio = Math.log2((ca.median + 0.5) / (cb.median + 0.5));
  const loR = Math.log2((ca.lo + 0.5) / (cb.hi + 0.5));
  const hiR = Math.log2((ca.hi + 0.5) / (cb.lo + 0.5));
  return { ratio, lo: loR, hi: hiR, different: loR > 0 || hiR < 0, a: ca, b: cb };
}
