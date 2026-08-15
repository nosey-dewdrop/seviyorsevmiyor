// WhatsApp export reader. A .txt is read directly; a .zip is unpacked in the browser and its
// _chat.txt pulled out. Everything is client-side and nothing is uploaded.
//
// JSZip is served from this origin, not from a CDN. A third party script running on this page would
// have full read access to the chat the user just dropped, which would make the privacy promise
// untrue regardless of what the copy says. Vendored file, one origin, no external executable code.
//
// It is loaded with a classic script tag rather than imported into the worker as a module: the
// vendored build is UMD, and UMD resolves differently depending on whether the host treats the file
// as CommonJS or as an ES module (verified: Node resolves it to a default export, a browser module
// worker would have to fall through to the self branch). A script tag has one behaviour everywhere.

let zipPromise = null;
function loadJSZip() {
  if (zipPromise) return zipPromise;
  zipPromise = new Promise((resolve, reject) => {
    if (window.JSZip) return resolve(window.JSZip);
    const s = document.createElement('script');
    s.src = new URL('../vendor/jszip.min.js', import.meta.url).href;
    s.onload = () => (window.JSZip ? resolve(window.JSZip) : reject(new Error('zip okuyucu yüklenemedi')));
    s.onerror = () => reject(new Error('zip okuyucu yüklenemedi'));
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
