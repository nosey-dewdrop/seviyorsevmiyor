// Cloud fallback client. Called ONLY on low-confidence conversations, after the user consents.
// Sends the normalized doc (no names required) to the Worker, which proxies Gemini and logs nothing.
import { API_BASE } from './config.js?v=5';

export async function cloudRead(doc, me) {
  const res = await fetch(`${API_BASE}/api/read`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ doc, me }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = res.status === 403 ? 'Bulut okuması henüz açık değil.'
      : res.status === 429 ? 'Çok fazla istek oldu, biraz bekle.'
        : 'Bulut okuması şu an yapılamadı.';
    throw new Error(msg);
  }
  return data.reveal;
}
