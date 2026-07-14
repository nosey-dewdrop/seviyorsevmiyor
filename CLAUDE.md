# seviyorsevmiyor (renamed from mesajibirokusana, 15 Tem 00:xx — Damla: terazi mekanigi + "repo adi bu olsun")

STATUS 2026-07-15 early: REPO RENAMED (github nosey-dewdrop/seviyorsevmiyor, local folder renamed).
REDESIGN LOCKED via mockups/21-final.html (Damla approved piece by piece through the night):
- entry: THREE SOURCE DOORS side by side (ctrl+v paste / screenshot png-jpg / whatsapp .zip) + "ornegi izle" demo link. no lone textarea.
- analysis moment: the commentary types out CENTERED like a typewriter (Helvetica, 19px, line-height 1.65, green→NO, accent is PEACH).
- settle moment: commentary slides RIGHT (Helvetica/Arial, human voice), PRINTABLE card sits LEFT.
- printable card: brand row + verdict (26px bold) + REAL-LOOKING SCALE (svg: pedestal, tapered pillar, ring finial w/ peach dot, rounded beam, 3 chains per pan, elegant bowls; beam swings "seviyor... sevmiyor..." then settles) + per-message word-count bars WITH AXES (values above bars, "ilk mesajin → son mesajin" below, y label: kelime) + computed metrics + short note + "karti indir".
- card download: canvas 1080x1920 story PNG, SINGLE SURFACE (no box-in-box frame), same scale/bars/axes drawn, peach accent.
- receipt/fis concept is DEAD (Damla: para satirlari alakasiz, fis gorunumu sacma). card speaks the product's own visual language.
- itiraz: click ANY commentary line → under it opens "NEDEN BOYLE OKUDUM?" + "BASKA TURLUSU MUMKUN MU?" + consent donation button. approved flow.
- colors: bg #1a1a1e (NOT pitch black — Damla: "dark mode bu degil"), surfaces #232327, borders #3a3a40, accent PEACH-CORAL #ff8a70 (green rejected as final, pink reserved for gymgyme). rounded corners 8-16px (Damla: keskin kose sevmedim).
- bubble sea: UNCHANGED sprites, but count FIXED 10-12 (not random-looking), bubbles STAY AT EDGES and drift slowly; never over center content. line-heights tightened (1.65).
- copy law additions: NO AI dashes ever (split the sentence instead); question-shaped copy ALWAYS ends with "?"; dost agzi NOT mahalle agzi (esprili != gevsek; "yapiyosun" style rejected); stats named with gen z terms where natural (dry texting/kuru cevap, breadcrumbing).
- VOICE DECISION (Damla, night of 14-15 Tem): LLAMA SAYS EVERYTHING on the result screen — verdict sentence, scale caption, metric explanations, right commentary, card note. Engine numbers remain LAW (llama miscounts; facts as named numbers). Template lines remain ONLY as fire escape (no consent / worker down).
- eerie theyseeyourphotos layer approved: computable-from-timestamps observations (who ends convos, night-writing pattern, reply delay asymmetry — need zip/timestamps; omit honestly on plain paste).
- stats set (research-backed, trend-arastirmaci 15 Tem): kim baslatiyor, soru dengesi, kuru cevap orani (dry texting, Hinge %41), cift mesaj, plan erteleme (breadcrumbing), gorulmede birakma + cevap suresi (zip only).

TRAINING TRACK (Damla: "yap hepsini, kendini de kullanabilirsin"): teacher distillation for the tone model.
- 3 Claude agents generating labeled synthetic TR chats (150 flirty/friendly, 150 cold/tense, 120 gray/hard) → train/synth_claude_*.jsonl (NOTE: agents wrote to OLD folder name mesajibirokusana/train — move files in).
- HONESTY RULE: held-out eval stays on the ORIGINAL 268 real seed's every-5th split; synthetic goes to TRAIN SPLIT ONLY (train.py needs a small patch for this). Report old vs new accuracy side by side; ship model.json only if it improves.
- Later teachers: Llama (Groq) + Gemini via worker keys; disagreement cases go to a "hard" pile for human/donation labeling.
- Long game (Damla): donations label the motor; at millions of samples switch everything (voice included) to own models.

DONE 15 Tem: 21-final scene PORTED into web/ as v21 (three source doors, centered typewriter then card-left/commentary-right scene, real svg terazi with heavy pan down, per-message word bars with values+axes capped at last 40 msgs, metrics computed from parsed chat via ui.js computeStats + balance.js deflectedPlans, 1080x1920 story canvas seviyorsevmiyor-<no>.png, per-paragraph itiraz boxes wired to /api/itiraz, bubbles fixed 10-12 deterministic edge-only). "okuma NNNN" = device-local analysis counter (localStorage svs.okuma.no). Spiker response has NO reasoning/alternative fields, so itiraz boxes use engine-fact template lines; spiker still voices verdict/denge/okumalar/kapanis/gozden as before (contract untouched).
DONE 15 Tem 01:xx (v22): bars UNCAPPED (Damla: "gosterilsin ama tamami analiz edilsin" — analysis was always full-chat; display now full too, dense strip on long chats, values auto-hide >16 bars), KVKK pass CLEAN (donation exception + spiker consent + localStorage register all covered, brand updated), technical ship-check tour CLEAN (assets/versions/secrets/consent-gate/pages-serve; panel 404 was a test-server artifact, real 200), TRAINING RUN DONE: baseline 72.2% -> with 420 synth 75.9% on the SAME 54 real held-out samples (synth train-only), parity 1.11e-16 OK, model.json 49KB->245KB (gzips fine), shipped as v22.
DONE 15 Tem 02:xx (v23): WORKER RENAME COMPLETE. New worker seviyorsevmiyor-api deployed (wrangler), GROQ_API_KEY rotated + set fresh, config.js points at seviyorsevmiyor-api.damummyphus.workers.dev, cache-bust v23, footer updated, pushed to gh-pages + main. End-to-end spiker test on live: 200, source:"groq", real Llama lines returned. Old mesajibirokusana-api worker still exists (can delete from Cloudflare dashboard later).
KNOWN SPIKER TIC (not fixed today): Llama occasionally glues words (b'ninpositive) and invents "kanit" quotes not in the doc. Engine numbers stay LAW so verdict is safe, but the gozden_kacanlar "kanit" field is free-text Llama. Fix later: constrain kanit to verbatim substrings of doc or drop it.
STILL TO DO: full manual walk on live (Damla is testing with real chats), EN engine, OCR quality run, spiker contract extension for itiraz reasoning fields, spiker kanit-hallucination fix, next distillation round with Llama/Gemini teachers + real donations. Groq key was exposed in-session twice; rotated to fresh key, but consider one more clean rotation.


---- OLDER NOTES (mesajibirokusana era, still valid where not overridden) ----

# mesajibirokusana (renamed from whatdoyoumean, 13 Tem night)

A "read the subtext" site for chats. You paste (or screenshot, or drop a WhatsApp export of) a
conversation and the engine answers "flört var mı, yok mu?" with a COMMITTED call plus evidence.
Theyseeyourphotos energy but for messaging. Turkish-first, FREE and unlimited.

STATUS 2026-07-13 late night: LIVE at https://nosey-dewdrop.github.io/mesajibirokusana/ (v18,
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

v20 (same night, "paketleyelim" = Faz 1): spiker post-process in the worker (TR lowercase on
playful screens, "sanki" tic stripped after first use — verified live: 0 uppercase, 0 extra
sanki); content-free counters (`/api/ping` analiz/spiker/paylasim/itiraz + `/api/stats` +
web/panel.html, no identity, no content, KV `stat:` keys); "bence yanlış okudun" itiraz button
→ optional consented donation (`/api/itiraz`, the ONLY content-storing route, KV `corpus:` keys,
gizlilik updated same session) = the flywheel that grows OUR model; kayıt defteri (localStorage,
other person's name + score only → "geçen sefere göre ısınmış/soğumuş" return loop).

VISION (Damla, 13 Tem late): NOT a company, NOT B2B, NOT VC-fundable — don't pitch that. It is a
viral fun tool à la theyseeyourphotos whose "thing" is the OWN ENGINE (cascade, on-device verdict,
donation flywheel). PM/VC/league analysis archived: reports/2026-07-13-mesajibirokusana-pm-vc-lig.md.

NEXT: EN second engine (greenlit "lig arttır"), OCR quality run (Damla will bring ~10 real
screenshots — she said she'll come back for this), first retrain once corpus donations arrive.
Groq key rotation: Damla says handled (13 Tem).
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
