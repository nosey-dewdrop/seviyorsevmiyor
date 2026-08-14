// Turn / session segmentation over a stamped chat. Everything downstream (signals, change points)
// is defined on the structures built here, so the definitions matter more than the arithmetic.
//
// TURN    = a run of consecutive messages from the same speaker. A 5-message burst is ONE turn.
//           Reply latency is measured between TURNS, never between messages — otherwise whoever
//           types more looks artificially "faster to reply".
// SESSION = a run of turns with no gap larger than tau. Tau is not a constant; it is estimated
//           from the chat itself (see estimateTau).

export const MIN_TAU = 20;          // dakika
export const MAX_TAU = 6 * 60;      // dakika
export const DEFAULT_TAU = 60;      // dakika

// Gap distribution is bimodal on a log scale: the fast lobe is within-conversation replies, the
// slow lobe is the silence between conversations. Tau is the antimode between them. Fixing tau at
// 60 minutes instead would mislabel both the couple who texts every 8 seconds and the pair who
// trade one message a day.
export function estimateTau(tsList) {
  const gaps = [];
  for (let i = 1; i < tsList.length; i++) {
    const g = tsList[i] - tsList[i - 1];
    if (g > 0) gaps.push(g);
  }
  if (gaps.length < 50) return { tau: DEFAULT_TAU, fallback: true, reason: 'az_veri' };

  // log10(minutes) histogram, 0.2-decade buckets from 1 min to ~10 days.
  const LO = 0, HI = 4.2, W = 0.2;
  const nb = Math.ceil((HI - LO) / W);
  const hist = new Float64Array(nb);
  for (const g of gaps) {
    const b = Math.floor((Math.log10(g) - LO) / W);
    if (b >= 0 && b < nb) hist[b]++;
  }
  // Light smoothing so single-bucket noise cannot pose as a mode.
  const sm = new Float64Array(nb);
  for (let i = 0; i < nb; i++) {
    sm[i] = (hist[Math.max(0, i - 1)] + hist[i] + hist[Math.min(nb - 1, i + 1)]) / 3;
  }
  const loB = Math.max(0, Math.floor((Math.log10(MIN_TAU) - LO) / W));
  const hiB = Math.min(nb - 1, Math.ceil((Math.log10(MAX_TAU) - LO) / W));

  // Highest peak below the search window, highest peak above it, valley in between.
  let p1 = -1, p1v = -1;
  for (let i = 0; i < loB; i++) if (sm[i] > p1v) { p1v = sm[i]; p1 = i; }
  let p2 = -1, p2v = -1;
  for (let i = hiB + 1; i < nb; i++) if (sm[i] > p2v) { p2v = sm[i]; p2 = i; }
  if (p1 < 0 || p2 < 0 || p1v < 5 || p2v < 5) {
    return { tau: DEFAULT_TAU, fallback: true, reason: 'tek_tepe' };
  }
  // The valley between two well-separated lobes is usually a run of empty buckets, not a single
  // point. Taking the first minimum would pin tau to the near edge of that run and make it hostage
  // to one stray gap; take the CENTRE of the widest minimal run instead.
  let vv = Infinity;
  for (let i = p1; i <= p2; i++) if (sm[i] < vv) vv = sm[i];
  let bestS = -1, bestL = 0, curS = -1, curL = 0;
  for (let i = p1; i <= p2; i++) {
    if (sm[i] <= vv + 1e-9) {
      if (curL === 0) curS = i;
      curL++;
      if (curL > bestL) { bestL = curL; bestS = curS; }
    } else curL = 0;
  }
  const vi = bestS + (bestL - 1) / 2;
  const tau = Math.round(Math.pow(10, LO + (vi + 0.5) * W));
  return { tau: Math.min(MAX_TAU, Math.max(MIN_TAU, tau)), fallback: false, reason: 'antimod' };
}

// Per-speaker sleep window: the longest run of hours whose activity stays under 5% of that
// speaker's peak hour. Without this correction every median lands near 6 hours and the engine ends
// up measuring "did they text at night", not "how fast do they answer".
export function sleepWindow(hourHist) {
  let peak = 0;
  for (const v of hourHist) if (v > peak) peak = v;
  if (peak === 0) return null;
  const thr = peak * 0.05;
  let best = null, cur = null;
  // Two laps so a window wrapping past midnight is found as one run.
  for (let i = 0; i < 48; i++) {
    const h = i % 24;
    if (hourHist[h] <= thr) {
      if (!cur) cur = { start: h, len: 1 };
      else cur.len++;
      if (cur.len <= 24 && (!best || cur.len > best.len)) best = { start: cur.start, len: cur.len };
    } else cur = null;
  }
  if (!best || best.len < 3 || best.len > 14) return null;   // implausible → do not correct
  return { start: best.start, len: best.len };
}

// Minutes of `win` that fall inside [from, to) — business-hours arithmetic, but for sleep.
export function sleepOverlap(from, to, win) {
  if (!win || to <= from) return 0;
  // One window per calendar day, walked once. Anchoring per-day and then also probing ±1 day (as an
  // earlier version did) counts the same window twice whenever the span crosses midnight.
  let total = 0;
  const first = Math.floor(from / 1440) - 1;
  const last = Math.floor((to - 1) / 1440) + 1;
  for (let d = first; d <= last; d++) {
    const s = d * 1440 + win.start * 60;
    const e = s + win.len * 60;
    const lo = Math.max(from, s), hi = Math.min(to, e);
    if (hi > lo) total += hi - lo;
  }
  return Math.min(total, to - from);
}

// Circular cross-correlation of the two hourly histograms. A large shift suggests the two people
// are in different timezones, which makes "they text at 3am" a claim about the export device, not
// about the person. We flag it and suppress night-based claims rather than guessing an offset.
export function timezoneShift(histA, histB) {
  const norm = (h) => { const s = h.reduce((a, b) => a + b, 0) || 1; return h.map((v) => v / s); };
  const a = norm(histA), b = norm(histB);
  // Sign convention: positive shift = B's day runs LATER than A's by that many hours.
  let bestShift = 0, bestVal = -Infinity;
  for (let d = -12; d <= 12; d++) {
    let acc = 0;
    for (let h = 0; h < 24; h++) acc += a[h] * b[(h + d + 24) % 24];
    if (acc > bestVal) { bestVal = acc; bestShift = d; }
  }
  return { shift: bestShift, suspect: Math.abs(bestShift) >= 3 };
}

// Build turns and sessions. `messages` must be chronological with numeric `ts` (naive minutes).
export function buildTimeline(messages) {
  const stamped = messages.filter((m) => typeof m.ts === 'number' && Number.isFinite(m.ts));
  if (stamped.length < 2) {
    return { ok: false, reason: 'damga_yok', stampedCount: stamped.length };
  }
  // Exports are ordered, but a merged/edited file may not be. Sort defensively and report it.
  let outOfOrder = 0;
  for (let i = 1; i < stamped.length; i++) if (stamped[i].ts < stamped[i - 1].ts) outOfOrder++;
  const msgs = outOfOrder ? [...stamped].sort((a, b) => a.ts - b.ts) : stamped;

  const hourHist = { A: new Array(24).fill(0), B: new Array(24).fill(0) };
  for (const m of msgs) hourHist[m.speaker][Math.floor(((m.ts % 1440) + 1440) % 1440 / 60)]++;

  const { tau, fallback: tauFallback, reason: tauReason } = estimateTau(msgs.map((m) => m.ts));

  // turns
  const turns = [];
  for (const m of msgs) {
    const last = turns[turns.length - 1];
    if (last && last.speaker === m.speaker && m.ts - last.end <= tau) {
      last.end = m.ts; last.n++;
      last.chars += m.text.length;
      last.words += m.media ? 0 : countWords(m.text);
      if (m.media) last.media++;
    } else {
      turns.push({
        speaker: m.speaker, start: m.ts, end: m.ts, n: 1,
        chars: m.media ? 0 : m.text.length,
        words: m.media ? 0 : countWords(m.text),
        media: m.media ? 1 : 0,
      });
    }
  }

  // sessions
  const sessions = [];
  for (let i = 0; i < turns.length; i++) {
    const prev = turns[i - 1];
    if (!prev || turns[i].start - prev.end > tau) {
      sessions.push({ from: i, to: i, start: turns[i].start, end: turns[i].end });
    } else {
      const s = sessions[sessions.length - 1];
      s.to = i; s.end = turns[i].end;
    }
  }

  const sleep = { A: sleepWindow(hourHist.A), B: sleepWindow(hourHist.B) };
  const tz = timezoneShift(hourHist.A, hourHist.B);

  return {
    ok: true,
    msgs, turns, sessions, tau, tauFallback, tauReason,
    hourHist, sleep, tz, outOfOrder,
    spanDays: (msgs[msgs.length - 1].ts - msgs[0].ts) / 1440,
    stampedCount: msgs.length,
    unstampedCount: messages.length - stamped.length,
  };
}

function countWords(t) {
  let n = 0, inW = false;
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i);
    const sp = c === 32 || c === 9 || c === 10 || c === 13;
    if (sp) inW = false;
    else if (!inW) { inW = true; n++; }
  }
  return n;
}
