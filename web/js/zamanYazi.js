// Verdict object to Turkish. Pure function, returns an HTML string, so it is testable in Node.
//
// Tone is the observer, not the friend: short, cold, mostly about the other person. The statistics
// do not disappear, they sit in their own block underneath, because a p value in the headline kills
// the sentence and a headline with no p value anywhere is the thing this engine exists not to be.

import {
  sec, ACILIS_KIRILMA, ACILIS_YOK, ACILIS_KESINTI, CUMLE, arketip,
  KAPANIS_KIRILMA, KAPANIS_YOK,
} from './soz.js?v=71';

const AY = ['ocak', 'şubat', 'mart', 'nisan', 'mayıs', 'haziran',
  'temmuz', 'ağustos', 'eylül', 'ekim', 'kasım', 'aralık'];

function tarih(min) {
  const d = new Date(min * 60000);
  return `${d.getUTCDate()} ${AY[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
function kisaTarih(min) {
  const d = new Date(min * 60000);
  return `${d.getUTCDate()} ${AY[d.getUTCMonth()]}`;
}
function sure(dk) {
  if (dk == null) return 'bilinmiyor';
  if (dk < 1) return 'bir dakikadan az';
  if (dk < 60) return `${Math.round(dk)} dakika`;
  if (dk < 1440) {
    const s = dk / 60;
    return `${s < 10 ? s.toFixed(1).replace('.', ',') : Math.round(s)} saat`;
  }
  return `${Math.round(dk / 1440)} gün`;
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function yuzde(p) { return `%${Math.round(p * 100)}`; }

const ETIKET = {
  gecikme: 'cevap süresi',
  baslatma: 'konuşmayı başlatma',
  bitiren: 'konuşmayı bitirme',
  uzunluk: 'mesaj uzunluğu',
  gece: 'gece yazma',
  sessizlik: 'aradaki sessizlik',
};

function kavram(label) { return String(label).replace(/_[AB]$/, ''); }

// "A ends conversations more" and "B ends conversations less" are one sentence said twice, once
// forwards and once in a mirror. Keep one line per concept, and where the two sides are
// complementary keep the side whose share went UP, because that is the one worth reading.
const AYNALI = new Set(['baslatma', 'bitiren']);
function tekilleştir(points) {
  const out = [];
  const gorulen = new Map();
  for (const p of points) {
    const k = kavram(p.label);
    if (!AYNALI.has(k)) { out.push(p); continue; }
    const onceki = gorulen.get(k);
    const yukseldi = p.after > p.before;
    if (!onceki) { gorulen.set(k, p); continue; }
    if (yukseldi && !(onceki.after > onceki.before)) gorulen.set(k, p);
  }
  for (const p of gorulen.values()) out.push(p);
  return out.sort((a, b) => a.ts - b.ts);
}
function taraf(label, ad) {
  const m = String(label).match(/_([AB])$/);
  return m ? ad[m[1]] : null;
}

// The sentence comes from the phrasebook, the values come from the engine. The model never sees a
// number and never writes one, so a fabricated figure is not possible here.
function noktaCumlesi(p, ad, seed, slot) {
  const k = kavram(p.label);
  const kim = taraf(p.label, ad);
  let onceki, sonraki, fark = '';

  if (k === 'gecikme' || k === 'sessizlik') {
    const a = Math.exp(p.before) - 0.5;
    const b = Math.exp(p.after) - 0.5;
    onceki = sure(a);
    sonraki = sure(b);
    fark = (b / Math.max(a, 0.5)).toFixed(1).replace('.', ',');
  } else if (k === 'uzunluk') {
    onceki = `${Math.round(Math.exp(p.before) - 1)} kelime`;
    sonraki = `${Math.round(Math.exp(p.after) - 1)} kelime`;
  } else {
    onceki = yuzde(p.before);
    sonraki = yuzde(p.after);
  }

  const kalip = sec(CUMLE[k], seed, slot);
  if (!kalip) return `${ETIKET[k] || k} değişti.`;
  return kalip
    .replace('{kim}', kim ? esc(kim) : 'karşı taraf')
    .replace('{onceki}', onceki)
    .replace('{sonraki}', sonraki)
    .replace('{fark}', fark);
}

// Inputs for the archetype label, all of them plain counts.
function arketipVerisi(res) {
  const s = res.summary;
  const lat = res.latency;
  const me = 'A';
  const other = 'B';
  // One source for this ratio. Computing it here as a raw median ratio while the details block
  // derived it from the log2 asymmetry printed 11,2 and 10,4 for the same fact on the same screen.
  const asim = lat.asymmetry;
  const oranGecikme = asim && asim.different ? Math.pow(2, Math.abs(asim.ratio)) : null;
  const gecOlan = asim ? (asim.ratio > 0 ? res.speakers.A : res.speakers.B) : null;
  const senMsj = s[me].messages || 1;
  const oMsj = s[other].messages || 1;
  return {
    oranGecikme,
    gecOlan,
    senKelime: Math.round(s[me].words / senMsj),
    oKelime: Math.round(s[other].words / oMsj),
    senBaslatmaPay: s.sessions ? s[me].starts / s.sessions : 0,
    uzunSessizlik: s.longestSilenceMin != null ? Math.round(s.longestSilenceMin / 1440) : null,
    geceBirlesik: (s[me].nightMessages + s[other].nightMessages) / (senMsj + oMsj),
    oturum: s.sessions,
  };
}

function redKarti(res) {
  if (res.reason === 'grup') {
    return `<div class="kart">
      <h2>bu bir grup sohbeti.</h2>
      <p>ikiden fazla kişi var, o yüzden kimin kime cevap verdiği belirsiz. ${res.dropped} mesaj
      zaten okunamadan düştü. bu motor sadece iki kişilik sohbette doğru sayar, o yüzden konuşmuyor.</p>
      <button class="btn" id="yeniBtn" type="button">başka dosya</button></div>`;
  }
  if (res.reason === 'damga_yok') {
    return `<div class="kart">
      <h2>bu dosyada saat yok.</h2>
      <p>yapıştırılmış metinde tarih ve saat olmuyor, motor da zamanı okuyamıyor. whatsapp içinden
      <b>sohbeti dışa aktar</b> ile alınan dosya gerekiyor.</p>
      <button class="btn" id="yeniBtn" type="button">başka dosya</button></div>`;
  }
  if (res.reason === 'veri_yetersiz') {
    const eksik = res.gate.reasons
      .map((r) => `<li>${r.what === 'mesaj' ? 'mesaj' : 'gün'}: <b>${r.have}</b> var, <b>${r.need}</b> gerekiyor.</li>`)
      .join('');
    return `<div class="kart">
      <h2>bu sohbet bir şey söylemeye yetmiyor.</h2>
      <p>uydurmaktansa susuyor. eksik olan şu.</p>
      <ul class="eksikler">${eksik}</ul>
      <p class="ince">daha uzun bir sohbet dene.</p>
      <button class="btn" id="yeniBtn" type="button">başka dosya</button></div>`;
  }
  return `<div class="kart"><h2>okunamadı.</h2>
    <p>${esc(res.reason || 'bilinmeyen sebep')}</p>
    <button class="btn" id="yeniBtn" type="button">başka dosya</button></div>`;
}

export function yaz(res, dosyaAdi) {
  if (!res || !res.ok) return redKarti(res || {});

  const ad = res.speakers;
  const s = res.summary;
  const gosterilebilir = tekilleştir(res.points.filter((p) => p.dateShowable && p.kind === 'degisim'));
  const kesintiler = res.points.filter((p) => p.kind === 'kesinti');

  const seed = res.seed >>> 0;
  let mansel;
  if (gosterilebilir.length) {
    const j = res.joint;
    const ana = j
      ? gosterilebilir.reduce((a, p) => (Math.abs(p.ts - j.ts) < Math.abs(a.ts - j.ts) ? p : a))
      : gosterilebilir[0];
    const lo = ana.tsLo != null ? kisaTarih(ana.tsLo) : null;
    const hi = ana.tsHi != null ? kisaTarih(ana.tsHi) : null;
    const aralik = lo && hi && lo !== hi ? ` <span class="aralik">(${lo} ile ${hi} arası)</span>` : '';
    mansel = `<p class="acilis">${sec(ACILIS_KIRILMA, seed, 1)}</p>
      <p class="tarih">${tarih(ana.ts)}${aralik}</p>
      <ul class="degisimler">${gosterilebilir.map((p, i) => `<li>${noktaCumlesi(p, ad, seed, i + 2)}</li>`).join('')}</ul>`;
    if (j && j.k >= 2) {
      const bir = Math.round(1 / j.prob);
      mansel += `<p class="birlesik">${sec(KAPANIS_KIRILMA, seed, 9)}
        ${j.k} ayrı ölçüm aynı iki haftaya düştü. bunun rastlantı olma ihtimali ${bir} de 1.</p>`;
    }
  } else if (res.points.length) {
    mansel = `<p class="acilis">${sec(ACILIS_KIRILMA, seed, 1)}</p>
      <p class="tarih">gün net değil.</p>
      <ul class="degisimler">${tekilleştir(res.points).map((p, i) => `<li>${noktaCumlesi(p, ad, seed, i + 2)}</li>`).join('')}</ul>
      <p class="ince">tarih aralığı ${res.need.ciDaysMax} günden geniş çıktı, o yüzden gün yazılmıyor.</p>`;
  } else {
    mansel = `<p class="acilis">${sec(ACILIS_YOK, seed, 1)}</p>
      <p class="tarih">bir kırılma yok.</p>
      <p class="ince">motor ${Math.round(s.spanDays)} günü taradı ve hiçbir tarihte kalıcı bir değişiklik bulamadı.
      ${sec(KAPANIS_YOK, seed, 9)}</p>`;
  }

  const av = arketipVerisi(res);
  const ark = arketip(av, { ben: esc(ad.A), o: esc(ad.B), gec: esc(av.gecOlan || ad.B) });
  const arketipBlok = ark
    ? `<div class="arketip"><span class="ark-ad">${esc(ark.ad)}</span><span class="ark-kanit">${ark.kanit}</span></div>`
    : '';

  const kesintiBlok = kesintiler.length
    ? `<p class="kesinti">${sec(ACILIS_KESINTI, seed, 20)}
       ${tarih(kesintiler[0].ts)} civarındaki değişiklik uzun bir sessizliğin içine düşüyor,
       o yüzden duygu değişimi olarak okunmamalı.</p>`
    : '';

  const lat = res.latency;
  const asim = lat.asymmetry;
  // The factor is 2^|ratio|. Using 2^ratio directly printed "0,1 kat slower", which is the
  // reciprocal of the true 11,2 and reads as the opposite of what the data says.
  const asimSatir = asim
    ? (asim.different
      ? `<li>${esc(asim.ratio > 0 ? ad.A : ad.B)} ${Math.pow(2, Math.abs(asim.ratio)).toFixed(1).replace('.', ',')} kat daha geç dönüyor.</li>`
      : '<li>cevap sürelerinde iki taraf arasında anlamlı bir fark yok.</li>')
    : '';

  const bitirenA = res.lastWord.A;
  const bitirenSatir = bitirenA && bitirenA.significant
    ? `<li>konuşmaları çoğunlukla ${esc(bitirenA.lift > 0 ? ad.A : ad.B)} bitiriyor, mesaj payından ${yuzde(Math.abs(bitirenA.lift))} fazla.</li>`
    : '<li>konuşmayı kimin bitirdiği, kimin daha çok yazdığıyla açıklanıyor.</li>';

  const sayilar = `
    <div class="sayilar">
      <div class="say"><b>${s.messages}</b><span>mesaj</span></div>
      <div class="say"><b>${Math.round(s.spanDays)}</b><span>gün</span></div>
      <div class="say"><b>${s.sessions}</b><span>konuşma</span></div>
      <div class="say"><b>${sure(lat.A ? lat.A.median : null)}</b><span>${esc(ad.A)} cevap</span></div>
      <div class="say"><b>${sure(lat.B ? lat.B.median : null)}</b><span>${esc(ad.B)} cevap</span></div>
      <div class="say"><b>${s.A.starts}/${s.B.starts}</b><span>${esc(ad.A)} / ${esc(ad.B)} başlatma</span></div>
    </div>`;

  const uyarilar = [];
  if (res.tauFallback) uyarilar.push('konuşma sınırı verinin kendisinden çıkarılamadı, 60 dakika varsayıldı.');
  if (res.tz && res.tz.suspect) uyarilar.push(`iki taraf arasında ${Math.abs(res.tz.shift)} saatlik bir gün farkı var. farklı saat dilimi olabilir, gece yazma sayıları bu yüzden yanıltıcı olabilir.`);
  if (res.tsAmbiguous) uyarilar.push('dosyada gün ve ay sırası kesin belirlenemedi, gün-ay varsayıldı.');
  if (res.unstamped) uyarilar.push(`${res.unstamped} satırda saat yoktu, zaman hesabına girmediler.`);
  if (res.underpowered) uyarilar.push('sinyal sayısı çok, test gücü sınırda kaldı.');

  const nasil = `
    <details class="nasil-okudum">
      <summary>bunu nasıl okudum?</summary>
      <ul>
        <li>${s.messages} mesaj, ${s.A.turns + s.B.turns} sıra, ${s.sessions} ayrı konuşma.</li>
        <li>konuşma sınırı ${res.tau} dakika. bu, sohbetin kendi boşluk dağılımından çıkarıldı.</li>
        <li>cevap süresi hesaplanırken karşı tarafın uyku saatleri düşüldü.</li>
        <li>tarih, sıralama tabanlı bir kırılma testiyle bulundu. anlamlılık ${1000} karıştırma denemesiyle ölçüldü.</li>
        <li>yavaş bir eğim kırılma sayılmaz. aday, düz bir çizgiden daha iyi açıklamak zorunda.</li>
        ${asimSatir}
        ${bitirenSatir}
        ${s.longestSilenceMin ? `<li>en uzun sessizlik ${sure(s.longestSilenceMin)}, ${tarih(s.longestSilenceTs)} öncesi.</li>` : ''}
        ${res.refused.length ? `<li>yetersiz veri yüzünden bakılmayanlar: ${res.refused.map((r) => `${ETIKET[kavram(r.key)] || r.key} (${r.have}/${r.need})`).join(', ')}.</li>` : ''}
        ${uyarilar.map((u) => `<li>${u}</li>`).join('')}
        <li>hiçbir mesaj bu cihazdan çıkmadı.</li>
      </ul>
    </details>`;

  return `<div class="kart">
    <p class="ust-etiket">${esc(ad.A)} ve ${esc(ad.B)}</p>
    ${mansel}
    ${arketipBlok}
    ${kesintiBlok}
    ${sayilar}
    ${nasil}
    <button class="btn" id="yeniBtn" type="button">başka sohbet</button>
  </div>`;
}
