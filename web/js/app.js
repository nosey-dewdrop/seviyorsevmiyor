// Flow: input → parse → who-is-me → on-device engine (verdict + counts = the law) →
// optional Groq/Llama spiker (reads the CONVERSATION, consent-gated) → reveal.
// Free and unlimited (Damla, 13 Tem: money is not a goal here — idea tool, audience first).
import { loadModel, scoreConversation } from './model.js?v=75';
import { parseChat, toDoc } from './parse.js?v=75';
import { buildReveal } from './reveal.js?v=75';
import { playReveal, spikerDene } from './ui.js?v=75';
import { ping } from './api.js?v=75';
import { ocrToText } from './ocr.js?v=75';
import { readWhatsApp } from './wa.js?v=75';

const $ = (id) => document.getElementById(id);
const pasteBox = $('pasteBox');
const goBtn = $('goBtn');
const resetBtn = $('resetBtn');
const whois = $('whois');
const meSeg = $('meSeg');
const reveal = $('reveal');
const consent = $('consent');
const consentBox = $('consentBox');
const cloudConsent = $('cloudConsent');
const cloudConsentBox = $('cloudConsentBox');

let parsed = null;   // { messages, speakers, me, ambiguous }
let lastReveal = null;

// ---- iki sütun: solda seçenek tıkla → sağda o kutu açılır ----
function activateTab(name) {
  document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x.dataset.tab === name));
  ['paste', 'shot', 'wa'].forEach((k) => $(`pane-${k}`).classList.toggle('hidden', k !== name));
}
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => activateTab(t.dataset.tab)));
function ingestText(text) {
  pasteBox.value = (text || '').trim();
  activateTab('paste');
  refreshParse();
  pasteBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

const shotZone = $('shotZone');
const shotStatus = shotZone.querySelector('.dz-title');
$('shotInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  shotZone.classList.add('hot');
  shotStatus.textContent = 'ekran görüntüsü okunuyor…';
  try {
    const text = await ocrToText(file, (p) => { shotStatus.textContent = `okunuyor… %${Math.round(p * 100)}`; });
    if (!text) throw new Error('metin çıkmadı');
    ingestText(text);
    shotStatus.textContent = 'okundu, aşağıda düzenleyebilirsin.';
  } catch (err) {
    shotStatus.textContent = 'okunamadı, başka bir görsel dene ya da metni yapıştır.';
  } finally {
    shotZone.classList.remove('hot');
    e.target.value = '';
  }
});

const waZone = $('waZone');
const waStatus = waZone.querySelector('.dz-title');
$('waInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  waStatus.textContent = 'dosya okunuyor…';
  try {
    const text = await readWhatsApp(file);
    if (!text || !text.trim()) throw new Error('dosya boş görünüyor');
    ingestText(text);
    waStatus.textContent = 'okundu, aşağıda düzenleyebilirsin.';
  } catch (err) {
    waStatus.textContent = err.message || 'dosya okunamadı';
  } finally {
    e.target.value = '';
  }
});

// ---- parse as the user types ----
pasteBox.addEventListener('input', refreshParse);
function refreshParse() {
  const raw = pasteBox.value.trim();
  if (raw.length < 6) { parsed = null; whois.classList.add('hidden'); goBtn.disabled = true; return; }
  parsed = parseChat(raw);
  goBtn.disabled = parsed.messages.length < 2;
  consent.classList.toggle('hidden', parsed.messages.length < 2);
  cloudConsent.classList.toggle('hidden', parsed.messages.length < 2);
  renderWhois();
}
function renderWhois() {
  if (!parsed || parsed.messages.length < 2) { whois.classList.add('hidden'); return; }
  whois.classList.remove('hidden');
  meSeg.innerHTML = '';
  for (const key of ['A', 'B']) {
    const b = document.createElement('button');
    b.textContent = parsed.speakers[key];
    b.className = parsed.me === key ? 'on' : '';
    b.addEventListener('click', () => { parsed.me = key; renderWhois(); });
    meSeg.appendChild(b);
  }
}

// ---- analyze ----
// What the spiker is given: the conversation, labelled the way the reveal screen labels it, so the
// model and the reader are looking at the same two names. Nothing is summarised on the way out;
// summarising was the old design and it is what produced template sentences.
function spikerDoc(messages, me) {
  return messages.map((m) => `${m.speaker === me ? 'SEN' : 'O'}: ${m.text}`).join('\n');
}

// The spiker ADDS a short reading; it does not overwrite the engine's lines. The old merge rewrote
// ton_line, sinyal_reason, denge_line, every per-message reading and the closing sentence, which is
// how one verdict ended up stated three times in different words on the same screen.
function mergeSpiker(r, sp) {
  r.spikerSatirlar = Array.isArray(sp.satirlar) ? sp.satirlar : [];
  r.spiker = true;
}

goBtn.addEventListener('click', async () => {
  if (!parsed) return;
  goBtn.disabled = true;
  goBtn.textContent = 'okunuyor…';
  try {
    await loadModel();
    const doc = toDoc(parsed.messages);
    const toneResult = scoreConversation(doc);
    const r = buildReveal({ toneResult, messages: parsed.messages, me: parsed.me });
    ping('analiz');
    if (consentBox.checked && cloudConsentBox.checked) {
      goBtn.textContent = 'spiker okuyor…';
      // The checkbox is read HERE and passed on as `onay`; api.js refuses to build a request body
      // without it. `if (sp)` alone was a silent default: the box was ticked, the cloud never
      // answered, and the reveal showed template lines with nothing on screen admitting it.
      // spikerDene names the cause and playReveal prints it.
      const { sp, sebep } = await spikerDene({
        sohbet: spikerDoc(parsed.messages, parsed.me),
        onay: cloudConsentBox.checked === true,
      });
      if (sp) { mergeSpiker(r, sp); ping('spiker'); }
      else r.spikerKapali = sebep;
    }
    attachHistory(r, parsed);
    lastReveal = r;
    // sonuç ekranı temiz: kaynak seçimi + yazma alanını gizle, ama reset butonu görünür kalsın
    document.querySelector('.ikili').classList.add('hidden');
    whois.classList.add('hidden');
    consent.classList.add('hidden');
    cloudConsent.classList.add('hidden');
    goBtn.classList.add('hidden');
    document.body.classList.add('sonuc');   // sonuç ekranı sayfa genişliğini alsın
    playReveal(reveal, r, parsed.messages, parsed.me);
    resetBtn.classList.remove('hidden');
    reveal.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    reveal.innerHTML = '<div class="unsure">bir şey ters gitti. sayfayı yenileyip tekrar dener misin?</div>';
  } finally {
    goBtn.disabled = false;
    goBtn.textContent = 'alt-metni oku';
  }
});

resetBtn.addEventListener('click', () => {
  pasteBox.value = '';
  parsed = null;
  lastReveal = null;
  reveal.innerHTML = '';
  // formu geri getir: kaynak seçimi + buton görünür, akordeon başa (yapıştır)
  document.body.classList.remove('sonuc');
  document.querySelector('.ikili').classList.remove('hidden');
  activateTab('paste');
  whois.classList.add('hidden');
  consent.classList.add('hidden');
  consentBox.checked = false;
  cloudConsent.classList.add('hidden');
  cloudConsentBox.checked = false;
  goBtn.classList.remove('hidden');
  resetBtn.classList.add('hidden');
  goBtn.disabled = true;
  document.getElementById('giris').scrollIntoView({ behavior: 'smooth', block: 'start' });
  pasteBox.focus();
});

// isme tıklayınca developer flört tavsiyeleri açılır/kapanır
const brandBtn = $('brandBtn'), devNotu = $('devNotu');
if (brandBtn && devNotu) brandBtn.addEventListener('click', () => devNotu.classList.toggle('hidden'));

// theme toggle removed 13 Tem gece (Damla: "light mode kaldıralım") — the site is dark only.

// model.json (245KB) sayfa boşta iken arka planda yüklensin: kullanıcı "oku"ya basınca hazır,
// beklemez. loadModel kendi içinde tekrarı önler (bir kez fetch). idle yoksa gecikmeli fallback.
(window.requestIdleCallback || ((f) => setTimeout(f, 1200)))(() => { loadModel().catch(() => {}); });

// ---- kayıt defteri: on-device return loop. Keyed by the OTHER person's real name (skipped
// for anonymous "İlk kişi/İkinci kişi" parses); stores verdict + score only, never the chat.
const HISTORY_KEY = 'wdym.history.v1';
function attachHistory(r, p) {
  const other = p.me === 'A' ? 'B' : 'A';
  const name = (p.speakers[other] || '').trim();
  if (!name || /^(İlk kişi|İkinci kişi)$/i.test(name)) return;
  const key = name.toLocaleLowerCase('tr');
  let hist = {};
  try { hist = JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}'); } catch {}
  if (!hist || typeof hist !== 'object' || Array.isArray(hist)) hist = {};  // bozuk localStorage koruması
  const prev = hist[key];
  if (prev && typeof prev.score === 'number') {
    r.kayit = { name, prevScore: prev.score, prevKarar: prev.karar, prevTs: prev.ts, score: r.flort_sinyali.score };
  }
  hist[key] = { ts: Date.now(), karar: r.flort_sinyali.karar, score: r.flort_sinyali.score };
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(hist)); } catch {}
}
