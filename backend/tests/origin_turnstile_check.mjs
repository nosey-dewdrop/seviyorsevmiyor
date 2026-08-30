// Who is allowed to spend this account's key, and what is allowed to live forever in KV.
// Run: node backend/tests/origin_turnstile_check.mjs
//
// This imports the real worker module and calls its real fetch handler. Nothing about the gates is
// reimplemented here: the only things faked are the outside world (KV, Turnstile, Groq), because a
// test that mimics the worker would stay green while the worker rots.
//
// Thresholds (S2): foreign origin = 403 - own origin = 200 - KV writes without a TTL = 0 -
// ticketless /api/zaman = 403 even from the right origin - Groq calls out of a ticketless request
// = 0, counted separately for every route that spends the key.

import worker from '../worker.js';

let fails = 0;
const ok = (n, c, d = '') => {
  if (c) console.log(`ok  ${n}`);
  else { fails++; console.log(`*** ${n}${d ? '\n    ' + d : ''}`); }
};

// A block that throws used to take the rest of the file with it: the corpus-TTL assertion read
// `w.opts.expirationTtl` on a write recorded with no options, and the TypeError meant the headline
// gate below it never ran at all. Exit 1 came from the crash, not from a measurement. Now a throw
// is one red gate and the run continues to the end.
async function blok(ad, fn) {
  try { await fn(); } catch (e) { fails++; console.log(`*** ${ad} PATLADI\n    ${(e && e.stack) || e}`); }
}

const OWN = 'https://nosey-dewdrop.github.io';
const FOREIGN = 'https://kotu-site.example';

// Every route that can spend the Groq key. The ticket gate is measured once per route, not once
// per worker: /api/zaman sat outside it for a whole phase precisely because the suite only ever
// asked about /api/spiker.
const PARALI_YOLLAR = [
  { yol: '/api/zaman', govde: { olgu: { gun: 30, mesaj: 400, kirilma_var: true } } },
  { yol: '/api/spiker', govde: { sohbet: null, onay: true } },              // sohbet filled below
  { yol: '/api/itiraz', govde: { doc: null, hukum: 'flort_yok', karar: 'yanlis', onay: true } },
];

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
  const env = {
    RATE_LIMIT: kv,
    CORPUS: makeKV(),
    ALLOWED_ORIGINS: OWN,
    SPIKER_OPEN: 'on',
    ITIRAZ_OPEN: 'on',
    ...SIRLAR,
    ...over,
  };
  // `makeEnv({ CORPUS: undefined })` must actually remove the binding, the way an uncommented-out
  // wrangler.toml block does. Spreading undefined leaves the key present with value undefined,
  // which reads the same to the worker but not to Object.entries scans here.
  for (const [k, v] of Object.entries(env)) if (v === undefined) delete env[k];
  return env;
}

// Outside world. `turnstileOk` flips siteverify; Groq returns one valid spiker payload whose
// evidence quote really appears in the doc, so validateSpiker cannot drop it for the wrong reason.
let turnstileOk = true;
let turnstileCalls = 0;
let groqCalls = 0;

const DOC = 'SEN: bugun musait misin\nO: bakariz\nSEN: tamam o zaman\nO: hmm';
PARALI_YOLLAR[1].govde.sohbet = DOC;
PARALI_YOLLAR[2].govde.doc = DOC;

// Two short lines, one of them quoting a sentence that really is in DOC, so the worker's output
// filter cannot reject this for the wrong reason. What that filter does on a BAD answer is measured
// in train/llm_yol_check.mjs; here it only has to let a good one through.
const SPIKER_JSON = JSON.stringify({
  satirlar: ['"bakariz" kapiyi kapatiyor.', 'plan kuran hep ayni taraf.'],
});

// Three digit-free lines, so a legitimate /api/zaman call comes back ok:true rather than being
// rejected by zamanGecerli for the wrong reason.
const ZAMAN_METIN = 'cevaplar kisalmis.\nbekleme suresi uzamis.\nbaslatan taraf degismis.';

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
    const istek = String(init?.body || '');
    const icerik = istek.includes('sohbetin sayıları') ? ZAMAN_METIN : SPIKER_JSON;
    return new Response(JSON.stringify({ choices: [{ message: { content: icerik } }] }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  }
  throw new Error(`beklenmeyen dis cagri: ${u}`);
};

// ---- helpers ---------------------------------------------------------------------------------

function req(path, { origin = OWN, body = {}, method = 'POST', token = null, ip = '203.0.113.7' } = {}) {
  const headers = { 'content-type': 'application/json', 'cf-connecting-ip': ip };
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
      // Optional chaining on purpose: a write recorded with no options at all is exactly the
      // failure this function exists to report, so it must produce a finding, not a TypeError.
      if (!(w?.opts?.expirationTtl > 0)) hepsi.push(`${ad}.${w?.key}`);
    }
  }
  return hepsi;
}

// ---- 1. origin ---------------------------------------------------------------------------------

await blok('origin allowlist', async () => {
  const env = makeEnv();
  const yollar = ['/api/spiker', '/api/itiraz', '/api/zaman', '/api/ping', '/api/stats', '/api/bilet'];
  const kotu = [];
  const g = groqCalls;
  for (const y of yollar) {
    const res = await call(y, env, { origin: FOREIGN, body: { olay: 'analiz' } });
    if (res.status !== 403) kotu.push(`${y} -> ${res.status}`);
    if (res.headers.get('access-control-allow-origin')) kotu.push(`${y} CORS basligi sizdi`);
  }
  ok('yabanci origin her rotada 403', kotu.length === 0, kotu.join(', '));
  ok('yabanci origin Groq cagirmadi', groqCalls === g, `${groqCalls - g} cagri`);
  ok('yabanci origin hicbir sey yazmadi', ttlsizYazimlar(env).length === 0 && env.RATE_LIMIT.writes.length === 0,
    `${env.RATE_LIMIT.writes.length} yazim`);
});

await blok('origin yok', async () => {
  const env = makeEnv();
  const res = await call('/api/ping', env, { origin: '', body: { olay: 'analiz' } });
  ok('origin basligi yoksa 403', res.status === 403, `status ${res.status}`);
});

await blok('kendi origin', async () => {
  const env = makeEnv();
  const res = await call('/api/ping', env, { body: { olay: 'analiz' } });
  ok('kendi origin 200', res.status === 200, `status ${res.status}`);
  ok('kendi origin CORS basligi yildiz degil',
    res.headers.get('access-control-allow-origin') === OWN,
    String(res.headers.get('access-control-allow-origin')));
});

await blok('ALLOWED_ORIGINS bos', async () => {
  const env = makeEnv({ ALLOWED_ORIGINS: '' });
  const res = await call('/api/ping', env, { body: { olay: 'analiz' } });
  const d = await res.json();
  ok('ALLOWED_ORIGINS bossa 503 ve isim',
    res.status === 503 && d.eksik?.includes('ALLOWED_ORIGINS'), JSON.stringify(d));
});

await blok('preflight', async () => {
  const env = makeEnv();
  const res = await call('/api/spiker', env, { origin: FOREIGN, method: 'OPTIONS' });
  ok('yabanci origin preflight 403', res.status === 403, `status ${res.status}`);
  const res2 = await call('/api/spiker', env, { method: 'OPTIONS' });
  ok('kendi origin preflight gecer',
    res2.status === 200 && res2.headers.get('access-control-allow-origin') === OWN);
});

// ---- 2. turnstile + ticket -----------------------------------------------------------------------

await blok('bilet verilisi', async () => {
  const env = makeEnv();
  turnstileOk = true;
  const oncesi = turnstileCalls;
  const bilet = await biletAl(env);
  ok('bilet sunucuda siteverify cagiriyor', turnstileCalls === oncesi + 1);
  ok('bilet uc parcali imzali', typeof bilet === 'string' && bilet.split('.').length === 3, String(bilet));
});

await blok('turnstile basarisiz', async () => {
  const env = makeEnv();
  turnstileOk = false;
  const res = await call('/api/bilet', env, { body: { turnstile: 'sahte' } });
  ok('turnstile basarisiz ise bilet yok 403', res.status === 403, `status ${res.status}`);
  turnstileOk = true;
});

await blok('turnstile cevabi yok', async () => {
  const env = makeEnv();
  const res = await call('/api/bilet', env, { body: {} });
  ok('turnstile cevabi olmadan 403', res.status === 403, `status ${res.status}`);
});

// ---- 2b. THE gate of this phase: every budget route is its own door -------------------------------
//
// One loop, one route at a time, three measurements each: a request with the right origin and no
// ticket is refused, the refusal is 403, and zero Groq calls came out of it. /api/zaman is in this
// list because it was NOT: it answered 200 and spent the key with nothing but a forged Origin
// header, which is one line to write outside a browser.

for (const { yol, govde } of PARALI_YOLLAR) {
  await blok(`biletsiz ${yol}`, async () => {
    const env = makeEnv();
    const ts = turnstileCalls;
    const g = groqCalls;
    const res = await call(yol, env, { body: govde });        // own origin, NO ticket
    ok(`biletsiz ${yol} 403 (origin dogru olsa bile)`, res.status === 403, `status ${res.status}`);
    ok(`biletsiz ${yol} Groq cagirmadi`, groqCalls === g, `${groqCalls - g} cagri`);
    ok(`biletsiz ${yol} turnstile hic cozulmedi`, turnstileCalls === ts, `${turnstileCalls - ts} cozum`);
  });

  await blok(`sahte biletli ${yol}`, async () => {
    const env = makeEnv();
    const g = groqCalls;
    const res = await call(yol, env, {
      token: `${Date.now() + 60000}.abcdef12.` + 'f'.repeat(64),
      body: govde,
    });
    ok(`sahte imzali bilet ${yol} 403`, res.status === 403, `status ${res.status}`);
    ok(`sahte biletli ${yol} Groq cagirmadi`, groqCalls === g, `${groqCalls - g} cagri`);
  });

  await blok(`suresi gecmis biletli ${yol}`, async () => {
    const env = makeEnv();
    const bilet = await biletAl(env);
    const [, nonce, imza] = bilet.split('.');
    const res = await call(yol, env, { token: `${Date.now() - 1000}.${nonce}.${imza}`, body: govde });
    ok(`suresi gecmis bilet ${yol} 403`, res.status === 403, `status ${res.status}`);
  });
}

// The positive half: with a real ticket each budget route works, so the gate above is refusing
// intruders rather than refusing everyone. A gate that says 403 to valid traffic too is not a gate.
await blok('gecerli bilet + spiker', async () => {
  const env = makeEnv();
  const bilet = await biletAl(env);
  const g = groqCalls;
  const res = await call('/api/spiker', env, { token: bilet, body: { sohbet: DOC, onay: true } });
  const d = await res.json();
  ok('gecerli bilet + kendi origin = 200', res.status === 200, `status ${res.status} ${JSON.stringify(d)}`);
  ok('gecerli istek Groq a ulasti', groqCalls === g + 1);
  ok('spiker govdesi geldi', Array.isArray(d.spiker?.satirlar) && d.spiker.satirlar.length > 0,
    JSON.stringify(d).slice(0, 200));
});

await blok('gecerli bilet + zaman', async () => {
  const env = makeEnv();
  const bilet = await biletAl(env);
  const g = groqCalls;
  const res = await call('/api/zaman', env, {
    token: bilet, body: { olgu: { gun: 30, mesaj: 400, kirilma_var: true } },
  });
  const d = await res.json();
  ok('gecerli biletli zaman 200', res.status === 200, `status ${res.status}`);
  ok('gecerli biletli zaman Groq a ulasti', groqCalls === g + 1, `${groqCalls - g} cagri`);
  ok('zaman satirlari geldi', d.ok === true && d.satirlar?.length === 3, JSON.stringify(d).slice(0, 200));
  ok('zaman kotasi bir dustu', d.kalan === d.gunluk - 1, `kalan ${d.kalan} / ${d.gunluk}`);
});

// /api/zaman-kalan reads the counter and spends nothing, so it stays ticket-free on purpose: the
// page must be able to show an honest number before the visitor decides to spend a slot.
await blok('zaman-kalan biletsiz okunur', async () => {
  const env = makeEnv();
  const g = groqCalls;
  const res = await call('/api/zaman-kalan', env, {});
  const d = await res.json();
  ok('biletsiz zaman-kalan 200 (para harcamiyor)', res.status === 200, `status ${res.status}`);
  ok('zaman-kalan Groq cagirmiyor', groqCalls === g, `${groqCalls - g} cagri`);
  ok('zaman-kalan gercek sayi veriyor', d.kalan === d.gunluk, JSON.stringify(d));
});

// ---- 3. missing secrets: fail closed by name, EXCEPT the one case the product needs open ------
//
// The rule changed on 30 Ağu with the flow itself. TURNSTILE_SECRET is one half of a pair: the
// other half is TURNSTILE_SITEKEY in web/js/api.js, and with the site key empty there is no
// challenge for the page to solve. Demanding a ticket in that state does not protect /api/spiker,
// it closes it — which is the state the live site actually shipped in, with the main flow dark.
//
// So the ticket gate now switches itself on WITH the secret, and only on /api/spiker:
//   TURNSTILE_SECRET set   -> ticket demanded on every budget route (measured in section 2b above)
//   TURNSTILE_SECRET unset -> /api/bilet, /api/itiraz and /api/zaman still 503 by name, and
//                             /api/spiker runs ticketless behind the origin allowlist and quotas.
// BILET_SECRET is unchanged: with a ticket gate active, a missing signing key is a 503 by name.

for (const yol of ['/api/bilet', '/api/itiraz', '/api/zaman']) {
  await blok(`TURNSTILE_SECRET yok ${yol}`, async () => {
    const env = makeEnv({ TURNSTILE_SECRET: undefined });
    const g = groqCalls;
    const res = await call(yol, env, { body: { turnstile: 'x' } });
    const d = await res.json();
    ok(`TURNSTILE_SECRET yoksa ${yol} 503 ve adiyla soyluyor`,
      res.status === 503 && d.eksik?.includes('TURNSTILE_SECRET'), `status ${res.status} ${JSON.stringify(d)}`);
    ok(`TURNSTILE_SECRET yokken ${yol} Groq cagirmadi`, groqCalls === g, `${groqCalls - g} cagri`);
  });
}

for (const yol of ['/api/bilet', '/api/spiker', '/api/itiraz', '/api/zaman']) {
  await blok(`BILET_SECRET yok ${yol}`, async () => {
    const env = makeEnv({ BILET_SECRET: undefined });
    const g = groqCalls;
    const res = await call(yol, env, { body: { turnstile: 'x' } });
    const d = await res.json();
    ok(`BILET_SECRET yoksa ${yol} 503 ve adiyla soyluyor`,
      res.status === 503 && d.eksik?.includes('BILET_SECRET'), `status ${res.status} ${JSON.stringify(d)}`);
    ok(`BILET_SECRET yokken ${yol} Groq cagirmadi`, groqCalls === g, `${groqCalls - g} cagri`);
  });
}

await blok('TURNSTILE_SECRET yok /api/spiker: bilet istenmiyor ama kapi bos kalmiyor', async () => {
  const env = makeEnv({ TURNSTILE_SECRET: undefined });
  const g = groqCalls;
  // no ticket header at all, and it has to work: this is production today
  const res = await call('/api/spiker', env, { body: { sohbet: DOC, onay: true } });
  ok('biletsiz spiker 200 (sitekey yokken yol acik)', res.status === 200, `status ${res.status}`);
  ok('istek gercekten Groq a ulasti', groqCalls === g + 1, `${groqCalls - g} cagri`);

  // ...but only the doors that were never about tickets are still doing the work
  const g2 = groqCalls;
  const yabanci = await call('/api/spiker', env, { origin: FOREIGN, body: { sohbet: DOC, onay: true } });
  ok('bilet kalksa da yabanci origin hala 403', yabanci.status === 403, `status ${yabanci.status}`);
  const onaysiz = await call('/api/spiker', env, { body: { sohbet: DOC } });
  ok('bilet kalksa da onaysiz istek 400', onaysiz.status === 400, `status ${onaysiz.status}`);
  ok('bu iki ret Groq a hic gitmedi', groqCalls === g2, `${groqCalls - g2} cagri`);

  // and the quota is what bounds a stranger now, so it has to actually bite
  let ret = 0;
  for (let i = 0; i < 12; i++) {
    const r = await call('/api/spiker', env, { body: { sohbet: DOC, onay: true }, ip: '198.51.100.5' });
    if (r.status === 429) ret++;
  }
  ok('biletsiz yolda kota hala reddediyor (tek IP dakikada 6)', ret > 0, `${ret} ret / 12 istek`);
});

// ---- 4. itiraz: ticket, kill switch, retention ----------------------------------------------------

await blok('itiraz carki', async () => {
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
  // Order matters: "is there a TTL at all" is asked BEFORE "is the TTL short enough", because the
  // second question cannot be asked of a write that has no options object. Both use optional
  // chaining so a bare write is reported as red instead of crashing the run.
  ok('corpus anahtarinda expirationTtl var',
    yaz.length > 0 && yaz.every((w) => w?.opts?.expirationTtl > 0),
    JSON.stringify(yaz.map((w) => w?.opts ?? null)));
  ok('corpus saklama suresi bir yili gecmiyor',
    yaz.length > 0 && yaz.every((w) => (w?.opts?.expirationTtl ?? Infinity) <= 60 * 60 * 24 * 366),
    String(yaz[0]?.opts?.expirationTtl));
});

await blok('itiraz bilet kontrolu', async () => {
  const env = makeEnv();
  const bilet = await biletAl(env);
  const res = await call('/api/itiraz', env, { token: bilet, body: { doc: DOC, onay: true } });
  ok('itiraz biletle gecer, biletsiz gecmez (kontrol)', res.status === 200, `status ${res.status}`);
  const res2 = await call('/api/itiraz', env, { body: { doc: DOC, onay: true } });
  ok('biletsiz itiraz 403', res2.status === 403, `status ${res2.status}`);
});

await blok('ITIRAZ_OPEN kapali', async () => {
  const env = makeEnv({ ITIRAZ_OPEN: 'off' });
  const bilet = await biletAl(env);
  const res = await call('/api/itiraz', env, { token: bilet, body: { doc: DOC, onay: true } });
  ok('ITIRAZ_OPEN=off kapatiyor', res.status === 403, `status ${res.status}`);
  ok('kapaliyken corpus yazilmadi', env.CORPUS.writes.length === 0);
});

// The CORPUS binding is still commented out in wrangler.toml, so this is the production shape.
// The old code fell back to RATE_LIMIT here and said nothing, which meant donated conversations
// were sitting in the rate-counter namespace with no way to notice from outside.
await blok('CORPUS binding yok', async () => {
  const env = makeEnv({ CORPUS: undefined });
  const bilet = await biletAl(env);
  const res = await call('/api/itiraz', env, { token: bilet, body: { doc: DOC, onay: true } });
  const d = await res.json();
  ok('CORPUS yoksa itiraz 503 ve binding i adiyla soyluyor',
    res.status === 503 && d.eksik?.includes('CORPUS'), `status ${res.status} ${JSON.stringify(d)}`);
  ok('CORPUS yokken rate-limit namespace ine korpus dusmedi',
    env.RATE_LIMIT.writes.every((w) => !String(w.key).startsWith('corpus:')),
    env.RATE_LIMIT.writes.map((w) => w.key).join(', '));
});

// ---- 5. no KV write anywhere without a TTL ---------------------------------------------------------

await blok('TTL taramasi', async () => {
  const env = makeEnv();
  const bilet = await biletAl(env);
  await call('/api/ping', env, { body: { olay: 'analiz' } });
  await call('/api/stats', env, {});
  await call('/api/zaman-kalan', env, {});
  await call('/api/zaman', env, { token: bilet, body: { olgu: { gun: 30, mesaj: 400, kirilma_var: true } } });
  await call('/api/itiraz', env, { token: bilet, body: { doc: DOC, onay: true } });
  await call('/api/spiker', env, { token: bilet, body: { sohbet: DOC, onay: true } });

  const toplam = env.RATE_LIMIT.writes.length + env.CORPUS.writes.length;
  const kotu = ttlsizYazimlar(env);
  ok(`TTL siz KV yazimi = 0 (${toplam} yazim tarandi)`, kotu.length === 0, kotu.join(', '));
  ok('tarama bos degildi', toplam >= 5, `${toplam} yazim`);
  ok('zaman gun sayaci gercekten yazildi',
    env.RATE_LIMIT.writes.some((w) => w.key.startsWith('zaman:gun:')),
    env.RATE_LIMIT.writes.map((w) => w.key).join(', '));
});

// ---- 6. the client half: zamanBulut.js must carry a ticket too -------------------------------
//
// Closing the route on the server is only half the job — if the page kept calling /api/zaman bare,
// the main live flow would just start returning 403 to real visitors. The real module is imported
// and driven here, not read as text.

await blok('istemci: biletsiz zaman cagrisi', async () => {
  const gercekFetch = globalThis.fetch;
  const cagrilar = [];
  globalThis.fetch = async (u, init) => { cagrilar.push({ u: String(u), init }); return gercekFetch(u, init); };
  try {
    const { bulutYaz } = await import('../../web/js/zamanBulut.js?v=72');
    const sahteSonuc = {
      summary: { spanDays: 30, messages: 400, sessions: 40, A: { starts: 10, nightMessages: 5 }, B: { nightMessages: 5 }, longestSilenceMin: 1440 },
      latency: { A: { median: 5 }, B: { median: 50 }, asymmetry: { different: true, ratio: 1 } },
      points: [], joint: null,
    };
    const out = await bulutYaz(sahteSonuc, 2000);
    const zamanCagrilari = cagrilar.filter((c) => c.u.includes('/api/zaman') && !c.u.includes('kalan'));
    // No sitekey configured => no Turnstile => no ticket => the client must not reach the route at
    // all. Silence here is the point: an unticketed call would be a guaranteed 403 for a real user.
    ok('istemci bilet alamayinca /api/zaman a hic gitmiyor', zamanCagrilari.length === 0,
      `${zamanCagrilari.length} cagri`);
    ok('bilet yoksa bulutYaz null donuyor (sayfa yazi defterine dusuyor)', out === null, JSON.stringify(out));
  } finally {
    globalThis.fetch = gercekFetch;
  }
});

// Source-level, and labelled as such: the assertion above cannot observe the header itself, because
// with an empty TURNSTILE_SITEKEY the request is never built. This checks the header is wired and
// that zamanBulut did not grow its own second copy of the ticket logic.
await blok('istemci: kaynak kontrolu', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../../web/js/zamanBulut.js', import.meta.url), 'utf8');
  ok('zamanBulut /api/zaman isteginde x-app-token yolluyor', /'x-app-token':\s*token/.test(src));
  ok('zamanBulut bileti api.js ten aliyor, kopyalamiyor',
    /import\s*\{[^}]*biletAl[^}]*\}\s*from\s*'\.\/api\.js/.test(src)
    && !/siteverify|turnstile\.render|\/api\/bilet/.test(src));
});

console.log(fails ? `\n${fails} KAPI KIRMIZI` : '\nhepsi yesil');
process.exit(fails ? 1 : 0);
