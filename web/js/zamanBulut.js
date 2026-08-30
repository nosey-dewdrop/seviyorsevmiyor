// Optional cloud voice for the time engine.
//
// The reading is already complete before this file runs: the engine produced the verdict and the
// shipped phrasebook produced the wording. This asks the cloud to write three fresh lines on top,
// and it is capped, opt-in, and allowed to fail without breaking anything.
//
// What leaves the device: derived numbers only. No message text, no names, no dates as text. Names
// are left out deliberately, so "only numbers leave this device" stays literally true rather than
// nearly true. It costs the cloud lines some colour and it is worth it.

import { API_BASE } from './config.js?v=74';
import { biletAl, biletDusur } from './api.js?v=74';

const ZAMAN_URL = `${API_BASE}/api/zaman`;
const KALAN_URL = `${API_BASE}/api/zaman-kalan`;

// Reading the counter does not spend one, so the page can show a true number before asking.
export async function kalanSor(timeoutMs = 6000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(KALAN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
      signal: ctl.signal,
    });
    if (!res.ok) return null;
    const d = await res.json();
    return typeof d.kalan === 'number' ? d : null;
  } catch {
    return null;                 // endpoint not deployed yet, or offline: the page does not care
  } finally {
    clearTimeout(t);
  }
}

// Numbers only. Everything here is a count, a ratio or a short enum key.
export function olgular(res) {
  const s = res.summary;
  const lat = res.latency;
  const asim = lat.asymmetry;
  const kavramlar = [...new Set(res.points.map((p) => String(p.label).replace(/_[AB]$/, '')))];
  return {
    gun: Math.round(s.spanDays),
    mesaj: s.messages,
    konusma: s.sessions,
    cevap_hizli_dk: lat.A && lat.B ? Math.min(lat.A.median, lat.B.median) : null,
    cevap_yavas_dk: lat.A && lat.B ? Math.max(lat.A.median, lat.B.median) : null,
    gecikme_orani: asim && asim.different ? Math.pow(2, Math.abs(asim.ratio)) : 1,
    baslatma_pay: s.sessions ? s.A.starts / s.sessions : null,
    gece_pay: (s.A.nightMessages + s.B.nightMessages) / Math.max(1, s.messages),
    en_uzun_sessizlik_gun: s.longestSilenceMin != null ? Math.round(s.longestSilenceMin / 1440) : null,
    kirilma_sayisi: res.points.length,
    kirilma_var: res.points.length > 0,
    degisenler: kavramlar.join(','),          // short keys like "gecikme,sessizlik"
    birlesik_olasilik: res.joint ? res.joint.prob : null,
  };
}

/**
 * This route spends the Groq key, so it carries a ticket exactly like the spiker does. The ticket
 * comes from api.js — one Turnstile challenge per visitor, shared across both flows. No ticket
 * means no call: the page falls back to the shipped phrasebook, which is the floor anyway.
 *
 * @returns { ok:true, satirlar:[...], kalan } | { ok:false, sebep, kalan } | null when unreachable
 */
export async function bulutYaz(res, timeoutMs = 15000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const token = await biletAl();
    if (!token) return null;
    const r = await fetch(ZAMAN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-app-token': token },
      body: JSON.stringify({ olgu: olgular(res) }),
      signal: ctl.signal,
    });
    if (r.status === 403) biletDusur();
    if (!r.ok) return null;
    const d = await r.json();
    if (!d.ok) return d;
    // The server already rejects digits; check again here so a stale worker cannot put an
    // unmeasured figure on the screen.
    const temiz = (d.satirlar || []).filter((x) => typeof x === 'string' && !/[0-9]/.test(x) && x.length <= 140);
    return temiz.length >= 2 ? { ...d, satirlar: temiz } : { ok: false, sebep: 'gecersiz_cikti', kalan: d.kalan };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
