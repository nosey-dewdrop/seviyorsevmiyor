# mesajibirokusana API (Groq spiker + legacy Gemini fallback)

This Worker is the ONLY place the LLM keys live. The on-device engine still decides the verdict,
scores and flags; `/api/spiker` only rewrites the wording (Groq/Llama) and adds evidence-quoted
"gözden kaçanlar". It logs no content. If the Worker is down or rate-limited, the app falls back
to its on-device template lines — the product never breaks.

## One-time setup (Damla, ~5 minutes)
1. Get a free Groq key: https://console.groq.com → API Keys → Create API Key (starts `gsk_`).
2. `cd ~/damla_projects_2026/00_currently_on_working/mesajibirokusana/backend`
3. `npx wrangler login` (browser OAuth; approve within 5 minutes).
4. Create the KV namespace and paste its id into `wrangler.toml` (replaces REPLACE_WITH_KV_ID):
   `npx wrangler kv namespace create RATE_LIMIT`
5. `npx wrangler secret put GROQ_API_KEY` → blind-paste the gsk_ key.
6. `npx wrangler deploy` → note the printed URL; it must match `web/js/config.js` API_BASE
   (`https://mesajibirokusana-api.damummyphus.workers.dev`). If it differs, paste it into chat.

(GEMINI_API_KEY + APP_TOKEN are only needed if we ever open the legacy `/api/read` path.)

## Rate limits (all in code, KV-counted, no content stored)
- `/api/spiker`: 6/min per IP, 60/day per IP, 2000/day global; `SPIKER_OPEN = "off"` = kill switch.
- `/api/read`: 5/min + 20/day per IP, `PUBLIC_READ` gated, off by default.

## Endpoints
`POST /api/spiker` body: `{ "facts": <engine report>, "doc": "SEN: ...\nO: ..." }`
returns: `{ "source": "groq", "spiker": { ton_line, sinyal_reason, denge_line, okumalar[], gozden_kacanlar[{baslik,line,kanit}], kapanis } }`

`POST /api/read` body: `{ "doc": "A: ...\nB: ...", "me": "A" }` (legacy, off)

## Test
`curl -s https://mesajibirokusana-api.damummyphus.workers.dev/api/spiker \
  -H 'content-type: application/json' \
  -d '{"facts":{"hukum":"friendly","okumalar":[]},"doc":"SEN: naber\nO: iyi sen"}' | head -c 400`
