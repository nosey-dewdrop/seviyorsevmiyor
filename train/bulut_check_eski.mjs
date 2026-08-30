// What leaves the device on the OLD flow (index.html: paste a chat -> flört hükmü), and whether the
// page says the same thing the code does. Run: node train/bulut_check_eski.mjs
//
// THIS FILE USED TO MEASURE THE OPPOSITE THING. It was written when /api/spiker carried fifteen
// counts and the site said "mesajların cihazından çıkmaz" on four surfaces. That design is gone
// (30 Ağu, product owner's call): the chat is sent, because a model handed fifteen numbers can only
// write templates and the counter behind those numbers was inventing verdicts.
//
// So the question changed. It is no longer "did any text get out". It is:
//
//   - is the thing that DOES leave exactly the thing the visitor agreed to send, and nothing more?
//   - do the routes that still promise numbers only still keep that promise?
//   - does every published page say what actually happens, without a hedge word?
//
// The consent gate itself and the model's output filter are measured next door in
// train/llm_yol_check.mjs, with mutations. This file is the payload-shape and copy half.
//
// Nothing is reimplemented here. The real client module builds the payloads and the real worker
// module handles the requests; the only fakes are the outside world (KV, Turnstile, Groq), because
// a gate that mimics the code stays green while the code rots.

import { readFileSync, readdirSync } from 'node:fs';
import worker from '../backend/worker.js';
import { itirazOlgu } from '../web/js/api.js';
import { kacamakBul } from './tr_kucult.mjs';

let fails = 0;
const ok = (n, c, d = '') => {
  if (c) console.log(`ok  ${n}`);
  else { fails++; console.log(`*** ${n}${d ? '\n    ' + d : ''}`); }
};
async function blok(ad, fn) {
  try { await fn(); } catch (e) { fails++; console.log(`*** ${ad} PATLADI\n    ${(e && e.stack) || e}`); }
}

const KOK = new URL('..', import.meta.url);
const oku = (p) => readFileSync(new URL(p, KOK), 'utf8');

// ---- the fixture conversation ----------------------------------------------------------------
//
// Deliberately full of rare tokens. If any of them turns up in a KV value or in a payload that is
// supposed to be numeric, it could only have come from the chat.

const DOC = [
  'SEN: bugun musaitsin degil mi',
  'O: bakariz',
  'SEN: seni ozledim gercekten',
  'O: hmm',
  'SEN: kerem cevap versene',
  'O: yogunum simdi',
].join('\n');

const SOHBET_KELIMELERI = ['musaitsin', 'bakariz', 'ozledim', 'gercekten', 'kerem', 'yogunum', 'versene'];

// ---- the measurement -------------------------------------------------------------------------
//
// A text field is a string that could carry a message: it has whitespace in it, or it is longer
// than the enum-key cap. "flort_yok" is not a text field. "seni ozledim" is.

function metinAlanlari(deger, yol = '') {
  const bulunan = [];
  const gez = (v, y) => {
    if (typeof v === 'string') {
      if (/\s/.test(v) || v.length > 40) bulunan.push(`${y} = ${JSON.stringify(v)}`);
    } else if (Array.isArray(v)) {
      v.forEach((x, i) => gez(x, `${y}[${i}]`));
    } else if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) gez(x, y ? `${y}.${k}` : k);
    }
  };
  gez(deger, yol);
  return bulunan;
}

function sohbetIzi(metin) {
  const d = String(metin).toLowerCase();
  return SOHBET_KELIMELERI.filter((k) => d.includes(k));
}

// ---- 1. the donation payload: still numbers, and only numbers ---------------------------------
//
// /api/spiker reads a chat and forgets it. /api/itiraz writes a row into KV that lives for months,
// so it is a different promise and it did not change: what is donated is the twelve features the
// model actually trains on.

await blok('istemci itiraz yuku', async () => {
  const olgu = itirazOlgu(DOC);
  const json = JSON.stringify(olgu);
  console.log('cihazdan cikan tam yuk (itiraz bagisi):');
  console.log('  ' + json);
  console.log(`  boyut: ${json.length} bayt\n`);

  ok('itiraz yukunde metin alani = 0', metinAlanlari(olgu).length === 0, metinAlanlari(olgu).join(', '));
  ok('itiraz yukunde sohbetten tek kelime yok', sohbetIzi(json).length === 0, sohbetIzi(json).join(', '));
  ok('itiraz yukunun her alani sayi',
    Object.values(olgu).every((v) => typeof v === 'number' && Number.isFinite(v)), json);
  ok('itiraz yuku modelin egittigi 12 ozellik', Object.keys(olgu).length === 12, String(Object.keys(olgu).length));
  ok('ozellikler gercekten olculdu (hepsi sifir degil)',
    Object.values(olgu).some((v) => v > 0), json);
});

// ---- 2. the client source: which body carries what --------------------------------------------
//
// Read as source rather than driven, and labelled as such: the point is which FIELD NAMES each
// request body is built from. The spiker body is supposed to carry the chat now, and exactly two
// fields; the donation body is supposed to carry no chat at all. Both directions are asked, so a
// gate that simply says "no doc anywhere" cannot pass by being blind.

await blok('istemci kaynak kontrolu', async () => {
  const src = oku('web/js/api.js');
  const govdeler = [...src.matchAll(/body:\s*JSON\.stringify\(([^]*?)\)\s*,\n/g)].map((m) => m[1]);
  ok('api.js en az uc istek govdesi kuruyor', govdeler.length >= 3, String(govdeler.length));

  const spikerGovde = govdeler.find((g) => /sohbet/.test(g));
  ok('spiker govdesi sohbeti tasiyor (yeni gercek)', !!spikerGovde, govdeler.join(' | '));
  ok('spiker govdesi sadece sohbet ve onay tasiyor',
    !!spikerGovde && /sohbet:/.test(spikerGovde) && /onay:\s*true/.test(spikerGovde)
    && !/olgu|facts|isim|ad:/.test(spikerGovde), String(spikerGovde));

  // The donation body is the one that must still be free of the chat. `itirazOlgu(doc)` is the
  // opposite of a finding: it is the chat being consumed on the device instead of being posted.
  const itirazGovde = govdeler.find((g) => /itirazOlgu/.test(g));
  ok('itiraz govdesi bulundu', !!itirazGovde, govdeler.join(' | '));
  ok('itiraz govdesinde doc alani yok',
    !!itirazGovde && !/(^|[,{\s])doc\s*[,:}]/.test(itirazGovde) && !/sohbet/.test(itirazGovde),
    String(itirazGovde));

  ok('spikerRead artik sohbet + onay aliyor',
    /export async function spikerRead\(istek\)/.test(src), 'imza degismemis');
  ok('riza kapisi api.js te tek satir ve yerinde',
    /if \(!onay\) return null;/.test(src), 'RIZA KAPISI satiri yok');
});

// ---- 3. the server half: drive the real worker ------------------------------------------------

const OWN = 'https://nosey-dewdrop.github.io';

function makeKV() {
  const store = new Map();
  const writes = [];
  return {
    writes,
    async get(k) { return store.has(k) ? store.get(k) : null; },
    async put(k, v, opts) { writes.push({ key: k, deger: v, opts: opts || null }); store.set(k, v); },
  };
}
function makeEnv() {
  return {
    RATE_LIMIT: makeKV(),
    CORPUS: makeKV(),
    ALLOWED_ORIGINS: OWN,
    SPIKER_OPEN: 'on',
    ITIRAZ_OPEN: 'on',
    GROQ_API_KEY: 'test-groq',
    TURNSTILE_SECRET: 'test-turnstile',
    BILET_SECRET: 'test-bilet-secret-0123456789',
  };
}

// Everything the worker sends out is recorded, so "no message reached Groq on the numeric routes"
// is a measurement of the actual outbound request rather than a reading of the source.
const disCagrilar = [];
const ZAMAN_METIN = 'cevaplar kisalmis.\nbekleme suresi uzamis.\nbaslatan taraf degismis.';
globalThis.fetch = async (url, init) => {
  const u = String(url);
  disCagrilar.push({ u, govde: String(init?.body || '') });
  if (u.includes('siteverify')) {
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }
  if (u.includes('api.groq.com')) {
    return new Response(JSON.stringify({ choices: [{ message: { content: ZAMAN_METIN } }] }), { status: 200 });
  }
  throw new Error(`beklenmeyen dis cagri: ${u}`);
};
const groqCagrilari = () => disCagrilar.filter((c) => c.u.includes('api.groq.com'));

function req(path, { body = {}, token = null, ip = '203.0.113.9' } = {}) {
  const headers = { 'content-type': 'application/json', 'cf-connecting-ip': ip, origin: OWN };
  if (token) headers['x-app-token'] = token;
  return new Request(`https://seviyorsevmiyor-api.workers.dev${path}`, {
    method: 'POST', headers, body: JSON.stringify(body),
  });
}
const call = (path, env, opts) => worker.fetch(req(path, opts), env);
async function biletAl(env) {
  const res = await call('/api/bilet', env, { body: { turnstile: 'dummy' } });
  return (await res.json()).bilet;
}

// ---- 3b. the enum slots: the server checks the VALUE, not the length ---------------------------
//
// A string field used to only have to look like a key: up to forty characters, no whitespace.
// Twenty-four such slots is roughly 960 bytes per request that nothing on the server ever read, and
// the routes carried it into the Groq prompt and into a KV row with a 180-day life. The real client
// only ever put engine enums there, which is exactly why nobody noticed.
//
// The token below is not a message, on purpose. The point is not "is this prose?" but "did the
// server accept a value it has no list for?". Each route is measured on its own and paired with the
// legitimate value, so a gate that simply drops everything fails.

const KACAK = 'zurnabalik_kanarya_7719';

await blok('enum yuvasi 1/2: degisenler, virgullu liste (zaman -> groq)', async () => {
  const env = makeEnv();
  const bilet = await biletAl(env);
  const n = groqCagrilari().length;
  await call('/api/zaman', env, {
    token: bilet, body: { olgu: { degisenler: 'zurnabalik,kanarya,7719', gun: 30, mesaj: 400 } },
  });
  ok('groq yine de arandi (sadece o alan dustu)', groqCagrilari().length === n + 1);
  const cagri = groqCagrilari().at(-1);
  ok('kacak liste groq a ulasmadi', !cagri.govde.includes('zurnabalik') && !cagri.govde.includes('kanarya'),
    cagri.govde.slice(0, 400));
  ok('parcali kacak da gecmedi', !cagri.govde.includes('7719'), cagri.govde.slice(0, 400));
});

await blok('enum yuvasi 1/2 karsiti: gercek kavram listesi geciyor', async () => {
  const env = makeEnv();
  const bilet = await biletAl(env);
  await call('/api/zaman', env, {
    token: bilet, body: { olgu: { degisenler: 'gecikme,sessizlik', gun: 30 } },
  });
  const cagri = groqCagrilari().at(-1);
  ok('motorun kendi kavramlari gecti', cagri.govde.includes('gecikme,sessizlik'), cagri.govde.slice(0, 400));
  // one bad part poisons the whole field: a list is accepted or refused, never half-kept
  const env2 = makeEnv();
  const bilet2 = await biletAl(env2);
  await call('/api/zaman', env2, {
    token: bilet2, body: { olgu: { degisenler: `gecikme,${KACAK}`, gun: 30 } },
  });
  const c2 = groqCagrilari().at(-1);
  ok('tek kotu parca butun alani dusuruyor',
    !c2.govde.includes(KACAK) && !c2.govde.includes('degisenler'), c2.govde.slice(0, 400));
});

await blok('enum yuvasi 2/2: hukum, KV yolu (itiraz -> 180 gunluk satir)', async () => {
  const env = makeEnv();
  const bilet = await biletAl(env);
  const res = await call('/api/itiraz', env, {
    token: bilet,
    body: { olgu: itirazOlgu(DOC), hukum: KACAK, karar: KACAK, onay: true },
  });
  ok('itiraz 200', res.status === 200, `status ${res.status}`);
  const hepsi = JSON.stringify(env.CORPUS.writes) + JSON.stringify(env.RATE_LIMIT.writes);
  ok('kacak deger KV ye yazilmadi', !hepsi.includes(KACAK), hepsi.slice(0, 400));
  const kayit = JSON.parse(env.CORPUS.writes.find((w) => w.key.startsWith('corpus:')).deger);
  ok('hukum alani null olarak kaldi', kayit.hukum === null && kayit.karar === null, JSON.stringify(kayit));
});

await blok('sunucu: itiraz bagisi KV ye ne yaziyor', async () => {
  const env = makeEnv();
  const bilet = await biletAl(env);
  // Worst case on purpose: a stale client that still sends the raw chat alongside the numbers.
  const res = await call('/api/itiraz', env, {
    token: bilet,
    body: { doc: DOC, olgu: itirazOlgu(DOC), hukum: 'tense', karar: 'yok', onay: true },
  });
  ok('itiraz 200', res.status === 200, `status ${res.status}`);

  const yazimlar = env.CORPUS.writes.filter((w) => w.key.startsWith('corpus:'));
  ok('corpus satiri yazildi', yazimlar.length === 1, `${yazimlar.length} yazim`);
  const hepsi = JSON.stringify(env.CORPUS.writes) + JSON.stringify(env.RATE_LIMIT.writes);
  ok('KV de sohbetten tek kelime yok', sohbetIzi(hepsi).length === 0, sohbetIzi(hepsi).join(', '));

  const kayit = JSON.parse(yazimlar[0].deger);
  ok('kayitta doc alani hic yok', !('doc' in kayit), Object.keys(kayit).join(', '));
  ok('kayitta metin alani = 0', metinAlanlari(kayit).length === 0, metinAlanlari(kayit).join(', '));
  ok('kayit 12 sayilik ozellik vektoru tasiyor',
    kayit.olgu && Object.keys(kayit.olgu).length === 12
    && Object.values(kayit.olgu).every((v) => typeof v === 'number'), JSON.stringify(kayit.olgu));
  ok('kayitta itiraz edilen hukum var', kayit.hukum === 'tense' && kayit.karar === 'yok', JSON.stringify(kayit));
  ok('kayit saklama suresiyle yazildi', yazimlar[0].opts?.expirationTtl > 0
    && yazimlar[0].opts.expirationTtl <= 60 * 60 * 24 * 366, JSON.stringify(yazimlar[0].opts));
});

// The spiker sends the chat now, and that is the point. What it must NOT do is leave a trace: a
// route that forwards a conversation and also writes it somewhere is a route that stores it.
await blok('sunucu: spiker sohbeti hicbir yere yazmiyor', async () => {
  const env = makeEnv();
  const bilet = await biletAl(env);
  disCagrilar.push({ u: 'sinir', govde: '' });
  const res = await call('/api/spiker', env, { token: bilet, body: { sohbet: DOC, onay: true } });
  // The fake Groq above returns the time flow's plain-text answer, which is not valid JSON for this
  // route, so a 502 is expected here. The output filter is measured in train/llm_yol_check.mjs; the
  // question in THIS block is what was written while the request was being served.
  ok('spiker istegi islendi (200 ya da 502, cokme degil)',
    res.status === 200 || res.status === 502, `status ${res.status}`);
  const yazilanlar = JSON.stringify(env.CORPUS.writes) + JSON.stringify(env.RATE_LIMIT.writes);
  ok('spiker cagrisindan sonra KV de sohbetten tek kelime yok',
    sohbetIzi(yazilanlar).length === 0, sohbetIzi(yazilanlar).join(', '));
  ok('corpus namespace ine hicbir sey yazilmadi', env.CORPUS.writes.length === 0,
    env.CORPUS.writes.map((w) => w.key).join(', '));
});

// ---- 4. the page and the code have to say the same thing --------------------------------------

await blok('gizlilik iddiasi kodla ayni seyi soyluyor', async () => {
  const g = oku('web/gizlilik.html');
  const w = oku('backend/worker.js');
  const t = oku('backend/wrangler.toml');

  // The weasel scan used to read gizlilik.html only, so a hedged copy of the same claim sat in
  // index.html's schema.org featureList while the gate stayed green. The claim is made on every
  // surface, so every surface is read: visible text plus meta / ld+json fields.
  const KACAMAK = [
    'genellikle', 'çoğunlukla', 'genelde', 'gerekmedikçe', 'kural olarak', 'prensip olarak',
    'varsayılan olarak', 'normalde', 'nadiren', 'çoğu zaman', 'çoğu durumda',
    'mümkün olduğunca', 'gerektiğinde',
  ];
  // kosullar.html and panel.html are out of this phase's reach: a hit there is reported as
  // inherited debt and must not turn the gate red, because fixing it is not this phase's work.
  const DEVREDILEN = new Set(['kosullar.html', 'panel.html']);

  const okunacakMetin = (src) => src
    .replace(/<!--[^]*?-->/g, ' ')
    .replace(/<script(?![^>]*application\/ld\+json)[^>]*>[^]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[^]*?<\/style>/gi, ' ')
    // keep the fields a reader still sees even though they live in attributes
    .replace(/<[^>]+>/g, (etiket) => {
      const alan = etiket.match(/(?:content|alt|title|placeholder|aria-label)="[^"]*"/gi) || [];
      return ` ${alan.join(' ')} `;
    });
  // NOT .toLowerCase(): "GENELLİKLE".toLowerCase() is "genelli̇kle" (i + U+0307), so a hedge word
  // set in capitals — a heading, a button, a schema.org label — walked through this scan while the
  // gate stayed green. kacamakBul() folds İ->i and I->ı first. See train/tr_kucult.mjs.

  const sayfalar = readdirSync(new URL('web/', KOK)).filter((f) => f.endsWith('.html')).sort();
  ok('kapi web altindaki tum sayfalari tariyor', sayfalar.length >= 5, sayfalar.join(', '));
  // The gate's own blind spot, measured rather than asserted: the same word in capitals has to be
  // found by the scanner this file actually uses, and has to be MISSED by the plain call it used
  // to use. If both find it, this normalisation is not doing anything and should not be trusted.
  const ORNEK = 'Sohbetin metni GENELLİKLE buluta gider.';
  ok('turkce buyuk harf: GENELLİKLE yakalaniyor', kacamakBul(ORNEK, KACAMAK).includes('genellikle'),
    JSON.stringify(kacamakBul(ORNEK, KACAMAK)));
  ok('duz toLowerCase() bunu KACIRIYOR (yani duzeltme gercekten gerekli)',
    !ORNEK.toLowerCase().includes('genellikle'), JSON.stringify(ORNEK.toLowerCase()));
  for (const sayfa of sayfalar) {
    const metin = okunacakMetin(oku(`web/${sayfa}`));
    const bulunan = kacamakBul(metin, KACAMAK);
    if (DEVREDILEN.has(sayfa)) {
      if (bulunan.length) console.log(`??  ${sayfa} kacamak kelime tasiyor (devredilen, kapi kirmizi yanmaz)\n    ${bulunan.join(', ')}`);
      else console.log(`ok  ${sayfa} kacamak kelime yok (devredilen dosya, yine de temiz)`);
      continue;
    }
    ok(`${sayfa} icinde kacamak kelime yok`, bulunan.length === 0, bulunan.join(', '));
  }

  // The claim itself. It is the OPPOSITE of the one this file used to enforce, and it has to be
  // made without a hedge and without a euphemism: the visitor is told the text is sent, told who
  // reads it, and told how long it is kept.
  ok('gizlilik metni artik "cihazindan cikmaz" demiyor',
    !g.includes('Mesajlarının metni cihazından çıkmaz.'), 'eski iddia duruyor');
  ok('gizlilik metni gonderimi kosulsuz kuruyor',
    g.includes('o sohbetin metni buluta gönderilir'), 'acik cumle yok');
  ok('gizlilik metni onay yoksa gitmedigini de soyluyor',
    /Onay vermezsen tek karakter gitmez/.test(g), 'onay cumlesi yok');
  ok('gizlilik metni saklama suresini sayiyla veriyor',
    /sıfır gün/.test(g) && /180 gün/.test(g) && /400 gün/.test(g), 'sure yok');
  ok('gizlilik metni saglayiciyi adiyla soyluyor', /Groq/.test(g) && /Llama/.test(g), 'saglayici yok');
  ok('gizlilik metni artik olmayan bir e-postaya atif yapmiyor',
    !/yukarıdaki e-posta|e-posta atman/i.test(g));
  ok('KVKK basvuru kanali sayfada var',
    g.includes('https://github.com/nosey-dewdrop/seviyorsevmiyor/issues'));

  // Each claim now has to be true of the code sitting next to it.
  ok('worker sohbeti KV ye yazmiyor', !/put\([^)]*sohbet/.test(w), 'worker.js');
  ok('worker itiraz govdesinden doc okumuyor', !/body\.doc|b\.doc\b/.test(w.replace(/^\s*\/\/.*$/gm, '')),
    'worker.js');
  ok('wrangler artik metnin geldigini ve saklanmadigini dogru gerekceyle soyluyor',
    t.includes('Message text DOES reach this worker now')
    && t.includes('It is never written here')
    && !t.includes('No message text reaches this worker at all'),
    'wrangler.toml');
});

// The privacy claim is not only on the privacy page. The most-read copy of it is the consent
// checkbox, and it is read at the exact moment the visitor agrees to something — so a stale
// sentence there is worse than a stale sentence anywhere else. It used to say only counts are sent
// while the code was about to start sending the whole conversation.
await blok('onay aninda soylenen cumle de kodla ayni', async () => {
  const h = oku('web/index.html');
  const u = oku('web/js/ui.js');

  const kutu = h.match(/id="cloudConsentBox"[^]*?<\/label>/);
  ok('bulut onay kutusu bulundu', !!kutu);
  const metin = kutu ? kutu[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
  ok('onay kutusu artik "yalnizca sayimlar gider" demiyor',
    !/yalnızca sayımlar/.test(metin) && !/mesajların gitmez/.test(metin), metin);
  ok('onay kutusu metnin gittigini ACIKCA soyluyor',
    /sohbetin metni buluta gider/.test(metin), metin);
  ok('onay kutusu isaretlenmezse gitmedigini de soyluyor',
    /işaretlemezsen tek karakter gitmez/.test(metin), metin);
  ok('onay kutusu saklanmadigini soyluyor', /saklanmaz/.test(metin), metin);

  // the page's own unconditional claims (description, og, twitter, schema) had to be rewritten too:
  // the checkbox was changed BECAUSE it disagreed with them, so leaving the four in place would
  // satisfy "the page is consistent" the wrong way round.
  ok('sayfada eski iddia hicbir yuzeyde kalmadi',
    !/mesajların cihazından çıkmaz/.test(h), 'eski iddia duruyor');
  const yeniIddia = (h.match(/sohbetin metni buluta gider/g) || []).length;
  ok('sayfa en az dort yerde metnin gittigini soyluyor', yeniIddia >= 4, String(yeniIddia));

  // the donation success line describes the donation, which really is numbers only
  ok('bagis basari metni artik isim silmeyi onermiyor', !u.includes('isim geçiyorsa'), 'ui.js');
  ok('bagis basari metni ne gittigini soyluyor', u.includes('giden şey sohbetin değil'), 'ui.js');
  // the card is what gets screenshotted, so its footer cannot say "mesajlar hiçbir yere gitmedi"
  // on a reading the cloud wrote
  ok('kart dipnotu bulutlu okumada dogru cumleyi yaziyor',
    u.includes('yorumu onayınla bulut okudu'), 'ui.js kart dipnotu eski');

  // copy law: no em dash, questions end in "?"
  const yeni = [metin, ...u.split('\n').filter((l) => l.includes('giden şey sohbetin değil'))].join(' ');
  ok('yeni kopyada em dash yok', !yeni.includes('—'), yeni);
});

// The client filters enum values and the server filters them again. Two lists mean two places to
// forget, so they are compared instead of trusted: an engine that grows a sixth verdict has to
// grow it in both files or this fails.
await blok('istemci ve sunucu ayni kapali listeyi kullaniyor', async () => {
  const a = listeCikar(oku('web/js/api.js'), 'ENUM_DEGERLER');
  const w = listeCikar(oku('backend/worker.js'), 'ENUM_DEGERLER');
  ok('iki dosyada da ENUM_DEGERLER var', !!a && !!w, `api=${!!a} worker=${!!w}`);
  ok('iki liste birebir ayni', JSON.stringify(a) === JSON.stringify(w),
    `\n    api:    ${JSON.stringify(a)}\n    worker: ${JSON.stringify(w)}`);
});

// ---- 5. the lists have to be the ENGINE's vocabulary, not a hand-copied snapshot ---------------
//
// Comparing api.js against worker.js only proves the two copies agree. Both were typed by hand
// from web/js/reveal.js, so if reveal.js grows a sixth tone tomorrow, both copies go stale
// TOGETHER, the comparison above stays green, and the new tone is silently dropped on the wire —
// the reading loses a field and nothing anywhere says so.
//
// So the reference is the engine itself. reveal.js is read (never written) and its real
// vocabulary is derived from it: the TONE_TR keys, and the flört verdict literals. The signal
// concepts come the same way, from the series keys in web/js/time/signals.js. A value that exists
// in the engine and is missing from a shipped list is RED.
function listeCikar(src, ad) {
  const m = src.match(new RegExp(`const ${ad} = \\{[^]*?\\n\\};`));
  if (!m) return null;
  const out = {};
  for (const g of m[0].matchAll(/([a-z_]+):\s*\[([^\]]*)\]/g)) {
    out[g[1]] = [...g[2].matchAll(/'([^']*)'/g)].map((x) => x[1]);
  }
  return out;
}

function motorSozlugu() {
  const reveal = oku('web/js/reveal.js');

  // tone vocabulary = the keys of TONE_TR, the table the reveal screen labels a verdict with
  const tone = reveal.match(/const TONE_TR = \{([^]*?)\n\};/);
  const hukum = tone ? [...tone[1].matchAll(/^\s*([a-z_]+):/gm)].map((x) => x[1]) : [];

  // flört verdict = the string literals buildReveal() can ASSIGN to `karar`. The same expression
  // also compares against tone keys ('onesided', 'flirty'), so those are subtracted rather than
  // pattern-matched around: a verdict value is a literal in that statement that is not a tone key.
  const kararIfade = reveal.match(/const karar = [^;]+;/);
  const karar = kararIfade
    ? [...new Set([...kararIfade[0].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]))].filter((v) => !hukum.includes(v))
    : [];

  // signal concepts = the series keys, with the _${side} suffix stripped
  const signals = oku('web/js/time/signals.js');
  const kavram = [...new Set([...signals.matchAll(/key:\s*[`']([a-z]+)(?:_\$\{side\})?[`']/g)].map((x) => x[1]))];

  return { hukum, karar, kavram };
}

await blok('kapali listeler motorun sozlugunden dogrulaniyor', async () => {
  const sozluk = motorSozlugu();
  console.log(`\nmotorun sozlugu (reveal.js + signals.js'ten okundu):`);
  console.log(`  hukum : ${sozluk.hukum.join(', ')}`);
  console.log(`  karar : ${sozluk.karar.join(', ')}`);
  console.log(`  kavram: ${sozluk.kavram.join(', ')}\n`);

  // A gate that derives an EMPTY vocabulary would pass everything, so the derivation is checked
  // before it is used as a reference.
  ok('sozluk gercekten cikarildi (bos degil)',
    sozluk.hukum.length >= 5 && sozluk.karar.length >= 3 && sozluk.kavram.length >= 6,
    JSON.stringify(sozluk));

  const listeler = {
    'web/js/api.js': listeCikar(oku('web/js/api.js'), 'ENUM_DEGERLER'),
    'backend/worker.js': listeCikar(oku('backend/worker.js'), 'ENUM_DEGERLER'),
  };
  // hukum_tur / flort_karar are gone with the spiker payload that used them. A list nothing sends
  // is a list nobody maintains, so the two remaining slots are the two /api/itiraz really posts.
  const beklenen = { hukum: 'hukum', karar: 'karar' };

  for (const [dosya, liste] of Object.entries(listeler)) {
    ok(`${dosya} ENUM_DEGERLER okunabildi`, !!liste, String(liste));
    if (!liste) continue;
    ok(`${dosya} artik olu enum yuvasi tasimiyor`,
      !('hukum_tur' in liste) && !('flort_karar' in liste), Object.keys(liste).join(', '));
    for (const [alan, kaynak] of Object.entries(beklenen)) {
      const mevcut = liste[alan] || [];
      const eksik = sozluk[kaynak].filter((v) => !mevcut.includes(v));
      const fazla = mevcut.filter((v) => !sozluk[kaynak].includes(v));
      ok(`${dosya} ${alan} motorun ${kaynak} sozlugunu tam tasiyor`, eksik.length === 0,
        `sozlukte var listede YOK: ${eksik.join(', ')}`);
      ok(`${dosya} ${alan} sozlukte olmayan deger tasimiyor`, fazla.length === 0,
        `listede var sozlukte yok: ${fazla.join(', ')}`);
    }
  }

  // KAVRAMLAR lives on the server only: the time flow's `degisenler` list is filtered there.
  const kav = oku('backend/worker.js').match(/const KAVRAMLAR = \[([^\]]*)\]/);
  const kavListe = kav ? [...kav[1].matchAll(/'([^']*)'/g)].map((x) => x[1]) : [];
  const kavEksik = sozluk.kavram.filter((v) => !kavListe.includes(v));
  ok('worker KAVRAMLAR signals.js seri anahtarlarini tam tasiyor', kav && kavEksik.length === 0,
    `sozlukte var listede YOK: ${kavEksik.join(', ')}`);
  ok('worker KAVRAMLAR sozlukte olmayan kavram tasimiyor',
    kavListe.every((v) => sozluk.kavram.includes(v)),
    kavListe.filter((v) => !sozluk.kavram.includes(v)).join(', '));
});

console.log('');
if (fails) { console.log(`*** ${fails} MADDE KALDI`); process.exit(1); }
console.log('bulut_check_eski: hepsi gecti');
