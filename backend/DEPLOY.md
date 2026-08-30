# seviyorsevmiyor API (Cloudflare Worker, Groq spiker)

This Worker is the ONLY place the LLM key lives. The on-device engine still decides the verdict,
scores and flags. `/api/spiker` receives the CONVERSATION with the visitor's explicit consent and
Groq/Llama reads it (30 Ağu: the counts-only design produced templates, so it was dropped). The
chat is forwarded and never stored: no KV key in this worker holds a character of it. Every line
that comes back is filtered before it is returned, and a reading with an invented figure, an
unverifiable quotation, a contradiction or a repeat is thrown away whole. If the Worker is down,
rate-limited or the reading is refused, the app falls back to its on-device template lines, so the
product never breaks.

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
- `/api/spiker`: 6/min per IP, 60/day per IP, 900/day global; `SPIKER_OPEN = "off"` = kill switch.
  Ticket gate: demanded only when `TURNSTILE_SECRET` is set. Unset (production today) = ticketless,
  origin allowlist and the three quotas still apply.
- `/api/zaman`: 3/day per IP, 100/day global, payload capped at 2000 bytes of numbers.
- `/api/itiraz`: 5/min + 20/day per IP.

## Endpoints
`POST /api/spiker` body: `{ "sohbet": "SEN: ...\nO: ...", "onay": true }`
`onay` must be exactly `true`; anything else is 400 and no call is made.
returns: `{ "source": "groq", "spiker": { "satirlar": ["...", "..."] } }` — at most 5 lines and at
most 6 sentences, lowercase, no digits outside a verified quotation.

`POST /api/zaman` body: `{ "olgu": <flat numeric object> }` — numbers only, message text is rejected.
`POST /api/zaman-kalan` → how many cloud-written time readings are left today.
`POST /api/ping` + `POST /api/stats` → anonymous daily counters, no content, no identity.
`POST /api/itiraz` → the only route that writes to KV beyond counters: twelve numeric model
features plus the disputed verdict, 180-day TTL. The chat is not in the body and not in KV.

## Test
`curl -s https://seviyorsevmiyor-api.damummyphus.workers.dev/api/spiker \
  -H 'content-type: application/json' \
  -d '{"sohbet":"SEN: naber\nO: iyi sen","onay":true}' | head -c 400`
