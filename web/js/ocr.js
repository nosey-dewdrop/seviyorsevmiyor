// On-device screenshot OCR (Tesseract.js, loaded from CDN on demand). We do NOT just dump text:
// chat screenshots put one person's bubbles on the left and the other's on the right, so we use
// each line's x position to guess the speaker. The image never leaves the browser.

let tessPromise = null;
function loadTesseract() {
  if (tessPromise) return tessPromise;
  tessPromise = new Promise((resolve, reject) => {
    if (window.Tesseract) return resolve(window.Tesseract);
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    s.onload = () => resolve(window.Tesseract);
    s.onerror = () => reject(new Error('OCR yüklenemedi'));
    document.head.appendChild(s);
  });
  return tessPromise;
}

// Returns "Sol: ...\nSağ: ..." text; the two sides map to the two speakers, and the user picks
// which side is them with the existing who-is-me toggle. Editable before analysis.
export async function ocrToText(file, onProgress) {
  const Tesseract = await loadTesseract();
  const worker = await Tesseract.createWorker('tur', 1, {
    logger: (m) => { if (onProgress && m.status === 'recognizing text') onProgress(m.progress); },
  });
  try {
    const { data } = await worker.recognize(file);
    const lines = (data.lines || []).filter((l) => (l.text || '').trim().length > 1);
    if (!lines.length) return '';
    let maxX = 0;
    for (const l of lines) maxX = Math.max(maxX, l.bbox?.x1 || 0);
    const mid = maxX / 2;
    const out = [];
    let prevSide = null;
    for (const l of lines) {
      const b = l.bbox || { x0: 0, x1: 0 };
      const center = (b.x0 + b.x1) / 2;
      const side = center < mid ? 'Sol' : 'Sağ';
      const text = l.text.trim();
      // merge wrapped lines from the same side into one message
      if (side === prevSide && out.length) out[out.length - 1] += ' ' + text;
      else out.push(`${side}: ${text}`);
      prevSide = side;
    }
    return out.join('\n');
  } finally {
    await worker.terminate();
  }
}
