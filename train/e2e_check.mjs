// End to end: a real-format WhatsApp export string goes in, a dated verdict comes out.
// Run: node train/e2e_check.mjs
// This is the test that decides whether the engine is a product or a pile of statistics.
import { analyzeTime } from '../web/js/time/analyze.js';
import { makeExport } from './synth.mjs';

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

// ---------- 3. short chat: no DATE, but the rest of the engine still runs ----------
//
// The old assertion here was `if (res.ok) fail` — a short chat had to be refused outright. That
// locked the defect in place: gateOverall was an early return, so 68 real messages produced two
// missing-data numbers and nothing else. The test is not relaxed, it is aimed at the right thing.
// A date claim on a chat shorter than 2 * 21 days is still a failure. Silence is now also a failure.
{
  const { text } = makeExport({ seed: 3, days: 20, sessionsPerWeek: 4 });
  const res = analyzeTime(text, { B: 199, Bboot: 60 });
  say(`\n3) KISA SOHBET (20 gun)    → ok=${res.ok} tarih_kapisi=${res.zamanKapisi ? res.zamanKapisi.ok : '?'}`);
  if (!res.ok) { say(`   *** kisa sohbeti tumden reddetti: ${res.reason}`); fails++; }
  else {
    say(`   ${res.summary.messages} mesaj, ${Math.round(res.summary.spanDays)} gun, ${res.summary.sessions} oturum`);
    say(`   eksik olan katman: ${res.zamanKapisi.reasons.map((r) => `${r.what} ${r.have}/${r.need}`).join(', ')}`);
    if (res.points.length) { say('   *** kisa sohbette TARIH IDDIASI uretti'); fails++; }
    const sayimVar = res.summary.messages > 0 && res.summary.sessions > 0
      && res.summary.A.turns > 0 && res.summary.B.turns > 0;
    if (!sayimVar) { say('   *** sayimlar hesaplanmadi'); fails++; }
    const okumaVar = res.latency.A || res.latency.B || res.lastWord.A || res.baslatma;
    if (!okumaVar) { say('   *** hicbir okuma katmani hesaplanmadi'); fails++; }
    say(`   sayimlar var, okuma katmanlari hesaplandi (gecikme/bitiren/baslatma/gece)`);
  }
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
