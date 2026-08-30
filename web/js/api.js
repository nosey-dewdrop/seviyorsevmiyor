// API client.
//
// THE OLD FLOW SENDS THE CONVERSATION NOW. That is the product owner's call (30 Ağu): the
// on-device counter was inventing verdicts out of word counts, and a model handed fifteen numbers
// can only write templates. So /api/spiker receives the chat itself and reads it.
//
// What replaced the old wall is a CONSENT gate, and it is the only thing standing between the
// conversation and the network: spikerRead() refuses to build a request body at all unless the
// caller passes onay === true, which is the state of the checkbox the visitor ticked. No consent,
// not one character. train/llm_yol_check.mjs measures that by mutating the check away and watching
// the chat appear in the outgoing body.
//
// The time flow (zamanBulut.js) is unchanged: it still sends derived numbers only, and
// train/bulut_check.mjs still measures it.
//
// Tickets: /api/zaman and /api/itiraz spend a Turnstile-backed ticket. /api/spiker asks for one
// only when a site key is configured — with TURNSTILE_SITEKEY empty there is no challenge to
// solve, so demanding a ticket would close the route instead of protecting it. The worker follows
// the same rule from the other side (TURNSTILE_SECRET unset => no ticket demanded), and origin
// allowlisting plus the per-IP and global quotas stay on either way.
import { API_BASE } from './config.js?v=75';
import { numericFeatures } from './features.js?v=75';

// Public site key (NOT a secret — the secret half lives in wrangler as TURNSTILE_SECRET).
// Cloudflare dash > Turnstile > add widget (Invisible) > copy the site key here.
const TURNSTILE_SITEKEY = '';

// Fill the key in and the ticket gate turns itself on, here and on the worker, with no other edit.
export const BILET_GEREKLI = TURNSTILE_SITEKEY !== '';
const TURNSTILE_JS = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

// Counter pings are cheap and content-free, so they do not spend a ticket.
export function ping(olay) {
  try {
    fetch(`${API_BASE}/api/ping`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ olay }),
      keepalive: true,
    }).catch(() => {});
  } catch { /* counters must never break the product */ }
}

// ---- invisible Turnstile ---------------------------------------------------------------------

let scriptYuklendi = null;
function turnstileYukle() {
  if (scriptYuklendi) return scriptYuklendi;
  scriptYuklendi = new Promise((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile);
    const s = document.createElement('script');
    s.src = TURNSTILE_JS;
    s.async = true;
    s.defer = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile yok')));
    s.onerror = () => reject(new Error('turnstile script yuklenmedi'));
    document.head.appendChild(s);
  }).catch((e) => { scriptYuklendi = null; throw e; });
  return scriptYuklendi;
}

let widgetId = null;
function kap() {
  let el = document.getElementById('ts-kap');
  if (!el) {
    el = document.createElement('div');
    el.id = 'ts-kap';
    el.style.cssText = 'position:fixed;left:-9999px;top:0;width:0;height:0;overflow:hidden;';
    document.body.appendChild(el);
  }
  return el;
}

// Resolves with a Turnstile response string, or null if the challenge could not be solved.
function turnstileCevap(timeoutMs = 12000) {
  return new Promise(async (resolve) => {
    let bitti = false;
    const bit = (v) => { if (!bitti) { bitti = true; resolve(v); } };
    const t = setTimeout(() => bit(null), timeoutMs);
    try {
      const ts = await turnstileYukle();
      if (widgetId === null) {
        widgetId = ts.render(kap(), {
          sitekey: TURNSTILE_SITEKEY,
          execution: 'execute',
          appearance: 'interaction-only',
          callback: (token) => { clearTimeout(t); bit(token); },
          'error-callback': () => { clearTimeout(t); bit(null); },
          'timeout-callback': () => { clearTimeout(t); bit(null); },
        });
      } else {
        ts.reset(widgetId);
      }
      ts.execute(widgetId);
    } catch {
      clearTimeout(t);
      bit(null);
    }
  });
}

// ---- ticket ----------------------------------------------------------------------------------

let bilet = null;          // { deger, sonKullanma }
let biletIstek = null;     // in-flight, so two clicks do not burn two challenges

// Exported because every route that spends the key needs a ticket now, /api/zaman included.
// zamanBulut.js imports this one rather than growing a second copy: two ticket caches would mean
// two Turnstile challenges per visitor and two places for the refresh rule to drift.
export async function biletAl() {
  if (!TURNSTILE_SITEKEY) {
    // Same rule as the server: a missing key is said out loud, not worked around.
    console.error('[seviyorsevmiyor] TURNSTILE_SITEKEY bos — bulut yolu kapali.');
    return null;
  }
  if (bilet && bilet.sonKullanma - 30_000 > Date.now()) return bilet.deger;
  if (biletIstek) return biletIstek;
  biletIstek = (async () => {
    try {
      const cevap = await turnstileCevap();
      if (!cevap) return null;
      const res = await fetch(`${API_BASE}/api/bilet`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ turnstile: cevap }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        if (d && Array.isArray(d.eksik)) console.error('[seviyorsevmiyor] sunucu siri eksik:', d.eksik.join(', '));
        return null;
      }
      const d = await res.json();
      if (typeof d.bilet !== 'string') return null;
      bilet = { deger: d.bilet, sonKullanma: Date.now() + (d.omur_sn || 300) * 1000 };
      return bilet.deger;
    } catch {
      return null;
    } finally {
      biletIstek = null;
    }
  })();
  return biletIstek;
}

// A 403 from any ticket route means the cached ticket is dead (expired, or the secret rotated).
// Callers drop it so the next attempt solves a fresh challenge instead of replaying a bad ticket.
export function biletDusur() { bilet = null; }

// ---- the donation payload: still numbers only -------------------------------------------------
//
// /api/itiraz is a different promise from /api/spiker and keeps its old shape. The spiker reads a
// chat once and forgets it; a donated row is written into KV and lives for months, so what is
// donated stays the twelve numbers the model actually trains on.

// Rounded to two decimals so a float cannot smuggle a long tail of digits.
function sayi(v) {
  return typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
}
// An enum slot carries a value from a closed list, not "any short token". Length said nothing
// about content: `zurnabalik_kanarya_7719` is a legal token and an illegal verdict. The lists below
// are the engine's own vocabularies (reveal.js TONE_TR, reveal.js flört kararı), and backend/
// worker.js holds the identical lists, because the server may not trust this file to have run.
const ENUM_DEGERLER = {
  hukum: ['flirty', 'friendly', 'cold', 'tense', 'onesided'],
  karar: ['var', 'yok', 'tek'],
};
function anahtar(alan, v) {
  if (typeof v !== 'string') return null;
  const izin = ENUM_DEGERLER[alan];
  if (!izin) return null;
  const t = v.trim();
  return izin.includes(t) ? t : null;
}

/**
 * What a donated hard case is now: the twelve numeric features the tone model actually trains on,
 * plus the verdict that was disputed. The conversation stays on the device.
 *
 * features.js speaks "A:" / "B:", the reveal screen speaks "SEN:" / "O:", so the labels are mapped
 * before extraction. Only the twelve ratios come back out; the doc itself is never returned.
 */
export function itirazOlgu(doc) {
  if (typeof doc !== 'string' || !doc.trim()) return null;
  const abDoc = doc.replace(/^SEN:/gm, 'A:').replace(/^O:/gm, 'B:');
  const f = numericFeatures(abDoc);
  const out = {};
  for (const [k, v] of Object.entries(f)) {
    const n = sayi(v);
    if (n !== null) out[k] = n;
  }
  return Object.keys(out).length ? out : null;
}

// Consented hard-case donation ("yanlış okudun" + bağış onayı) — the flywheel that grows OUR
// engine so the LLM share shrinks over time. It donates the feature vector, not the chat: the
// model trains on those twelve numbers anyway, so the text was never the part worth keeping.
export async function itirazGonder(doc, hukum, karar) {
  try {
    const t = await biletAl();
    if (!t) return false;
    const res = await fetch(`${API_BASE}/api/itiraz`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-app-token': t },
      body: JSON.stringify({
        olgu: itirazOlgu(doc),
        hukum: anahtar('hukum', hukum),
        karar: anahtar('karar', karar),
        onay: true,
      }),
    });
    if (res.status === 403) bilet = null;
    return res.ok;
  } catch { return false; }
}

// ---- /api/spiker: the conversation, and the consent gate in front of it ----------------------

// A ceiling on what one reading may cost, in characters. The worker refuses anything larger, so
// this is the polite half of the same limit rather than a second policy.
export const SOHBET_MAKS = 12_000;

/**
 * Ask the cloud to read this conversation.
 *
 * @param {{sohbet: string, onay: boolean}} istek
 *   sohbet — the chat, "SEN:" / "O:" per line.
 *   onay   — the consent checkbox. MUST be exactly true.
 *
 * THE CONSENT GATE IS THE LINE BELOW. It is not a formality and it is not repeated anywhere else
 * on the client: if it is removed, the conversation goes out. train/llm_yol_check.mjs removes it
 * on purpose and fails if the chat does not then appear in the request body.
 */
export async function spikerRead(istek) {
  const sohbet = istek && typeof istek.sohbet === 'string' ? istek.sohbet : '';
  const onay = !!istek && istek.onay === true;
  if (!onay) return null;                 // RIZA KAPISI — onay yoksa gövde hiç kurulmaz
  if (!sohbet.trim()) return null;

  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 15000);
  try {
    const headers = { 'content-type': 'application/json' };
    if (BILET_GEREKLI) {
      const token = await biletAl();
      if (!token) return null;
      headers['x-app-token'] = token;
    }
    const res = await fetch(`${API_BASE}/api/spiker`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ sohbet: sohbet.slice(0, SOHBET_MAKS), onay: true }),
      signal: ctl.signal,
    });
    if (res.status === 403) bilet = null;
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const sp = data && data.spiker;
    return sp && Array.isArray(sp.satirlar) && sp.satirlar.length ? sp : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
