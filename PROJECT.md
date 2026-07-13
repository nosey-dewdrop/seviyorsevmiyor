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
- [ ] **Faz 3 — Screenshot OCR:** Tesseract.js on-device text extraction → cascade.
- [ ] **Faz 4 — WhatsApp .txt/.zip:** JSZip + WhatsApp line parser.
- [ ] **Faz 5 — Reveal + design:** chat-bubble output, onboarding, emotional layer, damla-ui pass.
- [x] **Faz 6 — KVKK + security:** privacy, consent, third-party warning, rate-limit hardening, sec pass.
- [ ] **Faz 7 — Paywall + revenue.**
- [ ] **Faz 8 (ongoing) — beaver:** retrain from consented hard cases; option to upgrade to BERTurk later.

## Label schema (seed set, train/data.jsonl)
One line per example: `{ "text": "<A/B tagged conversation>", "tone": "flirty|friendly|cold|tense" }`.
`text` uses `A:` / `B:` line prefixes. Interest balance and flags are computed by rules, not labeled.

## Open items
1. Repo name = `whatdoyoumean` (matches the brand + other repos use the product name); under org later.
2. Seed labels are author-written Turkish examples (small, honest v0); expand + human-review before launch.
3. Gemini key: Damla supplies from her Google account → wrangler secret.
4. Paywall provider (Paddle vs Lemon Squeezy) — Damla decides (mirrors stitchu open item).
5. Accuracy target + when to trust vs fallback: threshold tuned on held-out set, reported honestly.

## Revenue model
Free daily quota → premium (unlimited + deep read + relationship report). Premium also funds fallback
quota; fallback cost falls as the model learns.
