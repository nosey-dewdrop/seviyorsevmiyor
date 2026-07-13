# whatdoyoumean

A "read the subtext" site for chats. You paste (or screenshot, or drop a WhatsApp export of) a
conversation and the engine reads what's really going on: flirty or friendly, who wants it more,
interest level, green/red flags, and a per-message "what did they mean". Theyseeyourphotos energy,
but for messaging, printed in a chat-bubble reveal. Born with a paywall. Turkish-first.

STATUS 2026-07-13: LIVE at https://damlahelloworld.github.io/whatdoyoumean/ (v10). Faz 0–6 shipped; Faz 7 (revenue) deferred by Damla — this is a free idea-tool (paste→read→done), audience first.
Deploy: `git subtree split --prefix web -b t && git push -f origin t:gh-pages && git branch -D t`; bump ?v=N + footer stamp each time.
Big session (13 Tem): full redesign + ship-check. NO login/accounts (removed supa.js + supabase creds) — nothing stored server-side, like theyseeyourphotos; local daily quota only. Disclaimer + kosullar.html (Terms) live. Favicon + OG share card. Seed grown 120→169 (79% held-out, parity ok). Paste parser now strips time-first + bracketed WhatsApp stamps. Module imports are version-stamped (fixes Safari stale-module crash).

DAMLA'S TODO (all optional, none block launch):
1. Worker — ONLY if you want the "buluta sor" cloud fallback live: `cd backend && wrangler login` → KV → `wrangler secret put GEMINI_API_KEY` (your Google AI Studio key) + `APP_TOKEN` → PUBLIC_READ="on" → `wrangler deploy`. Until then the button says "cloud read not open" (graceful).
2. Payment provider (Paddle vs Lemon Squeezy) — ONLY when you actually want to sell premium; paywall shows "yakında".
3. Grow train/data.jsonl further + re-run train.py (reads sharpen with data).
4. Generate more bubble sprites in Midjourney if you want; drop into web/assets/bubbles/ and I bump the version.

LATER (Damla, deferred to save tokens 2026-07-13): add a SECOND engine for English — do NOT replace the Turkish one. Needs EN lexicons (features/balance), EN labeled seed data + model.en.json, EN reveal templates, and a TR/EN toggle with language routing. Only once the TR engine's data has grown; theyseeyourphotos is EN + global = bigger reach.


- Faz 1: own tone engine (numpy tfidf+logistic, 120-example TR seed, 79% held-out), on-device JS inference,
  Python↔JS parity harness (diff 1e-16), paste + WhatsApp-text parsing, deterministic balance + flag rules,
  templated TR reveal, chat-bubble UI, onboarding, daily free quota. Verified end to end in Node.
- Faz 2: Gemini fallback worker (backend/, PUBLIC_READ off by default) + on-device confidence threshold;
  low-confidence conversations show a "buluta sor" button (consent-gated). Worker NOT deployed (Damla: Google key + wrangler login).
- Faz 6: gizlilik.html (KVKK/GDPR), third-party-consent checkbox, no persistent storage, worker logs no content.
- OPEN: retrain repo path (data.jsonl is a small honest seed — grow it), screenshot OCR (Faz 3), WhatsApp .zip (Faz 4),
  paywall provider + real gate (Faz 7), deploy (gh-pages + worker), EN copy. See PROJECT.md.
- Retrain: `python3 train/train.py` (writes web/data/model.json). Verify: `python3 train/parity_check.py && node train/parity_check.mjs`.

## The one non-negotiable idea: cascade, not wrapper
This is NOT a GPT/Gemini wrapper. The engine is a **cascade**:
1. Our own **statistical model** (TF-IDF n-gram + logistic regression, trained on CPU, NO GPU) runs
   **in the browser** and scores the conversation.
2. **If it is confident** (margin over threshold) → WE answer, data never leaves the device (KVKK solved).
3. **Only if unsure** → optional fallback to Gemini via a Cloudflare Worker, with user consent.
4. Gemini's hard-case answers (consented, anonymised) become new labels → periodic retrain → the
   fallback share shrinks → Gemini eventually drops out entirely (the "beaver" plan).
Gemini is the exception, never the brain. Honesty: nuance/sarcasm is where statistics struggle — that
is exactly what earns a fallback. Held-out accuracy is measured and reported (build-in-public).

## Engine (train/ + web/js)
- Primary classifier = conversation **tone** ∈ {flirty, friendly, cold, tense}. Trained in numpy
  logistic regression (no sklearn) on a seed labeled Turkish set (`train/data.jsonl`), exported as a
  linear model JSON (`web/data/model.json`: per-token + per-numeric-feature weights + bias per class).
- **who-wants-more / interest balance** is deterministic (message-length asymmetry, double-texting,
  question ratio, initiation, reply lag) — a rule, not the classifier. That is the honest part.
- **flags** = keyword/pattern rules (love-bombing, controlling, ghosting cadence) + model confidence.
- Feature extractor is mirrored in `train/features.py` (training) and `web/js/features.js` (inference);
  a parity check dumps features from Python and re-computes them in Node to catch drift.

## Design (identity locked 13 Tem — Damla-directed)
The whole page is one chat thread of separate "bubble" cards floating on an interactive canvas **bubble
sea** (solid collision, flees the cursor, keeps clear of the cards). **DARK is default** (reads premium)
and the sea uses Damla's Midjourney-generated **textured ivory bubble sprites** (`web/assets/bubbles/`,
chroma-keyed to transparent); LIGHT mode uses colorful pastel vector bubbles. Type = Fraunces (display) +
Inter (body). Reveal streams in as the app "texting you back" (typing dots → bubbles). Onboarding = mini chat.
Still banned: cream backgrounds, colored single words, pill/gradient/emoji-bullet. Border-radius + font
weight are FREE now (old sharp-corner + no-bold laws were dropped 13 Tem). Asset flow: Damla generates in
MJ (recipe: matte black bg, ivory bubble, grainy stippled texture), I chroma-key to transparent PNGs and place.

## KVKK / law (ships in the SAME version as any data collection)
Story: most analysis stays on device; only unsure cases go to the cloud, with consent. Third-party data:
the other person did not consent → visible warning + "I have the right to upload this" checkbox. No
persistent storage in v1. `gizlilik.html` + consent line ship together. Worker logs no content.

## Money (born with a paywall)
Free: N reads/day. Paywall: unlimited + "deep read" + multi-chat "relationship report". The paywall also
funds the Gemini fallback quota (which shrinks as the model learns).

## Deploy (once live)
Site = gh-pages subtree push (stitchu pattern). Worker = Cloudflare (Gemini fallback proxy), GEMINI_API_KEY
+ APP_TOKEN as wrangler secrets, x-app-token from the app. Damla supplies the Gemini key + does OAuth.

Read PROJECT.md for the full roadmap and open items.
