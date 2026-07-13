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

## Revenue model
None by direction (2026-07-13): free idea-tool, audience first. Money is not a current goal for
damlahelloworld products; nothing here is gated.
