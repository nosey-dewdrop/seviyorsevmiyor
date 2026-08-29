// Orchestrator: raw export text in, a verdict object out. No DOM, no network, no globals, so the
// same function runs in Node (tests) and inside the worker.

import { parseChat } from '../parse.js';
import { buildTimeline } from './timeline.js';
import { buildSignals, summary, sessionGap } from './signals.js';
import { detectChangePoints, holmAdjust, jointClaim } from './cpd.js';
import {
  gateOverall, gateSignal, lastWordLift, classifyPoint, dateShowable, asymmetry, medianCi, NEED,
} from './honesty.js';

// A stable seed derived from the file itself: same export, same date, every time.
function hashText(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}

export function analyzeTime(raw, opts = {}) {
  const { B = 999, Bboot = 300, onProgress = null } = opts;
  const seed = hashText(raw);
  const step = (pct, note) => { if (onProgress) onProgress(pct, note); };

  step(5, 'okunuyor');
  const parsed = parseChat(raw);
  if (parsed.group) {
    return { ok: false, reason: 'grup', dropped: parsed.dropped, speakers: parsed.speakers };
  }

  step(15, 'zaman kuruluyor');
  const tl = buildTimeline(parsed.messages);
  if (!tl.ok) return { ok: false, reason: tl.reason, stamped: tl.stampedCount };

  const sum = summary(tl);
  const overall = gateOverall(sum);
  if (!overall.ok) {
    return { ok: false, reason: 'veri_yetersiz', gate: overall, summary: sum, speakers: parsed.speakers };
  }

  step(30, 'sinyaller');
  const signals = buildSignals(tl);
  const gaps = sessionGap(tl);

  const eligible = [];
  const refused = [];
  for (const s of signals) {
    const g = gateSignal(s.key, sum);
    if (g.ok && s.x.length >= 60) eligible.push(s);
    else refused.push({ key: s.key, ...g, events: s.x.length });
  }

  step(45, 'degisim noktalari');
  const results = [];
  for (let i = 0; i < eligible.length; i++) {
    const s = eligible[i];
    // Binary series shift in proportion, so the effect gate is expressed in proportion too.
    const minEffect = s.kind === 'binary' ? 0.15 : Math.LN2;
    results.push(detectChangePoints(s.x, s.ts, {
      seed: seed + i, B, Bboot, label: s.key, minEffect,
    }));
    step(45 + Math.round((40 * (i + 1)) / eligible.length), 'degisim noktalari');
  }
  const holm = holmAdjust(results, B);

  const points = results.flatMap((r) => r.points)
    .filter((p) => p.significant)
    .map((p) => ({
      ...p,
      kind: classifyPoint(p, gaps),
      dateShowable: dateShowable(p),
    }))
    .sort((a, b) => a.ts - b.ts);

  step(90, 'birlestiriliyor');
  const joint = jointClaim(points, sum.spanDays, 14);

  const latA = signals.find((s) => s.key === 'gecikme_A');
  const latB = signals.find((s) => s.key === 'gecikme_B');

  return {
    ok: true,
    seed,
    speakers: parsed.speakers,
    summary: sum,
    tau: tl.tau,
    tauFallback: tl.tauFallback,
    tz: tl.tz,
    tsAmbiguous: parsed.tsAmbiguous,
    unstamped: tl.unstampedCount,
    outOfOrder: tl.outOfOrder,
    points,
    joint,
    underpowered: holm.underpowered,
    refused,
    latency: {
      A: latA ? medianCi(latA.raw) : null,
      B: latB ? medianCi(latB.raw) : null,
      asymmetry: latA && latB ? asymmetry(latA.raw, latB.raw) : null,
    },
    lastWord: { A: lastWordLift(sum, 'A'), B: lastWordLift(sum, 'B') },
    need: NEED,
  };
}
