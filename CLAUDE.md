# whatdoyoumean

A "read the subtext" site for chats. You paste (or screenshot, or drop a WhatsApp export of) a
conversation and the engine reads what's really going on: flirty or friendly, who wants it more,
interest level, green/red flags, and a per-message "what did they mean". Theyseeyourphotos energy,
but for messaging, printed in a chat-bubble reveal. Born with a paywall. Turkish-first.

STATUS 2026-07-13 (night, PM pass): LIVE at https://damlahelloworld.github.io/whatdoyoumean/ (v11). Faz 0–6 shipped; FREE tool — quota + paywall REMOVED entirely (Damla direction 13 Tem: money is not a goal; unlimited reads, no account, nothing stored).
Deploy: `git subtree split --prefix web -b t && git push -f origin t:gh-pages && git branch -D t`; bump ?v=N + footer stamp each time.
PM iteration session (13 Tem night): walked the product as a customer, found + fixed the big ones —
- RULE-GUARDED VERDICT: the model proposes, counted signals veto. ≥2 red-flag kinds kills a flirty/friendly verdict (→ tense, with a "why" line); one-sided reaching (warm language from one side + short/deferring replies from the other) → new "tek taraflı" verdict, flirt shown per side ("sende %40, onda %0") instead of one misleading number. Fixes: argument read as "flört %63", dead one-sided chat read as "flört %99", closing line contradicting the flags.
- EVIDENCE IN EVERY CLAIM: balance line cites counts ("Sayım (sen–o): mesaj 9–5, soru 3–0"); "nasıl okudum?" expandable at the end (msgs counted, model verdict + confidence, whether rules overrode it, flag counts, on-device note).
- READINGS: scan the WHOLE chat (was: first 3 matches), one per pattern kind, max 4, new patterns (interrogation ≠ real question, keşke, pursue, excuse-with-acceptance guard); plans deflected by "bakarız" no longer count as a green flag.
- REVEAL PACING: waits cut ~60% (7-10s → ~3s), tap-anywhere-to-skip with a hint line; short chats (<6 msgs) get an honest caveat + unsure.
- SEED 169→211 (targeted at the three confusions), held-out 79%→83.7%, parity ok.

DAMLA'S TODO (all optional, none block):
1. Worker — ONLY if you want the "buluta sor" cloud fallback live: `cd backend && wrangler login` → KV → `wrangler secret put GEMINI_API_KEY` (your Google AI Studio key) + `APP_TOKEN` → PUBLIC_READ="on" → `wrangler deploy`. Until then the button says "cloud read not open" (graceful).
2. Grow train/data.jsonl further + re-run train.py (reads sharpen with data).
3. Generate more bubble sprites in Midjourney if you want; drop into web/assets/bubbles/ and I bump the version.

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

## Money
None by direction (2026-07-13): free unlimited idea-tool, audience first. Quota + paywall removed in v11;
nothing is gated and no payment provider is planned unless Damla says otherwise.

## Deploy (once live)
Site = gh-pages subtree push (stitchu pattern). Worker = Cloudflare (Gemini fallback proxy), GEMINI_API_KEY
+ APP_TOKEN as wrangler secrets, x-app-token from the app. Damla supplies the Gemini key + does OAuth.

Read PROJECT.md for the full roadmap and open items.

## Build story (13 Tem format — Damla's standing format for ALL projects)
- `linkedin.md` — damla essays: 300-500 word blog posts, each carrying the numbered chain (idea
  origin + the feeling → why each addition → pivots + the decision underneath → road to a real
  product). Never inflate one sentence into a post.
- `devlog.md` (renamed from devlog-tr.md) — Instagram build-in-public: the SMALLEST possible pieces,
  lots of content (no limit, "yüz reels olabilir"). Reel / post / carousel. Every entry = a 30-60s
  hooked reel script, spoken dev-diary voice: "bugün şunu değiştirdim arkadaşlar, çünkü şöyle bir
  sorun vardı" (problem → change → decision underneath).
- All entries must come from the real history (commits/plan) — no fabricated steps.
