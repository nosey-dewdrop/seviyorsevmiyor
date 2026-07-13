// Flow: input → parse → who-is-me → cascade (on-device model; fallback comes in Faz 2) → reveal.
import { loadModel, scoreConversation } from './model.js';
import { parseChat, toDoc } from './parse.js';
import { buildReveal } from './reveal.js';
import { renderReveal } from './ui.js';
import { cloudRead } from './api.js';

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

// ---- quota (paywall groundwork) ----
function quota() {
  const today = new Date().toISOString().slice(0, 10);
  let q = { day: today, used: 0 };
  try { const s = JSON.parse(localStorage.getItem(QKEY)); if (s && s.day === today) q = s; } catch {}
  return q;
}
function saveQuota(q) { try { localStorage.setItem(QKEY, JSON.stringify(q)); } catch {} }
function renderQuota() {
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
  if (q.used >= FREE_PER_DAY) {
    reveal.innerHTML = '<div class="unsure"><b>Günlük ücretsiz hakkın doldu.</b> Sınırsız okuma ve derin analiz için premium yakında açılıyor.</div>';
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
    saveQuota({ day: q.day, used: q.used + 1 });
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

// Render a reveal and (re)wire the cloud fallback button if present.
function showReveal(r) {
  reveal.innerHTML = '';
  reveal.appendChild(renderReveal(r, parsed.messages, parsed.me));
  const cloudBtn = document.getElementById('cloudBtn');
  if (cloudBtn) cloudBtn.addEventListener('click', onCloud);
}

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

renderQuota();
