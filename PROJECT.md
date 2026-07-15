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
