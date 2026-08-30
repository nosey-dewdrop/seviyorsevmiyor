// What leaves the device on the OLD flow (index.html: paste a chat -> flört hükmü).
// Run: node train/bulut_check_eski.mjs
//
// train/bulut_check.mjs asks this question of the time flow. This file asks it of the flow that
// was still shipping the conversation itself: /api/spiker carried up to 6000 characters of chat in
// the request body, and /api/itiraz wrote up to 8000 characters of it into KV. The page said
// "mesajların cihazından çıkmaz" the whole time.
//
// Nothing is reimplemented here. The real client module builds the payloads and the real worker
// module handles the requests; the only fakes are the outside world (KV, Turnstile, Groq), because
// a gate that mimics the code stays green while the code rots.
//
// Measured, not asserted in prose:
//   - the outgoing body has zero text fields (a text field = a string with whitespace, or > 40 chars)
//   - no word of the fixture conversation appears anywhere in what reaches Groq
//   - no word of it appears in anything written to KV
//   - a client that posts the raw chat anyway gets it dropped at the server wall
//   - the privacy page's claims and the code's behaviour say the same thing

import { readFileSync } from 'node:fs';
import worker from '../backend/worker.js';
import { spikerOlgu, itirazOlgu } from '../web/js/api.js';

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
// Deliberately full of rare tokens. If any of them turns up in a request body or a KV value, it
// could only have come from the chat.

const DOC = [
  'SEN: bugun musaitsin degil mi',
  'O: bakariz',
  'SEN: seni ozledim gercekten',
  'O: hmm',
  'SEN: kerem cevap versene',
  'O: yogunum simdi',
].join('\n');

const SOHBET_KELIMELERI = ['musaitsin', 'bakariz', 'ozledim', 'gercekten', 'kerem', 'yogunum', 'versene'];

// The exact shape app.js:spikerFacts() hands to spikerRead(). Message text lives in `okumalar`,
// generated sentences live in `cumle`/`baslik`/`kapanis`; both used to travel.
const FACTS = {
  hukum: { tur: 'tense', etiket: 'gergin', cumle: 'bu sohbeti tek basina sen tasiyorsun.', gerekce: 'kerem yogunum demis.' },
  flort: { karar: 'yok', yuzde: 18, sende_yuzde: 31, onda_yuzde: 4 },
  sayim: {
    toplam_mesaj: 6, senin_mesajin: 3, onun_mesaji: 3,
    senin_sorun: 2, onun_sorusu: 0, red_flag_turu: 1, green_flag: 0,
  },
  denge: { cumle: 'sen uzaniyorsun, o sadece orada.' },
  okumalar: [
    { mesaj: 'bugun musaitsin degil mi', okuma: 'plan kurmaya calisiyor.' },
    { mesaj: 'bakariz', okuma: 'kapiyi acik birakip kapatiyor.' },
    { mesaj: 'seni ozledim gercekten', okuma: 'acik bir yakinlik hamlesi.' },
  ],
  bayraklar: [{ tur: 'red', baslik: 'surekli erteleme' }, { tur: 'green', baslik: 'hizli cevap' }],
  kapanis: 'bu kadari bile yeterince acik.',
};

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

// ---- 1. the client half: the report goes in, counts come out ---------------------------------

await blok('istemci spiker yuku', async () => {
  const olgu = spikerOlgu(FACTS);
  const json = JSON.stringify(olgu);
  console.log('\ncihazdan cikan tam yuk (spiker):');
  console.log('  ' + json);
  console.log(`  boyut: ${json.length} bayt\n`);

  ok('spiker yukunde metin alani = 0', metinAlanlari(olgu).length === 0, metinAlanlari(olgu).join(', '));
  ok('spiker yukunde sohbetten tek kelime yok', sohbetIzi(json).length === 0, sohbetIzi(json).join(', '));
  ok('spiker yukunde uretilmis cumle de yok',
    !json.includes('tasiyorsun') && !json.includes('uzaniyorsun') && !json.includes('erteleme'), json);
  ok('sayimlar gercekten tasindi (yuk bos degil)',
    olgu.toplam_mesaj === 6 && olgu.senin_sorun === 2 && olgu.okuma_sayisi === 3
    && olgu.red_bayrak === 1 && olgu.green_bayrak === 1, json);
  ok('hukum kisa anahtar olarak gecti', olgu.hukum_tur === 'tense' && olgu.flort_karar === 'yok', json);
  ok('spiker yuku 600 baytin altinda', json.length < 600, `${json.length} bayt`);
});

// A single-token message is the hard case for any "no whitespace" rule, so it is asked directly:
// the allowlist must drop it because `okumalar` is never descended into, not because it happened
// to contain a space.
await blok('tek kelimelik mesaj da gecmiyor', async () => {
  const kotu = JSON.parse(JSON.stringify(FACTS));
  kotu.okumalar = [{ mesaj: 'yogunum', okuma: 'x' }];
  kotu.hukum.tur = 'ozledim';           // a message word smuggled into an enum slot
  const json = JSON.stringify(spikerOlgu(kotu));
  ok('tek kelimelik mesaj yuke girmiyor', !json.includes('yogunum'), json);
  ok('okuma sayisi hala gidiyor', JSON.parse(json).okuma_sayisi === 1, json);
  // hukum_tur is an allowlisted enum slot: whatever the engine puts there travels. That is the
  // one place a single word can ride along, so it is stated out loud rather than left implied.
  ok('enum yuvasi tek kelime tasiyabiliyor (bilinen ve tek delik)',
    JSON.parse(json).hukum_tur === 'ozledim', json);
});

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

await blok('istemci kaynak kontrolu', async () => {
  const src = oku('web/js/api.js');
  const govdeler = [...src.matchAll(/body:\s*JSON\.stringify\(([^]*?)\)\s*,\n/g)].map((m) => m[1]);
  ok('api.js en az uc istek govdesi kuruyor', govdeler.length >= 3, String(govdeler.length));
  // `doc` as a KEY of the body object, shorthand or explicit. `itirazOlgu(doc)` is the opposite of
  // a finding: it is the chat being consumed on the device instead of being posted.
  const docTasiyan = govdeler.filter((g) => /(^|[,{\s])doc\s*[,:}]/.test(g));
  ok('hicbir istek govdesinde doc alani yok', docTasiyan.length === 0, docTasiyan.join(' | '));
  ok('spikerRead ham doc parametresi almiyor',
    /export async function spikerRead\(facts\)/.test(src), 'imza degismemis');
});

// ---- 2. the server half: drive the real worker ------------------------------------------------

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

// Everything the worker sends out is recorded, so "no message reached Groq" is a measurement of
// the actual outbound request rather than a reading of the source.
const disCagrilar = [];
const SPIKER_JSON = JSON.stringify({
  ton_line: 'cevaplari buz gibi.',
  sinyal_reason: 'karsilik yok denecek kadar az.',
  denge_line: 'sen uzaniyorsun, o sadece orada.',
  okumalar: ['bunu yazmamaliydi', 'kapiyi kapatiyor', 'acik bir hamle'],
  gozden_kacanlar: [{ baslik: 'tek tarafli', line: 'sohbeti sen tasiyorsun.', kanit: 'bakariz' }],
  kapanis: 'bu kadar.',
});
globalThis.fetch = async (url, init) => {
  const u = String(url);
  disCagrilar.push({ u, govde: String(init?.body || '') });
  if (u.includes('siteverify')) {
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }
  if (u.includes('api.groq.com')) {
    return new Response(JSON.stringify({ choices: [{ message: { content: SPIKER_JSON } }] }), { status: 200 });
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

// The JSON block the worker pastes into the user turn. The surrounding prompt is our own prose and
// is supposed to be prose; the payload is the part that came from the visitor's device.
// The payload is pretty-printed by the worker, so it is the first block that starts at column zero
// and closes at column zero. The output schema further down the prompt is our own text.
function groqYuku(cagri) {
  const g = JSON.parse(cagri.govde);
  const kullanici = g.messages.find((m) => m.role === 'user').content;
  const m = kullanici.match(/^\{[^]*?^\}/m);
  return m ? JSON.parse(m[0]) : null;
}

await blok('sunucu: temiz istemciden spiker', async () => {
  const env = makeEnv();
  const bilet = await biletAl(env);
  const n = groqCagrilari().length;
  const res = await call('/api/spiker', env, { token: bilet, body: { olgu: spikerOlgu(FACTS) } });
  const d = await res.json();
  ok('temiz spiker istegi 200', res.status === 200, `status ${res.status} ${JSON.stringify(d)}`);
  ok('groq gercekten arandi', groqCagrilari().length === n + 1);

  const cagri = groqCagrilari().at(-1);
  ok('groq a giden istekte sohbetten tek kelime yok', sohbetIzi(cagri.govde).length === 0,
    sohbetIzi(cagri.govde).join(', '));
  const yuk = groqYuku(cagri);
  ok('groq a giden yukte metin alani = 0', yuk && metinAlanlari(yuk).length === 0,
    JSON.stringify(metinAlanlari(yuk || {})));
});

// The worker is not allowed to trust the client. A page cached before this phase still posts
// `{facts, doc}` with the whole conversation in it; the wall has to hold for that request too.
await blok('sunucu: eski istemci ham sohbet yollarsa', async () => {
  const env = makeEnv();
  const bilet = await biletAl(env);
  const n = groqCagrilari().length;
  const res = await call('/api/spiker', env, { token: bilet, body: { facts: FACTS, doc: DOC } });
  const d = await res.json();
  ok('eski govde hala 200 (eski sayfa kirilmiyor)', res.status === 200, `status ${res.status}`);
  ok('eski govde de groq a ulasti', groqCagrilari().length === n + 1);

  const cagri = groqCagrilari().at(-1);
  const iz = sohbetIzi(cagri.govde);
  ok('ham doc yollansa bile groq a tek kelime gitmedi', iz.length === 0, iz.join(', '));
  const yuk = groqYuku(cagri);
  ok('eski govdeden turetilen yukte metin alani = 0', yuk && metinAlanlari(yuk).length === 0,
    JSON.stringify(metinAlanlari(yuk || {})));
  ok('eski govdeden sayimlar dogru turetildi',
    yuk && yuk.toplam_mesaj === 6 && yuk.okuma_sayisi === 3 && yuk.red_bayrak === 1, JSON.stringify(yuk));
  ok('cevapta uydurma alinti yok', !d.spiker?.gozden_kacanlar, JSON.stringify(d.spiker));
  ok('cevapta mesaj bazli okuma yok', !d.spiker?.okumalar, JSON.stringify(d.spiker));
});

// The same wall, asked of the field a careless future client is most likely to add.
await blok('sunucu: olgu icine mesaj sokusturulursa', async () => {
  const env = makeEnv();
  const bilet = await biletAl(env);
  const n = groqCagrilari().length;
  await call('/api/spiker', env, {
    token: bilet,
    body: { olgu: { toplam_mesaj: 6, ilk_mesaj: 'seni ozledim gercekten', son_mesaj: 'yogunum simdi' } },
  });
  ok('bir groq cagrisi oldu', groqCagrilari().length === n + 1);
  const cagri = groqCagrilari().at(-1);
  const iz = sohbetIzi(cagri.govde);
  ok('sokusturulan mesaj alanlari sunucuda dusuruldu', iz.length === 0, iz.join(', '));
  const yuk = groqYuku(cagri);
  ok('geriye sadece sayi kaldi', yuk && metinAlanlari(yuk).length === 0 && yuk.toplam_mesaj === 6,
    JSON.stringify(yuk));
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

// ---- 3. the model may not put back what the wall took out -------------------------------------

await blok('cikti duvari', async () => {
  const env = makeEnv();
  const bilet = await biletAl(env);
  const res = await call('/api/spiker', env, { token: bilet, body: { olgu: spikerOlgu(FACTS) } });
  const d = await res.json();
  const cikti = JSON.stringify(d.spiker);
  const degerler = Object.values(d.spiker).filter((v) => typeof v === 'string');
  ok('ciktida rakam yok', !/[0-9]/.test(cikti), cikti);
  ok('ciktida tirnakli alinti yok', degerler.every((v) => !/["“”«»]/.test(v)), cikti);
  ok('modelin yolladigi okumalar ve alintili gozlemler dusuruldu',
    !cikti.includes('bunu yazmamaliydi') && !cikti.includes('tek tarafli'), cikti);
  ok('cikti alanlari sadece dort cumle',
    Object.keys(d.spiker).sort().join(',') === 'denge_line,kapanis,sinyal_reason,ton_line',
    Object.keys(d.spiker).join(','));
});

// ---- 4. the page and the code have to say the same thing --------------------------------------

await blok('gizlilik iddiasi kodla ayni seyi soyluyor', async () => {
  const g = oku('web/gizlilik.html');
  const w = oku('backend/worker.js');
  const t = oku('backend/wrangler.toml');

  const kacamak = ['genellikle', 'çoğunlukla', 'genelde', 'gerekmedikçe', 'kural olarak', 'prensip olarak'];
  const bulunan = kacamak.filter((k) => g.toLowerCase().includes(k));
  ok('gizlilik metninde kacamak kelime yok', bulunan.length === 0, bulunan.join(', '));

  ok('gizlilik metni iddiayi kosulsuz kuruyor', g.includes('Mesajlarının metni cihazından çıkmaz.'));
  ok('gizlilik metni artik olmayan bir e-postaya atif yapmiyor',
    !/yukarıdaki e-posta|e-posta atman/i.test(g));
  ok('KVKK basvuru kanali sayfada var',
    g.includes('https://github.com/nosey-dewdrop/seviyorsevmiyor/issues'));

  // The four lines this phase was opened on: each one is a claim, and each claim now has to be
  // true of the code sitting next to it.
  ok('worker doc u KV ye yazmiyor', !/doc,\s*$/m.test(w) && !/\bdoc:\s*doc\b/.test(w), 'worker.js');
  ok('worker istek govdesinden doc okumuyor', !/body\.doc|b\.doc\b/.test(w.replace(/^\s*\/\/.*$/gm, '')),
    'worker.js');
  ok('wrangler artik icerik saklamadigini dogru gerekceyle soyluyor',
    t.includes('No message text reaches this worker at all') && !t.includes('no content is ever stored here'),
    'wrangler.toml');
});

console.log('');
if (fails) { console.log(`*** ${fails} MADDE KALDI`); process.exit(1); }
console.log('bulut_check_eski: hepsi gecti');
