// Cloudflare Worker — Gemini fallback proxy for whatdoyoumean.
// The app never holds the Gemini key. On-device model answers the confident majority; only
// low-confidence conversations, with the user's consent, reach this Worker. Content is never
// logged; only a per-IP rate counter is kept in KV. Mirrors the stitchu worker pattern.
//
// Deploy:  npx wrangler deploy
// Secrets: npx wrangler secret put GEMINI_API_KEY   (Damla's Google AI Studio key)
//          npx wrangler secret put APP_TOKEN         (any long random string)
// Vars:    PUBLIC_READ = "on"  to open the browser (tokenless) fallback path.

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors() });
    const url = new URL(request.url);
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    try {
      if (url.pathname !== '/api/read' || request.method !== 'POST') {
        return json({ error: 'Not found' }, 404);
      }
      const hasToken = !!request.headers.get('x-app-token');
      if (!hasToken) {
        // Public browser path — a web page cannot keep a secret. Guarded by cost fuses.
        if (env.PUBLIC_READ !== 'on') return json({ error: 'Cloud read is not open yet' }, 403);
        if (await limited(env, `min:${ip}`, 5, 120) || await limited(env, `day:${ip}`, 20, 90000)) {
          return json({ error: 'Rate limit exceeded. Please wait.' }, 429);
        }
      } else if (request.headers.get('x-app-token') !== env.APP_TOKEN) {
        return json({ error: 'Unauthorized' }, 401);
      }
      const len = parseInt(request.headers.get('content-length') || '0');
      if (len > 60_000) return json({ error: 'Conversation too large' }, 413);
      return handleRead(request, env);
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
