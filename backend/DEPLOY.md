# whatdoyoumean API (Gemini fallback proxy)

This Worker is the ONLY place the Gemini key lives. The app answers most conversations on-device;
this covers the low-confidence minority, with the user's consent. It logs no content.

## One-time setup
1. `npm i -g wrangler` (or use `npx wrangler`).
2. `wrangler login` (Damla does the OAuth; approve within 5 minutes).
3. Create a KV namespace and paste its id into `wrangler.toml`:
   `wrangler kv namespace create RATE_LIMIT`
4. Set secrets (blind-paste, never in the repo):
   `wrangler secret put GEMINI_API_KEY`   → your Google AI Studio key
   `wrangler secret put APP_TOKEN`         → any long random string
5. To open the public browser fallback, set `PUBLIC_READ = "on"` in `wrangler.toml` (it costs money
   per call, so it ships "off" and throttled: 5/min + 20/day per IP).
6. `wrangler deploy`.

## Endpoint
`POST /api/read`  body: `{ "doc": "A: ...\nB: ...", "me": "A" }`
returns: `{ "source": "cloud", "reveal": { genel_ton, flort_sinyali, ilgi_dengesi, mesaj_okumalari, bayraklar, kapanis } }`

## Test
`curl -s https://<worker>.workers.dev/api/read -H 'content-type: application/json' \
  -H 'x-app-token: <APP_TOKEN>' -d '{"doc":"A: naber\nB: iyi","me":"A"}' | head`
