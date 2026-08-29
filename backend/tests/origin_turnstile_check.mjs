// Who is allowed to spend this account's key, and what is allowed to live forever in KV.
// Run: node backend/tests/origin_turnstile_check.mjs
//
// This imports the real worker module and calls its real fetch handler. Nothing about the gates is
// reimplemented here: the only things faked are the outside world (KV, Turnstile, Groq), because a
// test that mimics the worker would stay green while the worker rots.
//
// Thresholds (S2): foreign origin = 403 - own origin = 200 - KV writes without a TTL = 0.

import worker from '../worker.js';

let fails = 0;
const ok = (n, c, d = '') => {
  if (c) console.log(`ok  ${n}`);
  else { fails++; console.log(`*** ${n}${d ? '\n    ' + d : ''}`); }
};

const OWN = 'https://nosey-dewdrop.github.io';
const FOREIGN = 'https://kotu-site.example';

// ---- fakes -----------------------------------------------------------------------------------

// Records every put with the options it was given, so "TTL'siz KV yazımı = 0" is measured rather
// than reviewed by eye.
function makeKV() {
  const store = new Map();
  const writes = [];
  return {
    writes,
    async get(k) { return store.has(k) ? store.get(k) : null; },
    async put(k, v, opts) { writes.push({ key: k, opts: opts || null }); store.set(k, v); },
  };
}

const SIRLAR = {
  GROQ_API_KEY: 'test-groq',
  TURNSTILE_SECRET: 'test-turnstile',
  BILET_SECRET: 'test-bilet-secret-0123456789',
};

function makeEnv(over = {}) {
  const kv = makeKV();
  return {
    RATE_LIMIT: kv,
    CORPUS: makeKV(),
    ALLOWED_ORIGINS: OWN,
    SPIKER_OPEN: 'on',
    ITIRAZ_OPEN: 'on',
    ...SIRLAR,
    ...over,
  };
}

// Outside world. `turnstileOk` flips siteverify; Groq returns one valid spiker payload whose
// evidence quote really appears in the doc, so validateSpiker cannot drop it for the wrong reason.
let turnstileOk = true;
let turnstileCalls = 0;
let groqCalls = 0;

const DOC = 'SEN: bugun musait misin\nO: bakariz\nSEN: tamam o zaman\nO: hmm';

const SPIKER_JSON = JSON.stringify({
  ton_line: 'cevaplari kisa.',
  sinyal_reason: 'karsilik az.',
  denge_line: 'sen uzaniyorsun.',
  okumalar: [],
  gozden_kacanlar: [{ baslik: 'tek tarafli', line: 'sohbeti sen tasiyorsun.', kanit: 'bakariz' }],
  kapanis: 'bu kadar.',
});

globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes('siteverify')) {
    turnstileCalls++;
    return new Response(JSON.stringify({ success: turnstileOk }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  }
  if (u.includes('api.groq.com')) {
    groqCalls++;
    return new Response(JSON.stringify({ choices: [{ message: { content: SPIKER_JSON } }] }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  }
  throw new Error(`beklenmeyen dis cagri: ${u}`);
};

// ---- helpers ---------------------------------------------------------------------------------

function req(path, { origin = OWN, body = {}, method = 'POST', token = null } = {}) {
  const headers = { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.7' };
  if (origin) headers.origin = origin;
  if (token) headers['x-app-token'] = token;
  return new Request(`https://seviyorsevmiyor-api.workers.dev${path}`, {
    method, headers, body: method === 'POST' ? JSON.stringify(body) : undefined,
  });
}

const call = (path, env, opts) => worker.fetch(req(path, opts), env);

async function biletAl(env) {
  const res = await call('/api/bilet', env, { body: { turnstile: 'dummy' } });
  const d = await res.json();
  return d.bilet;
}

function ttlsizYazimlar(env) {
  const hepsi = [];
  for (const [ad, ns] of Object.entries(env)) {
    if (!ns || typeof ns !== 'object' || !Array.isArray(ns.writes)) continue;
    for (const w of ns.writes) {
      if (!w.opts || !(w.opts.expirationTtl > 0)) hepsi.push(`${ad}.${w.key}`);
    }
  }
  return hepsi;
}

// ---- 1. origin ---------------------------------------------------------------------------------

{
  const env = makeEnv();
  const yollar = ['/api/spiker', '/api/itiraz', '/api/zaman', '/api/ping', '/api/stats', '/api/bilet'];
  const kotu = [];
  for (const y of yollar) {
    const res = await call(y, env, { origin: FOREIGN, body: { olay: 'analiz' } });
    if (res.status !== 403) kotu.push(`${y} -> ${res.status}`);
    if (res.headers.get('access-control-allow-origin')) kotu.push(`${y} CORS basligi sizdi`);
  }
  ok('yabanci origin her rotada 403', kotu.length === 0, kotu.join(', '));
  ok('yabanci origin hicbir sey yazmadi', ttlsizYazimlar(env).length === 0 && env.RATE_LIMIT.writes.length === 0,
    `${env.RATE_LIMIT.writes.length} yazim`);
}

{
  const env = makeEnv();
  const res = await call('/api/ping', env, { origin: '', body: { olay: 'analiz' } });
  ok('origin basligi yoksa 403', res.status === 403, `status ${res.status}`);
}

{
  const env = makeEnv();
  const res = await call('/api/ping', env, { body: { olay: 'analiz' } });
  ok('kendi origin 200', res.status === 200, `status ${res.status}`);
  ok('kendi origin CORS basligi yildiz degil',
    res.headers.get('access-control-allow-origin') === OWN,
    String(res.headers.get('access-control-allow-origin')));
}

{
  const env = makeEnv({ ALLOWED_ORIGINS: '' });
  const res = await call('/api/ping', env, { body: { olay: 'analiz' } });
  const d = await res.json();
  ok('ALLOWED_ORIGINS bossa 503 ve isim',
    res.status === 503 && d.eksik?.includes('ALLOWED_ORIGINS'), JSON.stringify(d));
}

{
  const env = makeEnv();
  const res = await call('/api/spiker', env, { origin: FOREIGN, method: 'OPTIONS' });
  ok('yabanci origin preflight 403', res.status === 403, `status ${res.status}`);
  const res2 = await call('/api/spiker', env, { method: 'OPTIONS' });
  ok('kendi origin preflight gecer',
    res2.status === 200 && res2.headers.get('access-control-allow-origin') === OWN);
}

// ---- 2. turnstile + ticket -----------------------------------------------------------------------

{
  const env = makeEnv();
  turnstileOk = true;
  const oncesi = turnstileCalls;
  const bilet = await biletAl(env);
  ok('bilet sunucuda siteverify cagiriyor', turnstileCalls === oncesi + 1);
  ok('bilet uc parcali imzali', typeof bilet === 'string' && bilet.split('.').length === 3, String(bilet));
}

{
  const env = makeEnv();
  turnstileOk = false;
  const res = await call('/api/bilet', env, { body: { turnstile: 'sahte' } });
  ok('turnstile basarisiz ise bilet yok 403', res.status === 403, `status ${res.status}`);
  turnstileOk = true;
}

{
  const env = makeEnv();
  const res = await call('/api/bilet', env, { body: {} });
  ok('turnstile cevabi olmadan 403', res.status === 403, `status ${res.status}`);
}

{
  const env = makeEnv();
  const g = groqCalls;
  const res = await call('/api/spiker', env, { body: { facts: { okumalar: [] }, doc: DOC } });
  ok('biletsiz spiker 403', res.status === 403, `status ${res.status}`);
  ok('biletsiz spiker Groq cagirmadi', groqCalls === g, `${groqCalls - g} cagri`);
}

{
  const env = makeEnv();
  const res = await call('/api/spiker', env, {
    token: `${Date.now() + 60000}.abcdef12.` + 'f'.repeat(64),
    body: { facts: { okumalar: [] }, doc: DOC },
  });
  ok('sahte imzali bilet 403', res.status === 403, `status ${res.status}`);
}

{
  const env = makeEnv();
  const bilet = await biletAl(env);
  const [son, nonce, imza] = bilet.split('.');
  const gecmis = `${Date.now() - 1000}.${nonce}.${imza}`;
  const res = await call('/api/spiker', env, { token: gecmis, body: { facts: { okumalar: [] }, doc: DOC } });
  ok('suresi gecmis bilet 403', res.status === 403, `status ${res.status} (son ${son})`);
}

{
  const env = makeEnv();
  const bilet = await biletAl(env);
  const g = groqCalls;
  const res = await call('/api/spiker', env, { token: bilet, body: { facts: { okumalar: [] }, doc: DOC } });
  const d = await res.json();
  ok('gecerli bilet + kendi origin = 200', res.status === 200, `status ${res.status} ${JSON.stringify(d)}`);
  ok('gecerli istek Groq a ulasti', groqCalls === g + 1);
  ok('spiker govdesi geldi', !!d.spiker?.ton_line, JSON.stringify(d).slice(0, 200));
}

// ---- 3. missing secrets fail closed, by name -----------------------------------------------------

for (const ad of ['TURNSTILE_SECRET', 'BILET_SECRET']) {
  const env = makeEnv({ [ad]: undefined });
  for (const yol of ['/api/bilet', '/api/spiker', '/api/itiraz']) {
    const res = await call(yol, env, { body: { turnstile: 'x' } });
    const d = await res.json();
    ok(`${ad} yoksa ${yol} 503 ve adiyla soyluyor`,
      res.status === 503 && d.eksik?.includes(ad), `status ${res.status} ${JSON.stringify(d)}`);
  }
}

// ---- 4. itiraz: ticket, kill switch, retention ----------------------------------------------------

{
  const env = makeEnv();
  const bilet = await biletAl(env);
  const res = await call('/api/itiraz', env, {
    token: bilet, body: { doc: DOC, hukum: 'flort_yok', karar: 'yanlis', onay: true },
  });
  ok('itiraz carki calisiyor (200)', res.status === 200, `status ${res.status}`);

  const yaz = env.CORPUS.writes.filter((w) => w.key.startsWith('corpus:'));
  ok('corpus yazildi', yaz.length === 1, `${yaz.length} yazim`);
  ok('corpus rate-limit namespace inde degil',
    env.RATE_LIMIT.writes.every((w) => !w.key.startsWith('corpus:')));
  ok('corpus anahtarinda expirationTtl var',
    yaz.every((w) => w.opts?.expirationTtl > 0), JSON.stringify(yaz.map((w) => w.opts)));
  ok('corpus saklama suresi bir yili gecmiyor',
    yaz.every((w) => w.opts.expirationTtl <= 60 * 60 * 24 * 366),
    String(yaz[0]?.opts?.expirationTtl));
}

{
  const env = makeEnv();
  const bilet = await biletAl(env);
  const res = await call('/api/itiraz', env, { token: bilet, body: { doc: DOC, onay: true } });
  ok('itiraz biletle gecer, biletsiz gecmez (kontrol)', res.status === 200, `status ${res.status}`);
  const res2 = await call('/api/itiraz', env, { body: { doc: DOC, onay: true } });
  ok('biletsiz itiraz 403', res2.status === 403, `status ${res2.status}`);
}

{
  const env = makeEnv({ ITIRAZ_OPEN: 'off' });
  const bilet = await biletAl(env);
  const res = await call('/api/itiraz', env, { token: bilet, body: { doc: DOC, onay: true } });
  ok('ITIRAZ_OPEN=off kapatiyor', res.status === 403, `status ${res.status}`);
  ok('kapaliyken corpus yazilmadi', env.CORPUS.writes.length === 0);
}

// ---- 5. no KV write anywhere without a TTL ---------------------------------------------------------

{
  const env = makeEnv();
  const bilet = await biletAl(env);
  await call('/api/ping', env, { body: { olay: 'analiz' } });
  await call('/api/stats', env, {});
  await call('/api/zaman-kalan', env, {});
  await call('/api/zaman', env, { body: { olgu: { gun: 30, mesaj: 400, kirilma_var: true } } });
  await call('/api/itiraz', env, { token: bilet, body: { doc: DOC, onay: true } });
  await call('/api/spiker', env, { token: bilet, body: { facts: { okumalar: [] }, doc: DOC } });

  const toplam = env.RATE_LIMIT.writes.length + env.CORPUS.writes.length;
  const kotu = ttlsizYazimlar(env);
  ok(`TTL siz KV yazimi = 0 (${toplam} yazim tarandi)`, kotu.length === 0, kotu.join(', '));
  ok('tarama bos degildi', toplam >= 5, `${toplam} yazim`);
}

console.log(fails ? `\n${fails} KAPI KIRMIZI` : '\nhepsi yesil');
process.exit(fails ? 1 : 0);
