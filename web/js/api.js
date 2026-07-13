// Spiker client. Sends the ENGINE's verdict + counts (the law) plus the chat text to the
// Worker; gets fresh wording and evidence-quoted "gözden kaçanlar" back. Any failure returns
// null — the on-device template lines are always the floor, the product never breaks offline.
import { API_BASE } from './config.js?v=18';

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
