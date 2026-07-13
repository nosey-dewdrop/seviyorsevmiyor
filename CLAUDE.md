# whatdoyoumean

A "read the subtext" site for chats. You paste (or screenshot, or drop a WhatsApp export of) a
conversation and the engine reads what's really going on: flirty or friendly, who wants it more,
interest level, green/red flags, and a per-message "what did they mean". Theyseeyourphotos energy,
but for messaging, printed in a chat-bubble reveal. Born with a paywall. Turkish-first.

STATUS 2026-07-13: LIVE at https://damlahelloworld.github.io/whatdoyoumean/ (gh-pages). Faz 0–7 shipped (7 partial).
Deploy: `git subtree split --prefix web -b t && git push -f origin t:gh-pages && git branch -D t`; bump ?v=N + footer stamp each time.

DAMLA'S TODO (blocks full launch):
1. Supabase: run backend/supabase-schema.sql in the SHARED project's SQL editor (wdym_ tables + RLS + signup trigger). Also enable Email auth (magic link) for the project. URL she gave was .supabase.com; correct is .supabase.co (already set in config.js).
2. Worker: `cd backend && wrangler login` → create KV, paste id in wrangler.toml → `wrangler secret put GEMINI_API_KEY` (her Google AI Studio key) + `APP_TOKEN` → set PUBLIC_READ="on" → `wrangler deploy`. Until then the "buluta sor" button degrades to "cloud read not open".
3. Payment provider decision (Paddle vs Lemon Squeezy) → then server-enforced quota (wdym_daily_reads + use_read rpc) + set is_premium on webhook.
4. Grow train/data.jsonl beyond the 120-example seed and re-run train.py (accuracy climbs with data). Review the seed labels.
5. Look at the design in dev and steer — it's a v1, not blindly iterated (kör iterasyon yasağı).

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

## Design
theyseeyourphotos spirit: single column, minimal, generous (not dead) whitespace, big emotional reveal,
chat-bubble typography so it reads as "about messaging". House style: sharp corners (0–3px), NO purple,
no colored single words, no bold piles, no pill/gradient/emoji-bullet. Onboarding always. Design is mine
to iterate until excellent, then Damla approves.

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
