// Cloudflare Worker — seviyorsevmiyor API.
// One honesty rule: the on-device engine decides WHAT is true (verdict, counts, flags); the cloud
// only makes the wording fresh. No route of this worker accepts message text, forwards message
// text or stores message text: every body is run through olguTemiz() first, which keeps numbers,
// booleans and short enum keys and drops everything else. KV holds per-IP rate counters and the
// numeric feature vectors of donated hard cases, all with a TTL.
//
// /api/spiker : Groq (Llama) rewrites the engine's lines in the product voice, from the counts.
// /api/zaman  : the time engine's optional voice — receives numbers only, never messages.
// /api/itiraz : consented donation of a disputed reading — twelve model features, not the chat.
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

      // public read-only counts (the panel)
      if (url.pathname === '/api/stats') {
        return json(await readStats(env), 200, origin);
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
          hukum: anahtarTemiz(b.hukum),
          karar: anahtarTemiz(b.karar),
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
        const red = await biletKapisi(env, request, origin);
        if (red) return red;
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

// Facts must be a small, flat, numeric object. This is the wall that keeps chat text from leaving
// the device even if a future client is careless about what it puts in the payload. It is the
// single wall for every route now, not just /api/zaman.
//
// The string rule used to be "at most 24 characters and no double space", which let a short
// sentence through — "musait misin" is twelve characters with one space. A string field is now an
// enum key or nothing: one token, no whitespace at all. Prose cannot be one token.
//
// The comma is in the set and the cap is 40 for one existing field: the time flow sends
// `degisenler: "gecikme,sessizlik"`, a joined list of concept keys. A comma-joined list of tokens
// is still not a sentence, because a sentence needs a space.
function anahtarTemiz(v) {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return /^[\p{L}\p{N}_,-]{1,40}$/u.test(t) ? t : null;
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
      // strings are allowed only as short enum keys, never as content
      const a = anahtarTemiz(v);
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

// ---- /api/spiker — Llama is the mouth, never the judge -------------------------------------

const SPIKER_SYSTEM = `sen "seviyorsevmiyor" sitesinin okuyucususun. cihazdaki motor bir sohbeti analiz etti ve sana yalnızca SAYILARINI verdi. sohbetin kendisi sende yok ve hiç olmayacak. görevin: bu sayılara bakıp hükmü theyseeyourphotos tonunda anlatmak.

TON — bu ürünün ruhu (theyseeyourphotos):
- MESAFELİ, GÖZLEMCİ, biraz ÜRKÜTÜCÜ bir üçüncü gözsün. sohbeti dışarıdan izliyorsun ve gördüğünü soğukkanlılıkla söylüyorsun.
- "kanka", "aga", "reis" gibi samimi hitap YOK. dost ağzı YOK. sen kullanıcının arkadaşı değilsin, onu gözlemleyen sessiz bir bakışsın.
- kullanıcıya "sen" diye seslenmek AZ; ağırlıkla KARŞI TARAF hakkında konuş ("cevapları buz gibi", "o uzanan taraf", "geri çekiliyor").
- cümleler KISA, düz, kesin. süs yok, emoji yok, ":D" yok. rahatsız edici ölçüde sakin.
- örnek ton: "cevapları buz gibi. konuşmayı bitirmek için yazıyor, sürdürmek için değil." / "sen uzanıyorsun, o sadece orada."

KANUN — asla çiğneme:
1. motor raporu gerçektir. hüküm, yüzdeler, sayımlar ve bayraklar DEĞİŞMEZ; yeni sayı, yeni yüzde, yeni bayrak uydurma. raporla çelişen tek cümle yazma.
2. RAKAM YAZMA. hiçbir sayı, yüzde, saat, tarih yazma. sayıları ekrana motor kendisi basıyor.
3. ALINTI YAPMA. elinde mesaj yok. tırnak içinde tek kelime bile yazma, sohbetten bir cümle biliyormuş gibi yapma. kim ne dedi bilmiyorsun, sadece kaç mesaj ve kaç soru olduğunu biliyorsun.
4. hüküm gergin ise VEYA kırmızı bayrak varsa daha da ciddi ol. ama ton hep mesafeli-gözlemci kalır, asla "kanka" ya da şakacı olmaz.
5. teşhis koyma, ihtimal dili kullan ama TEK yumuşatmayla: "gaslight kokusu var" evet, "sanki ... gibi görünüyor olabilir" diye üst üste yumuşatma YOK.

AĞIZ YASAKLARI (ihlal = çöp çıktı):
- spor metaforu YOK: maç, gol, kale, saha, skor, hakem benzetmesi yasak.
- cinsiyetli ağız YOK: "moruk/reis/aslanım" erkek-erkek havası da, "canım/tatlım/cicim" kız-kız havası da yasak. herkese aynı nötr, samimi dil.
- ai tıraşı YOK: terapi jargonu, ders verme, dolgu cümle, ruhsuz veda ("hadi iyi günler" tarzı) yasak. her cümle gerçek bir arkadaşın iki saniyede söyleyeceği kadar kısa ve içten.
- aynı kelimeyi üst üste tekrar etme ("sanki... sanki... sanki" gibi tik yasak); her gözlemi farklı kur.
- bayraklardan bahsederken "red flag" / "green flag" de ("kırmızı bayrak" deme, kimse öyle konuşmuyor).

üslup referansı: the pudding'in spotify botu — veriyi ANLATMA, veriye TEPKİ ver. kısa, kişisel, şoke olmuş bir gözlemci tepkisi.

İYİ örnekler (ağız bu):
- ton, tek taraflı: "üzülerek söylüyorum: bu sohbeti tek başına sen taşıyorsun."
- denge: "sen sorup duruyorsun, ondan geri gelen yok."
- iyi işaret: "iki taraf da aynı ağırlıkta yazıyor. bu kadarı bile nadir."
KÖTÜ örnekler (asla yazma): "bu maçta tek kale oynanıyor" (spor), "sanki seni suçlu hissettirmeye çalışıyor gibi görünüyor olabilir" (çift yumuşatma + tıraş), "hadi iyi günler" (ruhsuz veda), tırnak içinde sohbetten cümle vermek (elinde olmayan alıntı).

SADECE geçerli JSON döndür, başka hiçbir şey yazma.`;

// The report handed to the model is the SAME flat table of counts the time flow sends. The old
// prompt pasted the conversation under a "SOHBET:" heading and asked for quoted evidence; there is
// no conversation here to paste and no quote to ask for.
function spikerUserPrompt(olgu) {
  return `SOHBETİN SAYILARI (kanun, değiştirilemez):
${JSON.stringify(olgu, null, 1)}

alan adları: yuzde/pay alanları yüzde, "senin_" kullanıcı, "onun_" karşı taraf, red_flag_turu ve
green_flag motorun saydığı bayraklar.

ÇIKTI ŞEMASI — tüm alanlar türkçe, hiçbirinde rakam ve tırnak yok:
{"ton_line":"hükmü anlatan 1-2 cümle",
 "sinyal_reason":"flört sinyali yüzdesinin gerekçesi, 1 cümle",
 "denge_line":"kim daha çok istiyor, sayımlara sadık 1-2 cümle",
 "kapanis":"tek vuruşluk içten kapanış, 1 cümle"}`;
}

// The client already reduced the report to counts, but the client is the half an attacker
// controls, so the reduction is repeated here on whatever arrived. `body.doc` is never read: a
// stale cached page that still posts one gets its text dropped at this line.
function spikerOlguSunucu(body) {
  if (body && body.olgu) return olguTemiz(body.olgu);
  const f = body && typeof body.facts === 'object' && body.facts ? body.facts : null;
  if (!f) return null;
  const h = f.hukum || {};
  const fl = f.flort || {};
  const s = f.sayim || {};
  const bayraklar = Array.isArray(f.bayraklar) ? f.bayraklar : [];
  const tur = (t) => bayraklar.filter((b) => b && b.tur === t).length;
  return olguTemiz({
    hukum_tur: h.tur,
    flort_karar: fl.karar,
    flort_yuzde: fl.yuzde,
    sende_yuzde: fl.sende_yuzde,
    onda_yuzde: fl.onda_yuzde,
    toplam_mesaj: s.toplam_mesaj,
    senin_mesajin: s.senin_mesajin,
    onun_mesaji: s.onun_mesaji,
    senin_sorun: s.senin_sorun,
    onun_sorusu: s.onun_sorusu,
    red_flag_turu: s.red_flag_turu,
    green_flag: s.green_flag,
    okuma_sayisi: Array.isArray(f.okumalar) ? f.okumalar.length : 0,
    red_bayrak: tur('red'),
    green_bayrak: tur('green'),
  });
}

async function handleSpiker(request, env, origin) {
  const body = await request.json().catch(() => null);
  const olgu = spikerOlguSunucu(body);
  if (!olgu) return json({ error: 'Invalid request' }, 400, origin);

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.GROQ_API_KEY}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.8,
      max_tokens: 1200,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SPIKER_SYSTEM },
        { role: 'user', content: spikerUserPrompt(olgu) },
      ],
    }),
  });
  if (!res.ok) return json({ error: 'Upstream error' }, 502, origin);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || '';
  let out;
  try { out = JSON.parse(text); } catch { return json({ error: 'Could not read this one' }, 502, origin); }

  const spiker = validateSpiker(out);
  if (!spiker) return json({ error: 'Could not read this one' }, 502, origin);
  const serious = olgu.hukum_tur === 'tense' || (olgu.red_flag_turu || 0) >= 1;
  postProcess(spiker, serious);
  return json({ source: 'groq', spiker }, 200, origin);
}

// The LLM does not fully obey the voice law, so we enforce it in code: playful screens are
// lowercase (TR-aware), and the "sanki" filler tic is stripped after its first use. Evidence
// quotes are never touched.
function trLower(s) { return s.replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase(); }
function postProcess(spiker, serious) {
  let sankiSeen = false;
  const fix = (s) => {
    if (!s) return s;
    let t = serious ? s : trLower(s);
    t = t.replace(/\bsanki\b[ ,]*/gi, (m) => (sankiSeen ? '' : (sankiSeen = true, m)));
    return t.replace(/\s{2,}/g, ' ').trim();
  };
  spiker.ton_line = fix(spiker.ton_line);
  spiker.sinyal_reason = fix(spiker.sinyal_reason);
  spiker.denge_line = fix(spiker.denge_line);
  spiker.kapanis = fix(spiker.kapanis);
}

// The client merges these over its template lines; anything malformed is dropped so the
// on-device templates always remain the floor.
//
// Two fields the spiker used to return are gone on purpose, and neither can come back while the
// conversation stays on the device:
//   okumalar        — per-message rewrites. writing the subtext of a message requires the message.
//   gozden_kacanlar — evidence-quoted observations. the old quoteIsInDoc() check could only tell a
//                     real quote from an invented one by searching the doc. with no doc there is no
//                     check, and an unverifiable quote is exactly the failure that check existed to
//                     stop. so the observations are dropped rather than shipped unverified.
// Both fields keep their on-device template values, because the client only overwrites what it is
// handed and it is no longer handed these.
//
// A digit is refused for the same reason as in the time flow: every figure on screen is put there
// by the engine, so a figure written by the model is a figure nothing measured. A quotation mark is
// refused because the model has nothing to quote from.
function satirTemiz(v, max) {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t || t.length > max) return null;
  if (/[0-9٠-٩]/.test(t)) return null;
  if (/["“”«»]/.test(t)) return null;
  return t;
}

function validateSpiker(out) {
  if (!out || typeof out !== 'object') return null;
  const spiker = {
    ton_line: satirTemiz(out.ton_line, 300),
    sinyal_reason: satirTemiz(out.sinyal_reason, 300),
    denge_line: satirTemiz(out.denge_line, 400),
    kapanis: satirTemiz(out.kapanis, 300),
  };
  if (!spiker.ton_line && !spiker.denge_line) return null;
  return spiker;
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
