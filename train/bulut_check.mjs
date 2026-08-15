// What actually leaves the device on the cloud path, and what the server refuses to accept or
// return. Run: node train/bulut_check.mjs
//
// The privacy line on this page is "only numbers leave". That is a claim about the payload, so it
// is tested against the payload rather than asserted in copy.
import { analyzeTime } from '../web/js/time/analyze.js';
import { makeExport } from './synth.mjs';

let fails = 0;
const ok = (n, c, d = '') => { if (c) console.log(`ok  ${n}`); else { fails++; console.log(`*** ${n}${d ? '\n    ' + d : ''}`); } };

// zamanBulut.js imports config.js which is browser-safe, so pull olgular() out by re-implementing
// nothing: import it directly.
const { olgular } = await import('../web/js/zamanBulut.js');

const { text } = makeExport({ seed: 5 });
const res = analyzeTime(text, { B: 999, Bboot: 200 });
const payload = olgular(res);
const json = JSON.stringify(payload);

console.log('cihazdan cikan tam yuk:');
console.log('  ' + json);
console.log(`  boyut: ${json.length} bayt\n`);

// 1. no message text
{
  const kelimeler = ['selam', 'naber', 'bakariz', 'ozledim', 'gunaydin', 'musait', 'komiksin'];
  ok('mesaj metni yok', !kelimeler.some((k) => json.toLowerCase().includes(k)));
}

// 2. no names
{
  ok('isim yok', !/damla|kerem|zeynep/i.test(json), json);
}

// 3. every value is a number, a boolean, or a short enum key
{
  const kotu = Object.entries(payload).filter(([, v]) => {
    if (v === null || typeof v === 'number' || typeof v === 'boolean') return false;
    if (typeof v === 'string') return v.length > 40 || /\s/.test(v);
    return true;
  });
  ok('her alan sayi, bool ya da kisa anahtar', kotu.length === 0, JSON.stringify(kotu));
}

// 4. small enough that it cannot be smuggling content
{
  ok('yuk 2000 baytin altinda', json.length < 2000, `${json.length} bayt`);
}

// 5. no raw timestamps that could rebuild the chat timeline
{
  const buyuk = Object.entries(payload).filter(([, v]) => typeof v === 'number' && Math.abs(v) > 1e6);
  ok('ham zaman damgasi sizmiyor', buyuk.length === 0, JSON.stringify(buyuk));
}

// 6. the model's output validator: a digit anywhere means reject
{
  const gecerli = (satirlar) => satirlar.every((s) => !/[0-9]/.test(s) && s.length <= 140);
  ok('rakam iceren cikti reddedilir', !gecerli(['cevaplar 4 saate cikti']));
  ok('rakamsiz cikti kabul edilir', gecerli(['cevaplar uzadi', 'biri geri cekildi']));
  ok('cok uzun cikti reddedilir', !gecerli(['x'.repeat(200)]));
}

// 7. the page must be complete before the cloud is ever asked
{
  const { yaz } = await import('../web/js/zamanYazi.js');
  const html = yaz(res, 'x.txt');
  const t = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  ok('bulut olmadan da tam okuma var', t.includes('nisan 2025') && t.includes('bunu nasıl okudum?'));
}

// 8. quota states all render, including the honest exhausted note
{
  const { bulutBlok } = await import('../web/js/zamanYazi.js');
  const doldu = bulutBlok('doldu', 0, 100).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  ok('kota bitti notu var ve durust', doldu.includes('sınırladım') && doldu.includes('teşekkürler'), doldu);
  const teklif = bulutBlok('teklif', 63, 100).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  ok('teklifte kalan sayi gorunuyor', teklif.includes('63') && teklif.includes('100'), teklif);
  ok('teklif ne cikacagini soyluyor', teklif.includes('sadece sayılar çıkar'));
}

console.log('');
if (fails) { console.log(`*** ${fails} MADDE KALDI`); process.exit(1); }
console.log('bulut_check: hepsi gecti');
