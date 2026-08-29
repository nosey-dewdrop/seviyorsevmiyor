// UI controller for the time engine. Unzips on this thread (deterministic script tag load), hands
// the text to the worker, renders the verdict.
//
// The analysis path makes no network call: the file is read here, analysed in the worker, and the
// verdict is on screen before anything else happens. After that the page offers an optional cloud
// line, and taking that offer sends 326 bytes of derived numbers (measured in train/bulut_check.mjs)
// with no message text and no names. Declining, being over quota, or the endpoint being down all
// leave the reading exactly as it was.

import { readWhatsApp } from './wa.js?v=72';
import { yaz, bulutBlok } from './zamanYazi.js?v=72';
import { kalanSor, bulutYaz } from './zamanBulut.js?v=72';

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
      bulutuBagla(d.result);
    }
  };
  w.addEventListener('message', onMsg);
  w.postMessage({ id, text });
  // The text stays in this scope only until the worker has it; it is never sent anywhere else.
}

// The verdict is already on screen at this point. Everything below is additive and every failure
// path leaves the page exactly as it was.
async function bulutuBagla(res) {
  const yer = document.getElementById('bulutYer');
  if (!yer || !res.ok) return;
  const durum = await kalanSor();
  if (!durum) return;                    // endpoint not deployed, or offline: stay quiet
  if (durum.kalan <= 0) {
    yer.innerHTML = bulutBlok('doldu', 0, durum.gunluk);
    return;
  }
  yer.innerHTML = bulutBlok('teklif', durum.kalan, durum.gunluk);
  const btn = document.getElementById('bulutBtn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    yer.innerHTML = bulutBlok('yaziyor');
    const d = await bulutYaz(res);
    if (!d) { yer.innerHTML = ''; return; }
    if (d.ok) yer.innerHTML = bulutBlok('yazdi', d.kalan, d.gunluk, d.satirlar);
    else if (d.sebep === 'gunluk_doldu') yer.innerHTML = bulutBlok('doldu', 0, d.gunluk);
    else if (d.sebep === 'kisi_kotasi') yer.innerHTML = bulutBlok('kisiKotasi', d.kalan, d.gunluk);
    else yer.innerHTML = '';
  }, { once: true });
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
