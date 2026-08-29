// Spiker client. Sends the ENGINE's verdict + counts (the law) plus the chat text to the
// Worker; gets fresh wording and evidence-quoted "gözden kaçanlar" back. Any failure returns
// null — the on-device template lines are always the floor, the product never breaks offline.
//
// Every call that costs money or stores content now carries a ticket: the page solves an
// invisible Turnstile challenge, the worker verifies it server side and hands back a five-minute
// HMAC ticket. The widget by itself protects nothing, so the ticket is what the worker checks.
import { API_BASE } from './config.js?v=72';

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

async function biletAl() {
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

// Consented hard-case donation ("yanlış okudun" + bağış onayı) — the flywheel that grows OUR
// engine so the LLM share shrinks over time.
export async function itirazGonder(doc, hukum, karar) {
  try {
    const t = await biletAl();
    if (!t) return false;
    const res = await fetch(`${API_BASE}/api/itiraz`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-app-token': t },
      body: JSON.stringify({ doc, hukum, karar, onay: true }),
    });
    if (res.status === 403) bilet = null;
    return res.ok;
  } catch { return false; }
}

export async function spikerRead(facts, doc) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 7000);
  try {
    const token = await biletAl();
    if (!token) return null;
    const res = await fetch(`${API_BASE}/api/spiker`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-app-token': token },
      body: JSON.stringify({ facts, doc }),
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
