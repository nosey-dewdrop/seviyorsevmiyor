// Rendering: normalized chat → bubbles, reveal object → cards. Pure DOM, no framework.

function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
}
function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

export function renderThread(messages, me) {
  const box = el('div', 'thread');
  for (const m of messages) {
    const mine = m.speaker === me;
    box.appendChild(el('div', `bubble ${mine ? 'me' : 'them'}`, esc(m.text)));
  }
  return box;
}

export function renderReveal(r, messages, me) {
  r.mesaj_okumalari = Array.isArray(r.mesaj_okumalari) ? r.mesaj_okumalari : [];
  r.bayraklar = Array.isArray(r.bayraklar) ? r.bayraklar : [];
  const root = el('div', 'reveal-inner');
  root.appendChild(renderThread(messages, me));

  if (r.unsure && !r.fromCloud) {
    const u = el('div', 'unsure',
      '<b>Bu vakada emin değilim.</b> Sinyaller karışık. İstersen bunu daha derin okuması için buluta gönderebilirsin. Sadece bu sohbet gider, isim taşımadan; onay kutusu işaretliyse.');
    const cr = el('div', 'cloud-row');
    const btn = el('button', 'btn small', 'Buluta sor');
    btn.id = 'cloudBtn';
    cr.appendChild(btn);
    cr.appendChild(el('span', 'cloud-note', 'gizlilik: içerik saklanmaz'));
    u.appendChild(cr);
    root.appendChild(u);
  }

  const v = el('div', 'verdict');
  const ton = el('div', `ton ${r.genel_ton.key}`, esc(r.genel_ton.label));
  if (r.fromCloud) ton.appendChild(el('span', 'cloud-badge', 'buluttan'));
  v.appendChild(ton);
  v.appendChild(el('div', 'ton-line', esc(r.genel_ton.line)));
  root.appendChild(v);

  const fs = el('div', 'card');
  fs.appendChild(el('h3', null, 'Flört sinyali'));
  fs.appendChild(el('div', 'meter-num', `%${r.flort_sinyali.score}`));
  const meter = el('div', 'meter');
  meter.appendChild(el('span', null, '')).style.width = `${r.flort_sinyali.score}%`;
  fs.appendChild(meter);
  fs.appendChild(el('p', null, esc(r.flort_sinyali.reason)));
  root.appendChild(fs);

  const bal = el('div', 'card');
  bal.appendChild(el('h3', null, 'Kim daha çok istiyor'));
  bal.appendChild(el('p', null, esc(r.ilgi_dengesi.line)));
  root.appendChild(bal);

  if (r.mesaj_okumalari.length) {
    const mr = el('div', 'card');
    mr.appendChild(el('h3', null, 'Satır arası'));
    for (const m of r.mesaj_okumalari) {
      const rd = el('div', 'reading');
      rd.appendChild(el('div', 'said', `<b>${esc(m.speaker === me ? 'sen' : 'o')}:</b> ${esc(m.text)}`));
      rd.appendChild(el('div', 'mean', esc(m.read)));
      mr.appendChild(rd);
    }
    root.appendChild(mr);
  }

  if (r.bayraklar.length) {
    const fl = el('div', 'card');
    fl.appendChild(el('h3', null, 'Bayraklar'));
    for (const f of r.bayraklar) {
      const row = el('div', `flag ${f.type}`);
      row.appendChild(el('span', 'dot'));
      const body = el('div');
      body.appendChild(el('div', 'ttl', esc(f.title)));
      body.appendChild(el('div', 'txt', esc(f.line)));
      row.appendChild(body);
      fl.appendChild(row);
    }
    root.appendChild(fl);
  }

  root.appendChild(el('div', 'closing', esc(r.kapanis)));
  return root;
}
