# seviyorsevmiyor API (Cloudflare Worker, Groq spiker)

This Worker is the ONLY place the LLM key lives. The on-device engine still decides the verdict,
scores and flags; `/api/spiker` only rewrites the wording (Groq/Llama) and adds evidence-quoted
"gözden kaçanlar". It logs no content. If the Worker is down or rate-limited, the app falls back
to its on-device template lines — the product never breaks.

## One-time setup (~5 minutes)
1. Get a free Groq key: https://console.groq.com → API Keys → Create API Key (starts `gsk_`).
2. `cd backend`
3. `npx wrangler login` (browser OAuth; approve within 5 minutes).
4. Create the KV namespace and paste its id into `wrangler.toml`:
   `npx wrangler kv namespace create RATE_LIMIT`
5. `npx wrangler secret put GROQ_API_KEY` → blind-paste the gsk_ key.
6. `npx wrangler deploy` → the printed URL must match `API_BASE` in `web/js/config.js`.
   If it differs, update `web/js/config.js`.

## Rate limits (all in code, KV-counted, no content stored)
- `/api/spiker`: 6/min per IP, 60/day per IP, 2000/day global; `SPIKER_OPEN = "off"` = kill switch.
- `/api/zaman`: 3/day per IP, 100/day global, payload capped at 2000 bytes of numbers.
- `/api/itiraz`: 5/min + 20/day per IP.

## Endpoints
`POST /api/spiker` body: `{ "facts": <engine report>, "doc": "SEN: ...\nO: ..." }`
returns: `{ "source": "groq", "spiker": { ton_line, sinyal_reason, denge_line, okumalar[], gozden_kacanlar[{baslik,line,kanit}], kapanis } }`

`POST /api/zaman` body: `{ "olgu": <flat numeric object> }` — numbers only, message text is rejected.
`POST /api/zaman-kalan` → how many cloud-written time readings are left today.
`POST /api/ping` + `POST /api/stats` → anonymous daily counters, no content, no identity.
`POST /api/itiraz` → the only route that ever stores a chat, and only with an explicit donate consent.

## Test
`curl -s https://seviyorsevmiyor-api.damummyphus.workers.dev/api/spiker \
  -H 'content-type: application/json' \
  -d '{"facts":{"hukum":"friendly","okumalar":[]},"doc":"SEN: naber\nO: iyi sen"}' | head -c 400`
