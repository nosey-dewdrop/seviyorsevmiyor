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
- [deferred] **Faz 7 — Paywall + revenue:** free idea-tool by Damla's call — audience first. Login REMOVED
      (no accounts, nothing stored server-side). Local daily quota; paywall shows "yakında". Payment provider
      (Paddle vs Lemon Squeezy) only when she wants to sell.
- [ ] **Faz 8 (ongoing) — beaver:** retrain from consented hard cases; option to upgrade to BERTurk later.

## Label schema (seed set, train/data.jsonl)
One line per example: `{ "text": "<A/B tagged conversation>", "tone": "flirty|friendly|cold|tense" }`.
`text` uses `A:` / `B:` line prefixes. Interest balance and flags are computed by rules, not labeled.

## Last session (2026-07-13)
Full identity redesign + ship-check + login removal, all live (v10). Bubble-sea with Damla's textured MJ
sprites (dark) / vector bubbles (light), separate bubble cards, dark default, Fraunces+Inter, question marks,
disclaimer + kosullar.html, favicon + OG. Seed 120→169. English second-engine deferred (see CLAUDE.md LATER).
Open/next: grow seed more; optional Gemini worker deploy (her key); light-mode sprites; more MJ shapes.

## Open items
1. Seed still small (169); grow + human-review — reads improve with data (the whole promise rides on this).
2. Gemini worker not deployed — Damla supplies key from her Google account → wrangler secret (optional).
3. Payment provider (Paddle vs Lemon Squeezy) — only when Damla wants to sell; revenue deferred for now.
4. Light-mode bubble sea still uses vector bubbles (dark uses textured sprites) — could adapt sprites for light.
5. EN second engine deferred (do not replace TR) — see CLAUDE.md LATER note.

## Revenue model
Free daily quota → premium (unlimited + deep read + relationship report). Premium also funds fallback
quota; fallback cost falls as the model learns.
