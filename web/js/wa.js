// WhatsApp export reader. A .txt is read directly; a .zip is unpacked in the browser (JSZip from
// CDN) and its _chat.txt pulled out. Everything is client-side; nothing is uploaded. The returned
// text goes through the same parse.js line parser as pasted chats.

let zipPromise = null;
function loadJSZip() {
  if (zipPromise) return zipPromise;
  zipPromise = new Promise((resolve, reject) => {
    if (window.JSZip) return resolve(window.JSZip);
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
    s.onload = () => resolve(window.JSZip);
    s.onerror = () => reject(new Error('Zip okuyucu yüklenemedi'));
    document.head.appendChild(s);
  });
  return zipPromise;
}

export async function readWhatsApp(file) {
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.zip')) {
    const JSZip = await loadJSZip();
    const zip = await JSZip.loadAsync(file);
    let entry = null;
    zip.forEach((path, f) => {
      const p = path.toLowerCase();
      if (!entry && p.endsWith('_chat.txt')) entry = f;
    });
    if (!entry) zip.forEach((path, f) => { if (!entry && path.toLowerCase().endsWith('.txt')) entry = f; });
    if (!entry) throw new Error('Zip içinde sohbet metni bulunamadı');
    return entry.async('string');
  }
  return file.text();
}
