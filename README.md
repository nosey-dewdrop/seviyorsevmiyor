# seviyorsevmiyor

Reads the subtext of a chat and commits to a call, with the numbers it used shown next to it.
Turkish-first, free, no account. Live: https://nosey-dewdrop.github.io/seviyorsevmiyor/

Two flows share one engine:

- **`web/index.html`** — paste a chat, drop a screenshot, or drop a WhatsApp export.
  Answers "flört var mı, yok mu?" and who is leaning in more.
- **`web/zaman.html`** — drop a WhatsApp export. Answers "when did this chat change?"
  with a date and a confidence interval, not a vibe.

## Why is this not an LLM wrapper?

The verdict is computed on the device by code in this repo. A small tone model
(`web/data/model.json`, trained in `train/`) and a time-series engine (`web/js/time/`) produce every
number and every flag. Chat text never leaves the browser.

The cloud layer is optional and gated behind a checkbox. When it runs, Llama receives the engine's
**numbers**, not the messages, and rewrites the wording. It may not invent a figure: quotes are
checked against the chat and digits from the model are rejected (`backend/worker.js`,
`train/bulut_check.mjs`). With no consent, no key, or a dead Worker, the shipped phrasebook writes
the same reading. Engine numbers are law; the cloud is a voice.

## Layout

| path | what |
|---|---|
| `web/` | the whole site; this directory is what GitHub Pages serves |
| `web/js/time/` | time engine: parsing, sessions, rank-CUSUM change point, bootstrap date CI |
| `web/data/model.json` | shipped tone model weights (generated, do not hand-edit) |
| `backend/` | Cloudflare Worker: the only place the Groq key lives (`DEPLOY.md`) |
| `train/` | tone model training, synthetic data, and the seven gates below |
| `devlog.md`, `linkedin.md` | build log and the writing that came out of it |

## Gates

Every one of these must be green before anything ships:

```bash
for t in parse timeline cpd e2e yazi bulut; do node train/${t}_check.mjs; done
python3 train/parity_check.py && node train/parity_check.mjs
```

Measured by those gates: false positives 0% on null series and 0% under drift, power 75% on a real
4x jump, date CI coverage 89.3% against a nominal 90%, 39.5k messages parsed in under a second.
Parity keeps the Python trainer and the JS runtime within 1e-16 of each other.

Retrain the tone model with `python3 train/train.py`, then ship `model.json` only if held-out
accuracy improves.

## Deploy

Pushing to `main` with changes under `web/` publishes the site (`.github/workflows/pages.yml`).
The Worker is deployed separately with `npx wrangler deploy` from `backend/`.

## Status

The time flow is verified end to end in Node, not yet in a real browser session; until an export is
dropped in a browser it is not called "working". Details and open work live in `CLAUDE.md`.
