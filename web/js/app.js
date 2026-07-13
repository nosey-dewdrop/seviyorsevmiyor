// Flow: input → parse → who-is-me → cascade (on-device model; fallback comes in Faz 2) → reveal.
import { loadModel, scoreConversation } from './model.js?v=5';
import { parseChat, toDoc } from './parse.js?v=5';
import { buildReveal } from './reveal.js?v=5';
import { playReveal } from './ui.js?v=5';
import { cloudRead } from './api.js?v=5';
import { ocrToText } from './ocr.js?v=5';
import { readWhatsApp } from './wa.js?v=5';
import { getUser, sendMagicLink, signOut, isPremium, onAuthChange } from './supa.js?v=5';

const FREE_PER_DAY = 5;
const QKEY = 'wdym.quota.v1';
const ONBOARD_KEY = 'wdym.onboarded.v1';

const $ = (id) => document.getElementById(id);
const pasteBox = $('pasteBox');
const goBtn = $('goBtn');
const resetBtn = $('resetBtn');
const whois = $('whois');
const meSeg = $('meSeg');
const reveal = $('reveal');
const quotaEl = $('quota');
const consent = $('consent');
const consentBox = $('consentBox');

let parsed = null;   // { messages, speakers, me, ambiguous }
let lastReveal = null;
let premium = false;

// ---- quota (paywall groundwork) ----
function quota() {
  const today = new Date().toISOString().slice(0, 10);
  let q = { day: today, used: 0 };
  try { const s = JSON.parse(localStorage.getItem(QKEY)); if (s && s.day === today) q = s; } catch {}
  return q;
}
function saveQuota(q) { try { localStorage.setItem(QKEY, JSON.stringify(q)); } catch {} }
function renderQuota() {
  if (premium) { quotaEl.textContent = 'Premium: sınırsız okuma'; return; }
  const q = quota();
  const left = Math.max(0, FREE_PER_DAY - q.used);
  quotaEl.textContent = `Bugün kalan ücretsiz okuma: ${left}/${FREE_PER_DAY}`;
}

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

// ---- parse as the user types ----
pasteBox.addEventListener('input', refreshParse);
function refreshParse() {
  const raw = pasteBox.value.trim();
  if (raw.length < 6) { parsed = null; whois.classList.add('hidden'); goBtn.disabled = true; return; }
  parsed = parseChat(raw);
  goBtn.disabled = parsed.messages.length < 2;
  consent.classList.toggle('hidden', parsed.messages.length < 2);
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
goBtn.addEventListener('click', async () => {
  if (!parsed) return;
  const q = quota();
  if (!premium && q.used >= FREE_PER_DAY) {
    $('paywall').classList.remove('hidden');
    return;
  }
  goBtn.disabled = true;
  goBtn.textContent = 'Okunuyor…';
  try {
    await loadModel();
    const doc = toDoc(parsed.messages);
    const toneResult = scoreConversation(doc);
    const r = buildReveal({ toneResult, messages: parsed.messages, me: parsed.me });
    lastReveal = r;
    showReveal(r);
    if (!premium) saveQuota({ day: q.day, used: q.used + 1 });
    renderQuota();
    resetBtn.classList.remove('hidden');
    reveal.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    reveal.innerHTML = '<div class="unsure">Bir şey ters gitti. Sayfayı yenileyip tekrar dener misin?</div>';
  } finally {
    goBtn.disabled = false;
    goBtn.textContent = 'Alt-metni oku';
  }
});

// Play a reveal as an incoming thread. The cloud button appears late (after the stream),
// so it is wired via delegation on the reveal container once (see below).
function showReveal(r) {
  playReveal(reveal, r, parsed.messages, parsed.me);
}
reveal.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'cloudBtn') onCloud();
});

async function onCloud() {
  if (!consentBox.checked) {
    consent.scrollIntoView({ behavior: 'smooth', block: 'center' });
    consentBox.focus();
    return;
  }
  const btn = document.getElementById('cloudBtn');
  btn.disabled = true; btn.textContent = 'Buluta soruluyor…';
  try {
    const cloudReveal = await cloudRead(toDoc(parsed.messages), parsed.me);
    cloudReveal.fromCloud = true;
    cloudReveal.unsure = false;
    lastReveal = cloudReveal;
    showReveal(cloudReveal);
  } catch (e) {
    btn.disabled = false; btn.textContent = 'Buluta sor';
    const note = btn.parentElement.querySelector('.cloud-note');
    if (note) note.textContent = e.message;
  }
}

resetBtn.addEventListener('click', () => {
  pasteBox.value = '';
  parsed = null;
  lastReveal = null;
  reveal.innerHTML = '';
  whois.classList.add('hidden');
  consent.classList.add('hidden');
  consentBox.checked = false;
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

// ---- auth + paywall ----
const authBtn = $('authBtn');
const authSheet = $('authSheet');
const authMsg = $('authMsg');

function openAuth() { authSheet.classList.remove('hidden'); $('authEmail').focus(); }
function closeAuth() { authSheet.classList.add('hidden'); authMsg.textContent = ''; }

authBtn.addEventListener('click', async () => {
  const user = await getUser();
  if (user) {
    if (confirm(`${user.email} olarak girdin. Çıkış yapılsın mı?`)) { await signOut(); location.reload(); }
  } else { openAuth(); }
});
$('authCancel').addEventListener('click', closeAuth);
$('authSend').addEventListener('click', async () => {
  const email = $('authEmail').value.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { authMsg.textContent = 'Geçerli bir e-posta gir.'; return; }
  authMsg.textContent = 'Gönderiliyor…';
  try { await sendMagicLink(email); authMsg.textContent = 'Bağlantı gönderildi. E-postandaki linke tıkla.'; }
  catch (e) { authMsg.textContent = e.message; }
});

$('pwClose').addEventListener('click', () => $('paywall').classList.add('hidden'));
$('pwPremium').addEventListener('click', async () => {
  if (!(await getUser())) { $('paywall').classList.add('hidden'); openAuth(); return; }
  alert('Premium çok yakında. Giriş yaptığın için açıldığında hesabına tanımlanacak.');
});

async function refreshAuthUi() {
  const user = await getUser();
  if (user) {
    premium = await isPremium();
    authBtn.textContent = premium ? 'Premium' : user.email.split('@')[0];
    closeAuth();
  } else {
    premium = false;
    authBtn.textContent = 'Giriş';
  }
  renderQuota();
}
onAuthChange(() => refreshAuthUi());
refreshAuthUi();

renderQuota();

// ---- theme (dark default — reads more premium, persisted) ----
const THEME_KEY = 'wdym.theme.v1';
const themeBtn = $('themeBtn');
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  if (themeBtn) themeBtn.setAttribute('aria-label', t === 'dark' ? 'Aydınlık moda geç' : 'Karanlık moda geç');
}
(function initTheme() {
  let t = 'dark';
  try { t = localStorage.getItem(THEME_KEY) || 'dark'; } catch {}
  applyTheme(t);
})();
if (themeBtn) themeBtn.addEventListener('click', () => {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try { localStorage.setItem(THEME_KEY, next); } catch {}
});
