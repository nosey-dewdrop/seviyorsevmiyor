// Rendering: the reveal is played back as an incoming chat — the app "texts you" the analysis.
// Original conversation shows as a quoted transcript; each finding drops in as a bubble after a
// typing indicator. Pure DOM, no framework. Respects prefers-reduced-motion.

const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = (ms) => new Promise((r) => setTimeout(r, REDUCED ? 0 : ms));

function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
}
function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function kinetic(text) {
  // split into words that rise+settle staggered
  return text.split(' ').map((w, i) =>
    `<span class="kw" style="animation-delay:${i * 0.06}s">${esc(w)}</span>`).join(' ');
}

// The quoted conversation the user gave us.
function transcript(messages, me, speakers) {
  const box = el('div', 'transcript');
  box.appendChild(el('div', 'tlabel', 'senin verdiğin sohbet'));
  const th = el('div', 'thread');
  for (const m of messages) {
    const mine = m.speaker === me;
    const b = el('div', `q ${mine ? 'you' : 'them'}`, esc(m.text));
    th.appendChild(b);
  }
  box.appendChild(th);
  return box;
}

// Play the whole reveal into `root` as a live incoming thread. Returns when done.
export async function playReveal(root, r, messages, me) {
  r.mesaj_okumalari = Array.isArray(r.mesaj_okumalari) ? r.mesaj_okumalari : [];
  r.bayraklar = Array.isArray(r.bayraklar) ? r.bayraklar : [];
  root.innerHTML = '';

  root.appendChild(transcript(messages, me, r.speakers));
  const stream = el('div', 'stream');
  root.appendChild(stream);
  stream.appendChild(el('div', 'sys', r.fromCloud ? 'whatdoyoumean · derin okuma' : 'whatdoyoumean okudu'));

  // typing indicator, then drop a bubble in its place
  async function say(node, { wait = 900, soft = false } = {}) {
    const typing = el('div', `app soft typing`, '<i></i><i></i><i></i>');
    stream.appendChild(typing);
    await sleep(wait);
    typing.remove();
    node.classList.add('app', 'enter');
    if (soft) node.classList.add('soft');
    stream.appendChild(node);
    requestAnimationFrame(() => node.classList.remove('enter'));
    await sleep(REDUCED ? 0 : 160);
    return node;
  }

  // 1 — verdict (kinetic)
  const v = el('div', `bubble verdict-b ton-${r.genel_ton.key}`);
  v.appendChild(el('div', 'ton', kinetic(r.genel_ton.label)));
  v.appendChild(el('div', 'ton-line', esc(r.genel_ton.line)));
  if (r.fromCloud) v.appendChild(el('span', 'cloud-badge', 'buluttan'));
  await say(v, { wait: 1100 });

  // 2 — flört signal with animated meter
  const fs = el('div', 'bubble');
  fs.appendChild(el('div', 'b-h', 'flört sinyali'));
  fs.appendChild(el('div', 'meter-num', `%${r.flort_sinyali.score}`));
  const meter = el('div', 'meter');
  const fill = el('span'); meter.appendChild(fill);
  fs.appendChild(meter);
  fs.appendChild(el('p', 'b-p', esc(r.flort_sinyali.reason)));
  await say(fs, { wait: 850 });
  requestAnimationFrame(() => { fill.style.width = `${r.flort_sinyali.score}%`; });

  // 3 — who wants it more, two-sided meter
  const share = typeof r.ilgi_dengesi.aShare === 'number'
    ? (me === 'A' ? r.ilgi_dengesi.aShare : 1 - r.ilgi_dengesi.aShare) : 0.5;
  const bal = el('div', 'bubble');
  bal.appendChild(el('div', 'b-h', 'kim daha çok istiyor?'));
  const split = el('div', 'split');
  const you = el('span', 'you-side', `<b>sen</b> <em>%${Math.round(share * 100)}</em>`);
  const other = el('span', 'other-side', `<em>%${Math.round((1 - share) * 100)}</em> <b>o</b>`);
  split.appendChild(you); split.appendChild(other);
  bal.appendChild(split);
  bal.appendChild(el('p', 'b-p', esc(r.ilgi_dengesi.line)));
  await say(bal, { wait: 850 });
  requestAnimationFrame(() => { you.style.flexGrow = String(Math.max(0.08, share)); other.style.flexGrow = String(Math.max(0.08, 1 - share)); });

  // 4 — line readings (soft bubbles, the app quoting back)
  for (const m of r.mesaj_okumalari.slice(0, 3)) {
    const rd = el('div', 'bubble reading');
    rd.appendChild(el('div', 'said', `<span class="who">${esc(m.speaker === me ? 'sen' : 'o')}:</span> ${esc(m.text)}`));
    rd.appendChild(el('div', 'mean', esc(m.read)));
    await say(rd, { wait: 650, soft: true });
  }

  // 5 — flags, each stamped in
  for (const f of r.bayraklar) {
    const fl = el('div', `bubble flag ${f.type}`);
    fl.appendChild(el('span', 'flag-dot'));
    const body = el('div', 'flag-body');
    body.appendChild(el('div', 'ttl', esc(f.title)));
    body.appendChild(el('div', 'txt', esc(f.line)));
    fl.appendChild(body);
    await say(fl, { wait: 620, soft: true });
  }

  // 6 — closing punch
  const cl = el('div', 'bubble closing-b', esc(r.kapanis));
  await say(cl, { wait: 900 });

  // 7 — unsure → cloud offer (only on-device, uncertain)
  if (r.unsure && !r.fromCloud) {
    const u = el('div', 'bubble unsure');
    u.appendChild(el('div', 'said', 'Bu vakada emin değilim. Sinyaller karışık.'));
    u.appendChild(el('div', 'mean', 'İstersen daha derin okuması için buluta gönderebilirsin. Sadece bu sohbet gider, isim taşımadan, onay kutusu işaretliyse.'));
    const cr = el('div', 'cloud-row');
    const btn = el('button', 'btn small', 'Buluta sor');
    btn.id = 'cloudBtn';
    cr.appendChild(btn);
    cr.appendChild(el('span', 'cloud-note muted', 'gizlilik: içerik saklanmaz'));
    u.appendChild(cr);
    await say(u, { wait: 700, soft: true });
  }
}
