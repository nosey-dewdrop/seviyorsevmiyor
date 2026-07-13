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

## Last session (2026-07-13 night — PM pass, v11)
Walked the product end to end as a customer and closed the gaps: rule-guarded verdict (counted signals
veto the model — red flags kill a flirty verdict, one-sided reaching gets its own "tek taraflı" verdict
with per-side flirt numbers), evidence in every claim (count citations + "nasıl okudum?" expandable),
whole-chat message readings with richer patterns (interrogation, keşke, pursue; excuse-with-acceptance
guard; deflected plans no longer a green flag), reveal pacing cut ~60% + tap-to-skip, short-chat caveat.
Seed 169→211 targeting the confusions the walk found; held-out 79%→83.7%, parity ok. Quota + paywall
REMOVED (free unlimited tool, Damla's 13 Tem direction).

## Open items
1. Seed still small (211); grow + human-review — reads improve with data (the whole promise rides on this).
2. Gemini worker not deployed — Damla supplies key from her Google account → wrangler secret (optional).
3. Light-mode bubble sea still uses vector bubbles (dark uses textured sprites) — could adapt sprites for light.
4. EN second engine deferred (do not replace TR) — see CLAUDE.md LATER note.

## Revenue model
None by direction (2026-07-13): free idea-tool, audience first. Money is not a current goal for
damlahelloworld products; nothing here is gated.
