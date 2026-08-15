// Event-indexed signal series built on top of the timeline. Change point detection runs on THESE,
// not on calendar bins: bin edges alias the date by up to a week, empty weeks become NaN, and
// filling those with zero manufactures a shift that never happened. Calendar bins are for drawing.

import { sleepOverlap } from './timeline.js';

const NIGHT_START = 0, NIGHT_END = 5;

// A reply is still a reply when it takes four hours. Cutting the series at tau (often ~30 min)
// reclassified exactly the change this product exists to find: when someone starts answering in
// hours instead of minutes, every one of those slow replies became a "new conversation" and the
// latency signal went blind to the shift. Measured on a planted 4 min -> 4 h jump, the latency
// series did not move at all while the silence series did.
// So latency has its own ceiling. Past a day it is no longer answering, it is starting again.
export const REPLY_MAX = 24 * 60;

// How fast does `side` answer the other person.
// Measured turn to turn, from the END of the other side's block to the START of this side's reply,
// with the responder's own sleep window removed. Without that removal every median lands near six
// hours and the series stops measuring responsiveness at all.
export function replyLatency(tl, side, cap = REPLY_MAX) {
  const { turns, sleep } = tl;
  const xs = [], ts = [], raw = [];
  for (let i = 1; i < turns.length; i++) {
    const cur = turns[i], prev = turns[i - 1];
    if (cur.speaker !== side || prev.speaker === side) continue;
    const gap = cur.start - prev.end;
    if (gap < 0) continue;
    const awake = Math.max(0, gap - sleepOverlap(prev.end, cur.start, sleep[side]));
    if (awake > cap) continue;                       // re-initiation, not a reply
    xs.push(Math.log(awake + 0.5));
    raw.push(awake);
    ts.push(cur.start);
  }
  return { key: `gecikme_${side}`, x: xs, ts, raw, kind: 'log_minutes' };
}

// Who opens a conversation. One Bernoulli draw per session.
export function initiation(tl, side) {
  const { turns, sessions } = tl;
  const xs = [], ts = [];
  for (const s of sessions) {
    xs.push(turns[s.from].speaker === side ? 1 : 0);
    ts.push(s.start);
  }
  return { key: `baslatma_${side}`, x: xs, ts, kind: 'binary' };
}

// Who lets a conversation die. Reported later as lift over that side's message share, because a
// person who simply writes more will end more conversations without meaning anything by it.
export function lastWord(tl, side) {
  const { turns, sessions } = tl;
  const xs = [], ts = [];
  for (const s of sessions) {
    xs.push(turns[s.to].speaker === side ? 1 : 0);
    ts.push(s.end);
  }
  return { key: `bitiren_${side}`, x: xs, ts, kind: 'binary' };
}

// Words per turn. Log scale so the asymmetry is scale free and one 900-word fight does not own it.
export function turnLength(tl, side) {
  const xs = [], ts = [];
  for (const t of tl.turns) {
    if (t.speaker !== side) continue;
    xs.push(Math.log(t.words + 1));
    ts.push(t.start);
  }
  return { key: `uzunluk_${side}`, x: xs, ts, kind: 'log_words' };
}

// Messages sent between midnight and 05:00.
export function nightShare(tl, side) {
  const xs = [], ts = [];
  for (const m of tl.msgs) {
    if (m.speaker !== side) continue;
    const h = Math.floor((((m.ts % 1440) + 1440) % 1440) / 60);
    xs.push(h >= NIGHT_START && h < NIGHT_END ? 1 : 0);
    ts.push(m.ts);
  }
  return { key: `gece_${side}`, x: xs, ts, kind: 'binary' };
}

// Silence between conversations. Kept strictly apart from reply latency: a three day silence
// dragged into the latency median turns "they went on holiday" into "they answer in four hours".
export function sessionGap(tl) {
  const { sessions } = tl;
  const xs = [], ts = [], raw = [];
  for (let i = 1; i < sessions.length; i++) {
    const g = sessions[i].start - sessions[i - 1].end;
    if (g <= 0) continue;
    xs.push(Math.log(g + 0.5));
    raw.push(g);
    ts.push(sessions[i].start);
  }
  return { key: 'sessizlik', x: xs, ts, raw, kind: 'log_minutes' };
}

export function buildSignals(tl) {
  const out = [];
  for (const side of ['A', 'B']) {
    out.push(replyLatency(tl, side));
    out.push(initiation(tl, side));
    out.push(lastWord(tl, side));
    out.push(turnLength(tl, side));
    out.push(nightShare(tl, side));
  }
  out.push(sessionGap(tl));
  return out.filter((s) => s.x.length > 0);
}

// Plain counts that need no inference. These are the most defensible numbers in the product and
// they are reported even when every change point test comes back empty.
export function summary(tl) {
  const { msgs, turns, sessions, tau } = tl;
  const per = (side) => {
    const mine = msgs.filter((m) => m.speaker === side);
    const myTurns = turns.filter((t) => t.speaker === side);
    const lat = replyLatency(tl, side);
    const night = mine.filter((m) => {
      const h = Math.floor((((m.ts % 1440) + 1440) % 1440) / 60);
      return h >= NIGHT_START && h < NIGHT_END;
    }).length;
    return {
      messages: mine.length,
      turns: myTurns.length,
      words: myTurns.reduce((a, t) => a + t.words, 0),
      media: mine.filter((m) => m.media).length,
      questions: mine.filter((m) => m.text.includes('?')).length,
      replies: lat.raw.length,
      medianReplyMin: lat.raw.length ? med(lat.raw) : null,
      starts: sessions.filter((s) => turns[s.from].speaker === side).length,
      ends: sessions.filter((s) => turns[s.to].speaker === side).length,
      nightMessages: night,
    };
  };
  const gaps = sessionGap(tl);
  const longest = gaps.raw && gaps.raw.length ? Math.max(...gaps.raw) : null;
  return {
    tau,
    spanDays: tl.spanDays,
    messages: msgs.length,
    sessions: sessions.length,
    A: per('A'),
    B: per('B'),
    longestSilenceMin: longest,
    longestSilenceTs: longest != null ? gaps.ts[gaps.raw.indexOf(longest)] : null,
  };
}

function med(a) {
  const s = Array.from(a).sort((p, q) => p - q);
  const h = s.length >> 1;
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
}
