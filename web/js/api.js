// Spiker client. Sends the ENGINE's verdict and counts — numbers only. The chat text never
// leaves this file's caller: it is turned into a flat table of counts here and the counts are
// what travels. Any failure returns null; the on-device template lines are always the floor, so
// the product never breaks offline.
//
// This is the file the privacy claim rests on. "mesajların cihazından çıkmaz" is a statement
// about the request body, so every request body built below is built from numbers and short enum
// keys, and train/bulut_check_eski.mjs measures the bodies rather than trusting this comment.
//
// Every call that costs money now carries a ticket: the page solves an invisible Turnstile
// challenge, the worker verifies it server side and hands back a five-minute HMAC ticket. The
// widget by itself protects nothing, so the ticket is what the worker checks.
import { API_BASE } from './config.js?v=74';
import { numericFeatures } from './features.js?v=74';

// Public site key (NOT a secret — the secret half lives in wrangler as TURNSTILE_SECRET).
// Cloudflare dash > Turnstile > add widget (Invisible) > copy the site key here.
const TURNSTILE_SITEKEY = '';
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

// ---- the wall: chat text in, numbers out -----------------------------------------------------
//
// Both cloud routes of the old flow used to carry the conversation itself. They now carry a flat
// object of counts built here. Two rules, both enforced by construction rather than by review:
//
//   1. an allowlist of field names. a new field cannot appear in the payload by accident, because
//      only the names written below are ever read out of the report.
//   2. every value is a number, a boolean, or a short enum key with no whitespace. a message is
//      prose, and prose cannot survive that filter.

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
  hukum_tur: ['flirty', 'friendly', 'cold', 'tense', 'onesided'],
  karar: ['var', 'yok', 'tek'],
  flort_karar: ['var', 'yok', 'tek'],
};
function anahtar(alan, v) {
  if (typeof v !== 'string') return null;
  const izin = ENUM_DEGERLER[alan];
  if (!izin) return null;
  const t = v.trim();
  return izin.includes(t) ? t : null;
}
function say(v) { return Array.isArray(v) ? v.length : null; }

// Drop every field the filters above rejected, so the payload has no null holes to inspect.
function temizle(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) if (v !== null && v !== undefined) out[k] = v;
  return out;
}

/**
 * The engine report (app.js spikerFacts) minus every string that came from the conversation.
 * `okumalar` carries the raw message text and `bayraklar`/`denge` carry generated sentences, so
 * those are reduced to counts: the spiker is told HOW MANY readings and flags there are, never
 * what anyone wrote.
 */
export function spikerOlgu(facts) {
  const f = facts && typeof facts === 'object' ? facts : {};
  const h = f.hukum || {};
  const fl = f.flort || {};
  const s = f.sayim || {};
  const bayraklar = Array.isArray(f.bayraklar) ? f.bayraklar : [];
  // flag kinds are counted, not carried, so this compares rather than sanitises
  const tur = (t) => bayraklar.filter((b) => b && b.tur === t).length;
  return temizle({
    hukum_tur: anahtar('hukum_tur', h.tur),
    flort_karar: anahtar('flort_karar', fl.karar),
    flort_yuzde: sayi(fl.yuzde),
    sende_yuzde: sayi(fl.sende_yuzde),
    onda_yuzde: sayi(fl.onda_yuzde),
    toplam_mesaj: sayi(s.toplam_mesaj),
    senin_mesajin: sayi(s.senin_mesajin),
    onun_mesaji: sayi(s.onun_mesaji),
    senin_sorun: sayi(s.senin_sorun),
    onun_sorusu: sayi(s.onun_sorusu),
    red_flag_turu: sayi(s.red_flag_turu),
    green_flag: sayi(s.green_flag),
    okuma_sayisi: say(f.okumalar),
    red_bayrak: tur('red'),
    green_bayrak: tur('green'),
  });
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

// The caller still hands over the conversation as a second argument; it is deliberately not read.
// Removing the parameter would only move the question to app.js, which this phase may not touch —
// so the fact that nothing here consumes it is the thing the gate measures.
export async function spikerRead(facts) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 7000);
  try {
    const token = await biletAl();
    if (!token) return null;
    const res = await fetch(`${API_BASE}/api/spiker`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-app-token': token },
      body: JSON.stringify({ olgu: spikerOlgu(facts) }),
      signal: ctl.signal,
    });
    if (res.status === 403) bilet = null;
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return data && data.spiker ? data.spiker : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
