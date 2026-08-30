// v21 sahnesi: analiz anında yorum ORTADA daktilo gibi yazılır,
// bitince sol tarafa printable kart (terazi + barlar + ölçümler), sağ tarafa yorum paragrafları
// oturur. Her yorum satırı tıklanabilir: altında "NEDEN BÖYLE OKUDUM?" + "BAŞKA TÜRLÜSÜ MÜMKÜN MÜ?"
// + rızalı bağış açılır. Karttaki her sayı gerçek sohbetten hesaplanır, elle sayı yazılmaz.

import { ping, itirazGonder, biletAl, spikerRead, BILET_GEREKLI } from './api.js?v=75';
import { deflectedPlans } from './balance.js?v=75';

// Guarded so train/bos_ekran_check.mjs can import the real spikerDene / spikerKapaliMetni below
// in Node instead of retyping them.
const REDUCED = typeof window !== 'undefined' && window.matchMedia
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- canlı spiker: bulut yolu kapalıysa bunu ADIYLA söyle ----
//
// The visitor ticks "canlı spiker" and spikerRead returns null; app.js used to skip the merge with
// `if (sp)` and show the shipped template lines with nothing on screen saying so. The box they
// ticked did nothing and no one told them. Same rule as the time flow: the cause is named.
export const SPIKER_SEBEPLER = ['onay_yok', 'bilet_yok', 'ag_hatasi'];

const SPIKER_KAPALI = {
  onay_yok: 'canlı spiker çalışmadı çünkü buluta gönderme onayı verilmedi. onay olmadan sohbetin '
    + 'tek karakteri bile cihazından çıkmaz, o yüzden istek hiç kurulmadı. yorum cümlelerini '
    + 'cihazındaki şablon yazdı. hüküm ve sayılar zaten cihazda hesaplanıyordu, onlar değişmedi.',
  bilet_yok: 'canlı spikeri işaretledin ama bulut yolu şu an kapalı: bu sürümde doğrulama anahtarı '
    + 'tanımlı değil, o yüzden istek hiç gönderilmedi. yukarıdaki yorum cümlelerini cihazındaki '
    + 'şablon yazdı. hüküm ve sayılar zaten cihazda hesaplanıyordu, onlar değişmedi.',
  ag_hatasi: 'canlı spikeri işaretledin, istek gitti ama bulut kabul edilebilir bir okuma dönmedi. '
    + 'yorum cümlelerini bu yüzden cihazın kendi şablonu yazdı. sohbeti tekrar okutursan spiker '
    + 'yeniden denenir. hüküm ve sayılar buluttan gelmiyordu, onlar aynı.',
};

export function spikerKapaliMetni(sebep) {
  return SPIKER_KAPALI[sebep] || SPIKER_KAPALI.ag_hatasi;
}

/**
 * Three outcomes, three named causes, so "nothing happened" is never shown as a template line with
 * no explanation next to it.
 *
 * The consent check is asked FIRST and asked here as well as inside spikerRead, because this is the
 * layer that has to be able to say WHY nothing was sent. deps exists for the gate; the defaults are
 * the real client.
 *
 * @param {{sohbet: string, onay: boolean}} istek
 */
export async function spikerDene(istek, deps = {}) {
  const bilet = deps.bilet || biletAl;
  const oku = deps.oku || spikerRead;
  const biletGerekli = deps.biletGerekli === undefined ? BILET_GEREKLI : deps.biletGerekli;
  if (!istek || istek.onay !== true) return { sp: null, sebep: 'onay_yok' };
  if (biletGerekli) {
    const token = await bilet();
    if (!token) return { sp: null, sebep: 'bilet_yok' };
  }
  const sp = await oku(istek);
  if (!sp) return { sp: null, sebep: 'ag_hatasi' };
  return { sp, sebep: null };
}

function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
}
function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

const KARAR_TEXT = { var: 'flört var.', yok: 'flört yok.', tek: 'flört var, ama tek taraflı.' };

// ---- kart istatistikleri: hepsi parse edilmiş sohbetten sayılır ----
export function computeStats(messages, me) {
  const sen = [], o = [];
  let cift = 0, prevMine = null;
  for (const m of messages) {
    const mine = m.speaker === me;
    (mine ? sen : o).push(m.text);
    if (mine && prevMine === true) cift += 1;
    prevMine = mine;
  }
  const kelime = (s) => s.trim().split(/\s+/).filter(Boolean).length;
  const soru = (a) => a.filter((s) => s.includes('?')).length;
  const ort = (a) => {
    const t = a.reduce((x, s) => x + kelime(s), 0);
    return a.length ? +(t / a.length).toFixed(1) : 0;
  };
  const oKelimeler = o.map(kelime);
  const kuru = oKelimeler.filter((k) => k <= 2).length;
  return {
    baslatan: messages.length ? (messages[0].speaker === me ? 'sen' : 'o') : 'sen',
    senN: sen.length, oN: o.length,
    senSoru: soru(sen), oSoru: soru(o),
    senOrt: ort(sen), oOrt: ort(o),
    kuru, kuruOran: o.length ? Math.round(100 * kuru / o.length) : 0,
    cift,
    erteleme: deflectedPlans(messages),
    senKelimeler: sen.map(kelime), oKelimeler,
  };
}

// cihaz-yerel okuma sayacı: karttaki "okuma NNNN" bu cihazın kaçıncı okuması, uydurma değil
function nextOkumaNo() {
  let n = 0;
  try {
    n = parseInt(localStorage.getItem('svs.okuma.no') || '0', 10) || 0;
    n += 1;
    localStorage.setItem('svs.okuma.no', String(n));
  } catch { n = 1; }
  return String(n).padStart(4, '0');
}
function bugunTarih() {
  const d = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

// ---- yorum paragrafları + itiraz gerekçeleri (şablonlar motor sayılarına bağlı, tire yok) ----
function buildParagraphs(r, st) {
  const n = r.nasil || {};
  const P = [];

  P.push({
    html: `${esc(r.genel_ton.line)}${r.genel_ton.why ? ' ' + esc(r.genel_ton.why) : ''}${r.genel_ton.caveat ? ' ' + esc(r.genel_ton.caveat) : ''}`,
    g: {
      neden: n.overridden
        ? `model "${n.modelTone}" dedi (%${n.modelConf} güven) ama sayılan sinyaller ağır bastı. ${n.redKinds} red flag türü ve denge sayımı hükmü çevirdi.`
        : `ton modeli %${n.modelConf} güvenle "${n.modelTone}" dedi. hüküm bu skora ve sayımlara dayanıyor, hiçbir cümle uydurulmadı.`,
      alt: 'kısa kesitlerde ton yanılabilir. sohbetin daha uzun bir dökümünü bırakırsan okuma değişebilir.',
    },
  });

  P.push({
    html: `<b>${esc(KARAR_TEXT[r.flort_sinyali.karar] || KARAR_TEXT.yok)}</b> ${esc(r.flort_sinyali.reason)}`,
    g: {
      neden: r.flort_sinyali.oneSided
        ? `yakınlık dili iki taraf için ayrı sayıldı: sende %${r.flort_sinyali.me}, onda %${r.flort_sinyali.other}. tek taraflılık bu farktan geliyor.`
        : `flört sinyali %${r.flort_sinyali.score}. skor, ton modelinin flört olasılığı artı sayılan sıcak kelimelerden geliyor.`,
      alt: 'bazı insanlar ilgiyi yazıya dökmez. hüküm sadece bu yazışmaya bakar, yüz yüzesi başka bir hikaye olabilir.',
    },
  });

  P.push({
    html: `<b>soru dengesi</b> en az yanıltan ölçü. merak eden sorar: senden ${st.senSoru} soru çıkmış, ${st.oSoru} soru dönmüş. ${esc(r.ilgi_dengesi.line)}`,
    g: {
      neden: `sayım düz metinden: mesaj sende ${st.senN}, onda ${st.oN}. soru sende ${st.senSoru}, onda ${st.oSoru}. üst üste yazma sende ${st.cift}. denge bu sayılardan çıktı.`,
      alt: 'soru sormadan da ilgi gösterilir: hızlı cevap, karşı teklif, uzun mesaj. o sinyaller de sayılıyor, yönü değiştirmediler.',
    },
  });

  if (st.oN > 0) {
    P.push({
      html: `<b>kuru cevap:</b> onun ${st.oN} mesajından ${st.kuru} tanesi iki kelime ya da altında. oran %${st.kuruOran}. buna internet "dry texting" diyor.`,
      g: {
        neden: `eşik 2 kelime. sayım mesaj mesaj yapıldı: ${st.kuru}/${st.oN}, oran %${st.kuruOran} oradan geldi.`,
        alt: 'yoğun bir dönemde herkes kısalır. ama cevapların yarıdan çoğu kuruysa buna dönem değil desen denir.',
      },
    });
  }

  if (st.erteleme > 0) {
    P.push({
      html: `<b>plan:</b> ${st.erteleme} plan teklifi ertelemeyle karşılanmış. flört var ama buluşma yoksa buna "breadcrumbing" deniyor: seni aç bırakmayacak kadar kırıntı, doyurmayacak kadar az.`,
      g: {
        neden: `plan cümlesinin hemen ardından gelen cevaplar tarandı. ${st.erteleme} kez erteleme kalıbı döndü. kaynak yine sohbetin kendisi.`,
        alt: 'gerçekten müsait olmayabilir. o zaman karşı teklif gelirdi: "bu hafta olmaz, haftaya?" gelmemiş.',
      },
    });
  }

  for (const m of r.mesaj_okumalari.slice(0, 4)) {
    P.push({
      html: `<span class="kanit">"${esc(m.text)}"</span> ${esc(m.read)}`,
      g: {
        neden: 'bu satır sözlükten yakalandı: kalıp düz metinde birebir geçiyor. yorum satırın kendisine bağlı, dışarıdan bilgi yok.',
        alt: 'tek satır bağlam olmadan okunabilir. şaka ya da alıntı olabilir. o yüzden hüküm tek satıra değil toplam sayıma dayanıyor.',
      },
    });
  }

  for (const f of r.bayraklar) {
    P.push({
      html: `<span class="fdot ${f.type === 'red' ? 'red' : 'green'}"></span><b>${esc(f.title)}.</b> ${esc(f.line)}`,
      g: {
        neden: `"${f.title}" kalıbı sohbette birebir sayıldı. bu tür ifadeler ilişki araştırmalarında en güçlü işaretlerden.`,
        alt: 'bir kalıp şakayla da geçebilir. sıklık önemli. tek seferse hafif, tekrarlıyorsa ciddi oku.',
      },
    });
  }

  // The cloud reading. `gozden_kacanlar` is gone with the old flow: it was a title, a sentence and
  // a separate "kanıt" field, and the reveal drew all three, which is how one observation became
  // three lines saying the same thing. What comes back now is a short list of plain sentences, and
  // every quotation inside them was searched for in this very conversation on the server before it
  // was allowed through.
  for (const s of (r.spikerSatirlar || [])) {
    P.push({
      html: esc(s),
      g: {
        neden: 'bu satırı bulut spikeri yazdı: onay verdiğin için sohbetin metni ona gitti, yani '
          + 'sözlüğe değil sohbetin kendisine bakıyor. alıntı yaptıysa o cümle sohbette birebir '
          + 'geçiyor, sunucu göndermeden önce arayıp doğruladı.',
        alt: 'spiker yorumu tek okumadır. sayılarla çelişirse sayılara inan, onlar cihazda sayıldı.',
      },
    });
  }

  if (r.kayit) {
    const delta = r.kayit.score - r.kayit.prevScore;
    const gun = Math.max(1, Math.round((Date.now() - r.kayit.prevTs) / 86400000));
    const yon = delta > 5 ? `ısınmış (+${delta})` : delta < -5 ? `soğumuş (${delta})` : 'aynı yerde sayıyor';
    P.push({
      html: `<b>kayıt defteri:</b> ${esc(r.kayit.name)} ile ${gun} gün önceki okumada sinyal %${r.kayit.prevScore} idi, şimdi %${r.kayit.score}. ${esc(yon)}.`,
      g: {
        neden: 'geçmiş skor bu cihazın kayıt defterinden geldi. sadece isim, karar ve skor tutulur, sohbetin kendisi asla tutulmaz.',
        alt: 'iki okuma iki farklı kesit olabilir. aynı kişiyle aynı uzunlukta kesit karşılaştırmak daha adil olur.',
      },
    });
  }

  P.push({
    html: esc(r.kapanis),
    g: {
      neden: 'kapanış cümlesi hükmün özeti. hüküm skor ve sayımlardan geldi, kapanış onları tek cümleye indirdi.',
      alt: 'özet her zaman bir şeyleri dışarıda bırakır. yukarıdaki satırların her biri tek tek itiraza açık.',
    },
  });

  return P;
}

// ---- kart (sol sütun) — SADE (Damla 15 Tem: terazi/kalp yok, flört skoru barı + istatistik grafiği) ----
function buildKart(r, st, okumaNo, senAgir, onIndir) {
  const kart = el('div', 'kart');
  kart.appendChild(el('div', 'marka', `<span>seviyorsevmiyor</span><span>okuma ${okumaNo} · ${bugunTarih()}</span>`));
  kart.appendChild(el('div', 'hukum', esc(KARAR_TEXT[r.flort_sinyali.karar] || KARAR_TEXT.yok)));

  // flört skoru: yüzdelik bar (terazi/kalp yerine düz, okunur skor)
  const skor = Math.max(0, Math.min(100, r.flort_sinyali.score || 0));
  kart.appendChild(el('div', 'skor',
    `<div class="skor-ust"><span>flört skoru</span><span class="skor-no">%${skor}</span></div>` +
    `<div class="skor-bar"><i style="width:${skor}%"></i></div>`));

  // istatistik satırları — sade, iki sütun
  const kuruSatir = st.oN > 0 ? `<div><span>kuru cevap</span><b>%${st.kuruOran}</b></div>` : '';
  kart.appendChild(el('div', 'stat',
    `<div><span>başlatan</span><b>${st.baslatan}</b></div>` +
    `<div><span>soru dengesi</span><b>${st.senSoru} · ${st.oSoru}</b></div>` +
    kuruSatir +
    `<div><span>çift mesaj</span><b>${st.cift}</b></div>` +
    `<div><span>plan ertelemesi</span><b>${st.erteleme}</b></div>` +
    `<div><span>ort. kelime</span><b>${st.senOrt} · ${st.oOrt}</b></div>`));

  // mesaj boyu grafiği — tek şerit, sen/o iç içe değil ayrık, kırpma yok
  const senDizi = st.senKelimeler, oDizi = st.oKelimeler;
  const maks = Math.max(1, ...senDizi, ...oDizi);
  const grafik = el('div', 'grafik');
  const ciz = (dizi, cls, etiket) => {
    grafik.appendChild(el('div', 'g-etiket', etiket));
    const d = el('div', `g-dizi ${cls}`);
    d.innerHTML = dizi.map((kk) => `<i style="height:${Math.max(6, Math.round(100 * kk / maks))}%"></i>`).join('');
    grafik.appendChild(d);
  };
  ciz(senDizi, 'sen', `sen · ${senDizi.length} mesaj`);
  if (oDizi.length) ciz(oDizi, 'o', `o · ${oDizi.length} mesaj`);
  kart.appendChild(grafik);

  // kısa yorum kartın içinde (Damla: kart printable da yorumu versin)
  const kisaCumle = st.oN > 0
    ? `${st.senSoru} soruna ${st.oSoru} soru döndü, cevapların %${st.kuruOran}'i kuru. yükü taşıyan ${senAgir ? 'sensin' : 'karşı taraf'}.`
    : `${st.senSoru} soru sordun, karşı taraftan bu yazışmada dönüş yok. yük tümüyle sende.`;
  kart.appendChild(el('p', 'kisa', kisaCumle));
  // The card is the part that gets screenshotted, so its footer says what actually happened in THIS
  // reading rather than a slogan that is only true half the time.
  kart.appendChild(el('p', 'dip', r.spiker
    ? 'sayılar cihazda hesaplandı · yorumu onayınla bulut okudu'
    : 'cihazda hesaplandı · mesajlar hiçbir yere gitmedi'));

  const indir = el('button', 'indir', 'kartı indir');
  indir.type = 'button';
  indir.addEventListener('click', () => onIndir(indir));
  kart.appendChild(indir);
  return kart;
}

// ---- itiraz kutusu ----
function gerekceBox(g, doc, r) {
  const box = el('div', 'gerekce');
  box.appendChild(el('span', 'g-b', 'neden böyle okudum?'));
  box.appendChild(document.createTextNode(g.neden));
  box.appendChild(el('span', 'g-b', 'başka türlüsü mümkün mü?'));
  box.appendChild(document.createTextNode(g.alt));
  const bagis = el('button', 'bagis', 'bu sohbeti bağışla, modeli birlikte eğitelim');
  bagis.type = 'button';
  bagis.addEventListener('click', async () => {
    ping('itiraz');
    bagis.disabled = true;
    bagis.textContent = 'gönderiliyor...';
    const ok = await itirazGonder(doc, r.genel_ton.key, r.flort_sinyali.karar);
    bagis.remove();
    box.appendChild(el('span', 'bagis-not', ok
      ? 'geldi, motor bundan öğrenecek. sağ ol. giden şey sohbetin değil, ondan çıkan sayılar.'
      : 'şu an gitmedi ama itirazın not edildi.'));
  });
  box.appendChild(document.createElement('br'));
  box.appendChild(bagis);
  return box;
}

// ---- ana akış: daktilo → sahne ----
export async function playReveal(root, r, messages, me) {
  r.mesaj_okumalari = Array.isArray(r.mesaj_okumalari) ? r.mesaj_okumalari : [];
  r.bayraklar = Array.isArray(r.bayraklar) ? r.bayraklar : [];
  root.innerHTML = '';

  const st = computeStats(messages, me);
  const paragraflar = buildParagraphs(r, st);
  const okumaNo = nextOkumaNo();
  const myShare = typeof r.ilgi_dengesi.aShare === 'number'
    ? (me === 'A' ? r.ilgi_dengesi.aShare : 1 - r.ilgi_dengesi.aShare) : 0.5;
  const senAgir = myShare >= 0.5;
  const doc = messages.map((m) => `${m.speaker === me ? 'SEN' : 'O'}: ${m.text}`).join('\n');

  // 1) daktilo: yorum ortada, harf harf, beyaz imleç. dokununca atlanır.
  const akis = el('div', 'akis on');
  const akisText = el('span');
  akis.appendChild(akisText);
  akis.appendChild(el('span', 'imlec'));
  const atla = el('span', 'akis-atla', 'dokun, geç');
  akis.appendChild(atla);
  root.appendChild(akis);

  // daktilo SADECE ilk paragrafı (hüküm anı) yazar — kısa, dramatik kanca. gerisi sağ sütunda oturur.
  // uzun sohbette tüm paragrafları yazmak 14sn+ sürüyordu, akıcılığı öldürüyordu.
  const strip = (h) => h.replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  const duz = strip(paragraflar[0].html);
  let skip = REDUCED;
  const onSkip = () => { skip = true; };
  akis.addEventListener('click', onSkip);
  await new Promise((done) => {
    let i = 0;
    (function tik() {
      if (skip) { done(); return; }
      if (i <= duz.length) { akisText.textContent = duz.slice(0, i); i += 2; setTimeout(tik, 14); }
      else setTimeout(done, 500);
    })();
  });
  akis.removeEventListener('click', onSkip);
  akis.remove();

  // 2) sahne: solda kart, sağda yorum (mobilde tek sütun, kart önce)
  const sahne = el('div', 'sahne');
  const yorum = el('div', 'yorum');

  paragraflar.forEach((p, ix) => {
    const par = el('p', 'satir', p.html);
    yorum.appendChild(par);
    const box = gerekceBox(p.g, doc, r);
    yorum.appendChild(box);
    par.addEventListener('click', () => box.classList.toggle('on'));
  });

  // bulut yolu kapalıysa bunu satır olarak yaz, sessizce şablona düşme
  if (r.spikerKapali) {
    yorum.appendChild(el('p', 'satir', esc(spikerKapaliMetni(r.spikerKapali))));
  }

  // genel itiraz satırı
  const hint = el('p', 'itiraz',
    'katılmıyor musun? bir satıra dokun, neden öyle okuduğumu göstereyim.');
  yorum.appendChild(hint);

  // nasıl okudum: sayılan kanıt, tire yok
  if (r.nasil) {
    const n = r.nasil;
    const rows = [
      `${n.msgs} mesaj sayıldı (${n.mine} senden, ${n.theirs} ondan). soru sende ${n.questionsMine}, onda ${n.questionsTheirs}.`,
      n.overridden
        ? `ton modeli "${n.modelTone}" dedi (%${n.modelConf} güven) ama sayılan sinyaller ağır bastı. hükmü onlar verdi.`
        : `ton modeli %${n.modelConf} güvenle "${n.modelTone}" dedi.`,
      `${n.redKinds} red flag türü, ${n.greens} green flag sayıldı. her cümle sayılan bir sinyale bağlı, hiçbir şey uydurulmadı.`,
      r.spiker
        ? 'hüküm ve sayılar cihazında hesaplandı. sohbetin metni, onayını verdiğin için buluta gitti '
          + 've orada okundu; sunucuda saklanmadı, istek biter bitmez silindi.'
        : 'hepsi cihazında hesaplandı. mesajların hiçbir yere gitmedi.',
    ];
    const det = el('details', 'howread');
    det.appendChild(el('summary', null, 'nasıl okudum?'));
    for (const tt of rows) det.appendChild(el('p', null, esc(tt)));
    yorum.appendChild(det);
  }
  yorum.appendChild(el('div', 'reveal-note', 'bu okuma otomatik bir tahmindir; kesin bir yargı ya da tavsiye değildir.'));

  const kart = buildKart(r, st, okumaNo, senAgir, async (btn) => {
    btn.disabled = true;
    btn.textContent = 'hazırlanıyor...';
    ping('paylasim');
    try {
      const { shareReveal } = await import('./share.js?v=75');
      const how = await shareReveal(r, st, okumaNo, senAgir);
      btn.textContent = how === 'downloaded' ? 'indirildi' : how === 'shared' ? 'paylaşıldı' : 'kartı indir';
    } catch { btn.textContent = 'olmadı, tekrar dene'; }
    finally { btn.disabled = false; }
  });

  sahne.appendChild(kart);
  sahne.appendChild(yorum);
  root.appendChild(sahne);
  requestAnimationFrame(() => sahne.classList.add('on'));
}
