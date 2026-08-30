// THE LLM PATH GATE — "the conversation goes out, and it only goes out because someone said yes."
// Run: node train/llm_yol_check.mjs
//
// The old flow used to reduce a chat to fifteen counts and send those. That is over (30 Ağu,
// product owner's call): the counter was inventing verdicts out of word frequencies and a model
// handed fifteen numbers can only write templates. The chat itself is sent now.
//
// Which moves the entire burden onto two things, and this file measures both instead of describing
// them:
//
//   1. CONSENT is the only door. Not a checkbox that also happens to exist, not a promise in the
//      privacy page: one `if` in web/js/api.js and one `if` in backend/worker.js. Both are MUTATED
//      here — taken out, run again, put back byte for byte. If the chat does not appear in the
//      outgoing body once the check is gone, then the check was not what was holding it and this
//      gate is measuring nothing.
//
//   2. THE OUTPUT IS FILTERED, because a model reading a real chat can invent a real-sounding
//      figure, quote a Spotify link as "a genuine question", say two opposite things in one reading
//      and say the same thing three times. Every one of those is a shape the live site actually
//      produced. Each gets its own fake Groq answer below and each has to be REFUSED.
//
// Nothing is reimplemented. The real client module builds the request, the real worker module
// handles it; the only fakes are the outside world (KV, Turnstile, Groq).
//
// No real Groq call is made and no key is needed.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import worker from '../backend/worker.js';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let fails = 0;
const ok = (n, c, d = '') => {
  if (c) console.log(`ok  ${n}`);
  else { fails++; console.log(`*** ${n}${d ? '\n    ' + d : ''}`); }
};
const baslik = (s) => console.log(`\n=== ${s} ===`);
async function blok(ad, fn) {
  try { await fn(); } catch (e) { fails++; console.log(`*** ${ad} PATLADI\n    ${(e && e.stack) || e}`); }
}

// ---- the fixture conversation -----------------------------------------------------------------
//
// Rare tokens on purpose: if any of them turns up in a request body, it could only have come from
// the chat. It also carries the two things the live spiker quoted and should not have: a link, and
// an export system line.

const SOHBET = [
  'SEN: bugun musaitsin degil mi',
  'O: bakariz',
  'SEN: seni ozledim gercekten',
  'O: hmm',
  'SEN: sunu dinle https://open.spotify.com/track/4zurnabalik',
  'O: <Çıkartma dahil edilmedi>',
  'SEN: kerem cevap versene',
  'O: yogunum simdi',
].join('\n');

const SOHBET_KELIMELERI = ['musaitsin', 'bakariz', 'ozledim', 'gercekten', 'kerem', 'yogunum', 'versene'];
const izi = (metin) => SOHBET_KELIMELERI.filter((k) => String(metin).toLowerCase().includes(k));

// ---- fakes ------------------------------------------------------------------------------------

function makeKV() {
  const store = new Map();
  const writes = [];
  return {
    writes,
    async get(k) { return store.has(k) ? store.get(k) : null; },
    async put(k, v, opts) { writes.push({ key: k, deger: v, opts: opts || null }); store.set(k, v); },
  };
}
const OWN = 'https://nosey-dewdrop.github.io';
function makeEnv(over = {}) {
  const env = {
    RATE_LIMIT: makeKV(),
    CORPUS: makeKV(),
    ALLOWED_ORIGINS: OWN,
    SPIKER_OPEN: 'on',
    ITIRAZ_OPEN: 'on',
    GROQ_API_KEY: 'test-groq',
    // TURNSTILE_SECRET deliberately absent: that is production today, and it is the state in which
    // /api/spiker must still work. The ticket cases live in backend/tests/origin_turnstile_check.mjs.
    BILET_SECRET: 'test-bilet-secret-0123456789',
    ...over,
  };
  for (const [k, v] of Object.entries(env)) if (v === undefined) delete env[k];
  return env;
}

// Everything the worker sends out is recorded, so "the chat reached the prompt" is a measurement of
// the actual outbound request rather than a reading of the source.
let groqCevap = null;          // set per test
const disCagrilar = [];
const gercekFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const u = String(url);
  disCagrilar.push({ u, govde: String(init?.body || ''), init });
  if (u.includes('siteverify')) return new Response(JSON.stringify({ success: true }), { status: 200 });
  if (u.includes('api.groq.com')) {
    return new Response(JSON.stringify({ choices: [{ message: { content: groqCevap } }] }), { status: 200 });
  }
  // the client posts at API_BASE; hand it back to the real worker so client and server are wired
  if (u.includes('/api/')) {
    const env = makeEnv();
    return worker.fetch(new Request(u, { ...init, headers: { ...(init.headers || {}), origin: OWN, 'cf-connecting-ip': '203.0.113.4' } }), env);
  }
  throw new Error(`beklenmeyen dis cagri: ${u}`);
};
const groqCagrilari = () => disCagrilar.filter((c) => c.u.includes('api.groq.com'));
const istemciCagrilari = () => disCagrilar.filter((c) => c.u.includes('/api/spiker'));

function req(path, { body = {}, token = null, ip = '203.0.113.9' } = {}) {
  const headers = { 'content-type': 'application/json', 'cf-connecting-ip': ip, origin: OWN };
  if (token) headers['x-app-token'] = token;
  return new Request(`https://seviyorsevmiyor-api.workers.dev${path}`, {
    method: 'POST', headers, body: JSON.stringify(body),
  });
}
const call = (path, env, opts) => worker.fetch(req(path, opts), env);

const GECERLI_CEVAP = JSON.stringify({
  satirlar: [
    'plan kuran hep aynı taraf.',
    '"bakariz" bir kapıyı kapatmanın kibar yolu.',
    'karşı taraf konuyu uzatmıyor.',
  ],
});

// ---- mutation helper --------------------------------------------------------------------------
//
// Edit a real source file, run something, put the file back byte for byte. The restore is verified,
// because a gate that leaves the tree dirty is worse than no gate.
async function mutasyon(gorece, degistir, fn) {
  const yol = join(REPO, gorece);
  const asil = readFileSync(yol, 'utf8');
  const yeni = degistir(asil);
  if (yeni === asil) throw new Error(`mutasyon tutmadi, hedef metin ${gorece} icinde yok`);
  writeFileSync(yol, yeni);
  try {
    return await fn();
  } finally {
    writeFileSync(yol, asil);
    if (readFileSync(yol, 'utf8') !== asil) throw new Error(`${gorece} geri konamadi`);
  }
}

// api.js is imported fresh each time with a cache-busting query, so a mutated copy is really the
// one being driven and not the one Node loaded first.
let sayac = 0;
const apiYukle = () => import(`../web/js/api.js?llmyol=${++sayac}`);

// ================================================================================================
baslik('1. riza YOKKEN cihazdan ne cikiyor');

await blok('onay yok', async () => {
  const api = await apiYukle();
  const n = istemciCagrilari().length;
  const out = await api.spikerRead({ sohbet: SOHBET, onay: false });
  const yeni = istemciCagrilari().slice(n);
  ok('onay false: spikerRead null donuyor', out === null, JSON.stringify(out));
  ok('onay false: /api/spiker a HIC istek gitmedi', yeni.length === 0, `${yeni.length} istek`);
  const hepsi = JSON.stringify(disCagrilar.slice(n));
  ok('onay false: giden hicbir govdede sohbetten tek kelime yok', izi(hepsi).length === 0, izi(hepsi).join(', '));
});

await blok('onay alani hic yok', async () => {
  const api = await apiYukle();
  const n = disCagrilar.length;
  const out = await api.spikerRead({ sohbet: SOHBET });
  ok('onay alansiz istek de null', out === null, JSON.stringify(out));
  ok('onay alansiz istekte de govde kurulmadi', disCagrilar.length === n, `${disCagrilar.length - n} istek`);
});

await blok('onay "truthy" ama true degil', async () => {
  const api = await apiYukle();
  const n = disCagrilar.length;
  // 'evet', 1 and {} are all truthy. The gate is `=== true`, so none of them opens it: a consent
  // flag that arrives as a string from a stale cached page must not count as consent.
  for (const sahte of ['evet', 1, {}, 'true']) {
    await api.spikerRead({ sohbet: SOHBET, onay: sahte });
  }
  ok('truthy ama true olmayan onay da kapiyi acmiyor', disCagrilar.length === n,
    `${disCagrilar.length - n} istek`);
});

// THE MEASUREMENT THAT MAKES THE THREE ABOVE MEAN SOMETHING. Take the consent line out of the real
// client and the chat has to appear on the wire. If it does not, then something else was stopping
// it and the `if` this product rests on is decoration.
await blok('MUTASYON: riza kapisi sokulunce sohbet gercekten cikiyor', async () => {
  const n = disCagrilar.length;
  await mutasyon('web/js/api.js',
    (src) => src.replace(
      '  if (!onay) return null;                 // RIZA KAPISI — onay yoksa gövde hiç kurulmaz',
      '  if (false) return null;                 // MUTASYON'),
    async () => {
      const api = await apiYukle();
      await api.spikerRead({ sohbet: SOHBET, onay: false });
    });
  const yeni = disCagrilar.slice(n);
  const govdeler = yeni.map((c) => c.govde).join('\n');
  ok('mutasyonla istek gercekten kuruldu', yeni.length > 0, `${yeni.length} istek`);
  ok('mutasyonla sohbet govdeye girdi (kapi gercekten o satirdi)',
    izi(govdeler).length >= 5, izi(govdeler).join(', '));
  const geri = readFileSync(join(REPO, 'web/js/api.js'), 'utf8');
  ok('mutasyon sonrasi api.js geri kondu',
    geri.includes('if (!onay) return null;'), 'satir geri gelmemis');
});

// ================================================================================================
baslik('2. riza VARKEN sohbet gidiyor mu');

await blok('onay true', async () => {
  groqCevap = GECERLI_CEVAP;
  const api = await apiYukle();
  const ni = istemciCagrilari().length;
  const ng = groqCagrilari().length;
  const sp = await api.spikerRead({ sohbet: SOHBET, onay: true });

  const istek = istemciCagrilari().at(-1);
  ok('onay true: /api/spiker a istek gitti', istemciCagrilari().length === ni + 1);
  const govde = JSON.parse(istek.govde);
  ok('gonderilen govde sohbeti tasiyor', typeof govde.sohbet === 'string' && izi(govde.sohbet).length >= 5,
    izi(govde.sohbet || '').join(', '));
  ok('govde onayi da tasiyor', govde.onay === true, JSON.stringify(Object.keys(govde)));
  ok('govdede sohbet ve onay disinda alan yok',
    Object.keys(govde).sort().join(',') === 'onay,sohbet', Object.keys(govde).join(','));

  ok('sunucu Groq u aradi', groqCagrilari().length === ng + 1);
  ok('okuma geri geldi', !!sp && Array.isArray(sp.satirlar) && sp.satirlar.length === 3, JSON.stringify(sp));
});

await blok('prompt sohbetin kendisini iceriyor', async () => {
  groqCevap = GECERLI_CEVAP;
  const env = makeEnv();
  const ng = groqCagrilari().length;
  const res = await call('/api/spiker', env, { body: { sohbet: SOHBET, onay: true } });
  ok('sunucu 200 dondu', res.status === 200, `status ${res.status}`);
  ok('bir Groq cagrisi oldu', groqCagrilari().length === ng + 1);
  const g = JSON.parse(groqCagrilari().at(-1).govde);
  const kullanici = g.messages.find((m) => m.role === 'user').content;
  ok('kullanici mesaji sohbetin TAMAMINI tasiyor', kullanici.includes(SOHBET), kullanici.slice(0, 200));
  ok('promptta sohbetin her nadir kelimesi var', izi(kullanici).length === SOHBET_KELIMELERI.length,
    `${izi(kullanici).length}/${SOHBET_KELIMELERI.length}`);
  const sistem = g.messages.find((m) => m.role === 'system').content;
  ok('sistem promptu artik "sayilar" istemiyor', !/yalnızca SAYILARINI/.test(sistem), 'eski prompt duruyor');
  ok('sistem promptu rakam yasagini soyluyor', /RAKAM YAZMA/.test(sistem));
  ok('sistem promptu birebir alinti sartini soyluyor', /BİREBİR/.test(sistem));
  ok('KV ye sohbetten tek kelime yazilmadi',
    izi(JSON.stringify(env.RATE_LIMIT.writes) + JSON.stringify(env.CORPUS.writes)).length === 0,
    'KV de sohbet izi var');
});

await blok('sunucu tarafi riza kapisi', async () => {
  groqCevap = GECERLI_CEVAP;
  const env = makeEnv();
  const ng = groqCagrilari().length;
  const res = await call('/api/spiker', env, { body: { sohbet: SOHBET } });
  ok('onaysiz sunucu istegi 400', res.status === 400, `status ${res.status}`);
  ok('onaysiz istekte Groq hic aranmadi', groqCagrilari().length === ng, `${groqCagrilari().length - ng} cagri`);
  const res2 = await call('/api/spiker', env, { body: { sohbet: SOHBET, onay: 'evet' } });
  ok('onay true degilse (string) yine 400', res2.status === 400, `status ${res2.status}`);
  ok('hala Groq aranmadi', groqCagrilari().length === ng, `${groqCagrilari().length - ng} cagri`);
});

await blok('MUTASYON: sunucudaki riza kapisi sokulunce sohbet Groq a gidiyor', async () => {
  groqCevap = GECERLI_CEVAP;
  const ng = groqCagrilari().length;
  await mutasyon('backend/worker.js',
    (src) => src.replace(
      "  if (!body || body.onay !== true) return json({ error: 'Onay yok' }, 400, origin);",
      "  if (false) return json({ error: 'Onay yok' }, 400, origin);"),
    async () => {
      const mut = await import(`../backend/worker.js?llmyol=${++sayac}`);
      await mut.default.fetch(req('/api/spiker', { body: { sohbet: SOHBET } }), makeEnv());
    });
  const yeni = groqCagrilari().slice(ng);
  ok('mutasyonla onaysiz istek Groq a ulasti (kapi gercekten o satirdi)',
    yeni.length === 1 && izi(yeni[0].govde).length >= 5,
    `${yeni.length} cagri, iz: ${yeni.map((c) => izi(c.govde).join('+')).join(' | ')}`);
});

// ================================================================================================
baslik('3. cikti duvari: model ne yazarsa yazsin ekrana ne cikiyor');

// Each case is one fake Groq answer and one question: does the worker refuse it? A 502 here is the
// green outcome — the client falls back to the on-device template lines, which is a worse sentence
// rather than a false one.
async function ciktiDene(ad, cevap, bekleneniKabul) {
  groqCevap = typeof cevap === 'string' ? cevap : JSON.stringify(cevap);
  const env = makeEnv();
  const res = await call('/api/spiker', env, { body: { sohbet: SOHBET, onay: true } });
  const d = await res.json();
  const kabul = res.status === 200;
  ok(`${ad} -> ${bekleneniKabul ? 'KABUL' : 'RED'}`, kabul === bekleneniKabul,
    `status ${res.status} ${JSON.stringify(d).slice(0, 200)}`);
  return d;
}

await blok('uzunluk siniri', async () => {
  await ciktiDene('uc kisa satir', GECERLI_CEVAP, true);
  await ciktiDene('yedi cumle (6 sinirinin ustu)', {
    satirlar: [
      'plan kuran hep aynı taraf. cevaplar kısa. konu her seferinde kapanıyor.',
      'soru sormayan taraf belli. karşılık ölçülü. mesafe korunuyor.',
      'burada tutan tek bir kişi var.',
    ],
  }, false);
  await ciktiDene('alti satir (5 satir sinirinin ustu)', {
    satirlar: ['bir', 'iki', 'uc', 'dort', 'bes', 'alti'],
  }, false);
});

await blok('uydurma sayi', async () => {
  await ciktiDene('uydurma yuzde', {
    satirlar: ['flört sinyali %89.', 'karşı taraf geri çekiliyor.'],
  }, false);
  await ciktiDene('yazisiz rakam', {
    satirlar: ['3 mesajda bir konu kapanıyor.', 'plan kuran hep aynı taraf.'],
  }, false);
  await ciktiDene('saat uydurmasi', {
    satirlar: ['cevaplar 4 saate çıkmış.', 'karşı taraf geri çekiliyor.'],
  }, false);
});

await blok('alinti dogrulamasi', async () => {
  await ciktiDene('sohbette GECEN alinti', {
    satirlar: ['"bakariz" bir kapıyı kapatmanın kibar yolu.', 'plan kuran hep aynı taraf.'],
  }, true);
  await ciktiDene('sohbette GECMEYEN alinti', {
    satirlar: ['"seni hic sevmedim" demiş.', 'plan kuran hep aynı taraf.'],
  }, false);
  await ciktiDene('yariya kadar gercek alinti', {
    satirlar: ['"seni ozledim gercekten ama olmaz" demiş.', 'plan kuran hep aynı taraf.'],
  }, false);
  await ciktiDene('acik kalan tirnak', {
    satirlar: ['"bakariz diyor.', 'plan kuran hep aynı taraf.'],
  }, false);
});

await blok('URL ve sistem satiri alintilanamaz', async () => {
  // Both of these ARE in the conversation, so "is it in the doc" says yes about both. They are
  // still nobody's sentence, and the live spiker held the first one up as "gerçek bir soru".
  await ciktiDene('sohbetteki URL i alintilamak', {
    satirlar: ['"https://open.spotify.com/track/4zurnabalik" gerçek bir soru.', 'plan kuran aynı taraf.'],
  }, false);
  await ciktiDene('sistem satirini alintilamak', {
    satirlar: ['"<Çıkartma dahil edilmedi>" bir cevap sayılmaz.', 'plan kuran aynı taraf.'],
  }, false);
  await ciktiDene('tirnaksiz URL yazmak', {
    satirlar: ['karşı taraf open.spotify.com bağlantısı atmış.', 'plan kuran aynı taraf.'],
  }, false);
});

await blok('celiski ve tekrar', async () => {
  await ciktiDene('ayni okumada duvar orme + kollama', {
    satirlar: ['karşı taraf konuyu kapatıp duvar örüyor.', 'aynı anda seni kolluyor.'],
  }, false);
  await ciktiDene('ayni okumada flort var + flort yok', {
    satirlar: ['burada bir flörtleşme var.', 'bu arkadaşça bir sohbet, romantik değil.'],
  }, false);
  await ciktiDene('ayni hukmu iki kez kurmak', {
    satirlar: ['plan kuran hep aynı taraf.', 'plan kuran hep aynı taraf.'],
  }, false);
  await ciktiDene('bir cumleyi digerinin icine gomerek tekrarlamak', {
    satirlar: ['plan kuran hep aynı taraf.', 'bu sohbette plan kuran hep aynı taraf, başkası değil.'],
  }, false);
});

await blok('agiz ve bicim', async () => {
  await ciktiDene('"kanka"', { satirlar: ['kanka bu iş bitmiş.', 'plan kuran aynı taraf.'] }, false);
  await ciktiDene('em dash', { satirlar: ['plan kuran aynı taraf — hep o.', 'cevaplar kısa.'] }, false);
  await ciktiDene('json degil', 'bu bir cumle, json degil', false);
  await ciktiDene('satirlar dizi degil', { satirlar: 'tek cumle' }, false);
  await ciktiDene('bos dizi', { satirlar: [] }, false);
});

await blok('kabul edilen cikti kucuk harf ve sinirlar icinde', async () => {
  groqCevap = JSON.stringify({
    satirlar: ['Plan Kuran Hep Aynı Taraf.', '"bakariz" kapıyı kapatıyor.'],
  });
  const env = makeEnv();
  const res = await call('/api/spiker', env, { body: { sohbet: SOHBET, onay: true } });
  const d = await res.json();
  ok('kabul edildi', res.status === 200, `status ${res.status} ${JSON.stringify(d)}`);
  const s = d.spiker.satirlar;
  ok('cikti kucuk harfe cevrildi', s.every((x) => x === x.replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase()),
    JSON.stringify(s));
  ok('cikti alani sadece satirlar', Object.keys(d.spiker).join(',') === 'satirlar', Object.keys(d.spiker).join(','));
  ok('toplam cumle 6 yi asmiyor',
    s.join(' ').split(/(?<=[.!?])\s+/).filter(Boolean).length <= 6, JSON.stringify(s));
});

// ================================================================================================
baslik('4. eski yol gercekten kalkti mi');

await blok('olu kod kalmadi', async () => {
  const api = readFileSync(join(REPO, 'web/js/api.js'), 'utf8');
  const app = readFileSync(join(REPO, 'web/js/app.js'), 'utf8');
  const ui = readFileSync(join(REPO, 'web/js/ui.js'), 'utf8');
  const w = readFileSync(join(REPO, 'backend/worker.js'), 'utf8');

  ok('api.js spikerOlgu yu artik ihrac etmiyor', !/export function spikerOlgu/.test(api), 'hala var');
  ok('app.js spikerFacts i birakti', !/spikerFacts/.test(app), 'hala var');
  ok('app.js gozden_kacanlar atamiyor', !/gozden_kacanlar/.test(app), 'hala var');
  ok('ui.js g.kanit dalini render etmiyor', !/g\.kanit/.test(ui), 'olu dal duruyor');
  ok('worker spikerOlguSunucu yu birakti', !/spikerOlguSunucu/.test(w), 'hala var');
  ok('worker olguTemiz i /api/spiker te kullanmiyor',
    !/handleSpiker[^]*?olguTemiz/.test(w.slice(w.indexOf('async function handleSpiker'))), 'hala suzuyor');
  ok('ui.js spiker satirlarini ciziyor', /r\.spikerSatirlar/.test(ui), 'render yok');
  ok('app.js spiker satirlarini atiyor', /r\.spikerSatirlar/.test(app), 'atama yok');
});

await blok('gizlilik metni gercegi yaziyor', async () => {
  const g = readFileSync(join(REPO, 'web/gizlilik.html'), 'utf8');
  const h = readFileSync(join(REPO, 'web/index.html'), 'utf8');
  ok('gizlilik "mesajlarinin metni cihazindan cikmaz" demiyor',
    !/Mesajlarının metni cihazından çıkmaz/.test(g), 'eski iddia duruyor');
  ok('gizlilik metnin buluta gittigini acikca yaziyor',
    /sohbetin metni buluta gönderilir/.test(g), 'acik cumle yok');
  ok('gizlilik saklama suresini yaziyor', /sıfır gün/.test(g) && /180 gün/.test(g), 'sure yok');
  ok('onay kutusu metnin gittigini soyluyor',
    /onay verirsen bu sohbetin metni buluta gider/.test(h), 'onay kutusu eski');
  ok('index.html hicbir yerde "mesajların cihazından çıkmaz" demiyor',
    !/mesajların cihazından çıkmaz/.test(h), 'eski iddia duruyor');
});

// ================================================================================================
console.log('');
if (fails) { console.log(`*** ${fails} MADDE KALDI`); process.exit(1); }
console.log('llm_yol_check: hepsi gecti');
if (gercekFetch) globalThis.fetch = gercekFetch;
