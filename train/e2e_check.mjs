// End to end: a real-format WhatsApp export string goes in, a dated verdict comes out.
// Run: node train/e2e_check.mjs
// This is the test that decides whether the engine is a product or a pile of statistics.
import { analyzeTime } from '../web/js/time/analyze.js';

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

let fails = 0;
const say = (s) => console.log(s);

// ---------- 1. the headline case ----------
{
  const { text, breakTs } = makeExport({ seed: 5 });
  const t0 = Date.now();
  const res = analyzeTime(text, { B: 999, Bboot: 200 });
  const ms = Date.now() - t0;
  const kb = Math.round(text.length / 1024);

  say(`1) GERCEK FORMAT EXPORT  ${kb} KB, ${res.ok ? res.summary.messages : '?'} mesaj, ${ms} ms`);
  if (!res.ok) { say(`   *** motor reddetti: ${res.reason}`); fails++; }
  else {
    say(`   sure ${Math.round(res.summary.spanDays)} gun, ${res.summary.sessions} oturum, tau ${res.tau} dk`);
    say(`   Damla ${res.summary.A.messages} mesaj / Kerem ${res.summary.B.messages} mesaj`);
    say(`   Kerem medyan cevap ${res.latency.B ? res.latency.B.median.toFixed(0) : '-'} dk, Damla ${res.latency.A ? res.latency.A.median.toFixed(0) : '-'} dk`);
    const gerc = new Date(breakTs * 60000).toISOString().slice(0, 10);
    say(`   ekilen kirilma: ${gerc}`);
    if (!res.points.length) { say('   *** hicbir degisim noktasi bulunamadi'); fails++; }
    for (const p of res.points) {
      const d = new Date(p.ts * 60000).toISOString().slice(0, 10);
      const lo = p.tsLo != null ? new Date(p.tsLo * 60000).toISOString().slice(0, 10) : '?';
      const hi = p.tsHi != null ? new Date(p.tsHi * 60000).toISOString().slice(0, 10) : '?';
      const off = Math.round(Math.abs(p.ts - breakTs) / 1440);
      say(`   bulunan [${p.label}] ${d} (${lo} .. ${hi}) sapma ${off} gun, p=${p.p.toFixed(4)} tur=${p.kind} tarih_gosterilir=${p.dateShowable}`);
    }
    if (res.joint) {
      const jd = new Date(res.joint.ts * 60000).toISOString().slice(0, 10);
      say(`   BIRLESIK: ${res.joint.k}/${res.joint.S} sinyal ${jd} civari, olasilik ${res.joint.prob.toExponential(1)}`);
    } else { say('   birlesik iddia yok'); }
    if (res.refused.length) say(`   reddedilen sinyaller: ${res.refused.map((x) => `${x.key}(${x.have}/${x.need})`).join(', ')}`);
  }
}

// ---------- 2. a chat where nothing changed: must stay silent ----------
{
  const { text } = makeExport({ seed: 9, latBefore: 6, latAfter: 6, initBefore: 0.5, initAfter: 0.5 });
  const res = analyzeTime(text, { B: 999, Bboot: 200 });
  const n = res.ok ? res.points.length : -1;
  say(`\n2) HICBIR SEY DEGISMEDI    → nokta: ${n} (0 olmali)`);
  if (n !== 0) { say('   *** uydurma tarih'); fails++; }
}

// ---------- 3. short chat: must refuse with numbers ----------
{
  const { text } = makeExport({ seed: 3, days: 20, sessionsPerWeek: 4 });
  const res = analyzeTime(text, { B: 199, Bboot: 60 });
  say(`\n3) KISA SOHBET (20 gun)    → ok=${res.ok} sebep=${res.reason}`);
  if (res.ok) { say('   *** kisa sohbette konustu'); fails++; }
  else if (res.gate) say(`   eksik: ${res.gate.reasons.map((r) => `${r.what} ${r.have}/${r.need}`).join(', ')}`);
}

// ---------- 4. group chat: must refuse ----------
{
  const { text } = makeExport({ seed: 4 });
  const withThird = text + '\n' + '12.06.2025, 14:00 - Zeynep: ben de varim\n'.repeat(40);
  const res = analyzeTime(withThird, { B: 199, Bboot: 60 });
  say(`\n4) GRUP SOHBETI            → ok=${res.ok} sebep=${res.reason} dusen=${res.dropped ?? '-'}`);
  if (res.ok) { say('   *** grubu kabul etti'); fails++; }
}

// ---------- 5. determinism ----------
{
  const { text } = makeExport({ seed: 5 });
  const a = JSON.stringify(analyzeTime(text, { B: 199, Bboot: 60 }));
  const b = JSON.stringify(analyzeTime(text, { B: 199, Bboot: 60 }));
  say(`\n5) AYNI EXPORT IKI KEZ     → ${a === b ? 'BIT-AYNI' : 'FARKLI ***'}`);
  if (a !== b) fails++;
}

// ---------- 6. scale ----------
{
  const { text } = makeExport({ seed: 8, days: 1100, sessionsPerWeek: 30 });
  const t0 = Date.now();
  const res = analyzeTime(text, { B: 999, Bboot: 200 });
  const ms = Date.now() - t0;
  say(`\n6) BUYUK EXPORT            → ${Math.round(text.length / 1024)} KB, ${res.ok ? res.summary.messages : '?'} mesaj, ${ms} ms`);
  if (ms > 5000) { say('   *** cok yavas'); fails++; }
}

say('');
if (fails) { say(`*** ${fails} MADDE KALDI`); process.exit(1); }
say('E2E: hepsi gecti');
