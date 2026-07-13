// Flow: input → parse → who-is-me → on-device engine (verdict + counts = the law) →
// optional Groq/Llama spiker (fresh wording + gözden kaçanlar, consent-gated) → reveal.
// Free and unlimited (Damla, 13 Tem: money is not a goal here — idea tool, audience first).
import { loadModel, scoreConversation } from './model.js?v=18';
import { parseChat, toDoc } from './parse.js?v=18';
import { buildReveal } from './reveal.js?v=18';
import { playReveal } from './ui.js?v=18';
import { spikerRead } from './api.js?v=18';
import { ocrToText } from './ocr.js?v=18';
import { readWhatsApp } from './wa.js?v=18';

const ONBOARD_KEY = 'wdym.onboarded.v1';

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

// ---- tabs ----
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
  t.classList.add('active');
  ['paste', 'shot', 'wa'].forEach((k) => $(`pane-${k}`).classList.toggle('hidden', k !== t.dataset.tab));
}));

// ---- screenshot (OCR) + WhatsApp file inputs feed the same paste flow ----
function activateTab(name) {
  document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x.dataset.tab === name));
  ['paste', 'shot', 'wa'].forEach((k) => $(`pane-${k}`).classList.toggle('hidden', k !== name));
}
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
  shotStatus.textContent = 'Ekran görüntüsü okunuyor…';
  try {
    const text = await ocrToText(file, (p) => { shotStatus.textContent = `Okunuyor… %${Math.round(p * 100)}`; });
    if (!text) throw new Error('Metin çıkmadı');
    ingestText(text);
    shotStatus.textContent = 'Okundu, aşağıda düzenleyebilirsin.';
  } catch (err) {
    shotStatus.textContent = 'Okunamadı, başka bir görsel dene ya da metni yapıştır.';
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
  waStatus.textContent = 'Dosya okunuyor…';
  try {
    const text = await readWhatsApp(file);
    if (!text || !text.trim()) throw new Error('Dosya boş görünüyor');
    ingestText(text);
    waStatus.textContent = 'Okundu, aşağıda düzenleyebilirsin.';
  } catch (err) {
    waStatus.textContent = err.message || 'Dosya okunamadı';
  } finally {
    e.target.value = '';
  }
});

// ---- demo chat: a stranger should feel the product in five seconds ----
const DEMO_CHAT = `Ben: naber, bugün ne yaptın?
O: iş güç işte
Ben: ben bugün o kafeye gittim hani beraber gitmiştik ya, aklıma sen geldin
O: hı
Ben: bu hafta sonu müsait misin? şu sergiye gidelim mi demiştik
O: bakarız
Ben: geçen de öyle demiştin ama :( özledim seni ya
O: yoğunum bu ara
Ben: tamam, haber ver o zaman?
O: ok`;
$('demoBtn').addEventListener('click', () => { ingestText(DEMO_CHAT); });

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
// Facts sent to the spiker: EXPLICIT named numbers, never "5-3" strings — Llama once read
// "mesaj 5-3" as "3 of 5 messages"; ambiguity is how numbers get bent. Fields are the law.
function spikerFacts(r) {
  const n = r.nasil || {};
  return {
    hukum: { tur: r.genel_ton.key, etiket: r.genel_ton.label, cumle: r.genel_ton.line, gerekce: r.genel_ton.why || null },
    flort: { karar: r.flort_sinyali.karar, yuzde: r.flort_sinyali.score, sende_yuzde: r.flort_sinyali.me, onda_yuzde: r.flort_sinyali.other },
    sayim: {
      toplam_mesaj: n.msgs, senin_mesajin: n.mine, onun_mesaji: n.theirs,
      senin_sorun: n.questionsMine, onun_sorusu: n.questionsTheirs,
      red_flag_turu: n.redKinds, green_flag: n.greens,
    },
    denge: { cumle: r.ilgi_dengesi.line },
    okumalar: r.mesaj_okumalari.map((m) => ({ mesaj: m.text, okuma: m.read })),
    bayraklar: r.bayraklar.map((f) => ({ tur: f.type, baslik: f.title })),
    kapanis: r.kapanis,
  };
}

function spikerDoc(messages, me) {
  return messages.map((m) => `${m.speaker === me ? 'SEN' : 'O'}: ${m.text}`).join('\n');
}

// The spiker may only restyle wording and add evidence-quoted observations; every merged
// field keeps its template floor if the cloud returns nothing.
function mergeSpiker(r, sp) {
  if (sp.ton_line) r.genel_ton.line = sp.ton_line;
  if (sp.sinyal_reason) r.flort_sinyali.reason = sp.sinyal_reason;
  if (sp.denge_line) r.ilgi_dengesi.line = sp.denge_line;
  if (Array.isArray(sp.okumalar)) {
    r.mesaj_okumalari.forEach((m, i) => { if (sp.okumalar[i]) m.read = sp.okumalar[i]; });
  }
  if (sp.kapanis) r.kapanis = sp.kapanis;
  r.gozden_kacanlar = sp.gozden_kacanlar || [];
  r.spiker = true;
}

goBtn.addEventListener('click', async () => {
  if (!parsed) return;
  goBtn.disabled = true;
  goBtn.textContent = 'Okunuyor…';
  try {
    await loadModel();
    const doc = toDoc(parsed.messages);
    const toneResult = scoreConversation(doc);
    const r = buildReveal({ toneResult, messages: parsed.messages, me: parsed.me });
    if (consentBox.checked && cloudConsentBox.checked) {
      goBtn.textContent = 'Spiker yazıyor…';
      const sp = await spikerRead(spikerFacts(r), spikerDoc(parsed.messages, parsed.me));
      if (sp) mergeSpiker(r, sp);
    }
    lastReveal = r;
    playReveal(reveal, r, parsed.messages, parsed.me);
    resetBtn.classList.remove('hidden');
    reveal.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    reveal.innerHTML = '<div class="unsure">Bir şey ters gitti. Sayfayı yenileyip tekrar dener misin?</div>';
  } finally {
    goBtn.disabled = false;
    goBtn.textContent = 'Alt-metni oku';
  }
});

resetBtn.addEventListener('click', () => {
  pasteBox.value = '';
  parsed = null;
  lastReveal = null;
  reveal.innerHTML = '';
  whois.classList.add('hidden');
  consent.classList.add('hidden');
  consentBox.checked = false;
  cloudConsent.classList.add('hidden');
  cloudConsentBox.checked = false;
  resetBtn.classList.add('hidden');
  goBtn.disabled = true;
  pasteBox.focus();
});

// ---- onboarding ----
if (!localStorage.getItem(ONBOARD_KEY)) $('onboard').classList.remove('hidden');
$('onboardClose').addEventListener('click', () => {
  $('onboard').classList.add('hidden');
  try { localStorage.setItem(ONBOARD_KEY, '1'); } catch {}
});

// theme toggle removed 13 Tem gece (Damla: "light mode kaldıralım") — the site is dark only.
