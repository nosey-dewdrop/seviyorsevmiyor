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
number and every flag, in both flows, with or without a network.

The cloud layer only rewrites wording. It is opt-in, off by default, and allowed to fail: with no
consent, no key, or a dead Worker, the shipped phrasebook writes the same reading. Engine numbers are
law; the cloud is a voice. What it sends is not the same in the two flows:

- **`web/zaman.html`** sends derived numbers only. No message text, no names, no dates as text
  (`olgular()` in `web/js/zamanBulut.js`). A single digit anywhere in the model's answer rejects that
  answer, so every figure on screen came from the engine (`backend/worker.js`,
  `train/bulut_check.mjs`).
- **`web/index.html`** sends the engine report **and the chat text itself**. `spikerDoc()` in
  `web/js/app.js` builds the full transcript and posts it as `body.doc`, which the Worker truncates
  at 6000 characters before handing it to Llama; the raw message strings also ride along inside
  `okumalar[].mesaj`. It takes two ticked checkboxes to happen, but once ticked, the messages do
  leave the device. The model may only restyle sentences: an evidence quote is dropped unless it
  literally occurs in the chat, and any malformed field falls back to the on-device template.
  Making this flow numbers-only, the way `zaman.html` already is, is open work tracked in
  `CLAUDE.md`.

`web/gizlilik.html` is the user-facing wording of this same split.

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
4x jump, date CI coverage 89.3% against a nominal 90%, 39.5k messages parsed in 1.3 s on the
development machine.
Parity keeps the Python trainer and the JS runtime within 1e-16 of each other.

Retrain the tone model with `python3 train/train.py`, then ship `model.json` only if held-out
accuracy improves.

## Deploy

Pushing to `main` with changes under `web/` publishes the site (`.github/workflows/pages.yml`).
The Worker is deployed separately with `npx wrangler deploy` from `backend/`.

## Status

The time flow is verified end to end in Node, not yet in a real browser session; until an export is
dropped in a browser it is not called "working". Details and open work live in `CLAUDE.md`.
