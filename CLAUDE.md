# mesajibirokusana (renamed from whatdoyoumean, 13 Tem night)

A "read the subtext" site for chats. You paste (or screenshot, or drop a WhatsApp export of) a
conversation and the engine answers "flört var mı, yok mu?" with a COMMITTED call plus evidence.
Theyseeyourphotos energy but for messaging. Turkish-first, FREE and unlimited.

STATUS 2026-07-13 late night: LIVE at https://damlahelloworld.github.io/mesajibirokusana/ (v18,
old /whatdoyoumean/ URL is dead 404). v18 shipped in one session, all Damla-directed:
- RENAME everywhere (repo, folder, worker `mesajibirokusana-api`, copy, share card, og). Reason:
  TR product with an EN name kills word of mouth; new name IS the sentence users say.
- LLAMA SPIKER LIVE: worker `/api/spiker` (Groq llama-3.3-70b, secrets set, deployed) rewrites the
  engine's lines fresh per request + returns "gözden kaçanlar" (evidence-quoted observations:
  self-talk, over-investment, manipulation/gaslight smell, green flags). Engine facts are LAW;
  facts sent as explicit named numbers (never "5-3" strings — Llama misread those). Consent
  checkbox gates it (KVKK text shipped same session); no consent / worker down → template floor.
  Fuses: 6/min + 60/day per IP, 2000/day global, SPIKER_OPEN kill switch, KV = MESAJ_RATE_LIMIT.
- NET HÜKÜM (Damla: "varsa var yoksa yok deyin, bıktık"): headline commits — flört var. / flört
  yok. / flört var, ama tek taraflı. (>=50 or flirty verdict = var; onesided = tek). Mumbling
  middle-band lines deleted; honesty lives in score + counts + "nasıl okudum?".
- VOICE LAW additions: NO sports metaphors (gol/kale dead), NO gendered registers, NO ai filler,
  no repeated-word tics; "red flag/green flag" (never "kırmızı bayrak"); Pudding Spotify-roast
  register = react to data, don't narrate. Questions end with "?" (copy law).
- DESIGN: dark ONLY (light mode + theme toggle removed), Arial everywhere (Fraunces/Inter gone,
  no Google Fonts requests), content text bold (web 1.0 chunky), denser sea 16-26 bubbles,
  sprites re-keyed via tools/clean_bubbles.py (body mask + edge unpremultiply; dirty px 54k→4.5k).
- Legacy Gemini /api/read path kept but off; old unsure→"buluta sor" UI removed.
Seed 268, held-out 72.2% (hard set), parity 1e-16. VC report: reports/2026-07-13-whatdoyoumean-vc.md.

NEXT: spiker polish (LLM sometimes slips "sanki" tic + capitalizes lowercase voice — tighten
prompt or post-process), EN second engine (greenlit "lig arttır"), 10 real screenshots OCR run.
DAMLA-ONLY: rotate the Groq key (it touched terminal history + chat 13 Tem — make new key at
console.groq.com, then `npx wrangler secret put GROQ_API_KEY` in HER OWN terminal, blind paste).
Deploy: `git subtree split --prefix web -b t && git push -f origin t:gh-pages && git branch -D t`; bump ?v=N + footer.
Retrain: `python3 train/train.py`; verify `python3 train/parity_check.py && node train/parity_check.mjs`; walk harness /tmp/mbo_walk/walk.mjs (recreate from git history of this note if gone).

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
