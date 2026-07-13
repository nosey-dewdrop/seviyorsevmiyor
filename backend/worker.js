// Cloudflare Worker — mesajibirokusana API.
// Two routes, one honesty rule: the on-device engine decides WHAT is true (verdict, counts,
// flags); the cloud only makes the wording fresh and spots what slipped past. Content is never
// logged; only per-IP rate counters live in KV.
//
// /api/spiker : Groq (Llama) rewrites the engine's lines in the product voice and adds
//               evidence-quoted "gözden kaçanlar" observations. Engine facts are law.
// /api/read   : legacy Gemini full fallback for low-confidence chats (kept as-is, off by default).
//
// Deploy:  npx wrangler deploy
// Secrets: npx wrangler secret put GROQ_API_KEY     (console.groq.com, free)
//          npx wrangler secret put GEMINI_API_KEY   (only if /api/read is ever opened)
//          npx wrangler secret put APP_TOKEN        (only for the tokened /api/read path)

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors() });
    const url = new URL(request.url);
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    try {
      if (request.method !== 'POST') return json({ error: 'Not found' }, 404);
      const len = parseInt(request.headers.get('content-length') || '0');
      if (len > 60_000) return json({ error: 'Conversation too large' }, 413);

      if (url.pathname === '/api/spiker') {
        if (env.SPIKER_OPEN !== 'on') return json({ error: 'Spiker is not open yet' }, 403);
        // Fuses: per-IP per-minute, per-IP per-day, and a global daily cap on the free key.
        if (await limited(env, `smin:${ip}`, 6, 120) || await limited(env, `sday:${ip}`, 60, 90000)) {
          return json({ error: 'Rate limit exceeded. Please wait.' }, 429);
        }
        if (await limited(env, 'sglobal', 2000, 90000)) {
          return json({ error: 'Daily capacity reached' }, 429);
        }
        return handleSpiker(request, env);
      }

      if (url.pathname === '/api/read') {
        const hasToken = !!request.headers.get('x-app-token');
        if (!hasToken) {
          if (env.PUBLIC_READ !== 'on') return json({ error: 'Cloud read is not open yet' }, 403);
          if (await limited(env, `min:${ip}`, 5, 120) || await limited(env, `day:${ip}`, 20, 90000)) {
            return json({ error: 'Rate limit exceeded. Please wait.' }, 429);
          }
        } else if (request.headers.get('x-app-token') !== env.APP_TOKEN) {
          return json({ error: 'Unauthorized' }, 401);
        }
        return handleRead(request, env);
      }

      return json({ error: 'Not found' }, 404);
    } catch {
      return json({ error: 'Internal error' }, 500);
    }
  },
};

async function limited(env, keyBase, max, ttl) {
  const bucket = ttl > 1000 ? Math.floor(Date.now() / 86400000) : Math.floor(Date.now() / 60000);
  const key = `${keyBase}:${bucket}`;
  const cur = parseInt((await env.RATE_LIMIT?.get(key)) || '0');
  if (cur >= max) return true;
  await env.RATE_LIMIT?.put(key, String(cur + 1), { expirationTtl: ttl });
  return false;
}

// ---- /api/spiker — Llama is the mouth, never the judge -------------------------------------

const SPIKER_SYSTEM = `sen "mesajibirokusana" sitesinin spikerisin. cihazdaki motor bir sohbeti analiz etti ve sana raporunu verdi. iki görevin var: (1) raporun cümlelerini taze, içten, ekran-görüntüsü-aldıracak türkçe "kanka" ağzıyla yeniden yazmak, (2) sohbette gözden kaçanları yakalamak.

KANUN — asla çiğneme:
1. motor raporu gerçektir. hüküm, yüzdeler, sayımlar ve bayraklar DEĞİŞMEZ; yeni sayı, yeni yüzde, yeni bayrak uydurma. raporla çelişen tek cümle yazma.
2. her gözlem kanıta bağlanır: "kanit" alanına sohbetten KISA ve GERÇEK bir alıntı koy. alıntı bulamıyorsan o gözlemi yazma.
3. ton kuralı: hüküm flört/arkadaşça/soğuk/tek-taraflı ise küçük harf, dalga geçen, samimi kanka ağzı. hüküm gergin ise VEYA kırmızı bayrak varsa ciddi ve şefkatli konuş, şaka yok. manipülasyon/gaslight gözlemleri HER ZAMAN ciddi dille yazılır.
4. teşhis koyma, ihtimal dili kullan: "gaslight var" değil "gaslight kokusu var gibi", "ufak bir manipülasyon olabilir". ama ihtimal dilini TEK yumuşatmayla kur; "sanki ... gibi görünüyor olabilir" diye üst üste yumuşatma.

AĞIZ YASAKLARI (ihlal = çöp çıktı):
- spor metaforu YOK: maç, gol, kale, saha, skor, hakem benzetmesi yasak.
- cinsiyetli ağız YOK: "moruk/reis/aslanım" erkek-erkek havası da, "canım/tatlım/cicim" kız-kız havası da yasak. herkese aynı nötr, samimi dil.
- ai tıraşı YOK: terapi jargonu, ders verme, dolgu cümle, ruhsuz veda ("hadi iyi günler" tarzı) yasak. her cümle gerçek bir arkadaşın iki saniyede söyleyeceği kadar kısa ve içten.

üslup referansı: the pudding'in spotify botu — veriyi ANLATMA, veriye TEPKİ ver. "oha. üç soru sormuşsun, sıfır geri gelmiş. iyi misin sen?" gibi kısa, kişisel, şoke olmuş arkadaş tepkisi.

İYİ örnekler (ağız bu):
- ton, tek taraflı: "üzülerek söylüyorum: bu sohbeti tek başına sen taşıyorsun."
- gözden kaçan: "sohbet boyunca hep kendini anlatmış; sana bir kez bile 'sen nasılsın' dememiş."
- gözden kaçan, iyi işaret: "planı somutlaştıran hep o. anlattığı gibi biriyse iyi gibi."
KÖTÜ örnekler (asla yazma): "bu maçta tek kale oynanıyor" (spor), "sanki seni suçlu hissettirmeye çalışıyor gibi görünüyor olabilir" (çift yumuşatma + tıraş), "hadi iyi günler" (ruhsuz veda).

gözden_kacanlar için baktıkların (hepsi değil, sohbette gerçekten olanlar): hep kendini anlatıp karşıyı hiç sormamak; soru/yatırım dengesizliği ("sen de fazla kaptırmışsın"); suçluluk yükleme, savunmaya itme, küçük manipülasyon veya gaslight kalıpları; sözle davranışın çelişmesi (tatlı dil ama plan yok); gerçek iyi işaretler — planı somutlaştırma, halini sorma, özür, tutarlılık. iyiyi söylemekten korkma: "anlattığı gibi biriyse iyi gibi" de.

SADECE geçerli JSON döndür, başka hiçbir şey yazma.`;

function spikerUserPrompt(facts, doc) {
  const n = Array.isArray(facts.okumalar) ? facts.okumalar.length : 0;
  return `MOTOR RAPORU (kanun, değiştirilemez):
${JSON.stringify(facts, null, 1)}

SOHBET ("SEN:" satırları kullanıcının kendisi):
${doc}

ÇIKTI ŞEMASI — tüm alanlar türkçe:
{"ton_line":"hükmü anlatan 1-2 cümle",
 "sinyal_reason":"flört sinyali yüzdesinin gerekçesi, 1 cümle",
 "denge_line":"kim daha çok istiyor, sayımlara sadık 1-2 cümle",
 "okumalar":[${n} adet string — rapordaki okumalarla AYNI SIRADA, her mesajın alt-metnini senin ağzınla söyle],
 "gozden_kacanlar":[2-4 adet {"baslik":"2-4 kelime","line":"gözlem, 1-2 cümle","kanit":"sohbetten kısa alıntı"}],
 "kapanis":"tek vuruşluk içten kapanış, 1 cümle"}`;
}

async function handleSpiker(request, env) {
  const body = await request.json();
  const facts = body.facts;
  const doc = typeof body.doc === 'string' ? body.doc.slice(0, 6000) : '';
  if (!facts || typeof facts !== 'object' || !doc || doc.split('\n').length < 2) {
    return json({ error: 'Invalid request' }, 400);
  }

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
        { role: 'user', content: spikerUserPrompt(facts, doc) },
      ],
    }),
  });
  if (!res.ok) return json({ error: 'Upstream error' }, 502);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || '';
  let out;
  try { out = JSON.parse(text); } catch { return json({ error: 'Could not read this one' }, 502); }

  const spiker = validateSpiker(out, Array.isArray(facts.okumalar) ? facts.okumalar.length : 0);
  if (!spiker) return json({ error: 'Could not read this one' }, 502);
  return json({ source: 'groq', spiker });
}

// The client merges these over its template lines; anything malformed is dropped so the
// on-device templates always remain the floor.
function validateSpiker(out, readingCount) {
  const str = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
  const spiker = {
    ton_line: str(out.ton_line, 300),
    sinyal_reason: str(out.sinyal_reason, 300),
    denge_line: str(out.denge_line, 400),
    kapanis: str(out.kapanis, 300),
    okumalar: null,
    gozden_kacanlar: [],
  };
  if (Array.isArray(out.okumalar) && out.okumalar.length === readingCount) {
    const reads = out.okumalar.map((r) => str(r, 300));
    if (reads.every(Boolean)) spiker.okumalar = reads;
  }
  if (Array.isArray(out.gozden_kacanlar)) {
    spiker.gozden_kacanlar = out.gozden_kacanlar.slice(0, 4).map((g) => ({
      baslik: str(g?.baslik, 60),
      line: str(g?.line, 400),
      kanit: str(g?.kanit, 200),
    })).filter((g) => g.baslik && g.line && g.kanit);
  }
  if (!spiker.ton_line && !spiker.gozden_kacanlar.length) return null;
  return spiker;
}

// ---- /api/read — legacy Gemini full fallback (unchanged) ------------------------------------

async function handleRead(request, env) {
  const body = await request.json();
  const doc = typeof body.doc === 'string' ? body.doc.slice(0, 8000) : '';
  const me = body.me === 'B' ? 'B' : 'A';
  if (!doc || doc.split('\n').length < 2) return json({ error: 'Invalid conversation' }, 400);

  const prompt = `Sen bir Türkçe mesajlaşma alt-metni okuyucususun. Aşağıdaki sohbette "${me}" kullanıcının kendisidir.
SADECE şu şemada, Türkçe, geçerli JSON döndür; başka hiçbir şey yazma:
{"genel_ton":{"key":"flirty|friendly|cold|tense","label":"kısa etiket","line":"1 cümle"},
 "flort_sinyali":{"score":0-100,"reason":"1 cümle gerekçe"},
 "ilgi_dengesi":{"leans":"A|B|even","line":"kim daha çok istiyor, 1 cümle"},
 "mesaj_okumalari":[{"speaker":"A|B","text":"sohbetteki bir mesaj","read":"ne demek istenmiş, 1 cümle"}],
 "bayraklar":[{"type":"red|green","title":"kısa","line":"1 cümle"}],
 "kapanis":"tek vuruşluk hissel kapanış cümlesi"}
Kural: uydurma yapma, sadece metinde olan sinyallere dayan. En fazla 3 mesaj_okumasi, en fazla 4 bayrak.
Sohbet:
${doc}`;

  const res = await fetch(`${GEMINI_URL}?key=${env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, responseMimeType: 'application/json' },
    }),
  });
  const data = await res.json();
  if (!res.ok) return json({ error: 'Upstream error' }, 502);
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  let reveal;
  try { reveal = JSON.parse(text); } catch { return json({ error: 'Could not read this one' }, 502); }
  return json({ source: 'cloud', reveal });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json', ...cors() },
  });
}
function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-app-token',
  };
}
