#!/usr/bin/env node
// AZ VERI KAPISI — "sohbetimi biraktim ve motor bana gercekten bir sey soyledi."
//
// Run: node train/az_veri_check.mjs
//
// The defect this gate was written for was live. A real 68 message / 11 day chat produced one
// screen and only one screen: "bu sohbet bir sey soylemeye yetmiyor. mesaj: 68 var, 500 gerekiyor.
// gun: 11 var, 60 gerekiyor." Two numbers with no calibration behind them, printed instead of a
// 6x reply gap that was sitting in the same 68 messages and is measurable there.
//
// The architecture, not the threshold, was the fault: gateOverall was an early `return` in
// analyze.js, so buildSignals, the latency medians, who ends, who opens, the night share and the
// plain counts were never computed at all.
//
// This gate measures the product at the sizes it refused to speak at:
//
//   1. NULL SWEEP. 200 synthetic chats per size at 20/40/68/100/250/500 messages, generated with
//      no planted effect. Every inference that can reach the screen is counted. Any of them firing
//      more than 5% of the time is RED. "A line the engine shows" and "a line the engine measured"
//      have to be the same set.
//   2. POWER. The same sizes with a real pattern planted, so the table says what az veri buys and
//      what it does not.
//   3. THE LIVE CASE. 68 messages / 11 days, rendered through the real zamanYazi.yaz: the screen
//      must carry at least one finding line and the full count block, and must not be a refusal.
//   4. NO DATE ON A SHORT CHAT. 11 days is under the 2 * 21 day calendar guard in cpd.js, so a
//      dated claim there is fabrication regardless of how many messages are crammed in. Tested with
//      5000 messages inside 11 days as well.
//   5. COUNTS AT EVERY SIZE. summary is description, not inference, so it is never allowed to be
//      missing from the screen.
//   6. NO UNSOURCED NUMBER. The old 500/60 pair may not come back, and the threshold that replaced
//      it has to carry its derivation in the file.
//
// Nothing here is stubbed: analyzeTime and yaz are the shipped modules.

import { analyzeTime } from '../web/js/time/analyze.js';
import { sohbet } from './az_veri_synth.mjs';
import { makeExport } from './synth.mjs';
import { yaz } from '../web/js/zamanYazi.js';
import { NEED } from '../web/js/time/honesty.js';
import { MIN_EVENTS } from '../web/js/time/cpd.js';
import { readFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let fails = 0;
const ok = (ad, kosul, detay = '') => {
  if (kosul) console.log(`ok   ${ad}`);
  else { fails++; console.log(`***  ${ad}${detay ? `\n       ${detay}` : ''}`); }
};
const baslik = (s) => console.log(`\n=== ${s} ===`);

// ---- which claims can reach the screen ---------------------------------------------------------
//
// One entry per line the reader can be shown as a finding. If a line renders, it is measured here.

const IDDIALAR = {
  gecikme_asimetri: (res) => !!(res.latency && res.latency.asymmetry && res.latency.asymmetry.different),
  bitiren: (res) => !!(res.lastWord && res.lastWord.A && res.lastWord.A.significant),
  baslatma: (res) => !!(res.baslatma && res.baslatma.significant),
  gece: (res) => !!(res.gece && res.gece.significant),
  tarih: (res) => !!(res.points && res.points.length > 0),
};
const IDDIA_ADLARI = Object.keys(IDDIALAR);

// The shipped settings, not cheaper ones. B = 199 was tried first and it moved the answer: the
// permutation floor becomes 1/200 = 0.005, Holm multiplies the smallest p by the number of points,
// and a planted 4x break that the engine finds at B = 999 came back with zero points. A sweep that
// under-reports the date layer would report a false positive rate for something that never ran.
const B = 999, Bboot = 200;
const TEKRAR = Number(process.env.AZ_VERI_TEKRAR || 200);
const BOYUTLAR = [
  { mesaj: 20, gun: 4 },
  { mesaj: 40, gun: 7 },
  { mesaj: 68, gun: 11 },      // the live case
  { mesaj: 100, gun: 16 },
  { mesaj: 250, gun: 42 },     // NEED.changePoint, exactly
  { mesaj: 500, gun: 84 },
];

function kosu(opts) {
  return analyzeTime(sohbet(opts), { B, Bboot });
}

function sayim(opts, n, tohumOfs) {
  const say = Object.fromEntries(IDDIA_ADLARI.map((k) => [k, 0]));
  let gecerli = 0;
  // How many of these runs even reached the change point search. Without it a "date: 0.0%" column
  // cannot be told apart from a layer that never ran, and those two are not the same claim.
  let kapiAcik = 0;
  for (let i = 0; i < n; i++) {
    const res = kosu({ ...opts, seed: tohumOfs + i });
    if (!res.ok) continue;
    gecerli++;
    if (res.zamanKapisi && res.zamanKapisi.ok) kapiAcik++;
    for (const k of IDDIA_ADLARI) if (IDDIALAR[k](res)) say[k]++;
  }
  return { say, gecerli, kapiAcik };
}

const yuz = (k, n) => (n ? `${((100 * k) / n).toFixed(1)}%` : '  n/a');
const sut = (s, w = 9) => String(s).padStart(w);

// ================================================================================================
baslik(`1. NULL SERI: yanlis pozitif (${TEKRAR} tekrar, ekilen desen yok)`);

console.log(`     olcum ayari: B=${B} permutasyon, Bboot=${Bboot}, esik %5`);
console.log(`     ${'boyut'.padEnd(14)}${IDDIA_ADLARI.map((k) => sut(k, 18)).join('')}`);

const nullSonuc = [];
for (const [bi, b] of BOYUTLAR.entries()) {
  const t0 = Date.now();
  const { say, gecerli, kapiAcik } = sayim(b, TEKRAR, 1000 + bi * 100000);
  nullSonuc.push({ b, say, gecerli });
  const satir = IDDIA_ADLARI.map((k) => sut(`${say[k]}/${gecerli} ${yuz(say[k], gecerli)}`, 18)).join('');
  console.log(`     ${`${b.mesaj} msj / ${b.gun} gun`.padEnd(14)}${satir}   tarih katmani acik: ${kapiAcik}/${gecerli}  (${Date.now() - t0} ms)`);
}

for (const { b, say, gecerli } of nullSonuc) {
  ok(`${b.mesaj} mesaj: her boy analiz edildi (motor reddetmedi)`, gecerli === TEKRAR,
    `${gecerli}/${TEKRAR}`);
  for (const k of IDDIA_ADLARI) {
    const fp = gecerli ? say[k] / gecerli : 0;
    ok(`${b.mesaj} mesaj / ${k}: yanlis pozitif %5 altinda`, fp < 0.05,
      `${yuz(say[k], gecerli)} (${say[k]}/${gecerli})`);
  }
}

// ================================================================================================
baslik('2. EKILI GERCEK DESEN: guc');

const DESENLER = [
  { ad: 'gecikme 10x', opts: { gecikmeKat: 10 }, bak: 'gecikme_asimetri' },
  { ad: 'gecikme 3x', opts: { gecikmeKat: 3 }, bak: 'gecikme_asimetri' },
  { ad: 'baslatma 0.85', opts: { baslatmaP: 0.85 }, bak: 'baslatma' },
  { ad: 'bitiren 0.85', opts: { bitirenP: 0.85 }, bak: 'bitiren' },
  { ad: 'gece tek tarafli', opts: { geceSolo: 0.35 }, bak: 'gece' },
];

// Power costs the same as the null sweep and buys a table, not a pass/fail, so it runs at a
// quarter of the repetitions. The number printed is an estimate and is labelled as one.
const GUC_TEKRAR = Math.max(50, Math.round(TEKRAR / 4));
console.log(`     ${GUC_TEKRAR} tekrar, tabloda satirin ekildigi olcumun yakalama orani`);
console.log(`     ${'desen'.padEnd(16)}${BOYUTLAR.map((b) => sut(`${b.mesaj}msj`, 9)).join('')}`);
for (const [di, d] of DESENLER.entries()) {
  const hucre = [];
  for (const [bi, b] of BOYUTLAR.entries()) {
    const { say, gecerli } = sayim({ ...b, ...d.opts }, GUC_TEKRAR, 500000 + di * 50000 + bi * 5000);
    hucre.push(sut(yuz(say[d.bak], gecerli), 9));
  }
  console.log(`     ${d.ad.padEnd(16)}${hucre.join('')}`);
}

// ================================================================================================
baslik('3. CANLIDAKI VAKA: 68 mesaj / 11 gun, ekranda ne var');

const gorunen = (h) => String(h || '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/\s+/g, ' ').trim();

// Two patterns planted, so nothing this screen prints is a coin landing the same way twice:
// a 10x reply gap and a 4 in 5 opening share. The false positive table above is the authority on
// what an UNplanted chat of this size prints, and it is 0.0% for every line.
const canliRes = kosu({ seed: 7, mesaj: 68, gun: 11, gecikmeKat: 10, baslatmaP: 0.82 });
const canliHtml = yaz(canliRes, 'sohbet.txt');
const canliMetin = gorunen(canliHtml);
console.log(`     ${canliRes.ok ? `${canliRes.summary.messages} mesaj, ${Math.round(canliRes.summary.spanDays)} gun, ${canliRes.summary.sessions} konusma` : `REDDEDILDI: ${canliRes.reason}`}`);
console.log(`     ekran: ${canliMetin.slice(0, 300)}`);

ok('68 mesaj analiz ediliyor, reddedilmiyor', canliRes.ok === true, canliRes.reason || '');
ok('ekran bos degil', canliMetin.length > 120, `${canliMetin.length} karakter`);

const okumaHtml = (canliHtml.match(/<ul class="okuma">([^]*?)<\/ul>/) || ['', ''])[1];
const okumaSatir = (okumaHtml.match(/<li[^>]*>/g) || []);
const bulgu = okumaSatir.filter((t) => !/class="yok"/.test(t));
console.log(`     okuma satiri: ${okumaSatir.length}, bunlarin ${bulgu.length} tanesi bir BULGU`);
ok('okuma blogu var ve dolu', okumaSatir.length >= 1, `${okumaSatir.length} satir`);
ok('EN AZ BIR GERCEK OKUMA SATIRI VAR (fark bulundu diyen)', bulgu.length >= 1,
  gorunen(okumaHtml));
ok('ekilen 10x gecikme farki 68 mesajda yakalandi', /kat daha geç dönüyor/.test(canliMetin),
  gorunen(okumaHtml));
ok('arketip etiketi 68 mesajda da hesaplandi',
  /(bekleten|kuru cevap|tek tarafl|kaybolan|gece hatt|dengeli)/.test(canliMetin));

ok('REDDETME EKRANI YOK: "yetmiyor" cumlesi ekranda degil',
  !/bir şey söylemeye yetmiyor/.test(canliMetin), canliMetin.slice(0, 200));
ok('REDDETME EKRANI YOK: "daha uzun bir sohbet dene" ekranda degil',
  !/daha uzun bir sohbet dene/.test(canliMetin));
ok('uydurma esik metni yok: "500 gerekiyor" ekranda degil', !/500 gerekiyor/.test(canliMetin));
ok('tarihin neden yok oldugu ADIYLA yaziliyor',
  /gerekiyor/.test(canliMetin) && /gün yazmıyorum/.test(canliMetin), canliMetin.slice(-400));
ok('okumanin tarih notundan etkilenmedigi soyleniyor',
  /okuma bundan etkilenmiyor/.test(canliMetin));

// ================================================================================================
baslik('4. 11 GUNLUK SOHBETTE TARIH IDDIASI YOK');

ok(`takvim kapisi arimetigi: NEED.changePoint.days = 2 * 21 = ${NEED.changePoint.days}`,
  NEED.changePoint.days === 42, String(NEED.changePoint.days));
ok('canli vakada hic degisim noktasi uretilmedi', canliRes.points.length === 0,
  JSON.stringify(canliRes.points.map((p) => p.label)));
ok('canli vakada tarih satiri ekranda yok', !/class="tarih"/.test(canliHtml));
ok('tarih katmani kapali olarak isaretlenmis',
  canliRes.zamanKapisi && canliRes.zamanKapisi.ok === false,
  JSON.stringify(canliRes.zamanKapisi));

// 5000 messages crammed into 11 days: the message count is far past the threshold and the date is
// still impossible, because cpd.js needs 21 calendar days on each side of any split.
{
  const kalabalik = analyzeTime(sohbet({ seed: 11, mesaj: 5000, gun: 11, gecikmeKat: 10 }), { B, Bboot });
  console.log(`     11 gune sikistirilmis ${kalabalik.ok ? kalabalik.summary.messages : '?'} mesaj → nokta: ${kalabalik.ok ? kalabalik.points.length : 'n/a'}`);
  ok('11 gunde 5000 mesaj da tarih uretmiyor', kalabalik.ok && kalabalik.points.length === 0,
    JSON.stringify((kalabalik.points || []).map((p) => p.label)));
  ok('ama o 5000 mesajda okuma yine de var',
    kalabalik.ok && !!(kalabalik.latency.A && kalabalik.latency.B));
}

// A "date: 0.0%" column means nothing unless the layer can still fire when there IS a break. This
// is the same planted export train/e2e_check.mjs uses, run through the same analyzeTime.
{
  const { text, breakTs } = makeExport({ seed: 5 });
  const kirik = analyzeTime(text, { B, Bboot });
  const sapma = kirik.ok && kirik.points.length
    ? Math.round(Math.abs(kirik.points[0].ts - breakTs) / 1440) : null;
  console.log(`     ekili kirilma olan uzun sohbet → ${kirik.ok ? kirik.points.length : '?'} nokta, sapma ${sapma} gun`);
  ok('tarih katmani olu degil: ekili kirilmada tarih uretiyor',
    kirik.ok && kirik.points.length > 0 && sapma != null && sapma <= 7, String(sapma));
}

// Why the message half of the threshold is 250 and not, say, 120. Below it the date layer has
// nothing to run ON: every signal series is shorter than cpd.js MIN_EVENTS, so the number states a
// fact about the engine instead of adding a rule on top of it. Measured here rather than asserted,
// on chats with a long span and few messages, where the calendar gate is NOT what is binding.
{
  const SINYAL = 11;                            // 5 per side + sessizlik
  const N = 50;
  let uygun = 0;
  for (let i = 0; i < N; i++) {
    const r = analyzeTime(sohbet({ seed: 8000 + i, mesaj: 120, gun: 120 }), { B, Bboot });
    if (r.ok && r.refused.length < SINYAL) uygun++;
  }
  console.log(`     120 mesaj / 120 gun: ${N} sohbetin ${uygun} unde EN AZ BIR sinyal MIN_EVENTS=${MIN_EVENTS} i geciyor`);
  ok('250 mesajin altinda tarih katmaninin uzerinde calisacak seri neredeyse hic yok (%10 alti)',
    uygun / N <= 0.10, `${uygun}/${N}`);
}

// A chat that IS long enough must still be able to produce a date, or the fix is just a mute.
{
  const uzun = analyzeTime(sohbet({ seed: 21, mesaj: 3000, gun: 400, gecikmeKat: 1 }), { B, Bboot });
  ok('42 gunu asan sohbette tarih katmani aciliyor',
    uzun.ok && uzun.zamanKapisi.ok === true, JSON.stringify(uzun.ok && uzun.zamanKapisi));
}

// ================================================================================================
baslik('5. SAYIMLAR HER BOYUTTA EKRANDA');

const SAYIM_ETIKET = ['mesaj', 'gün', 'konuşma', 'sıra', 'kelime', 'soru', 'medya',
  'gece mesajı', 'başlatma', 'bitirme', 'en uzun sessizlik'];

for (const b of BOYUTLAR) {
  const res = kosu({ seed: 31, ...b, gecikmeKat: 4 });
  const html = yaz(res, 'x.txt');
  const i0 = html.indexOf('<div class="sayilar">');
  const blok = i0 < 0 ? '' : html.slice(i0, html.indexOf('<details', i0));
  const eksik = SAYIM_ETIKET.filter((e) => !gorunen(blok).includes(e));
  ok(`${b.mesaj} mesaj: sayim blogundaki ${SAYIM_ETIKET.length} kalemin hepsi ekranda`,
    res.ok && eksik.length === 0, `eksik: ${eksik.join(', ')}`);
  const t = gorunen(html);
  ok(`${b.mesaj} mesaj: ekranda undefined / NaN / null yok`,
    !/\b(undefined|NaN|null)\b/.test(t), t.slice(0, 200));
}

// ================================================================================================
baslik('6. KAYNAKSIZ SAYI YOK');

// Comments are stripped first. Both of these files explain what they removed and why, quoting the
// old code, and a check that cannot tell a quotation from a live line would forbid writing the
// reason down.
const koda = (src) => src.replace(/\/\*[^]*?\*\//g, '').split('\n')
  .map((l) => l.replace(/^\s*\/\/.*$/, '')).join('\n');
const honesty = koda(readFileSync(join(REPO, 'web/js/time/honesty.js'), 'utf8'));
const honestyHam = readFileSync(join(REPO, 'web/js/time/honesty.js'), 'utf8');
const analyze = koda(readFileSync(join(REPO, 'web/js/time/analyze.js'), 'utf8'));
const yaziSrc = koda(readFileSync(join(REPO, 'web/js/zamanYazi.js'), 'utf8'));

ok('honesty.js de anyTimeClaim kalmadi', !/anyTimeClaim/.test(honesty));
ok('uydurma 500 / 60 cifti geri gelmedi',
  !/messages:\s*500/.test(honesty) && !/days:\s*60/.test(honesty));
ok('changePoint esigi 250 / 42', NEED.changePoint.messages === 250 && NEED.changePoint.days === 42,
  JSON.stringify(NEED.changePoint));
ok('esigin gerekcesi kodda yaziyor (cpd.js:249 takvim kapisi adiyla aniliyor)',
  /cpd\.js:249/.test(honestyHam) && /21 calendar/.test(honestyHam),
  'gerekce yorumu yok');
ok('esigin olcum kaynagi kodda yaziyor (bu kapinin adi geciyor)',
  /az_veri_check/.test(honestyHam), 'olcum kaynagi yazilmamis');
ok('MIN_EVENTS honesty.js icine elle kopyalanmadi, cpd.js ten geliyor',
  /import\s*{\s*MIN_EVENTS\s*}\s*from '\.\/cpd\.js'/.test(honestyHam) && NEED.events === MIN_EVENTS,
  String(NEED.events));

ok('analyze.js te genel veri_yetersiz erken donusu kalmadi',
  !/reason:\s*'veri_yetersiz'/.test(analyze), 'erken donus hala var');
ok('zamanYazi.js te veri_yetersiz red karti kalmadi',
  !/res\.reason === 'veri_yetersiz'/.test(yaziSrc), 'red karti hala var');

// uzunluk_* and sessizlik used to fall through gateSignal with a bare ok:true.
{
  const res = kosu({ seed: 41, mesaj: 100, gun: 16 });
  const kapisiz = (res.refused || []).filter((r) => r.need == null);
  console.log(`     reddedilen sinyaller: ${(res.refused || []).map((r) => `${r.key}(${r.have}/${r.need})`).join(', ')}`);
  ok('hicbir sinyal kapisiz (have/need) null ile reddedilmiyor', kapisiz.length === 0,
    kapisiz.map((r) => r.key).join(', '));
  const anahtarlar = (res.refused || []).map((r) => r.key);
  ok('uzunluk_* ve sessizlik artik gercek sayiyla raporlaniyor',
    anahtarlar.some((k) => k.startsWith('uzunluk')) && anahtarlar.includes('sessizlik'),
    anahtarlar.join(', '));
}

// ================================================================================================
baslik('7. KOPYA KANUNU');

{
  const metin = canliMetin;
  ok('em dash yok', !metin.includes('—'));
  ok('"kanka" yok', !/kanka/i.test(metin));
  // JS \b is ASCII, so it fires INSIDE Turkish words: "dagilimindan" contains "mi" between two
  // non-ASCII letters and a naive \bmi\b calls it a question. The boundary is spelled out.
  const HARF = 'a-zA-ZçğıöşüÇĞİÖŞÜ';
  const SORU = ['mi', 'mı', 'mu', 'mü', 'misin', 'mısın', 'musun', 'müsün', 'nasıl', 'neden', 'niye'];
  const sorular = metin.split(/(?<=[.?!])\s+/)
    .filter((c) => SORU.some((k) => new RegExp(`(^|[^${HARF}])${k}([^${HARF}]|$)`, 'i').test(c))
      && !/\?/.test(c));
  ok('soru cumlesi olup "?" ile bitmeyen yok', sorular.length === 0, sorular.join(' | '));
  const basliklar = (canliHtml.match(/<summary>([^<]*)<\/summary>|<h2>([^<]*)<\/h2>/g) || [])
    .map((x) => x.replace(/<[^>]+>/g, '').trim());
  const kotu = basliklar.filter((b) => /^(nasıl|neden|ne zaman|kim|hangi)/i.test(b) && !b.endsWith('?'));
  ok('soru basliklari "?" ile bitiyor', kotu.length === 0, kotu.join(', '));
}

console.log('');
if (fails) { console.log(`KIRMIZI: ${fails} olcum dustu`); process.exit(1); }
console.log('YESIL: 68 mesajda ekranda okuma ve sayimlar var, 11 gunde tarih yok, gosterilen her cikarimin yanlis pozitifi %5 altinda.');
process.exit(0);
