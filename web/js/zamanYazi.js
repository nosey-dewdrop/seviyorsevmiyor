// Verdict object to Turkish. Pure function, returns an HTML string, so it is testable in Node.
//
// Tone is the observer, not the friend: short, cold, mostly about the other person. The statistics
// do not disappear, they sit in their own block underneath, because a p value in the headline kills
// the sentence and a headline with no p value anywhere is the thing this engine exists not to be.

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

function noktaCumlesi(p, ad) {
  const k = kavram(p.label);
  const kim = taraf(p.label, ad);
  const ne = ETIKET[k] || k;
  if (k === 'gecikme') {
    const a = sure(Math.exp(p.before) - 0.5);
    const b = sure(Math.exp(p.after) - 0.5);
    return `${kim ? esc(kim) + ' ' : ''}cevap süresi ${a} iken ${b} oldu.`;
  }
  if (k === 'sessizlik') {
    const a = sure(Math.exp(p.before) - 0.5);
    const b = sure(Math.exp(p.after) - 0.5);
    return `konuşmalar arasındaki sessizlik ${a} iken ${b} oldu.`;
  }
  if (k === 'uzunluk') {
    const a = Math.round(Math.exp(p.before) - 1);
    const b = Math.round(Math.exp(p.after) - 1);
    return `${kim ? esc(kim) + ' ' : ''}mesaj başına ${a} kelime yazarken ${b} kelime yazar oldu.`;
  }
  if (k === 'baslatma' || k === 'bitiren' || k === 'gece') {
    return `${kim ? esc(kim) + ' ' : ''}${ne} payı ${yuzde(p.before)} iken ${yuzde(p.after)} oldu.`;
  }
  return `${ne} değişti.`;
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

  let mansel;
  if (gosterilebilir.length) {
    const j = res.joint;
    const ana = j
      ? gosterilebilir.reduce((a, p) => (Math.abs(p.ts - j.ts) < Math.abs(a.ts - j.ts) ? p : a))
      : gosterilebilir[0];
    const lo = ana.tsLo != null ? kisaTarih(ana.tsLo) : null;
    const hi = ana.tsHi != null ? kisaTarih(ana.tsHi) : null;
    const aralik = lo && hi && lo !== hi ? ` <span class="aralik">(${lo} ile ${hi} arası)</span>` : '';
    mansel = `<p class="tarih">${tarih(ana.ts)}${aralik}</p>
      <ul class="degisimler">${gosterilebilir.map((p) => `<li>${noktaCumlesi(p, ad)}</li>`).join('')}</ul>`;
    if (j && j.k >= 2) {
      const bir = Math.round(1 / j.prob);
      mansel += `<p class="birlesik">aynı iki hafta içinde ${j.k} ayrı şey değişti.
        bunun rastlantı olma ihtimali ${bir} de 1.</p>`;
    }
  } else if (res.points.length) {
    mansel = `<p class="tarih">bir şey değişti, ama tarihi net değil.</p>
      <ul class="degisimler">${tekilleştir(res.points).map((p) => `<li>${noktaCumlesi(p, ad)}</li>`).join('')}</ul>
      <p class="ince">tarih aralığı ${res.need.ciDaysMax} günden geniş çıktı, o yüzden gün yazılmıyor.</p>`;
  } else {
    mansel = `<p class="tarih">bu sohbette bir kırılma yok.</p>
      <p class="ince">motor ${Math.round(s.spanDays)} günü tarayıp hiçbir tarihte kalıcı bir değişiklik bulamadı.
      yavaşça değişmiş olabilir, ama bir gün gösteremiyorum.</p>`;
  }

  const kesintiBlok = kesintiler.length
    ? `<p class="kesinti">${kesintiler.map((p) => `${tarih(p.ts)} civarındaki değişiklik uzun bir sessizliğin içine düşüyor. bu bir kopukluk, duygu değişimi olarak okunmamalı.`).join(' ')}</p>`
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
    ${kesintiBlok}
    ${sayilar}
    ${nasil}
    <button class="btn" id="yeniBtn" type="button">başka sohbet</button>
  </div>`;
}
