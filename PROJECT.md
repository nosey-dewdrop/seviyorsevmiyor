# whatdoyoumean — living doc

## What it is
Paste / screenshot / drop a chat export → the engine reads the subtext and prints an emotional,
chat-bubble reveal: overall tone, flirt signal (0–100 + reason), interest balance (who wants it more),
per-message readings, green/red flags, one closing line. Turkish-first, born with a paywall.

## Product principle
Not a wrapper. A **cascade**: our own on-device statistical model answers when confident; a Gemini
worker fallback covers only the unsure minority; consented hard cases retrain the model so the fallback
shrinks over time. See CLAUDE.md for the full cascade contract.

## Architecture
- `web/index.html` — landing + app (single page).
- `web/css/{tokens,base,components}.css` — house style.
- `web/js/app.js` — flow orchestration (input → normalize → cascade → reveal).
- `web/js/features.js` — feature extractor (mirror of `train/features.py`).
- `web/js/model.js` — on-device linear inference over `web/data/model.json`.
- `web/js/balance.js` — deterministic interest-balance + flag rules.
- `web/js/reveal.js` — turns model output + rules into the templated reveal (no fabrication).
- `web/js/parse.js` — paste + WhatsApp .txt/.zip → normalized chat.
- `web/js/ocr.js` — Tesseract.js screenshot OCR (on-device).
- `web/js/api.js` — worker fallback client (only on low confidence, with consent).
- `web/js/ui.js` — chat-bubble render.
- `train/` — Python: seed labels + numpy logistic-regression training + weight export + parity check.
- `backend/worker.js` + `wrangler.toml` — Cloudflare Gemini fallback proxy.
- `web/gizlilik.html` — privacy (KVKK).

## Normalized chat format
`{ messages: [{ speaker: "A"|"B", text, ts? }], me: "A"|"B" }` — every input adapter lands here.

## Roadmap (phases)
- [x] **Faz 0 — Skeleton:** repo, folders, label schema, CLAUDE.md + PROJECT.md + devlog.
- [x] **Faz 1 — Own engine v0:** seed labels → numpy logistic model → export weights → JS inference;
      **paste input works end to end** (no Gemini). Report held-out accuracy.
- [x] **Faz 2 — Confidence threshold + Gemini fallback:** worker proxy, low-confidence routing + consent.
- [x] **Faz 3 — Screenshot OCR:** Tesseract.js on-device text extraction → cascade.
- [x] **Faz 4 — WhatsApp .txt/.zip:** JSZip + WhatsApp line parser.
- [x] **Faz 5 — Reveal + design:** chat-bubble reveal streams in (typing → bubbles); identity redesign =
      bubble sea of separate cards, dark default, Damla's textured MJ bubble sprites; disclaimer + kosullar.html.
- [x] **Faz 6 — KVKK + security:** privacy, consent, third-party warning, no server storage, no login.
- [removed] **Faz 7 — Paywall + revenue:** Damla direction 2026-07-13 — money is NOT a goal; quota +
      paywall stripped entirely. Free, unlimited, no accounts, nothing stored server-side.
- [ ] **Faz 8 (ongoing) — beaver:** retrain from consented hard cases; option to upgrade to BERTurk later.

## Label schema (seed set, train/data.jsonl)
One line per example: `{ "text": "<A/B tagged conversation>", "tone": "flirty|friendly|cold|tense" }`.
`text` uses `A:` / `B:` line prefixes. Interest balance and flags are computed by rules, not labeled.

## Last session (2026-07-15, v45→v70 all live on gh-pages, "customer eye" marathon)
Redesign: mercan/terazi/kalp DROPPED. New: antrasit+beyaz terminal, JetBrains Mono, two-column entry
(left source list / right box), SIMPLE card (flört score bar + stat grid + msg-length graph), footer with
ANSI colors (gizlilik orange / koşullar blue / analiz pink / @nosey-dewdrop purple github link). Comment
voice = theyseeyourphotos (distant observer, no "kanka") in reveal.js templates + worker.js spiker prompt.
Engine fix (v67): interestBalance now weighs message LENGTH + emotion asymmetry, so blatant one-sidedness
reads "sen uzanıyorsun" not "even" (regression 3/3, balanced still even). Fixed critical cache bug: JS
imports froze at ?v=61 (dynamic import too) — must force ALL js versions each bump. workflow now: no
localhost, every change pushed to gh-pages + viewed live. devlog m28-m29 added.
Bugs found + fixed: reset didn't clear body.sonuc; card canvas overflow on long chats (dip/CTA now hy-bound).
Open (needs Damla): flört advice text (empty placeholder), og.png stale (terazi+kalp), Llama raw-text
architecture decision, card-comment stat repetition, first-3-sec hook.

## Last session (2026-07-13 night marathon, v11→v17 all live)
PM pass (v11): rule-guarded verdict (red flags veto flirty; one-sided → "tek taraflı" + per-side flirt),
evidence counts + "nasıl okudum?", whole-chat readings, ~3s reveal + tap-to-skip, quota/paywall removed.
VC pass (v12): demo-chat button, on-device PNG share card; seed 268 hard-boundary cases (held-out 72.2%
on the harder set), parity ok; VC/league report at reports/2026-07-13-whatdoyoumean-vc.md.
Damla design pass (v13-v17): sea = 10-15 bubbles (sizes untouched), textured sprites in BOTH themes,
hero "sana kırmızı çok yakışıyor / bu kız bana aşık mı? / kesin aşık kanka :D", caps ink privacy badge
→ gizlilik, share-card dare line, FULL kanka-voice rewrite of the reveal (screenshot-bait, lowercase;
tense/red-flag screens stay serious). Content system: linkedin.md (4 essays 300-500w) + devlog.md
(8 session logs + 14 series reels + 16 atomic pieces).

## Open items
1. EN second engine — next big block, greenlit ("lig arttır"); fresh session budget.
2. Gemini worker not deployed — Damla: wrangler login + GEMINI_API_KEY (fallback flywheel starts here).
3. OCR never tested on real screenshots — needs 10 samples from Damla, then a quality run.
4. Seed 268 still small; grow toward 1000 + weekly retrain ritual.
5. More MJ bubble sprites whenever Damla generates them (drop into web/assets/bubbles/).

## SLOP-KURTARMA HAMLELERİ (2026-07-15)
Diagnosis: the engine is genuinely good (own on-device cascade, honest interest-balance, verified
parse) but the EXPERIENCE ends flat. The result screen is informative, not shareable — the verdict is a
plain sentence, the share card is a stat dump, and there is no curiosity gap, no comparison, and no
reason for a viewer to become the next user. Viral text-analyzers (Lucen, red-flag AI, Mosaic, and the
theyseeyourphotos trend) don't win on smarter analysis; they win on a screenshot-worthy payoff dropped at
the exact emotional peak, plus a loop that turns each shared card into a new visitor. These are low-effort,
high-impact, shareable, on-device (KVKK-safe) micro-moves. Chat text never leaves the device except the
already-consented Llama path; none of these add new data collection.

1. **Curiosity-gap "reveal" card (screenshot-bait verdict)** — S/M.
   The verdict + flört score ship UNDER a blur/mosaic overlay on both the web card and the 1080x1920 PNG,
   with a "dokun, öğren" hint; tap (or a second tap-to-download) removes it. Why viral: a shared card that
   still hides the answer forces the viewer to come to the site to get their own — the single strongest
   screenshot-bait pattern (curiosity gap at the emotional high). Moderation: none — the hidden text is our
   own engine output, not user content. KVKK: nothing new leaves the device; blur is a pure canvas layer.

2. **One eerie observer line instead of a stat row (theyseeyourphotos energy)** — S.
   Add ONE cold, specific, computed-from-stats sentence as the card's hero subline (e.g. "sen 7 soru sordun,
   3 döndü. gerisini sen doldur."). It's already in the tone; we just promote one line above the number grid
   so the card reads like a person watching, not a dashboard. Why viral: theyseeyourphotos went viral on the
   unsettling personal readout, not the data. Moderation: template-generated from engine numbers (LAW), so
   no hallucination risk; never quotes the chat. KVKK: computed on-device, no text shipped.

3. **Shareable archetype label (persona from existing stats)** — S.
   Derive a single gen-z persona tag from stats we ALREADY compute — "kuru cevap kralı" (high dry-reply %),
   "gece yazarı" (needs timestamps), "breadcrumb'çı" (high plan-deferral), "çift mesajcı", "dengeli" — and
   print it big on the card. Why viral: identity labels are the most tagged/re-shared quiz output ("Am I Unc",
   personality-type cards); people share a label they ARE far more than a raw score. Moderation: fixed label
   set chosen by deterministic thresholds, no free text. KVKK: zero new data; pure client compute.

4. **"gönder, ne diyeceğine bak" dare loop** — S.
   A one-line CTA on the card back / result footer daring the user to screenshot and send the card to the
   person it's about ("bu kartı ona at, cevabını izle"). Why viral: the theyseeyourphotos/quiz loop grows
   because the share IS the challenge; sending it to the crush both spreads the card and creates a real
   social moment. Moderation: static copy, none needed. KVKK: no data; it's an invitation, not a transfer.

5. **Rarity / percentile vanity line (local counter, no server profiling)** — S/M.
   Using the on-device okuma counter + a small local histogram of past scores (localStorage only), show a
   soft rarity line: "bu skor senin okumalarının en yükseği" or a coarse bucket ("nadir: %90+ çıktı"). Why
   viral: percentile/rarity is a proven vanity+curiosity trigger (HQ-style, "top N%"). Moderation: none.
   KVKK: histogram is local-only, never uploaded — keep it strictly client-side to stay profiling-free.

Sequencing: 1 and 3 are the highest leverage (curiosity gap + identity label) and both are pure canvas/copy
edits with no engine or backend change — do these first. 2 and 4 are copy-only. 5 needs a tiny localStorage
histogram. None require AI moderation and none change the privacy posture.

## Revenue model
None by direction (2026-07-13): free idea-tool, audience first. Money is not a current goal for
nosey-dewdrop products; nothing here is gated.

---

## ARŞİV — detay ve tarihçe (CLAUDE.md sadeleştirmesinden taşındı, 18 Tem)

### The one non-negotiable idea: cascade, not wrapper
This is NOT a GPT/Gemini wrapper. The engine is a **cascade**:
1. Our own **statistical model** (TF-IDF n-gram + logistic regression, trained on CPU, NO GPU) runs
   **in the browser** and scores the conversation.
2. **If it is confident** (margin over threshold) → WE answer, data never leaves the device (KVKK solved).
3. **Only if unsure** → optional fallback to Gemini via a Cloudflare Worker, with user consent.
4. Gemini's hard-case answers (consented, anonymised) become new labels → periodic retrain → the
   fallback share shrinks → Gemini eventually drops out entirely (the "beaver" plan).
Gemini is the exception, never the brain. Honesty: nuance/sarcasm is where statistics struggle — that
is exactly what earns a fallback. Held-out accuracy is measured and reported (build-in-public).

### Engine (train/ + web/js)
- Primary classifier = conversation **tone** ∈ {flirty, friendly, cold, tense}. Trained in numpy
  logistic regression (no sklearn) on a seed labeled Turkish set (`train/data.jsonl`), exported as a
  linear model JSON (`web/data/model.json`: per-token + per-numeric-feature weights + bias per class).
- **who-wants-more / interest balance** is deterministic (message-length asymmetry, double-texting,
  question ratio, initiation, reply lag) — a rule, not the classifier. That is the honest part.
- **flags** = keyword/pattern rules (love-bombing, controlling, ghosting cadence) + model confidence.
- Feature extractor is mirrored in `train/features.py` (training) and `web/js/features.js` (inference);
  a parity check dumps features from Python and re-computes them in Node to catch drift.

### Design (identity, evolves — CURRENT is terminal antrasit; this is the 13 Tem bubble-sea era, superseded)
The whole page is one chat thread of separate "bubble" cards floating on an interactive canvas **bubble
sea** (solid collision, flees the cursor, keeps clear of the cards). **DARK is default** (reads premium)
and the sea uses Damla's Midjourney-generated **textured ivory bubble sprites** (`web/assets/bubbles/`,
chroma-keyed to transparent); LIGHT mode uses colorful pastel vector bubbles. Type = Fraunces (display) +
Inter (body). Reveal streams in as the app "texting you back" (typing dots → bubbles). Onboarding = mini chat.
Still banned: cream backgrounds, colored single words, pill/gradient/emoji-bullet. Border-radius + font
weight are FREE now (old sharp-corner + no-bold laws were dropped 13 Tem). Asset flow: Damla generates in
MJ (recipe: matte black bg, ivory bubble, grainy stippled texture), I chroma-key to transparent PNGs and place.

### KVKK / law (ships in the SAME version as any data collection)
Story: most analysis stays on device; only unsure cases go to the cloud, with consent. Third-party data:
the other person did not consent → visible warning + "I have the right to upload this" checkbox. No
persistent storage in v1. `gizlilik.html` + consent line ship together. Worker logs no content.

### Deploy contract (worker)
Site = gh-pages subtree push (stitchu pattern). Worker = Cloudflare, GROQ_API_KEY (was Gemini) + APP_TOKEN
as wrangler secrets, x-app-token from the app. Damla supplies the key + does OAuth.

### Build story (13 Tem format — Damla's standing format for ALL projects)
- `linkedin.md` — damla essays: 300-500 word blog posts, each carrying the numbered chain (idea
  origin + the feeling → why each addition → pivots + the decision underneath → road to a real
  product). Never inflate one sentence into a post.
- `devlog.md` (renamed from devlog-tr.md) — Instagram build-in-public: the SMALLEST possible pieces,
  lots of content (no limit, "yüz reels olabilir"). Reel / post / carousel. Every entry = a 30-60s
  hooked reel script, spoken dev-diary voice (problem → change → decision underneath).
- All entries must come from the real history (commits/plan) — no fabricated steps.

### v70 STATUS DETAIL (15 Tem sabah, gerçek sitede çalışma)
- GİRİŞ: iki sütun (solda yapıştır/ekran/whatsapp seçenek listesi, sağda tıklanan kutu). Akordeon DEĞİL.
  Seçili öğe BEYAZ + başında "*", çizgi yok. Placeholder boş. İsme (brand) tıkla → developer flört tavsiyeleri.
- RENKLER: gövde+seçili BEYAZ/nötr. Sadece FOOTER'da ANSI: gizlilik turuncu, koşullar mavi, "analiz cihazında
  yapılır" pembe/magenta, @nosey-dewdrop mor (github link). --link mercanı kalktı.
- KART SADE (terazi+kalp metaforundan bıktım): yüzde barı + istatistik grid (2 sütun) + mesaj boyu bar grafiği
  + kısa yorum. Terazi/kalp/sallanan söz SİLİNDİ. Hem web kartı hem indirilen 1080x1920 PNG aynı sade dil.
- YORUM DİLİ = theyseeyourphotos tonu: mesafeli, gözlemci, ürkütücü üçüncü göz. reveal.js + worker.js SPIKER
  promptu çevrildi. Küçük harf. SONUÇ EKRANI: body.sonuc → wrap 1100px, giriş 680px dar.
- v67 MÜŞTERİ HİSSİ FIX: balance motoru mesaj UZUNLUĞU+duygu asimetrisini sayıyor → tek-taraflı sohbet "eşit"
  değil "sen uzanıyorsun" (regresyon 3/3 Node-kanıtlı). Bug: JS import'ları ?v=61'de DONMUŞTU → cache fix.

### v45 GECE REDESIGN DETAIL (15 Tem, terminal yönü — mercan TERK)
- MERCAN #ff8a70 TAMAMEN KALKTI ("slopware duruyor"). --accent nötr beyaz. Yeşil/mavi de reddedildi.
- FONT: JetBrains Mono (Google Fonts 400/500/700, display=swap). --sans=--mono (HER YER mono). body 500 sabit.
- GİRİŞ: kutu/border YOK. Kaynaklar AKORDEON, "/ / /" ayraç, tek 520px ortalı sütun. Onboarding + demo SİLİNDİ.
  Bubble sea KAPATILDI. Kenarlarda sönük "*" papatyalar. Metinler Damla sesiyle yeniden yazıldı.
- KART (bu turda): kalp puanı EKLENDİ (0-100 → ♥♥♥♥♥). Kartın KAHRAMANI 32px. (v70'te terazi/kalp söküldü.)
- "bu nasıl yapıldı" tıkla-aç link: 2-model mimarisi anlatımı. EDGE-CASE: O-yok/tek-taraflı kuru "0/0" his
  kırılması kapatıldı, division-by-zero korumaları, reduced-motion + focus-visible (a11y).
- T21 PARSE DOĞRULAMA (Node 8/8 geçti): isimli düz, WhatsApp iOS/Android timestamp temizleme, düz-satır→
  alternating+ambiguous, tek satır, boş satır, URL bölünmemesi. GÖZLEM: grup sohbetinde 3. kişi sessizce atılıyor.

### mesajibirokusana era (13 Tem, v18 — hâlâ geçerli, üstü çizilmeyen yerlerde)
- LLAMA SPIKER LIVE: worker `/api/spiker` (Groq llama-3.3-70b) engine satırlarını yeniden yazar + "gözden
  kaçanlar" (kanıt-alıntılı gözlemler). Engine facts LAW, açık isimli sayılar olarak gider ("5-3" string DEĞİL).
  Consent checkbox gate (KVKK aynı session), fuse: 6/min + 60/day per IP, 2000/day global, SPIKER_OPEN kill switch.
- NET HÜKÜM ("varsa var yoksa yok"): flört var. / flört yok. / flört var, ama tek taraflı. Mumbling orta-band silindi.
- VOICE LAW: spor metaforu yok, gendered register yok, ai filler yok, "red flag/green flag" (kırmızı bayrak değil),
  Pudding Spotify-roast register (veriye tepki ver, anlatma). DESIGN o dönem: dark ONLY, Arial, content bold.
- v20 "paketleyelim": spiker post-process (TR lowercase, "sanki" tic strip), content-free counters (/api/ping +
  /api/stats + panel.html), itiraz button → consented donation (/api/itiraz, tek content-storing route, corpus:
  KV keys), kayıt defteri (localStorage, isim+skor → "ısınmış/soğumuş" return loop).
- DONE 15 Tem v21-v23: 21-final sahne web'e port, KVKK pass clean, TRAINING RUN: baseline 72.2% → 420 synth 75.9%
  (aynı 54 real held-out, synth train-only, parity 1.11e-16), model.json 49KB→245KB, WORKER RENAME (seviyorsevmiyor-api
  deploy, GROQ_API_KEY rotate, config.js güncel). Eski mesajibirokusana-api worker Cloudflare'de duruyor (silinebilir).

### VISION (Damla, 13 Tem)
NOT a company, NOT B2B, NOT VC-fundable. Viral fun tool à la theyseeyourphotos whose "thing" is the OWN ENGINE
(cascade, on-device verdict, donation flywheel). PM/VC/lig analizi arşiv: reports/2026-07-13-mesajibirokusana-pm-vc-lig.md.

### TRAINING TRACK (teacher distillation)
3 Claude agents labeled synthetic TR chats (150 flirty/friendly, 150 cold/tense, 120 gray/hard) → train/synth_claude_*.jsonl.
HONESTY RULE: held-out eval stays on ORIGINAL 268 real seed's every-5th split; synthetic → TRAIN SPLIT ONLY. Report
old vs new side by side; ship model.json only if it improves. Later teachers: Llama (Groq) + Gemini; disagreement → "hard"
pile for human/donation labeling. Long game: donations label the motor; at millions of samples switch everything to own models.

### KNOWN SPIKER TIC (not fixed)
Llama occasionally glues words (b'ninpositive) and invents "kanit" quotes not in the doc. Engine numbers stay LAW so
verdict is safe, but gozden_kacanlar "kanit" is free-text Llama. Fix later: constrain kanit to verbatim doc substrings or drop.

### STILL TO DO (arşiv, tarih geçmiş "sırada X" kayıtları)
Full manual walk on live, EN engine, OCR quality run (~10 real screenshots from Damla), spiker contract extension for
itiraz reasoning fields, spiker kanit-hallucination fix, next distillation round (Llama/Gemini teachers + real donations).
Groq key was exposed in-session twice; rotated fresh — consider one more clean rotation. First-3-sec hook / "örnek dene"
demo geri (Damla kararı). Card-comment stat repetition (bilinçli bırakıldı, Damla "fazla" derse subtext'e çekilir).
