// UI controller for the time engine. Unzips on this thread (deterministic script tag load), hands
// the text to the worker, renders the verdict.
//
// The analysis path makes no network call: the file is read here, analysed in the worker, and the
// verdict is on screen before anything else happens. After that the page offers an optional cloud
// line, and taking that offer sends 326 bytes of derived numbers (measured in train/bulut_check.mjs)
// with no message text and no names. Declining, being over quota, or the endpoint being down all
// leave the reading exactly as it was.

import { readWhatsApp } from './wa.js?v=73';
import { yaz, bulutBlok } from './zamanYazi.js?v=73';
import { kalanSor, bulutYaz } from './zamanBulut.js?v=73';
import { biletAl } from './api.js?v=73';

// The page wiring below is guarded so this module can also be imported in Node, where there is no
// document. train/bos_ekran_check.mjs drives the real bulutuBagla / bulutCagir / bulutSonucBlok
// from this file rather than a copy of them.
const VAR_DOM = typeof document !== 'undefined';
const $ = (id) => (VAR_DOM ? document.getElementById(id) : null);
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
//
// It used to leave rather less than that. `bulutYaz` returns null for every unhappy path it has,
// and the click handler turned that null into `yer.innerHTML = ''`: the visitor pressed a button
// and the box they pressed it in disappeared. KOSU-v1 §0.7 says the engine goes silent BY NAME and
// that every refusal carries a next step, so the null is split into named causes below and each
// cause has its own sentence. There is no branch here that renders nothing.

export const BULUT_SEBEPLER = ['bilet_yok', 'gunluk_doldu', 'ag_hatasi', 'kisi_kotasi', 'gecersiz_cikti', 'sayac_yok'];

// One sentence per cause. Deliberately not one sentence with a variable in it: "bir hata oluştu"
// is the thing this block exists to replace, and a shared sentence drifts back into it.
const SEBEP_BLOK = {
  bilet_yok: `<div class="bulut">
      <p class="bulut-not">bulut yolu şu an kapalı. bu sürümde doğrulama anahtarı tanımlı olmadığı
      için istek hiç yola çıkmadı: bulut cevap vermedi değil, buluta sorulmadı. yukarıdaki okumanın
      tamamı motorun kendi okuması ve eksiksiz duruyor.</p>
      <span class="bulut-kalan">anahtar takıldığında bu kutu bulut cümlelerini gösterecek.</span>
    </div>`,
  ag_hatasi: `<div class="bulut">
      <p class="bulut-not">bulut isteği yanıtsız kaldı. istek gitti, dönüş gelmedi: ya bağlantın
      koptu ya da bulut tarafı şu an ayakta değil. yukarıdaki okuma yerinde, tek satırı bile
      eksilmedi.</p>
      <button class="btn ghost" id="bulutBtn" type="button">yeniden dene</button>
    </div>`,
  gecersiz_cikti: `<div class="bulut">
      <p class="bulut-not">bulut yazdı ama yazdıkları elendi. içinde rakam geçen ya da çok uzun
      satırları ekrana koymuyorum, çünkü sayıyı motor koyar, bulut değil. yukarıdaki okuma olduğu
      gibi duruyor.</p>
      <button class="btn ghost" id="bulutBtn" type="button">bulut yeniden yazsın</button>
    </div>`,
  sayac_yok: `<div class="bulut">
      <p class="bulut-not">bulut hak sayacına ulaşılamadı, o yüzden bugün kaç hak kaldığını
      bilmiyorum ve bilmediğim sayıyı yazmıyorum. bulut cümleleri bu okumada yok. motorun okuması
      yukarıda, eksiksiz.</p>
      <span class="bulut-kalan">sayaç geri geldiğinde teklif kutusu yeniden çıkar.</span>
    </div>`,
};

/**
 * Cause in, wording out. Pure, so the gate can read what a visitor would read.
 * Every branch returns a non-empty block; the spinner state is not one of the branches.
 */
export function bulutSonucBlok(d) {
  if (d && d.ok) return bulutBlok('yazdi', d.kalan, d.gunluk, d.satirlar);
  const sebep = (d && d.sebep) || 'ag_hatasi';
  if (sebep === 'gunluk_doldu') return bulutBlok('doldu', 0, d && d.gunluk);
  if (sebep === 'kisi_kotasi') return bulutBlok('kisiKotasi', d && d.kalan, d && d.gunluk);
  const govde = SEBEP_BLOK[sebep] || SEBEP_BLOK.ag_hatasi;
  return govde;
}

/**
 * The ticket is asked for HERE, before bulutYaz, only so the answer to "why did nothing come back"
 * exists. zamanBulut.js collapses a missing ticket and a dead endpoint into the same null, and
 * those two are a different sentence to the reader. biletAl caches, so asking twice costs nothing.
 *
 * deps is for the gate: bulutYaz cannot be reached with a ticket from Node, so the gate injects
 * the two calls it cannot make and every line of mapping and rendering below stays real.
 */
export async function bulutCagir(res, deps = {}) {
  const bilet = deps.bilet || biletAl;
  const yazdir = deps.yaz || bulutYaz;
  const token = await bilet();
  if (!token) return { ok: false, sebep: 'bilet_yok' };
  const d = await yazdir(res);
  if (!d) return { ok: false, sebep: 'ag_hatasi' };
  return d;
}

export async function bulutuBagla(res) {
  // Read at call time, not module time: the gate installs its document after the import.
  const yer = typeof document !== 'undefined' ? document.getElementById('bulutYer') : null;
  if (!yer || !res.ok) return;

  // Delegated once, so the retry buttons inside the failure blocks work too. The old handler was
  // bound to the offer button with { once: true }, which meant a failure had no way back.
  yer.addEventListener('click', async (e) => {
    const t = e && e.target;
    if (!t || t.id !== 'bulutBtn') return;
    yer.innerHTML = bulutBlok('yaziyor');
    yer.innerHTML = bulutSonucBlok(await bulutCagir(res));
  });

  const durum = await kalanSor();
  if (!durum) { yer.innerHTML = bulutSonucBlok({ ok: false, sebep: 'sayac_yok' }); return; }
  if (durum.kalan <= 0) { yer.innerHTML = bulutBlok('doldu', 0, durum.gunluk); return; }
  yer.innerHTML = bulutBlok('teklif', durum.kalan, durum.gunluk);
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

if (dosya) dosya.addEventListener('change', () => { if (dosya.files[0]) calistir(dosya.files[0]); });
if (birakAlan) {
birakAlan.addEventListener('dragover', (e) => { e.preventDefault(); birakAlan.classList.add('uzerinde'); });
birakAlan.addEventListener('dragleave', () => birakAlan.classList.remove('uzerinde'));
birakAlan.addEventListener('drop', (e) => {
  e.preventDefault();
  birakAlan.classList.remove('uzerinde');
  const f = e.dataTransfer.files && e.dataTransfer.files[0];
  if (f) calistir(f);
});
}
