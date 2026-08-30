// Cloudflare Worker — seviyorsevmiyor API.
//
// /api/spiker : THE CONVERSATION ARRIVES HERE. With the visitor's explicit consent, the chat is
//               forwarded to Groq (Llama), which reads it and returns a short reading. Nothing is
//               stored: the text lives in this request and dies with it, no KV write touches it.
// /api/zaman  : the time engine's optional voice — derived numbers only, never messages.
// /api/itiraz : consented donation of a disputed reading — twelve model features, not the chat.
//
// Why /api/spiker changed (30 Ağu, product owner's call): the old design sent fifteen counts and
// asked a model to voice them. A model handed fifteen numbers can only write templates, and the
// counter behind those numbers was inventing verdicts out of word frequencies. So the text goes,
// and what guards it is CONSENT plus a hard output filter, not a shape filter on the request body.
//
// Three things this route refuses, and each of them is measured by train/llm_yol_check.mjs:
//   1. onay !== true            -> 400, and no call is made. Consent is the gate, not the checkbox.
//   2. a figure in the output   -> rejected. Every number on screen is put there by the engine.
//   3. an unverifiable quote    -> rejected. A quotation is searched for in the chat that was sent
//                                 with this very request; a URL or an export system line is never
//                                 an allowed quotation even when it does appear.
//
// KV holds per-IP rate counters and the numeric feature vectors of donated hard cases, all with a
// TTL. The conversation is in none of them.
//
// Deploy:  npx wrangler deploy
// Secrets: npx wrangler secret put GROQ_API_KEY     (console.groq.com, free)

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const TURNSTILE_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// Every KV write carries a TTL. Nothing this worker stores is allowed to live forever, and what
// lands in `corpus:` is a feature vector plus a verdict key — no conversation. Numbers are seconds.
const TTL = {
  corpus: 60 * 60 * 24 * 180,   // 180 days: long enough to retrain on, short enough to defend
  stat: 60 * 60 * 24 * 400,
  zamanGun: 60 * 60 * 30,
  statsOnbellek: 60 * 10,       // backstop only; freshness is decided by the timestamp inside
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('origin') || '';
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';

    // ---- gate 1: origin -----------------------------------------------------------------------
    // The old worker answered `Access-Control-Allow-Origin: *`, which is not a rate-limit problem
    // but an ownership problem: any page anywhere could spend this account's Groq key. The
    // allowlist is configuration, so a missing/empty one is a misconfiguration and the worker says
    // so by name instead of falling back to "open".
    const izinli = izinliOriginler(env);
    if (!izinli.length) {
      return json({ error: 'Sunucu yapilandirilmadi', eksik: ['ALLOWED_ORIGINS'] }, 503, '');
    }
    if (!izinli.includes(origin)) {
      // No CORS header on this path on purpose: the browser must not be able to read the body.
      return json({ error: 'Origin not allowed' }, 403, '');
    }
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors(origin) });

    try {
      if (request.method !== 'POST') return json({ error: 'Not found' }, 404, origin);
      const len = parseInt(request.headers.get('content-length') || '0');
      if (len > 60_000) return json({ error: 'Conversation too large' }, 413, origin);

      // ---- gate 2: hand out a short-lived ticket for a solved Turnstile challenge --------------
      // The widget alone protects nothing; an attacker POSTs straight at the endpoint. So the
      // Turnstile response is verified HERE, server side, and what the client gets back is our own
      // HMAC ticket with a five minute life. The expensive routes accept the ticket, not the widget.
      if (url.pathname === '/api/bilet') {
        const eksik = eksikSirlar(env);
        if (eksik.length) return json({ error: 'Sunucu yapilandirilmadi', eksik }, 503, origin);
        if (await limited(env, `b:${ip}`, 20, 120)) {
          return json({ error: 'Rate limit exceeded' }, 429, origin);
        }
        const b = await request.json().catch(() => ({}));
        const cevap = typeof b.turnstile === 'string' ? b.turnstile : '';
        if (!cevap) return json({ error: 'Turnstile cevabi yok' }, 403, origin);
        if (!(await siteverify(env, cevap, ip))) {
          return json({ error: 'Turnstile dogrulanmadi' }, 403, origin);
        }
        return json({ bilet: await biletVer(env), omur_sn: BILET_OMUR_SN }, 200, origin);
      }

      // fire-and-forget counters: no content, no identity, daily totals only (Faz 1 metrics)
      if (url.pathname === '/api/ping') {
        if (await limited(env, `p:${ip}`, 30, 120)) return json({ ok: true }, 200, origin);
        const b = await request.json().catch(() => ({}));
        if (PING_EVENTS.includes(b.olay)) await bump(env, b.olay);
        return json({ ok: true }, 200, origin);
      }

      // public read-only counts (the panel).
      //
      // This route used to be the cheapest way to kill the whole site. It took no ticket, no
      // counter and no cache, and every call fanned out into 14 days x 6 events = 84 KV reads.
      // Measured: 50 calls from one IP = 4200 reads and not one refusal, so ~1200 calls exhaust the
      // free tier's 100k daily reads — and because the rate limiter lives in the SAME namespace,
      // the site does not lose its panel, it loses its doors.
      //
      // Chosen door: QUOTA + CACHE, not a ticket. A ticket costs a Turnstile solve, and the only
      // caller is web/panel.html, a plain page that posts here with no ticket and which this phase
      // is not allowed to edit — a ticket gate would close the panel instead of protecting it. The
      // panel is also read-only and content-free, so what it needs is a ceiling, not an identity.
      // Quota bounds how many times a stranger may ask; the cache bounds what one ask costs.
      if (url.pathname === '/api/stats') {
        if (await limited(env, `st:${ip}`, STATS_IP_DAKIKA, 120)
          || await limited(env, `stgun:${ip}`, STATS_IP_GUNLUK, 90000)) {
          return json({ error: 'Rate limit exceeded' }, 429, origin);
        }
        return json(await statsOku(env), 200, origin);
      }

      // how many cloud-written readings are left today. reading this does NOT spend one, so the
      // page can show an honest number before the user decides.
      if (url.pathname === '/api/zaman-kalan') {
        return json({ kalan: await zamanKalan(env), gunluk: ZAMAN_GUNLUK }, 200, origin);
      }

      // the time engine's optional voice. facts only, never messages.
      // This spends the Groq key, so it is a ticket route like the other two. Origin alone is not a
      // gate: a header is one line to forge outside a browser, and this is the live main flow, so
      // the whole ZAMAN_GUNLUK budget was a stranger's to burn. Turnstile must be solved first.
      if (url.pathname === '/api/zaman') {
        const red = await biletKapisi(env, request, origin);
        if (red) return red;
        return handleZaman(request, env, ip, origin);
      }

      // consented hard-case donation: user pressed "yanlış okudun" AND approved donating this
      // reading. What is stored is the numeric feature vector the model trains on plus the verdict
      // that was disputed. The chat is not in the request and is not in KV. It keeps its own kill
      // switch, its own retention window and the ticket gate anyway, because a donated row is
      // still a donated row.
      if (url.pathname === '/api/itiraz') {
        if (env.ITIRAZ_OPEN !== 'on') return json({ error: 'Itiraz is not open' }, 403, origin);
        const red = await biletKapisi(env, request, origin);
        if (red) return red;
        if (!korpusKV(env)) {
          return json({ error: 'Sunucu yapilandirilmadi', eksik: ['CORPUS'] }, 503, origin);
        }
        if (await limited(env, `i:${ip}`, 5, 120) || await limited(env, `iday:${ip}`, 20, 90000)) {
          return json({ error: 'Rate limit exceeded' }, 429, origin);
        }
        const b = await request.json().catch(() => ({}));
        if (b.onay !== true) return json({ error: 'Invalid request' }, 400, origin);
        // b.doc is deliberately not read. Old clients may still send one; it is dropped here and
        // never reaches KV, so a stale cached page cannot reopen content storage on its own.
        const kayit = {
          olgu: olguTemiz(b.olgu),
          hukum: anahtarTemiz('hukum', b.hukum),
          karar: anahtarTemiz('karar', b.karar),
          ts: Date.now(),
        };
        // Donated rows do not belong in the rate-limit namespace; the check above already
        // refused the request if CORPUS is absent. Every write carries the retention window.
        await korpusKV(env).put(`corpus:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
          JSON.stringify(kayit), { expirationTtl: TTL.corpus });
        await bump(env, 'itiraz_bagis');
        return json({ ok: true }, 200, origin);
      }

      if (url.pathname === '/api/spiker') {
        if (env.SPIKER_OPEN !== 'on') return json({ error: 'Spiker is not open yet' }, 403, origin);
        // The ticket gate turns itself on with the secret. With TURNSTILE_SECRET unset there is no
        // challenge for the page to solve, so demanding a ticket would not protect this route, it
        // would close it — which is exactly the state the site shipped in. The origin allowlist
        // above and the three quotas below are unaffected and still apply either way.
        if (env.TURNSTILE_SECRET) {
          const red = await biletKapisi(env, request, origin);
          if (red) return red;
        }
        // Fuses: per-IP per-minute, per-IP per-day, and a global daily cap on the free key.
        if (await limited(env, `smin:${ip}`, 6, 120) || await limited(env, `sday:${ip}`, 60, 90000)) {
          return json({ error: 'Rate limit exceeded. Please wait.' }, 429, origin);
        }
        // 900, not 2000: the Groq free tier is 1000 requests a day, so the old cap sat above the
        // thing it was supposed to protect.
        if (await limited(env, 'sglobal', SPIKER_GLOBAL_GUNLUK, 90000)) {
          return json({ error: 'Daily capacity reached' }, 429, origin);
        }
        return handleSpiker(request, env, origin);
      }

      return json({ error: 'Not found' }, 404, origin);
    } catch {
      return json({ error: 'Internal error' }, 500, origin);
    }
  },
};

const SPIKER_GLOBAL_GUNLUK = 900;
const BILET_OMUR_SN = 300;

function izinliOriginler(env) {
  return String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
}

// Corpus lives in its own namespace, full stop. The old fallback to RATE_LIMIT meant that in
// production — where the binding is still commented out in wrangler.toml — donated conversations
// were quietly landing in the rate-counter namespace and nobody could tell from the outside. A
// missing binding is a misconfiguration, so it is named like every other one instead of papered
// over: no CORPUS, no donation, and the response says which binding is absent.
function korpusKV(env) { return env.CORPUS || null; }

// Named, not boolean: a 503 that says which secret is missing is a bug report. A worker that
// quietly stays open because a secret was never set is the failure this phase exists to remove.
function eksikSirlar(env) {
  return ['TURNSTILE_SECRET', 'BILET_SECRET'].filter((ad) => !env[ad]);
}

async function siteverify(env, cevap, ip) {
  try {
    const form = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: cevap });
    if (ip && ip !== 'unknown') form.set('remoteip', ip);
    const res = await fetch(TURNSTILE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data?.success === true;
  } catch {
    return false;
  }
}

// ---- our own ticket: exp + nonce + HMAC-SHA256, verified in constant time ---------------------

async function hmac(secret, mesaj) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(mesaj));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function biletVer(env) {
  const son = Date.now() + BILET_OMUR_SN * 1000;
  const nonce = crypto.randomUUID().slice(0, 8);
  const govde = `${son}.${nonce}`;
  return `${govde}.${await hmac(env.BILET_SECRET, govde)}`;
}

function esit(a, b) {
  if (a.length !== b.length) return false;
  let fark = 0;
  for (let i = 0; i < a.length; i++) fark |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return fark === 0;
}

async function biletGecerli(env, bilet) {
  if (typeof bilet !== 'string') return false;
  const parca = bilet.split('.');
  if (parca.length !== 3) return false;
  const [sonStr, nonce, imza] = parca;
  const son = parseInt(sonStr, 10);
  if (!Number.isFinite(son) || Date.now() > son) return false;
  if (son > Date.now() + (BILET_OMUR_SN + 60) * 1000) return false;   // no far-future tickets
  if (!/^[a-z0-9-]{4,36}$/i.test(nonce)) return false;
  return esit(imza, await hmac(env.BILET_SECRET, `${sonStr}.${nonce}`));
}

async function biletKapisi(env, request, origin) {
  const eksik = eksikSirlar(env);
  if (eksik.length) return json({ error: 'Sunucu yapilandirilmadi', eksik }, 503, origin);
  const bilet = request.headers.get('x-app-token') || '';
  if (!(await biletGecerli(env, bilet))) return json({ error: 'Bilet gecersiz' }, 403, origin);
  return null;
}

const PING_EVENTS = ['analiz', 'spiker', 'paylasim', 'itiraz', 'zaman'];

async function bump(env, olay) {
  const day = new Date().toISOString().slice(0, 10);
  const key = `stat:${olay}:${day}`;
  const cur = parseInt((await env.RATE_LIMIT?.get(key)) || '0');
  await env.RATE_LIMIT?.put(key, String(cur + 1), { expirationTtl: TTL.stat });
}

// The panel's ceiling. A human reading a counter page refreshes a handful of times; ten a minute
// and a hundred and twenty a day is far above that and far below anything that costs money.
const STATS_IP_DAKIKA = 10;
const STATS_IP_GUNLUK = 120;
// How stale a daily counter is allowed to be. Five minutes on a table of DAILY totals is invisible
// to the reader and turns 84 reads per view into 84 reads per five minutes for the whole planet.
const STATS_ONBELLEK_SN = 300;
const STATS_ONBELLEK_ANAHTAR = 'stats:onbellek';

// One served request now costs three reads (two counters + the cache) instead of eighty-four.
// The 84-read fan-out still happens, but at most once per STATS_ONBELLEK_SN across all callers.
async function statsOku(env) {
  const ham = await env.RATE_LIMIT?.get(STATS_ONBELLEK_ANAHTAR);
  if (ham) {
    try {
      const p = JSON.parse(ham);
      if (p && p.veri && Number.isFinite(p.ts) && Date.now() - p.ts < STATS_ONBELLEK_SN * 1000) {
        return p.veri;
      }
    } catch { /* a corrupt cache is a cache miss, never an error the visitor sees */ }
  }
  const veri = await readStats(env);
  await env.RATE_LIMIT?.put(STATS_ONBELLEK_ANAHTAR, JSON.stringify({ ts: Date.now(), veri }),
    { expirationTtl: TTL.statsOnbellek });
  return veri;
}

async function readStats(env) {
  const out = {};
  const days = [];
  for (let i = 0; i < 14; i++) days.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
  for (const olay of [...PING_EVENTS, 'itiraz_bagis']) {
    out[olay] = {};
    for (const day of days) {
      const v = await env.RATE_LIMIT?.get(`stat:${olay}:${day}`);
      if (v) out[olay][day] = parseInt(v);
    }
  }
  return out;
}

async function limited(env, keyBase, max, ttl) {
  const bucket = ttl > 1000 ? Math.floor(Date.now() / 86400000) : Math.floor(Date.now() / 60000);
  const key = `${keyBase}:${bucket}`;
  const cur = parseInt((await env.RATE_LIMIT?.get(key)) || '0');
  if (cur >= max) return true;
  await env.RATE_LIMIT?.put(key, String(cur + 1), { expirationTtl: ttl });
  return false;
}

// ---- /api/zaman — the time engine's optional voice ------------------------------------------
//
// The page always works without this. The on-device engine produces the verdict and a shipped
// phrasebook produces the wording, so a reading is complete before this endpoint is ever called.
// What this adds is freshness: a line written for THIS chat rather than picked from four variants.
//
// It is capped on purpose and the cap is stated on the page. The free tier gives 100k tokens a day,
// which is why an uncapped cloud path would return 429 to everyone within the first viral hour
// instead of degrading. Capped, the first hundred readings of the day get a written line and the
// rest get the phrasebook, which is a worse sentence rather than a broken page.
//
// Two hard rules, both enforced here rather than trusted:
//   1. only derived numbers arrive. no message text, ever. anything that looks like prose is rejected.
//   2. the model may not write digits. every figure on screen is injected by the engine, so an
//      invented number cannot reach the user. this is the same failure the live spiker had when it
//      quoted lines that were never in the chat.

const ZAMAN_GUNLUK = 100;      // global readings per day
const ZAMAN_IP_GUNLUK = 3;     // per person per day, so one visitor cannot drain the pool
const ZAMAN_MAX_BYTES = 2000;

async function zamanKalan(env) {
  const day = new Date().toISOString().slice(0, 10);
  const used = parseInt((await env.RATE_LIMIT?.get(`zaman:gun:${day}`)) || '0');
  return Math.max(0, ZAMAN_GUNLUK - used);
}

// Facts must be a small, flat, numeric object. This is the wall on the two routes that still carry
// nothing but numbers: /api/zaman (the time flow) and /api/itiraz (a donated row that lives in KV
// for months). /api/spiker is deliberately NOT behind it any more — that route carries the chat on
// purpose now, and what guards it is consent plus the output filter further down, not this shape
// test.
//
// The string rule used to ask how LONG a value was: up to 40 characters, no whitespace. That is a
// question about shape, and shape says nothing about content. `zurnabalik_kanarya_7719` is a legal
// value under every length rule and under no value rule, so twenty-four enum slots at forty
// characters each were roughly 960 bytes of caller-chosen text per request, riding unaudited into
// the Groq prompt and, on /api/itiraz, into a KV row with a 180-day life. The real client never put
// anything but engine enums there; the server had no way to tell, which is the whole problem.
//
// So the question is now "is this one of OUR values?" and the answer is a closed list. A value that
// is not on its field's list drops the field. The lists are the engine's own vocabularies:
//   hukum       web/js/reveal.js  TONE_TR
//   karar       web/js/reveal.js  flört kararı
//   degisenler  web/js/time/signals.js series keys, with the _A/_B side stripped
// web/js/api.js carries the same lists and train/bulut_check_eski.mjs compares the two files, so
// they cannot drift apart quietly. The `hukum_tur` / `flort_karar` slots are gone with the spiker
// payload that used them: a list nothing sends is a list nobody maintains.
const ENUM_DEGERLER = {
  hukum: ['flirty', 'friendly', 'cold', 'tense', 'onesided'],
  karar: ['var', 'yok', 'tek'],
};
// The time flow sends `degisenler: "gecikme,sessizlik"`, a joined list. Each part is checked
// against the list, and the value that survives is rebuilt from the parts rather than echoed back,
// so a repeated part cannot inflate the field past six concepts.
const KAVRAMLAR = ['gecikme', 'baslatma', 'bitiren', 'uzunluk', 'gece', 'sessizlik'];

function anahtarTemiz(alan, v) {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t || t.length > 200) return null;
  if (alan === 'degisenler') {
    const parca = [...new Set(t.split(','))].filter(Boolean);
    if (!parca.length || parca.some((p) => !KAVRAMLAR.includes(p))) return null;
    return parca.join(',');
  }
  const izin = ENUM_DEGERLER[alan];
  // A string slot with no list behind it cannot be checked, so it is not a slot: drop it.
  if (!izin) return null;
  return izin.includes(t) ? t : null;
}
function olguTemiz(f) {
  if (!f || typeof f !== 'object' || Array.isArray(f)) return null;
  const out = {};
  let n = 0;
  for (const [k, v] of Object.entries(f)) {
    if (++n > 24) break;
    if (!/^[a-zA-Z_]{1,24}$/.test(k)) continue;
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = Math.round(v * 100) / 100;
    else if (typeof v === 'boolean') out[k] = v;
    else {
      // strings are allowed only as a value from that field's closed list, never as content
      const a = anahtarTemiz(k, v);
      if (a !== null) out[k] = a;
    }
  }
  return Object.keys(out).length ? out : null;
}

const ZAMAN_SYSTEM = `sen bir sohbet analiz motorunun sesisin. sana bir sohbetin SAYILARI veriliyor, mesajları değil.

görevin: bu sayılara bakıp üç kısa cümle yazmak.

ton (theyseeyourphotos):
- mesafeli, gözlemci, biraz ürkütücü bir üçüncü göz. dışarıdan bakıyorsun ve gördüğünü soğukkanlılıkla söylüyorsun.
- "kanka", "aga", "dostum" gibi samimi hitap YOK. şaka YOK. teselli YOK. öğüt YOK.
- ağırlıkla insanlar hakkında konuş, okuyucuya "sen" deme.
- küçük harfle yaz. kısa cümleler. süs yok, metafor yok, slogan yok.
- soru cümlesi kurarsan "?" ile bitir.

mutlak kurallar:
- RAKAM YAZMA. hiçbir sayı, yüzde, tarih, saat yazma. sayıları ekrana motor kendisi basıyor.
- alıntı uydurma. elinde mesaj yok, sohbetten cümle biliyormuş gibi yapma.
- nedensellik kurma. "aldatıyor", "biriyle tanıştı", "senden sıkıldı" gibi şeyler yazma. sadece görüneni söyle.
- her cümle 12 kelimeyi geçmesin.

çıktı: sadece üç satır, her satır bir cümle, numaralandırma yok, tırnak yok.`;

// A single digit in the output means the model tried to state a figure of its own, and that figure
// was not measured by anything. Reject the whole reading rather than repair it.
function zamanGecerli(satirlar) {
  if (!Array.isArray(satirlar) || satirlar.length < 2) return null;
  const temiz = [];
  for (const s of satirlar.slice(0, 3)) {
    if (typeof s !== 'string') return null;
    const t = s.trim().replace(/^[-*\d.)\s]+/, '');
    if (!t || t.length > 140) return null;
    if (/[0-9٠-٩]/.test(t)) return null;
    if (/(kanka|aga|reis|dostum|moruk)/i.test(t)) return null;
    if (/["“”«»]/.test(t)) return null;
    temiz.push(t);
  }
  return temiz.length >= 2 ? temiz : null;
}

async function handleZaman(request, env, ip, origin) {
  const day = new Date().toISOString().slice(0, 10);
  const kalan = await zamanKalan(env);
  if (kalan <= 0) return json({ ok: false, sebep: 'gunluk_doldu', kalan: 0, gunluk: ZAMAN_GUNLUK }, 200, origin);
  if (await limited(env, `zip:${ip}`, ZAMAN_IP_GUNLUK, 90000)) {
    return json({ ok: false, sebep: 'kisi_kotasi', kalan, gunluk: ZAMAN_GUNLUK }, 200, origin);
  }

  const body = await request.json().catch(() => ({}));
  const olgu = olguTemiz(body.olgu);
  if (!olgu) return json({ ok: false, sebep: 'olgu_yok', kalan, gunluk: ZAMAN_GUNLUK }, 200, origin);
  const payload = JSON.stringify(olgu);
  if (payload.length > ZAMAN_MAX_BYTES) {
    return json({ ok: false, sebep: 'cok_buyuk', kalan, gunluk: ZAMAN_GUNLUK }, 200, origin);
  }
  if (!env.GROQ_API_KEY) return json({ ok: false, sebep: 'anahtar_yok', kalan, gunluk: ZAMAN_GUNLUK }, 200, origin);

  // spend the global slot before calling out, so a burst cannot overshoot the cap
  const used = parseInt((await env.RATE_LIMIT?.get(`zaman:gun:${day}`)) || '0');
  await env.RATE_LIMIT?.put(`zaman:gun:${day}`, String(used + 1), { expirationTtl: TTL.zamanGun });

  let satirlar = null;
  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${env.GROQ_API_KEY}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.8,
        max_tokens: 220,
        messages: [
          { role: 'system', content: ZAMAN_SYSTEM },
          { role: 'user', content: `sohbetin sayıları:\n${payload}` },
        ],
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const metin = data?.choices?.[0]?.message?.content || '';
      satirlar = zamanGecerli(metin.split('\n').map((x) => x.trim()).filter(Boolean));
    }
  } catch (e) {
    satirlar = null;
  }

  await bump(env, 'zaman');
  if (!satirlar) return json({ ok: false, sebep: 'gecersiz_cikti', kalan: kalan - 1, gunluk: ZAMAN_GUNLUK }, 200, origin);
  return json({ ok: true, satirlar, kalan: kalan - 1, gunluk: ZAMAN_GUNLUK }, 200, origin);
}

// ---- /api/spiker — the model reads the conversation, the filter reads the model ---------------
//
// The prompt below is short on purpose. The old one was two screens of voice law wrapped around a
// table of fifteen numbers, and what came back was fifteen blocks of prose the product owner threw
// out on sight ("iğrenç, çok uzun"). What is asked for now is five sentences about a chat the model
// can actually see.

const SPIKER_MAKS_BAYT = 14_000;   // one reading's worth of chat; larger bodies are refused
const SPIKER_MAKS_SATIR = 5;       // lines the model may return
const SPIKER_MAKS_CUMLE = 6;       // sentences across all of them, the hard ceiling

const SPIKER_SYSTEM = `sen bir sohbetin alt metnini okuyan mesafeli bir gözlemcisin. sohbetin kendisi sana veriliyor. "SEN:" kullanıcının yazdıkları, "O:" karşı tarafın yazdıkları.

görevin: en çok beş kısa satır yazmak. her satır sohbette GÖSTEREBİLECEĞİN bir şeye dayanacak.

ton:
- mesafeli, soğukkanlı, dışarıdan bakan üçüncü göz. teselli yok, öğüt yok, şaka yok.
- küçük harfle yaz. kısa cümle kur. süs yok, metafor yok, slogan yok.
- "kanka", "aga", "reis", "dostum", "moruk" gibi hitap yasak.
- uzun çizgi kullanma.
- soru cümlesi kurarsan "?" ile bitir.

kanun, hepsi zorunlu:
- RAKAM YAZMA. yüzde, skor, puan, saat, tarih, sayı yazma. ekrandaki bütün sayıları motor kendisi basıyor, senin yazdığın sayı hiçbir şeyin ölçümü değil.
- UYDURMA. sohbette olmayan bir olayı, niyeti ya da kişiyi anlatma.
- ÇELİŞME. aynı okumada birbirini dışlayan iki şey söyleme.
- TEKRARLAMA. aynı hükmü ikinci bir cümleyle yeniden kurma.
- ALINTI yapacaksan sohbette BİREBİR geçen bir cümleyi çift tırnak içine al. bağlantı, dosya adı, "çıkartma dahil edilmedi" gibi sistem satırı ya da senin kurduğun bir cümle alıntı değildir.
- teşhis koyma, tanı koyma, akıl verme.

çıktı: yalnızca geçerli json, başka hiçbir şey yazma.
{"satirlar":["...","..."]}
en az iki, en çok beş satır. her satır tek cümle.`;

function spikerUserPrompt(sohbet) {
  return `sohbet:\n${sohbet}\n\nşimdi en çok beş satır yaz.`;
}

// ---- the output filter ------------------------------------------------------------------------

// Turkish-aware fold. `'İ'.toLowerCase()` is `i` + U+0307 in JS, which makes a quotation that is
// really in the chat look like one that is not. Same normalisation as train/tr_kucult.mjs.
function trKucult(s) {
  return String(s).replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase();
}
// Punctuation and spacing are not content: a quote that differs from the chat only by a trailing
// full stop is still that line. Everything else must match.
function normalize(s) {
  return trKucult(s).replace(/[.,!?;:…]+/g, ' ').replace(/["“”«»']/g, ' ').replace(/\s+/g, ' ').trim();
}

// A link is never a quotation, whoever pasted it. The live failure was a Spotify URL held up as
// "gerçek bir soru".
const BAGLANTI = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|co|me|tr|app|link|gl)\b)/i;

// Export system lines. They are in the chat, so "is it in the doc" says yes about all of them; they
// are still nobody's sentence.
const SISTEM_SATIRI = [
  'dahil edilmedi', 'omitted', 'bu mesaj silindi', 'this message was deleted',
  'uçtan uca şifreli', 'end-to-end encrypted', 'güvenlik kodu değişti', 'medya yok',
  'bir çıkartma', 'sticker', 'gif', 'canlı konum', 'live location',
];

const AGIZ_YASAK = /(kanka|aga|reis|dostum|moruk|birader|canım|tatlım|cicim)/i;

// Mutually exclusive readings. Narrow on purpose: this is not a general contradiction detector, it
// is the four collisions the live output actually produced in one reading (walling off AND looking
// after, flirting AND not flirting, one-sided AND even, warm AND ice-cold). A pair that fires means
// the whole reading is thrown away, because there is no way to tell which half was right.
const CELISKI = [
  [/(duvar ör|konuyu kapat|geri çekil|kaçın)/i, /(kolluy|halini sor|merak ed|ilgilen)/i],
  [/(flört var|flörtleş|yakınlaş)/i, /(flört yok|arkadaş(ça|lık)|romantik değil)/i],
  [/(tek taraf|tek başına taşı|karşılıksız)/i, /(eşit|karşılıklı|iki taraf da aynı)/i],
  [/(buz gibi|soğuk|mesafeli duruyor)/i, /(sıcak|samimi|yakın duruyor)/i],
];

// Every "…" run in a line. Single quotes are not treated as quotation marks: in Turkish an
// apostrophe is a suffix separator (`Ayşe'nin`), so reading them as quotes would reject ordinary
// sentences. A line is refused outright if it opens a double quote it never closes.
function alintilar(satir) {
  const out = [];
  const re = /["“«]([^"”»]{1,200})["”»]/g;
  let m;
  while ((m = re.exec(satir)) !== null) out.push(m[1].trim());
  return out;
}
function tirnakDengeli(satir) {
  const n = (satir.match(/["“”«»]/g) || []).length;
  return n % 2 === 0;
}

function alintiGecerli(alinti, sohbetNorm) {
  const t = alinti.trim();
  if (t.length < 6) return false;                       // "ok" is not evidence
  if (BAGLANTI.test(t)) return false;
  const dt = trKucult(t);
  if (SISTEM_SATIRI.some((s) => dt.includes(trKucult(s)))) return false;
  const n = normalize(t);
  return n.length >= 6 && sohbetNorm.includes(n);
}

function cumleSay(satir) {
  return satir.split(/(?<=[.!?])\s+/).map((c) => c.trim()).filter(Boolean).length;
}

/**
 * Returns the accepted lines, or null. Null is a whole rejected reading: a reading that is repaired
 * field by field is a reading nobody measured.
 */
function spikerGecerli(ham, sohbet) {
  if (!ham || typeof ham !== 'object') return null;
  const dizi = Array.isArray(ham.satirlar) ? ham.satirlar : null;
  if (!dizi || dizi.length < 1 || dizi.length > SPIKER_MAKS_SATIR) return null;

  const sohbetNorm = normalize(sohbet);
  const temiz = [];
  const gorulen = [];
  let cumle = 0;

  for (const s of dizi) {
    if (typeof s !== 'string') return null;
    // A list marker is `1.` / `2)` / `- ` / `* ` FOLLOWED BY A SPACE. The old strip was a character
    // class, so it also ate the leading digit of "3 mesajda bir konu kapanıyor" and handed the
    // invented figure straight past the digit rule below.
    const t = s.trim().replace(/^(?:[-*•]|\d{1,2}[.)])\s+/, '').trim();
    if (!t || t.length > 200) return null;
    if (AGIZ_YASAK.test(t)) return null;
    if (t.includes('—')) return null;
    if (!tirnakDengeli(t)) return null;

    // quotations first: a verified quotation is allowed to carry the chat's own digits, an
    // unverified one is the failure this check exists for.
    const alinti = alintilar(t);
    for (const a of alinti) if (!alintiGecerli(a, sohbetNorm)) return null;
    const disi = alinti.reduce((acc, a) => acc.split(a).join(' '), t);
    if (/[0-9٠-٩]/.test(disi)) return null;          // a figure of the model's own
    if (BAGLANTI.test(disi)) return null;

    cumle += cumleSay(t);
    if (cumle > SPIKER_MAKS_CUMLE) return null;

    const n = normalize(t);
    if (!n) return null;
    // repetition: the same sentence again, or one sentence swallowed whole by another
    if (gorulen.some((g) => g === n || g.includes(n) || n.includes(g))) return null;
    gorulen.push(n);
    temiz.push(t);
  }
  if (temiz.length < 1) return null;

  const hepsi = temiz.join(' ');
  for (const [a, b] of CELISKI) if (a.test(hepsi) && b.test(hepsi)) return null;

  return temiz;
}

async function handleSpiker(request, env, origin) {
  const body = await request.json().catch(() => null);

  // THE CONSENT GATE. It is asked before anything is read out of the body and before a single byte
  // leaves this worker. A request without it is a bug or an attack, and either way it is a 400.
  if (!body || body.onay !== true) return json({ error: 'Onay yok' }, 400, origin);

  const sohbet = typeof body.sohbet === 'string' ? body.sohbet : '';
  if (!sohbet.trim()) return json({ error: 'Invalid request' }, 400, origin);
  if (sohbet.length > SPIKER_MAKS_BAYT) return json({ error: 'Conversation too large' }, 413, origin);
  if (!env.GROQ_API_KEY) {
    return json({ error: 'Sunucu yapilandirilmadi', eksik: ['GROQ_API_KEY'] }, 503, origin);
  }

  // The chat is a local of this function. It is put in one prompt, and no KV write below or above
  // this line touches it.
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.GROQ_API_KEY}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.7,
      max_tokens: 400,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SPIKER_SYSTEM },
        { role: 'user', content: spikerUserPrompt(sohbet) },
      ],
    }),
  });
  if (!res.ok) return json({ error: 'Upstream error' }, 502, origin);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || '';
  let out;
  try { out = JSON.parse(text); } catch { return json({ error: 'Could not read this one' }, 502, origin); }

  const satirlar = spikerGecerli(out, sohbet);
  if (!satirlar) return json({ error: 'Could not read this one' }, 502, origin);
  return json({ source: 'groq', spiker: { satirlar: satirlar.map(trKucult) } }, 200, origin);
}

function json(data, status = 200, origin = '') {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json', ...cors(origin) },
  });
}
// The allowed origin is echoed back, never "*". Vary: Origin keeps a cached allowed response from
// being replayed to a different site.
function cors(origin) {
  const h = {
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-app-token',
    'Access-Control-Max-Age': '600',
  };
  if (origin) h['Access-Control-Allow-Origin'] = origin;
  return h;
}
