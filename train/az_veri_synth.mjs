// Synthetic chats for train/az_veri_check.mjs, with the message COUNT and the calendar span both
// under control. synth.mjs generates by days and sessions-per-week, which is the wrong handle for a
// sweep that is about what the engine can say at 20 / 40 / 68 / 100 / 250 / 500 messages.
//
// Data generation only. The engine under test is imported by the gate, never imitated.

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
const pad = (n) => String(n).padStart(2, '0');
function stamp(min) {
  const d = new Date(min * 60000);
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
const LINES_A = ['gunaydin', 'ne yapiyorsun', 'bugun nasil gecti', 'aksam musait misin',
  'seni dusundum', 'hadi bir kahve icelim', 'cok komiksin', 'yarin gorusur muyuz'];
const LINES_B = ['iyiyim', 'idare eder', 'bakariz', 'yogunum biraz', 'olur', 'hmm',
  'sonra yazarim', 'tamam'];

// Midnight, deliberately. `saat` below is an absolute hour of the day and is added to this, so a
// non-zero hour here would be added on top of it and push every "daytime" session into the night.
const BASLANGIC = Math.floor(Date.UTC(2025, 0, 6, 0, 0) / 60000);

/**
 * @param mesaj      target message count
 * @param gun        calendar span in days
 * @param gecikmeKat B's reply latency divided by A's. 1 = null.
 * @param baslatmaP  P(A opens a session). 0.5 = null.
 * @param bitirenP   P(A sends the last message of a session). 0.5 = null.
 * @param gecePay    share of sessions that start between 01:00 and 04:00, both sides. Background.
 * @param geceSolo   share of sessions replaced by a ONE SIDED burst. 0 = null.
 *
 * On geceSolo: the night test asks whether a side's share of the night is different from its share
 * of the whole chat, so "A writes more inside night sessions" is NOT the pattern it looks for. That
 * plant raises both numbers together and the test correctly reports nothing, which is what the first
 * version of this generator produced (power 0.0% at every size, measured).
 * The pattern that IS night is one side being awake alone. So the bursts come in pairs: A alone at
 * 02:00, B alone in the afternoon, equal counts. Overall message share stays where it was and only
 * the composition of the night moves.
 */
export function sohbet({
  seed = 1, mesaj = 68, gun = 11,
  gecikmeKat = 1, baslatmaP = 0.5, bitirenP = 0.5, gecePay = 0.15, geceSolo = 0,
} = {}) {
  const r = rng(seed * 2654435761 + 12345);
  const out = [`${stamp(BASLANGIC - 60)} - Mesajlar ve aramalar uctan uca sifrelidir.`];
  const turMesaj = 1.3;                       // average messages per turn in this generator
  const turBasi = 5;                          // average turns per session
  // Planned session count. The loop keeps going past it when the message target has not been hit,
  // with the day clamped to `gun`, so `mesaj` is exact and the span is never overrun. Without that
  // tail a request for 68 messages came back with 59, and the gate would then be reporting a size
  // it did not actually test.
  const oturum = Math.max(2, Math.round(mesaj / (turBasi * turMesaj)));
  let yazilan = 0;
  let soloSira = 0;
  let sonT = BASLANGIC - 60;

  const yaz1 = (t, kim) => {
    const satirlar = kim === 'A' ? LINES_A : LINES_B;
    out.push(`${stamp(Math.round(t))} - ${kim === 'A' ? 'Damla' : 'Kerem'}: ${satirlar[Math.floor(r() * satirlar.length)]}`);
    sonT = Math.max(sonT, Math.round(t));
    yazilan++;
  };

  // The DAY is a whole number of days and the HOUR is chosen inside it. Deriving both from one
  // fractional day offset (floor(gunOfs * 1440)) leaked the fraction into the clock: each session
  // slid ~2 hours later than the previous one and the hour histogram came out flat, which silently
  // destroyed every night pattern this generator was supposed to plant. Measured: A and B both at
  // roughly 4% of messages in every one of the 24 hours.
  const gunNo = (s) => Math.min(gun, Math.round((s / Math.max(1, oturum - 1)) * gun));
  // Sessions must not run backwards. When more sessions are asked for than there are days (the
  // "5000 messages in 11 days" case) several land on the same day, so the clock is nudged forward.
  const basla = (s, saat) => Math.max(BASLANGIC + gunNo(s) * 1440 + Math.floor(saat), sonT + 5);

  for (let s = 0; yazilan < mesaj && s < oturum * 4; s++) {
    // one sided burst, alternating side so the two sides get the same number of them
    if (r() < geceSolo) {
      const kim = (soloSira++ % 2 === 0) ? 'A' : 'B';
      const saat = kim === 'A' ? 60 + r() * 180 : 13 * 60 + r() * 4 * 60;
      let t = basla(s, saat);
      const n = 3 + Math.floor(r() * 4);
      for (let m = 0; m < n && yazilan < mesaj; m++) { yaz1(t, kim); t += 1 + r() * 3; }
      continue;
    }

    const gece = r() < gecePay;
    const saat = gece ? 60 + r() * 180 : 9 * 60 + r() * 11 * 60;
    let t = basla(s, saat);

    const acan = r() < baslatmaP ? 'A' : 'B';
    const kapayan = r() < bitirenP ? 'A' : 'B';
    // Pick the turn count whose parity lands the last turn on `kapayan`, so who-ends is a knob
    // rather than a by-product of the loop.
    let turlar = turBasi - 1 + Math.floor(r() * 3);
    const biten = (turlar % 2 === 1) ? acan : (acan === 'A' ? 'B' : 'A');
    if (biten !== kapayan) turlar += 1;

    let kim = acan;
    for (let k = 0; k < turlar && yazilan < mesaj; k++) {
      const n = 1 + (r() < 0.3 ? 1 : 0);
      for (let m = 0; m < n && yazilan < mesaj; m++) { yaz1(t, kim); t += 1 + r() * 2; }
      // the OTHER side now answers; its latency is what the gecikme knob moves
      const cevaplayan = kim === 'A' ? 'B' : 'A';
      const taban = cevaplayan === 'B' ? 6 * gecikmeKat : 6;
      t += taban * (0.4 + r() * 1.6);
      kim = cevaplayan;
    }
  }
  return out.join('\n');
}

