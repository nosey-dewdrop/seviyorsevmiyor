// UI controller for the time engine. Unzips on this thread (deterministic script tag load), hands
// the text to the worker, renders the verdict. No network call anywhere in this flow.

import { readWhatsApp } from './wa.js';
import { yaz } from './zamanYazi.js';

const $ = (id) => document.getElementById(id);
const giris = $('giris');
const calisiyor = $('calisiyor');
const sonuc = $('sonuc');
const cubukDolu = $('cubukDolu');
const calNot = $('calNot');
const birakAlan = $('birakAlan');
const dosya = $('dosya');

let worker = null;
let seq = 0;

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('./time/zaman.worker.js', import.meta.url), { type: 'module' });
  }
  return worker;
}

function ilerle(pct, note) {
  cubukDolu.style.width = `${Math.max(2, Math.min(100, pct))}%`;
  if (note) calNot.textContent = note;
}

function goster(hangi) {
  giris.classList.toggle('gizli', hangi !== 'giris');
  calisiyor.classList.toggle('gizli', hangi !== 'calisiyor');
  sonuc.classList.toggle('gizli', hangi !== 'sonuc');
}

async function calistir(file) {
  goster('calisiyor');
  ilerle(2, 'dosya açılıyor');
  let text;
  try {
    text = await readWhatsApp(file);
  } catch (err) {
    return hata(err.message || 'dosya okunamadı');
  }

  const id = ++seq;
  const w = getWorker();
  const onMsg = (e) => {
    const d = e.data || {};
    if (d.id !== id) return;
    if (d.type === 'progress') return ilerle(d.pct, d.note);
    w.removeEventListener('message', onMsg);
    if (d.type === 'error') return hata(d.message);
    if (d.type === 'done') {
      sonuc.innerHTML = yaz(d.result, file.name || 'sohbet');
      goster('sonuc');
      const yeni = document.getElementById('yeniBtn');
      if (yeni) yeni.addEventListener('click', () => { dosya.value = ''; goster('giris'); });
    }
  };
  w.addEventListener('message', onMsg);
  w.postMessage({ id, text });
  // The text stays in this scope only until the worker has it; it is never sent anywhere else.
}

function hata(msg) {
  sonuc.innerHTML = `<div class="kart"><h2>okunamadı</h2><p>${escape(msg)}</p>
    <button class="btn" id="yeniBtn" type="button">başka dosya</button></div>`;
  goster('sonuc');
  const yeni = document.getElementById('yeniBtn');
  if (yeni) yeni.addEventListener('click', () => { dosya.value = ''; goster('giris'); });
}

function escape(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

dosya.addEventListener('change', () => { if (dosya.files[0]) calistir(dosya.files[0]); });
birakAlan.addEventListener('dragover', (e) => { e.preventDefault(); birakAlan.classList.add('uzerinde'); });
birakAlan.addEventListener('dragleave', () => birakAlan.classList.remove('uzerinde'));
birakAlan.addEventListener('drop', (e) => {
  e.preventDefault();
  birakAlan.classList.remove('uzerinde');
  const f = e.dataTransfer.files && e.dataTransfer.files[0];
  if (f) calistir(f);
});
