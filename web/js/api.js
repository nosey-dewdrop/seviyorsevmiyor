// Spiker client. Sends the ENGINE's verdict + counts (the law) plus the chat text to the
// Worker; gets fresh wording and evidence-quoted "gözden kaçanlar" back. Any failure returns
// null — the on-device template lines are always the floor, the product never breaks offline.
import { API_BASE } from './config.js?v=49';

// Content-free counter ping: event name only, fire-and-forget, never blocks the UI.
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

// Consented hard-case donation ("yanlış okudun" + bağış onayı) — the flywheel that grows OUR
// engine so the LLM share shrinks over time.
export async function itirazGonder(doc, hukum, karar) {
  try {
    const res = await fetch(`${API_BASE}/api/itiraz`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ doc, hukum, karar, onay: true }),
    });
    return res.ok;
  } catch { return false; }
}

export async function spikerRead(facts, doc) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 7000);
  try {
    const res = await fetch(`${API_BASE}/api/spiker`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ facts, doc }),
      signal: ctl.signal,
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return data && data.spiker ? data.spiker : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
