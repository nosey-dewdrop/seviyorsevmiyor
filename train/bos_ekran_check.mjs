#!/usr/bin/env node
// BOS EKRAN KAPISI — "butona bastim, ya cevap geldi ya da neden gelmedigini okudum."
//
// Run: node train/bos_ekran_check.mjs
//
// The defect this gate was written for was live. On zaman.html the cloud offer box renders and is
// clickable; pressing it swapped in `bulutBlok('yaziyor')`, then `bulutYaz` returned null because
// no Turnstile ticket can be minted (TURNSTILE_SITEKEY is the empty string), and the click handler
// did `yer.innerHTML = ''`. The visitor pressed a button and got a hole where the box had been.
// KOSU-v1 §0.7: the engine goes silent BY NAME, and every refusal carries a next step.
//
// The gate does not restate that in prose, it measures it:
//
//   1. the real web/js/zaman.js is imported and the real bulutuBagla is driven end to end against
//      the real zamanBulut.js / api.js, with only fetch and document stubbed. That run reproduces
//      the exact live cause (no ticket) and the assertion is that the box still reads as something.
//   2. every failure cause is pushed through the real bulutCagir + bulutSonucBlok and the rendered
//      block is measured as a reader sees it: tags stripped, entities decoded, whitespace
//      collapsed. Empty, whitespace-only, or the spinner text on its own is RED.
//   3. the causes are compared against each other, so one sentence reused for all of them fails.
//   4. a banned-phrase list kills the generic apology ("bir hata olustu" and its family).
//   5. the index.html side: the real ui.js spikerDene / spikerKapaliMetni, plus a static check
//      that app.js actually wires them.
//   6. the version bump: no `?v=72` may survive anywhere under web/.
//   7. MUTATION: the fix is taken back out of zaman.js in a temp copy of the tree, this gate is
//      re-run against it, and it has to go RED. A gate that never sees the bug it was written for
//      cannot tell a fix from a coincidence.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ALT = process.env.BOS_EKRAN_ALT === '1';   // running as the mutation's child

let fails = 0;
const ok = (ad, kosul, detay = '') => {
  if (kosul) console.log(`ok   ${ad}`);
  else { fails++; console.log(`***  ${ad}${detay ? `\n       ${detay}` : ''}`); }
};
const baslik = (s) => console.log(`\n=== ${s} ===`);
async function blok(ad, fn) {
  try { await fn(); } catch (e) { fails++; console.log(`***  ${ad} PATLADI\n       ${(e && e.stack) || e}`); }
}

// ---- what a reader actually sees ---------------------------------------------------------------

const SPINNER = 'bulut yazıyor';

function gorunen(html) {
  return String(html == null ? '' : html)
    .replace(/<script[^]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// The threshold the card sets: empty string, whitespace only, or nothing but the spinner is RED.
function bosMu(html) {
  const g = gorunen(html);
  if (!g) return 'bos';
  if (!g.replace(/\s/g, '')) return 'sadece bosluk';
  if (g === SPINNER || g === `${SPINNER}.`) return 'sadece spinner';
  if (g.length < 20) return `cok kisa (${g.length} karakter)`;
  return null;
}

// A generic apology is not a reason. These are the shapes that mean "something went wrong" and
// leave the reader exactly where they were.
// Matched on whole words: "olmadığı için istek hiç yola çıkmadı" is a reason, "olmadı" on its own
// is the apology. JS \b does not know Turkish letters, so the boundary is spelled out.
const HARF = 'a-zA-ZçğıöşüÇĞİÖŞÜ';
const YASAK = [
  'bir hata oluştu', 'bir hata olustu', 'bir şeyler ters gitti', 'bir şey ters gitti',
  'hata oluştu', 'beklenmeyen bir hata', 'olmadı', 'başarısız oldu', 'tekrar deneyin',
  'bir sorun oluştu', 'üzgünüm',
];
function yasakBul(metin) {
  const d = metin.toLocaleLowerCase('tr');
  return YASAK.filter((y) => new RegExp(`(^|[^${HARF}])${y}([^${HARF}]|$)`).test(d));
}

// ---- stubs: only the two things Node cannot be --------------------------------------------------

function sahteYer() {
  const dinleyiciler = [];
  return {
    id: 'bulutYer',
    innerHTML: '',
    gecmis: [],
    set: null,
    addEventListener(tur, fn) { if (tur === 'click') dinleyiciler.push(fn); },
    async tikla(hedefId) {
      for (const fn of dinleyiciler) await fn({ target: { id: hedefId } });
    },
    dinleyiciSayisi() { return dinleyiciler.length; },
  };
}

function domKur(yer) {
  globalThis.document = {
    getElementById: (id) => (id === 'bulutYer' ? yer : null),
  };
}
function domKaldir() { delete globalThis.document; }

// A verdict object shaped the way the worker hands one over. Only res.ok is read by bulutuBagla.
const RES = { ok: true, summary: {}, latency: {}, points: [], joint: null };

// ---- load the real modules ---------------------------------------------------------------------

const zaman = await import('../web/js/zaman.js?v=73');
const ui = await import('../web/js/ui.js?v=73');
const api = await import('../web/js/api.js?v=73');

baslik('0. gercek modul yuklendi mi');
ok('web/js/zaman.js Node da import edilebiliyor (kapi kopya degil, kaynagin kendisi)',
  typeof zaman.bulutuBagla === 'function' && typeof zaman.bulutCagir === 'function'
  && typeof zaman.bulutSonucBlok === 'function',
  Object.keys(zaman).join(', '));
ok('web/js/ui.js Node da import edilebiliyor',
  typeof ui.spikerDene === 'function' && typeof ui.spikerKapaliMetni === 'function',
  Object.keys(ui).join(', '));

// ---- 1. ucdan uca: canlidaki kusurun kendisi ----------------------------------------------------

baslik('1. canlidaki kusur: teklif kutusuna basildi, bilet alinamadi');

await blok('uctan uca', async () => {
  const yer = sahteYer();
  domKur(yer);
  const cagrilar = [];
  const asilFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    cagrilar.push(String(url));
    return { ok: true, status: 200, json: async () => ({ kalan: 5, gunluk: 120 }) };
  };
  // api.js prints a named console.error when the site key is missing; that line is the finding,
  // not noise, but it should not be mistaken for a gate failure in the output.
  const asilErr = console.error;
  const errler = [];
  console.error = (...a) => errler.push(a.join(' '));
  try {
    await zaman.bulutuBagla(RES);
    const teklif = yer.innerHTML;
    ok('sayac cevap verince teklif kutusu ciziliyor', /bulutBtn/.test(teklif), gorunen(teklif));
    ok('sayac gercekten soruldu (zamanBulut.js kosturuldu)',
      cagrilar.some((u) => /zaman-kalan/.test(u)), cagrilar.join(' | '));

    await yer.tikla('bulutBtn');
    const sonrasi = yer.innerHTML;
    const bos = bosMu(sonrasi);
    console.log(`     tiklama sonrasi ekranda kalan metin: "${gorunen(sonrasi).slice(0, 120)}"`);
    ok('TIKLAMADAN SONRA EKRAN BOSALMIYOR', bos === null, `kutu ${bos} kaldi`);
    ok('kalan metin spinner degil, bir sebep', gorunen(sonrasi) !== SPINNER, gorunen(sonrasi));
    ok('sebep bilet/anahtar oldugunu ADIYLA soyluyor',
      /anahtar/.test(gorunen(sonrasi)) && /kapalı/.test(gorunen(sonrasi)), gorunen(sonrasi));
    ok('api.js eksik sitekey i konsola da adiyla yaziyor (canlidaki gercek sebep bu)',
      errler.some((m) => /TURNSTILE_SITEKEY/.test(m)), errler.join(' | '));
    ok('bilet alinamadigi icin /api/zaman a hic gidilmedi',
      !cagrilar.some((u) => /\/api\/zaman$/.test(u)), cagrilar.join(' | '));
  } finally {
    console.error = asilErr;
    if (asilFetch) globalThis.fetch = asilFetch; else delete globalThis.fetch;
    domKaldir();
  }
});

// ---- 2. her sebep icin ayri, gorunur cumle -------------------------------------------------------

baslik('2. bulut uc ayri sebeple duserken ekranda ne kaliyor');

// Each entry drives the REAL bulutCagir. bulutYaz cannot be reached with a ticket from Node
// (api.js mints tickets from Turnstile), so the ticket call and the one call behind it are the
// only injected parts; the cause mapping and the rendering below them are the shipped code.
const SENARYO = [
  {
    ad: 'bulut yolu kapali (bilet alinamiyor / sitekey yok)',
    sebep: 'bilet_yok',
    deps: { yaz: async () => { throw new Error('bilet yokken bulutYaz cagrilmamaliydi'); } },
    bekle: /anahtar/,
  },
  {
    ad: 'gunluk sayac doldu',
    sebep: 'gunluk_doldu',
    deps: { bilet: async () => 'sahte-bilet', yaz: async () => ({ ok: false, sebep: 'gunluk_doldu', gunluk: 120 }) },
    bekle: /bugünlük bulut hakkı bitti/,
  },
  {
    ad: 'ag / worker hatasi',
    sebep: 'ag_hatasi',
    deps: { bilet: async () => 'sahte-bilet', yaz: async () => null },
    bekle: /yanıtsız/,
  },
  {
    ad: 'kisi kotasi',
    sebep: 'kisi_kotasi',
    deps: { bilet: async () => 'sahte-bilet', yaz: async () => ({ ok: false, sebep: 'kisi_kotasi', kalan: 0, gunluk: 120 }) },
    bekle: /senin bulut hakkın doldu/,
  },
  {
    ad: 'bulut yazdi ama cikti elendi',
    sebep: 'gecersiz_cikti',
    deps: { bilet: async () => 'sahte-bilet', yaz: async () => ({ ok: false, sebep: 'gecersiz_cikti', kalan: 3 }) },
    bekle: /elendi/,
  },
  {
    ad: 'hak sayacina ulasilamadi',
    sebep: 'sayac_yok',
    blok: () => zaman.bulutSonucBlok({ ok: false, sebep: 'sayac_yok' }),
    bekle: /sayac|sayaç/,
  },
];

const metinler = new Map();

await blok('sebep basina render', async () => {
  for (const s of SENARYO) {
    const html = s.blok
      ? s.blok()
      : zaman.bulutSonucBlok(await zaman.bulutCagir(RES, s.deps));
    const g = gorunen(html);
    metinler.set(s.sebep, g);
    console.log(`     [${s.sebep}] ${g.slice(0, 110)}`);
    const bos = bosMu(html);
    ok(`${s.ad}: ekranda gorunur metin kaliyor`, bos === null, `${bos} kaldi`);
    ok(`${s.ad}: sebebe ozgu cumle (genel degil)`, s.bekle.test(g), g);
    const yasak = yasakBul(g);
    ok(`${s.ad}: genel "hata olustu" cumlesi yok`, yasak.length === 0, yasak.join(', '));
  }
});

await blok('sebepler birbirinden farkli', async () => {
  const liste = [...metinler.entries()];
  ok('alti sebebin altisi da olculdu', liste.length === SENARYO.length, String(liste.length));
  const tekil = new Set(liste.map(([, g]) => g));
  ok('HER SEBEP FARKLI CUMLE veriyor', tekil.size === liste.length,
    `${tekil.size} ayri metin / ${liste.length} sebep`);
  // The three the card names have to be pairwise distinct even after normalisation.
  const uc = ['bilet_yok', 'gunluk_doldu', 'ag_hatasi'].map((k) => metinler.get(k));
  ok('kartin adiyla saydigi uc sebep ucu de birbirinden ayri',
    new Set(uc).size === 3 && uc.every(Boolean));
  ok('hicbir sebep digerinin metnini kapsamiyor (tek cumle iki isle kullanilmamis)',
    !liste.some(([a, ga]) => liste.some(([b, gb]) => a !== b && ga.includes(gb))));
});

await blok('bulutCagir sebebi gercekten ayirt ediyor', async () => {
  const a = await zaman.bulutCagir(RES, { bilet: async () => null, yaz: async () => ({ ok: true }) });
  ok('bilet yoksa bulutYaz hic cagrilmiyor ve sebep bilet_yok', a.ok === false && a.sebep === 'bilet_yok',
    JSON.stringify(a));
  const b = await zaman.bulutCagir(RES, { bilet: async () => 't', yaz: async () => null });
  ok('bilet varken null donen cagri ag_hatasi', b.ok === false && b.sebep === 'ag_hatasi', JSON.stringify(b));
  const c = await zaman.bulutCagir(RES, { bilet: async () => 't', yaz: async () => ({ ok: true, satirlar: ['x'], kalan: 2, gunluk: 120 }) });
  ok('basarili cagri hala basarili', c.ok === true, JSON.stringify(c));
  ok('basarili cagrida da ekran dolu', bosMu(zaman.bulutSonucBlok(c)) === null);
});

// ---- 3. index.html tarafi: canli spiker kutusu ---------------------------------------------------

baslik('3. index.html: canli spiker isaretlendi, bulut kapali');

await blok('spikerDene', async () => {
  const a = await ui.spikerDene({}, { bilet: async () => null, oku: async () => { throw new Error('cagrilmamaliydi'); } });
  ok('bilet yoksa sebep bilet_yok ve spikerRead cagrilmiyor', a.sp === null && a.sebep === 'bilet_yok',
    JSON.stringify(a));
  const b = await ui.spikerDene({}, { bilet: async () => 't', oku: async () => null });
  ok('bilet varken cevap gelmezse sebep ag_hatasi', b.sp === null && b.sebep === 'ag_hatasi', JSON.stringify(b));
  const c = await ui.spikerDene({}, { bilet: async () => 't', oku: async () => ({ ton_line: 'x' }) });
  ok('bulut cevap verirse sebep yok', c.sebep === null && !!c.sp, JSON.stringify(c));

  const m = ui.SPIKER_SEBEPLER.map((s) => ui.spikerKapaliMetni(s));
  for (const [i, s] of ui.SPIKER_SEBEPLER.entries()) {
    console.log(`     [${s}] ${m[i].slice(0, 110)}`);
    ok(`${s}: metin bos degil`, bosMu(`<p>${m[i]}</p>`) === null);
    ok(`${s}: cihazda yazildigini ADIYLA soyluyor`, /cihaz/.test(m[i]) && /şablon/.test(m[i]), m[i]);
    ok(`${s}: genel "hata olustu" cumlesi yok`, yasakBul(m[i]).length === 0, yasakBul(m[i]).join(', '));
  }
  ok('iki sebep iki ayri cumle', new Set(m).size === m.length);
  ok('bilinmeyen sebep de sessiz kalmiyor', bosMu(`<p>${ui.spikerKapaliMetni('zzz')}</p>`) === null);
});

await blok('app.js gercekten bagli', async () => {
  const app = readFileSync(join(REPO, 'web/js/app.js'), 'utf8');
  const uiSrc = readFileSync(join(REPO, 'web/js/ui.js'), 'utf8');
  ok('app.js spikerDene i kullaniyor', /spikerDene\(spikerFacts\(r\)\)/.test(app), 'cagri yok');
  ok('app.js sessiz dusmuyor: sebebi rapora yaziyor', /r\.spikerKapali = sebep/.test(app), 'atama yok');
  ok('app.js artik ciplak spikerRead cagirmiyor', !/\bspikerRead\(/.test(app), 'hala cagiriyor');
  ok('ui.js sebebi ekrana basiyor', /spikerKapaliMetni\(r\.spikerKapali\)/.test(uiSrc), 'render yok');
});

// ---- 4. kopya kanunu ----------------------------------------------------------------------------

baslik('4. kopya kanunu');

await blok('kopya', async () => {
  const hepsi = [...metinler.values(), ...ui.SPIKER_SEBEPLER.map((s) => ui.spikerKapaliMetni(s))];
  const birlesik = hepsi.join('\n');
  ok('em dash yok', !birlesik.includes('—'), birlesik.split('\n').filter((l) => l.includes('—')).join(' | '));
  ok('"kanka" yok', !/kanka/i.test(birlesik));
  const soruIsaretsiz = birlesik.split('\n')
    .flatMap((l) => l.split(/(?<=[.?!])\s+/))
    .filter((c) => /\b(mi|mı|mu|mü|misin|mısın|musun|müsün|nasıl|neden|niye)\b/i.test(c) && !/\?/.test(c));
  ok('soru cumlesi olup "?" ile bitmeyen yok', soruIsaretsiz.length === 0, soruIsaretsiz.join(' | '));
  const buyuk = hepsi.filter((m) => /^[A-ZĞÜŞİÖÇ]/.test(gorunen(m)));
  ok('cumleler kucuk harfle basliyor', buyuk.length === 0, buyuk.join(' | '));
});

// ---- 5. surum bumpi ------------------------------------------------------------------------------

baslik('5. surum bumpi');

// git grep exits 1 with no output when nothing matched, which is the green case here.
await blok('bump olcumu', async () => {
  let cikti = '';
  let kod = 0;
  try {
    cikti = execFileSync('git', ['grep', '-n', '-F', '?v=72', '--', 'web/'],
      { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) { kod = e.status; cikti = String(e.stdout || ''); }
  ok('web/ altinda hicbir ?v=72 kalmadi', kod === 1 && !cikti.trim(), cikti.trim());

  let v73 = '';
  try {
    v73 = execFileSync('git', ['grep', '-c', '-F', '?v=73', '--', 'web/'],
      { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) { v73 = String(e.stdout || ''); }
  const toplam = v73.split('\n').filter(Boolean)
    .reduce((a, l) => a + Number(l.split(':').pop() || 0), 0);
  console.log(`     ?v=73 gecen satir sayisi: ${toplam}`);
  ok('yerine ?v=73 kondu', toplam >= 30, String(toplam));

  const idx = readFileSync(join(REPO, 'web/index.html'), 'utf8');
  const imza = (idx.match(/class="imza"[^]*?<\/span>\s*$/m) || [])[0] || idx.match(/· v\d+ ·/)?.[0] || '';
  ok('index.html altbilgi surum etiketi v73', /· v73 ·/.test(idx), imza);
  ok('altbilgide eski v71/v72 etiketi kalmadi', !/· v7[12] ·/.test(idx));
});

// ---- 6. MUTASYON: duzeltmeyi sok, kapinin kirmizi yandigini gor ----------------------------------
//
// The whole fix funnels through one line in zaman.js: `const govde = SEBEP_BLOK[sebep] || ...`.
// Replacing it with the empty string restores exactly the old behaviour (a cleared box) for every
// new cause at once, including the live one. This gate must then fail.

if (!ALT) {
  baslik('6. mutasyon: duzeltme sokulunce kapi kirmizi mi');

  const YOL = join(REPO, 'web/js/zaman.js');
  const CAPA = '  const govde = SEBEP_BLOK[sebep] || SEBEP_BLOK.ag_hatasi;';
  const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

  await blok('mutasyon', async () => {
    const asil = readFileSync(YOL);
    const asilSha = sha(YOL);
    const src = asil.toString('utf8');
    if (!src.includes(CAPA)) throw new Error('mutasyon capasi bulunamadi');
    let cocuk = { kod: 0, out: '' };
    try {
      writeFileSync(YOL, src.replace(CAPA, "  const govde = '';"), 'utf8');
      try {
        cocuk.out = execFileSync('node', ['train/bos_ekran_check.mjs'], {
          cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26,
          env: { ...process.env, BOS_EKRAN_ALT: '1' },
          stdio: ['ignore', 'pipe', 'pipe'],
        });
      } catch (e) { cocuk = { kod: e.status, out: String(e.stdout || '') + String(e.stderr || '') }; }
    } finally {
      writeFileSync(YOL, asil);
      if (sha(YOL) !== asilSha) throw new Error('GERI KONULAMADI: web/js/zaman.js');
    }
    ok('MUTASYON: bos kutu geri gelince kapi KIRMIZI', cocuk.kod === 1, `exit ${cocuk.kod}`);
    ok('kirmizi yanan sey tam da "ekran bosalmiyor" olcumu',
      /\*\*\* {2}TIKLAMADAN SONRA EKRAN BOSALMIYOR/.test(cocuk.out),
      cocuk.out.split('\n').filter((l) => l.startsWith('***')).slice(0, 3).join(' | '));
    ok('sebep basina olcumler de dusuyor',
      (cocuk.out.match(/ekranda gorunur metin kaliyor/g) || []).some(() => true)
      && /\*\*\* .*bulut yolu kapali.*ekranda gorunur metin kaliyor/.test(cocuk.out),
      cocuk.out.split('\n').filter((l) => l.startsWith('***')).slice(0, 6).join(' | '));
    ok('MUTASYON sonrasi zaman.js bit-ayni geri kondu', sha(YOL) === asilSha);
  });
}

console.log('');
if (fails) { console.log(`KIRMIZI: ${fails} olcum dustu`); process.exit(1); }
console.log('YESIL: bulut alti ayri sebeple dustu, altisinda da ekranda ayri ve okunur bir cumle kaldi.');
process.exit(0);
