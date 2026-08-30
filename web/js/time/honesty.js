// Thresholds and intervals. "Not enough data" is a first class result here, printed with its own
// numbers ("41 replies, 100 needed"), because a silent engine and a confident engine look identical
// to the person reading the screen.
//
// What "not enough data" is NOT allowed to mean: the whole screen. A threshold here closes ONE
// layer. Every other layer keeps its own gate and keeps running.

import { MIN_EVENTS } from './cpd.js';

export const NEED = {
  // The dated change point is the only claim in this engine that needs a long chat, and both of its
  // limits are read off the code and the measurement rather than chosen by feel.
  //
  //   days 42     cpd.js:249 refuses any split unless BOTH sides of it span at least 21 calendar
  //               days, so 2 * 21 = 42 is the shortest chat in which a dated break can exist at
  //               all. This is arithmetic on the segmenter, not taste: 5000 messages inside 11 days
  //               still produce no date, because no candidate survives that guard.
  //   messages 250 train/az_veri_check.mjs, 200 null chats per size. The date claim comes back at
  //               0.0% false positives at 250 / 42 days and again at 500 / 84 days, where the layer
  //               is open on all 200 runs. And the number is a description, not an extra rule: at
  //               120 messages over 120 days, where the calendar gate is NOT what binds, only 1
  //               chat in 50 had any signal series long enough for the search to run on at all
  //               (MIN_EVENTS = 60). Under 250 there is nothing there to gate.
  //
  // It replaces { messages: 500, days: 60 }. That pair arrived in one commit (d47cb1c), written by
  // hand, with no calibration and no test anywhere under train/, and it was roughly twice anything
  // that had been measured. Its cost was not conservatism: gateOverall was wired as an early return
  // in analyze.js, so those two numbers silenced the counts, the latency medians, the asymmetry and
  // the archetype as well, none of which they describe.
  changePoint: { messages: 250, days: 42 },

  replyLatency: 100,      // within-session replies per side, for the change point layer
  segmentReplies: 40,     // per side of a change point
  initiation: 50,         // sessions
  lastWord: 50,           // sessions
  night: 30,              // night messages
  events: MIN_EVENTS,     // cpd.js MIN_EVENTS, measured in train/cpd_check.mjs:110
  lastWordLift: 0.15,
  ciDaysMax: 60,          // wider than this and the date is not shown at all
  medianMin: 8,           // medianCi returns null below this
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

// Whether the DATE layer is allowed to speak: the change point search and the day it prints.
// Nothing else. Counts are description, not inference, and the per signal tests below carry their
// own gates, so both keep running under this line.
export function gateChangePoint(sum) {
  const reasons = [];
  if (sum.messages < NEED.changePoint.messages) {
    reasons.push({ what: 'mesaj', have: sum.messages, need: NEED.changePoint.messages });
  }
  if (sum.spanDays < NEED.changePoint.days) {
    reasons.push({ what: 'gun', have: Math.round(sum.spanDays), need: NEED.changePoint.days });
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
  // uzunluk_* and sessizlik used to fall through to a bare { ok: true, have: null, need: null }.
  // They were not ungated: analyze.js filtered them with an inline `s.x.length >= 60` right after
  // asking this function. So the gate said yes, a literal somewhere else said no, and the refusal
  // line on screen read "mesaj uzunluğu (null/null)". Same number, stated where the others state
  // theirs. MIN_EVENTS is cpd.js's own floor and it is the one measured in train/cpd_check.mjs:110.
  if (key.startsWith('uzunluk')) {
    return { ok: s.turns >= NEED.events, have: s.turns, need: NEED.events, what: 'sira' };
  }
  if (key === 'sessizlik') {
    const gaps = Math.max(0, sum.sessions - 1);
    return { ok: gaps >= NEED.events, have: gaps, need: NEED.events, what: 'sessizlik' };
  }
  return { ok: true, have: null, need: null, what: null };
}

// A share against the null it should be compared with, at 99%. Used for "who opens" (null: half the
// sessions) and "who writes at night" (null: that side's share of all messages, because whoever
// writes more writes more at night too). Reported only when the whole interval clears the null, so
// a coin flip prints as a coin flip instead of a lean.
export function shareTest(k, n, nullP) {
  if (!n || nullP == null) return null;
  const ci = wilson(k, n);
  return { k, n, p: k / n, nullP, ci, significant: ci.lo > nullP || ci.hi < nullP };
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
