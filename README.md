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
(`web/data/model.json`, trained in `train/`) and a time-series engine (`web/js/time/`) produce the
verdict, its percentages and its flags in both flows. No server call takes part in producing them.

The cloud layer is opt-in, off by default, and allowed to fail: with no consent, no key, or a dead
Worker, the shipped template lines carry the reading. Engine numbers are law; the cloud is a voice.
What leaves the device is not the same in the two flows:

- **`web/zaman.html`** sends derived numbers only. No message text, no names, no dates as text
  (`olgular()` in `web/js/zamanBulut.js`). A single digit anywhere in the model's answer rejects that
  answer, so every figure on screen came from the engine (`zamanGecerli()` in `backend/worker.js`,
  re-checked client-side in `zamanBulut.js`, both covered by `train/bulut_check.mjs`).
- **`web/index.html`** sends the engine report **and the chat text itself**. `spikerDoc()` in
  `web/js/app.js` builds the full transcript and posts it as `body.doc`, which the Worker truncates
  at 6000 characters before handing it to Llama; the raw message strings also ride along inside
  `okumalar[].mesaj`. It takes two ticked checkboxes to happen (`app.js:150`), but once ticked, the
  messages do leave the device. What comes back is restyled sentences plus new "gözden kaçanlar"
  observations; an observation is dropped unless its evidence quote literally occurs in the chat
  (`quoteIsInDoc()`), and any malformed field falls back to the on-device template. Unlike the time
  flow, these sentences are not digit-checked, so a figure the model writes inside a sentence here is
  not verified against the engine. Making this flow numbers-only, the way `zaman.html` already is, is
  open work tracked in `CLAUDE.md`.

### What the server stores

One route stores chat content: `/api/itiraz` in `backend/worker.js:52-69`. In the chat flow, tapping
a sentence opens its rationale box, and that box carries a button, "bu sohbeti bağışla, modeli
birlikte eğitelim" (`web/js/ui.js:233-246`). One press posts the full transcript — the same `SEN:` /
`O:` text the reading was built from — along with the verdict key and the flirt decision. The
`onay: true` consent field is hard-coded in the client (`web/js/api.js:25`), so pressing the button
is the consent. The Worker cuts the text at 8000 characters and writes it to KV under a `corpus:`
key with no `expirationTtl`: the record has no expiry date and stays until someone deletes it by
hand. Presses from one IP are capped at 5 a minute and 20 a day.

The rest of what the server keeps is counters: per-IP rate-limit buckets (the IP is part of the key,
the entry carries a TTL) and daily event totals in `bump()`. Neither holds chat text.

`web/gizlilik.html` is the user-facing wording of all of this, including how to ask for a donated
chat to be deleted.

## Layout

| path | what |
|---|---|
| `web/` | the whole site; this directory is what GitHub Pages serves |
| `web/js/time/` | time engine: parsing, sessions, rank-CUSUM change point, bootstrap date CI |
| `web/data/model.json` | shipped tone model weights (generated, do not hand-edit) |
| `backend/` | Cloudflare Worker; the Groq key is a Worker secret, not in this repo (`DEPLOY.md`) |
| `train/` | tone model training, synthetic data, and the seven gates below |
| `devlog.md`, `linkedin.md` | build log and the writing that came out of it |

## Gates

Every one of these must be green before anything ships:

```bash
for t in parse timeline cpd e2e yazi bulut; do node train/${t}_check.mjs; done
python3 train/parity_check.py && node train/parity_check.mjs
```

Measured by those gates: false positives 0% on null series and 0% under drift, power 75% on a real
4x jump, date CI coverage 89.3% against a nominal 90%, 39 524 messages parsed in under 1.5 s on the
development machine (968–1427 ms across six runs of `e2e_check`).
Parity puts the largest feature/probability gap between the Python trainer and the JS runtime at
1.11e-16, about machine epsilon.

Retrain the tone model with `python3 train/train.py`, then ship `model.json` when held-out accuracy
improves.

## Deploy

Pushing to `main` with changes under `web/` publishes the site (`.github/workflows/pages.yml`).
The Worker is deployed separately with `npx wrangler deploy` from `backend/`.

## Status

The time flow is verified end to end in Node, not yet in a real browser session; until an export is
dropped in a browser it is not called "working". Details and open work live in `CLAUDE.md`.
