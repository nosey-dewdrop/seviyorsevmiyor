#!/usr/bin/env node
// GIRIS KAPISI — "siteye girdim ve sohbetimin ne zaman degistigine bakan yeri buldum."
//
// Run: node train/giris_check.mjs
//
// The defect this gate was written for was live on 30 Agu. The time flow (web/zaman.html, six
// green Node gates behind it) had NO inbound link anywhere: the word "zaman" did not occur once
// in index.html, sitemap.xml did not list the page, and /zaman without the extension is a 404.
// The only way in was typing the filename by hand. A flow nobody can reach is a flow that does
// not exist, however green its engine is.
//
// This gate does not read prose, it reads the shipped HTML:
//
//   1. index.html actually links to zaman.html, and the link sits ABOVE the paste box (the old
//      flow), i.e. in the part a visitor sees without scrolling.
//   2. the link's visible text says what is behind it. Empty, icon-only, or a one-word riddle
//      like "zaman" is RED: the threshold is >= 4 words and >= 20 characters of real text.
//   3. zaman.html has a way back to index.html, also with visible text.
//   4. sitemap.xml lists zaman.html.
//   5. zaman.html carries og:title / og:description / og:url and they are non-empty and point at
//      zaman.html, not at the root.
//   6. every local file both pages reference exists on disk. One broken href is RED.
//   7. copy law on the text that was added: lowercase start, no em dash, no "kanka", and any
//      sentence shaped like a question ends with "?".

import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = join(REPO, 'web');

let fails = 0;
const ok = (ad, kosul, detay = '') => {
  if (kosul) console.log(`ok   ${ad}`);
  else { fails++; console.log(`***  ${ad}${detay ? `\n       ${detay}` : ''}`); }
};
const baslik = (s) => console.log(`\n=== ${s} ===`);
function blok(ad, fn) {
  try { fn(); } catch (e) { fails++; console.log(`***  ${ad} PATLADI\n       ${(e && e.stack) || e}`); }
}

function oku(rel) {
  const p = join(WEB, rel);
  if (!existsSync(p)) { fails++; console.log(`***  web/${rel} yok`); return ''; }
  return readFileSync(p, 'utf8');
}

// What a reader actually sees inside a chunk of markup.
function gorunen(html) {
  return String(html == null ? '' : html)
    .replace(/<script[^]*?<\/script>/gi, '')
    .replace(/<style[^]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const kelime = (m) => gorunen(m).split(/\s+/).filter(Boolean).length;

// Pull every <a ...>...</a> with its raw inner markup.
function baglar(html) {
  const out = [];
  const re = /<a\b([^>]*)>([^]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1];
    const href = (attrs.match(/href\s*=\s*["']([^"']*)["']/i) || [])[1] || '';
    out.push({ href, ic: m[2], ham: m[0], attrs, konum: m.index });
  }
  return out;
}

// One-word mystery links, the shape the card bans by name.
const GIZEMLI = new Set(['zaman', 'yeni', 'buraya', 'tıkla', 'tikla', 'aç', 'ac', 'git', 'daha', 'devam']);

function metniOlc(ad, ic) {
  const g = gorunen(ic);
  const k = kelime(ic);
  console.log(`     [${ad}] gorunen metin: "${g}"`);
  ok(`${ad}: bagin gorunur metni var (bos degil)`, g.length > 0, 'metin bos');
  ok(`${ad}: sadece ikon/isaret degil`, /[a-zçğıöşüA-ZÇĞİÖŞÜ]{3}/.test(g), g);
  ok(`${ad}: tek kelimelik gizemli metin degil`,
    !(k <= 1 || GIZEMLI.has(g.toLocaleLowerCase('tr'))), `${k} kelime: "${g}"`);
  ok(`${ad}: tiklamadan once ne bulacagini soyluyor (>= 4 kelime, >= 20 karakter)`,
    k >= 4 && g.length >= 20, `${k} kelime / ${g.length} karakter: "${g}"`);
  return g;
}

// ---- 0. dosyalar --------------------------------------------------------------------------------

baslik('0. dosyalar duruyor mu');

const idx = oku('index.html');
const zmn = oku('zaman.html');
const smap = oku('sitemap.xml');
ok('web/index.html okundu', idx.length > 0);
ok('web/zaman.html okundu', zmn.length > 0);
ok('web/sitemap.xml okundu', smap.length > 0);

// ---- 1. ana sayfadan zaman akisina giris ----------------------------------------------------------

baslik('1. ana sayfada zaman akisina giris var mi');

let girisMetni = '';

blok('index -> zaman', () => {
  ok('index.html icinde "zaman" gecen bir yer var (canlida hic yoktu)', /zaman/i.test(idx),
    'kelime hic gecmiyor');

  const hepsi = baglar(idx);
  const zamanBaglari = hepsi.filter((b) => /(^|\/)zaman\.html(\?|#|$)/.test(b.href));
  ok('index.html den zaman.html e giden en az bir <a> var', zamanBaglari.length >= 1,
    `bulunan href ler: ${hepsi.map((b) => b.href).join(' | ') || 'hic <a> yok'}`);
  if (!zamanBaglari.length) return;

  // The most descriptive one is the entry; measure that one.
  const giris = zamanBaglari.slice().sort((a, b) => kelime(b.ic) - kelime(a.ic))[0];
  girisMetni = metniOlc('ana sayfa girisi', giris.ic);

  ok('giris bagi gizlenmemis (hidden / display:none degil)',
    !/\bclass\s*=\s*["'][^"']*\bhidden\b/.test(giris.attrs)
    && !/display\s*:\s*none/i.test(giris.attrs), giris.attrs);

  // Above the fold: the entry must come before the paste box, which is the old flow's first
  // interactive element. If it lands after it, the visitor has to scroll past the whole old flow.
  const yapistir = idx.indexOf('id="pasteBox"');
  const govde = idx.indexOf('<body');
  ok('sayfada yapistirma kutusu hala duruyor (eski akisa dokunulmadi)', yapistir > -1);
  ok('GIRIS YAPISTIRMA KUTUSUNDAN ONCE (kaydirmadan gorulur)',
    giris.konum > govde && giris.konum < yapistir,
    `giris ${giris.konum}, pasteBox ${yapistir}`);

  // It also has to name the thing it opens, not just be long.
  ok('giris metni ne yaptigini soyluyor (zaman/degis/tarih gecen bir cumle)',
    /(ne zaman|değiş|tarih)/i.test(girisMetni), girisMetni);
});

// ---- 2. zaman.html tan geri donus ------------------------------------------------------------------

baslik('2. zaman.html tan ana sayfaya donus yolu var mi');

blok('zaman -> index', () => {
  const hepsi = baglar(zmn);
  const geri = hepsi.filter((b) => /(^|\/)index\.html(\?|#|$)/.test(b.href) || b.href === './' || b.href === '/');
  ok('zaman.html ten ana sayfaya giden en az bir <a> var', geri.length >= 1,
    `bulunan href ler: ${hepsi.map((b) => b.href).join(' | ')}`);
  if (!geri.length) return;
  const enIyi = geri.slice().sort((a, b) => kelime(b.ic) - kelime(a.ic))[0];
  const g = metniOlc('zaman.html donus yolu', enIyi.ic);
  ok('donus metni ana sayfaya gittigini soyluyor', /ana sayfa/i.test(g), g);
  ok('donus yolu birden fazla yerde (ust ve alt)', geri.length >= 2, `${geri.length} tane`);
});

// ---- 3. sitemap ------------------------------------------------------------------------------------

baslik('3. sitemap.xml');

blok('sitemap', () => {
  ok('sitemap.xml zaman.html i iceriyor', /zaman\.html/.test(smap), smap.trim());
  const loc = (smap.match(/<loc>([^<]*zaman\.html)<\/loc>/) || [])[1] || '';
  ok('zaman.html tam url ile yazilmis', /^https?:\/\/[^\s]+\/zaman\.html$/.test(loc), loc);
  ok('sitemap hala ana sayfayi da iceriyor',
    /<loc>https?:\/\/[^<]*\/<\/loc>/.test(smap), smap.trim());
});

// ---- 4. og etiketleri ------------------------------------------------------------------------------

baslik('4. zaman.html og etiketleri');

function meta(html, ad) {
  const re = new RegExp(`<meta[^>]*(?:property|name)\\s*=\\s*["']${ad}["'][^>]*>`, 'i');
  const etiket = (html.match(re) || [])[0] || '';
  const icerik = (etiket.match(/content\s*=\s*["']([^"']*)["']/i) || [])[1] || '';
  return icerik.trim();
}

blok('og', () => {
  const t = meta(zmn, 'og:title');
  const d = meta(zmn, 'og:description');
  const u = meta(zmn, 'og:url');
  console.log(`     og:title       "${t}"`);
  console.log(`     og:description "${d}"`);
  console.log(`     og:url         "${u}"`);
  ok('og:title var ve bos degil', t.length >= 10, t);
  ok('og:description var ve ne oldugunu anlatiyor', d.length >= 40, `${d.length} karakter`);
  ok('og:url var ve zaman.html i gosteriyor (kok degil)', /\/zaman\.html$/.test(u), u);
  ok('og:title zaman akisindan soz ediyor', /(ne zaman|değiş)/i.test(t), t);

  // index.html'in og yapisina uy: bu alanlar orada var, burada da olsun.
  for (const ad of ['og:type', 'og:site_name', 'og:locale', 'og:image', 'twitter:card']) {
    ok(`${ad} de var (ana sayfanin og yapisina uyuyor)`, meta(zmn, ad).length > 0, 'yok');
  }
  ok('og:image ana sayfayla ayni gorseli gosteriyor (og.png)', /og\.png/.test(meta(zmn, 'og:image')),
    meta(zmn, 'og:image'));
  ok('canonical da zaman.html', /<link[^>]*rel=["']canonical["'][^>]*zaman\.html/.test(zmn), 'canonical yok');
});

// ---- 5. kopuk link -----------------------------------------------------------------------------------

baslik('5. iki sayfanin referans verdigi yerel dosyalar gercekten var mi');

// href / src / content on the same-origin references. Absolute site URLs are resolved against web/.
function yerelHedefler(html) {
  const bulunan = new Set();
  const re = /(?:href|src)\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) bulunan.add(m[1]);
  const og = html.match(/content\s*=\s*["'](https:\/\/seviyorsevmiyor\.noseydewdrop\.com[^"']*)["']/gi) || [];
  for (const o of og) bulunan.add((o.match(/["']([^"']+)["']/) || [])[1]);
  return [...bulunan];
}

function dosyaYolu(ref) {
  let r = ref.trim();
  if (!r || r.startsWith('#') || r.startsWith('mailto:') || r.startsWith('data:')) return null;
  if (/^https?:\/\//i.test(r)) {
    if (!/^https?:\/\/seviyorsevmiyor\.noseydewdrop\.com/i.test(r)) return null; // dis kaynak
    r = r.replace(/^https?:\/\/seviyorsevmiyor\.noseydewdrop\.com/i, '');
  }
  if (r.startsWith('//')) return null;
  r = r.split('#')[0].split('?')[0];
  if (!r || r === '/') return 'index.html';
  r = r.replace(/^\.\//, '').replace(/^\//, '');
  if (!r || r.endsWith('/')) r = `${r}index.html`;
  return normalize(r);
}

blok('kopuk link', () => {
  let kopuk = 0;
  let sayilan = 0;
  for (const [ad, html] of [['index.html', idx], ['zaman.html', zmn]]) {
    for (const ref of yerelHedefler(html)) {
      const yol = dosyaYolu(ref);
      if (!yol) continue;
      sayilan++;
      const tam = join(WEB, yol);
      if (!existsSync(tam)) { kopuk++; console.log(`     KOPUK ${ad} -> ${ref}  (web/${yol} yok)`); }
    }
  }
  console.log(`     olculen yerel referans: ${sayilan}`);
  ok('iki sayfada da yerel referanslar sayildi', sayilan >= 8, String(sayilan));
  ok('KOPUK LINK 0', kopuk === 0, `${kopuk} kopuk referans`);
});

// ---- 6. kopya kanunu ---------------------------------------------------------------------------------

baslik('6. eklenen kopya kanuna uyuyor mu');

blok('kopya', () => {
  const yeni = [girisMetni];
  const geriBag = baglar(zmn).filter((b) => /index\.html/.test(b.href));
  for (const b of geriBag) yeni.push(gorunen(b.ic));
  yeni.push(meta(zmn, 'og:title'), meta(zmn, 'og:description'));
  const birlesik = yeni.filter(Boolean).join('\n');
  ok('olculecek yeni kopya bulundu', birlesik.length > 0);
  ok('em dash yok', !birlesik.includes('—'),
    birlesik.split('\n').filter((l) => l.includes('—')).join(' | '));
  ok('"kanka" yok', !/kanka/i.test(birlesik));
  const soruIsaretsiz = birlesik.split('\n')
    .flatMap((l) => l.split(/(?<=[.?!])\s+/))
    .filter((c) => /\b(mi|mı|mu|mü|misin|mısın|musun|müsün|nasıl|neden|niye)\b/i.test(c) && !/\?/.test(c));
  ok('soru cumlesi olup "?" ile bitmeyen yok', soruIsaretsiz.length === 0, soruIsaretsiz.join(' | '));
  const buyuk = yeni.filter((m) => m && /^[A-ZĞÜŞİÖÇ]/.test(m));
  ok('cumleler kucuk harfle basliyor', buyuk.length === 0, buyuk.join(' | '));
});

// ---- 7. eski akisa dokunulmadi -------------------------------------------------------------------------

baslik('7. eski akis yerinde duruyor');

blok('eski akis', () => {
  for (const im of ['id="pasteBox"', 'id="goBtn"', 'id="shotInput"', 'id="waInput"', 'id="reveal"']) {
    ok(`index.html hala ${im} iceriyor`, idx.includes(im), 'kayip');
  }
  ok('index.html hala app.js i yukluyor', /js\/app\.js/.test(idx));
  ok('zaman.html hala zaman.js i yukluyor', /js\/zaman\.js/.test(zmn));
});

console.log('');
if (fails) { console.log(`KIRMIZI: ${fails} olcum dustu`); process.exit(1); }
console.log('YESIL: ana sayfadan zaman akisina gorunur ve aciklayici bir giris var, donus yolu var, sitemap ve og tam, kopuk link 0.');
process.exit(0);
