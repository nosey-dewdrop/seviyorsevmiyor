# whatdoyoumean

A "read the subtext" site for chats. You paste (or screenshot, or drop a WhatsApp export of) a
conversation and the engine reads what's really going on: flirty or friendly, who wants it more,
green/red flags, per-message "what did they mean". Theyseeyourphotos energy but for messaging.
Turkish-first, FREE and unlimited (no quota, no paywall, no accounts — virality tool by design).

STATUS 2026-07-13 night: LIVE at https://damlahelloworld.github.io/whatdoyoumean/ (v17).
One marathon session shipped v11→v17: rule-guarded verdict (counted signals veto the model:
red flags kill flirty, one-sided gets "tek taraflı" with per-side flirt), evidence counts +
"nasıl okudum?" expandable, whole-chat readings, ~3s reveal + tap-to-skip, demo-chat button,
on-device PNG share card with roast dare line, denser sea (10-15 bubbles, Damla's spec) with
textured sprites in both themes, hero = "sana kırmızı çok yakışıyor / bu kız bana aşık mı? /
kesin aşık kanka :D", caps ink privacy badge → gizlilik. VOICE LAW: playful screenshot-bait
"kanka" register, lowercase, Damla-calibrated; tense + red-flag screens STAY SERIOUS.
Seed 268 (hard boundary cases), held-out 72.2% on the harder set (old easy-set 83.7% is not
comparable), parity 1e-16. VC/PM/league report: reports/2026-07-13-whatdoyoumean-vc.md.

NEXT: EN second engine in a fresh session (lexicons + EN seed + model.en.json + routing;
greenlit "lig arttır"). DAMLA-ONLY: worker deploy (`cd backend && wrangler login` → secrets
GEMINI_API_KEY + APP_TOKEN → PUBLIC_READ=on → deploy) for the fallback flywheel; 10 real
screenshots for an OCR quality run; more MJ bubble sprites if she wants.
Deploy: `git subtree split --prefix web -b t && git push -f origin t:gh-pages && git branch -D t`; bump ?v=N + footer.
Retrain: `python3 train/train.py`; verify `python3 train/parity_check.py && node train/parity_check.mjs`; product walk harness lives at /tmp/wdym_walk.mjs (recreate from git history of this note if gone).

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
