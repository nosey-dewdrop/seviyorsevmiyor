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
    ['bu sohbette bir kırılma yok'], ['undefined', 'NaN']);
}

// 3. too short
{
  const { text } = makeExport({ seed: 3, days: 20, sessionsPerWeek: 4 });
  const html = yaz(analyzeTime(text, { B: 199, Bboot: 60 }), 'x.txt');
  want('kisa sohbet, eksigi sayiyla soyluyor', html,
    ['yetmiyor', 'gerekiyor'], ['undefined', 'NaN']);
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

console.log('');
if (fails) { console.log(`*** ${fails} MADDE KALDI`); process.exit(1); }
console.log('yazi_check: hepsi gecti');
