// Synthetic WhatsApp export generator, shared by the e2e and renderer harnesses.

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
const pad = (n) => String(n).padStart(2, '0');
function stamp(min) {
  const d = new Date(min * 60000);
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
const LINES_A = ['gunaydin', 'ne yapiyorsun', 'bugun nasil gecti', 'aksam musait misin', 'seni dusundum', 'hadi bir kahve icelim', 'cok komiksin', 'yarin gorusur muyuz'];
const LINES_B = ['iyiyim', 'idare eder', 'bakariz', 'yogunum biraz', 'olur', 'hmm', 'sonra yazarim', 'tamam'];

/**
 * Build an export where B's reply latency jumps at `breakDay`.
 * before: B answers in ~4 min. after: B answers in ~4 hours.
 */
function makeExport({ seed = 5, days = 900, sessionsPerWeek = 9, breakDay = 450,
  latBefore = 4, latAfter = 240, initBefore = 0.5, initAfter = 0.85 } = {}) {
  const r = rng(seed);
  const out = [];
  const start = Math.floor(Date.UTC(2024, 0, 8, 9, 0) / 60000);
  out.push(`${stamp(start - 60)} - Mesajlar ve aramalar uctan uca sifrelidir.`);
  const nSessions = Math.round((days / 7) * sessionsPerWeek);
  for (let s = 0; s < nSessions; s++) {
    const dayOffset = (s / nSessions) * days;
    const after = dayOffset >= breakDay;
    // session start time, daytime hours only so the sleep window is real
    const t0 = start + Math.floor(dayOffset * 1440) + Math.floor(9 * 60 + r() * 11 * 60);
    let t = t0;
    const initiator = r() < (after ? initAfter : initBefore) ? 'A' : 'B';
    const turns = 4 + Math.floor(r() * 6);
    let who = initiator;
    for (let k = 0; k < turns; k++) {
      const lines = who === 'A' ? LINES_A : LINES_B;
      const nMsg = 1 + (r() < 0.3 ? 1 : 0);
      for (let m = 0; m < nMsg; m++) {
        out.push(`${stamp(Math.round(t))} - ${who === 'A' ? 'Damla' : 'Kerem'}: ${lines[Math.floor(r() * lines.length)]}`);
        t += 1 + r() * 2;
      }
      // the other side replies after a latency that depends on who is answering
      const base = who === 'A' ? (after ? latAfter : latBefore) : 3;
      t += base * (0.4 + r() * 1.6);
      who = who === 'A' ? 'B' : 'A';
    }
  }
  return { text: out.join('\n'), breakTs: start + breakDay * 1440 };
}

export { makeExport, rng, stamp };
