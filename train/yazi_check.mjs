// Renderer harness: does the verdict turn into the right Turkish sentence in every state?
// Run: node train/yazi_check.mjs
import { analyzeTime } from '../web/js/time/analyze.js';
import { yaz } from '../web/js/zamanYazi.js';
import { makeExport } from './synth.mjs';

const strip = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
let fails = 0;
function want(name, html, needles, forbidden = []) {
  const t = strip(html);
  const missing = needles.filter((n) => !t.includes(n));
  const present = forbidden.filter((n) => t.includes(n));
  if (missing.length || present.length) {
    fails++;
    console.log(`*** ${name}`);
    if (missing.length) console.log(`    eksik: ${missing.join(' | ')}`);
    if (present.length) console.log(`    olmamali: ${present.join(' | ')}`);
    console.log(`    metin: ${t.slice(0, 420)}`);
  } else console.log(`ok  ${name}`);
}

// 1. a real break
{
  const { text } = makeExport({ seed: 5 });
  const html = yaz(analyzeTime(text, { B: 999, Bboot: 200 }), 'x.txt');
  want('kirilma var, tarih ve cumle cikiyor', html,
    ['nisan 2025', 'cevap süresi', 'Damla ve Kerem', 'bunu nasıl okudum?', 'hiçbir mesaj bu cihazdan çıkmadı'],
    ['undefined', 'NaN', 'null']);
  console.log('    ' + strip(html).slice(0, 260));
}

// 2. nothing changed
{
  const { text } = makeExport({ seed: 9, latBefore: 6, latAfter: 6, initBefore: 0.5, initAfter: 0.5 });
  const html = yaz(analyzeTime(text, { B: 999, Bboot: 200 }), 'x.txt');
  want('degismedi, uydurma tarih yok', html,
    ['bir kırılma yok', 'bulamadım'], ['undefined', 'NaN']);
}

// 3. too short for a DATE. Not too short for a reading.
//
// This used to assert the refusal card ("yetmiyor", "daha uzun bir sohbet dene"), which is what the
// old gateOverall early return produced. That behaviour was the defect: one threshold silenced the
// counts and every per signal test along with the date. The assertion is inverted, not weakened.
// The date claim must still be absent, and now the reading and the counts must be present.
{
  const { text } = makeExport({ seed: 3, days: 20, sessionsPerWeek: 4 });
  const res = analyzeTime(text, { B: 199, Bboot: 60 });
  const html = yaz(res, 'x.txt');
  want('kisa sohbette motor okuyor, sadece tarih susuyor', html,
    ['gün yazmıyorum', 'gerekiyor', 'mesaj', 'konuşma', 'sıra', 'kelime'],
    ['undefined', 'NaN', 'daha uzun bir sohbet dene', 'bir şey söylemeye yetmiyor']);
  if (res.ok !== true) { fails++; console.log(`*** kisa sohbette motor hala reddediyor: ${res.reason}`); }
  else if (res.points.length || /class="tarih"/.test(html)) {
    fails++; console.log('*** kisa sohbette tarih iddiasi uretildi');
  } else console.log('ok  kisa sohbette tarih iddiasi yok');
  const okumaSayisi = (html.match(/<ul class="okuma">([^]*?)<\/ul>/) || ['', ''])[1].split('<li').length - 1;
  if (okumaSayisi < 1) { fails++; console.log('*** kisa sohbette hic okuma satiri yok'); }
  else console.log(`ok  kisa sohbette ${okumaSayisi} okuma satiri var`);
}

// 4. group
{
  const { text } = makeExport({ seed: 4 });
  const html = yaz(analyzeTime(text + '\n' + '12.06.2025, 14:00 - Zeynep: ben de varim\n'.repeat(40), { B: 199, Bboot: 60 }), 'x.txt');
  want('grup reddi', html, ['grup sohbeti'], ['undefined', 'NaN']);
}

// 5. no timestamps at all
{
  const html = yaz(analyzeTime('Ali: selam\nVeli: naber\n'.repeat(400), { B: 199, Bboot: 60 }), 'x.txt');
  want('damgasiz metin reddi', html, ['saat yok'], ['undefined', 'NaN']);
}

// 6. house style: no em dash anywhere, every question ends with a question mark
{
  const { text } = makeExport({ seed: 5 });
  const html = yaz(analyzeTime(text, { B: 999, Bboot: 200 }), 'x.txt');
  const t = strip(html);
  if (t.includes('—')) { fails++; console.log('*** em dash var'); } else console.log('ok  em dash yok');
  const basliklar = (html.match(/<summary>([^<]*)<\/summary>|<h2>([^<]*)<\/h2>/g) || [])
    .map((x) => x.replace(/<[^>]+>/g, '').trim());
  const kotu = basliklar.filter((b) => /^(nasıl|neden|ne zaman|kim|hangi)/i.test(b) && !b.endsWith('?'));
  if (kotu.length) { fails++; console.log(`*** soru basligi "?" ile bitmiyor: ${kotu.join(', ')}`); }
  else console.log('ok  soru basliklari "?" ile bitiyor');
}

// 7. the same fact must not appear with two different numbers
{
  const { text } = makeExport({ seed: 5 });
  const t = strip(yaz(analyzeTime(text, { B: 999, Bboot: 200 }), 'x.txt'));
  const katlar = [...t.matchAll(/([0-9]+,[0-9]) kat/g)].map((m) => m[1]);
  const tekil = [...new Set(katlar)];
  if (katlar.length > 1 && tekil.length > 1) {
    fails++; console.log(`*** ayni ekranda farkli kat sayilari: ${tekil.join(' / ')}`);
  } else console.log(`ok  kat sayisi tutarli (${tekil.join('') || 'yok'})`);
}

// 8. this flow never asks who the reader is, so it must not address them as "sen"
{
  const { text } = makeExport({ seed: 5 });
  const t = strip(yaz(analyzeTime(text, { B: 999, Bboot: 200 }), 'x.txt'));
  const ikinciSahis = /\b(senden|sensin|sen |senin |seni )/i.test(t);
  if (ikinciSahis) { fails++; console.log('*** okuyucuya "sen" diye sesleniyor, oysa kim oldugu sorulmadi'); }
  else console.log('ok  okuyucuya yanlis kisi diye seslenmiyor');
}

// 9. archetype label is present and carries its own number
{
  const { text } = makeExport({ seed: 5 });
  const t = strip(yaz(analyzeTime(text, { B: 999, Bboot: 200 }), 'x.txt'));
  const var_ = /(bekleten|kuru cevap|tek tarafl|kaybolan|gece hatt|dengeli)/.test(t);
  if (!var_) { fails++; console.log('*** arketip etiketi yok'); } else console.log('ok  arketip etiketi var');
}

console.log('');
if (fails) { console.log(`*** ${fails} MADDE KALDI`); process.exit(1); }
console.log('yazi_check: hepsi gecti');
