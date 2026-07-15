// v21 sahnesi (mockups/21-final.html portu): analiz anında yorum ORTADA daktilo gibi yazılır,
// bitince sol tarafa printable kart (terazi + barlar + ölçümler), sağ tarafa yorum paragrafları
// oturur. Her yorum satırı tıklanabilir: altında "NEDEN BÖYLE OKUDUM?" + "BAŞKA TÜRLÜSÜ MÜMKÜN MÜ?"
// + rızalı bağış açılır. Karttaki her sayı gerçek sohbetten hesaplanır, elle sayı yazılmaz.

import { ping, itirazGonder } from './api.js?v=56';
import { deflectedPlans } from './balance.js?v=56';

const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
const SOZ_FINAL = { var: 'seviyor.', yok: 'sevmiyor.', tek: 'seviyor, ama tek taraflı.' };

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

  for (const g of (r.gozden_kacanlar || [])) {
    P.push({
      html: `<b>gözden kaçan: ${esc(g.baslik)}.</b> ${esc(g.line)} <span class="kanit">kanıt: "${esc(g.kanit)}"</span>`,
      g: {
        neden: `spiker bu gözlemi şu satıra dayandırdı: "${g.kanit}". sayılar cihazda hesaplandı, cümleyi onayınla spiker yazdı.`,
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

// ---- kart (sol sütun) ----
function buildKart(r, st, okumaNo, senAgir, onIndir) {
  const kart = el('div', 'kart');
  kart.appendChild(el('div', 'marka', `<span>seviyorsevmiyor</span><span>okuma ${okumaNo} · ${bugunTarih()}</span>`));
  kart.appendChild(el('div', 'hukum', esc(KARAR_TEXT[r.flort_sinyali.karar] || KARAR_TEXT.yok)));

  // kalp puanı: flört skoru (0-100) 5 kalbe iner. dolu = beyaz, boş = sönük.
  const dolu = Math.max(0, Math.min(5, Math.round((r.flort_sinyali.score || 0) / 20)));
  kart.appendChild(el('div', 'kalpler',
    `<span class="dolu">${'♥'.repeat(dolu)}</span><span class="bos">${'♥'.repeat(5 - dolu)}</span>` +
    `<span class="kalp-not">${dolu}/5 · flört ${r.flort_sinyali.score}</span>`));

  // terazi: mockup 21'in svg'si birebir. ağır kefe aşağı iner (sol = SEN).
  const svgWrap = el('div');
  svgWrap.innerHTML = `
    <svg class="terazi${senAgir ? ' sol-agir' : ''}" viewBox="0 0 360 240" aria-hidden="true">
      <rect x="142" y="216" width="76" height="10" rx="5" fill="#4a4a52"/>
      <rect x="158" y="204" width="44" height="12" rx="6" fill="#55555c"/>
      <path d="M176 204 L177.5 60 L182.5 60 L184 204 Z" fill="#6a6a72"/>
      <circle cx="180" cy="46" r="9" fill="none" stroke="#8a8a92" stroke-width="3"/>
      <circle cx="180" cy="46" r="3" fill="#fafafa"/>
      <g class="t-kol">
        <path d="M58 46 L302 46" stroke="#8a8a92" stroke-width="5" stroke-linecap="round"/>
        <circle cx="58" cy="46" r="4" fill="#8a8a92"/>
        <circle cx="302" cy="46" r="4" fill="#8a8a92"/>
        <g class="t-pan-l">
          <line x1="58" y1="50" x2="30" y2="116" stroke="#6a6a72" stroke-width="1.6"/>
          <line x1="58" y1="50" x2="58" y2="112" stroke="#6a6a72" stroke-width="1.6"/>
          <line x1="58" y1="50" x2="86" y2="116" stroke="#6a6a72" stroke-width="1.6"/>
          <ellipse cx="58" cy="117" rx="34" ry="5" fill="#c8c8ce"/>
          <path d="M24 117 Q26 148 58 148 Q90 148 92 117 Q75 124 58 124 Q41 124 24 117 Z" fill="#a1a1aa"/>
        </g>
        <g class="t-pan-r">
          <line x1="302" y1="50" x2="274" y2="116" stroke="#6a6a72" stroke-width="1.6"/>
          <line x1="302" y1="50" x2="302" y2="112" stroke="#6a6a72" stroke-width="1.6"/>
          <line x1="302" y1="50" x2="330" y2="116" stroke="#6a6a72" stroke-width="1.6"/>
          <ellipse cx="302" cy="117" rx="34" ry="5" fill="#55555c"/>
          <path d="M268 117 Q270 148 302 148 Q334 148 336 117 Q319 124 302 124 Q285 124 268 117 Z" fill="#4a4a52"/>
        </g>
      </g>
    </svg>`;
  kart.appendChild(svgWrap.firstElementChild);

  const soz = el('p', 't-soz', 'seviyor...');
  kart.appendChild(soz);
  const sozler = ['seviyor...', 'sevmiyor...', 'seviyor...', 'sevmiyor...', SOZ_FINAL[r.flort_sinyali.karar] || SOZ_FINAL.yok];
  let k = 0;
  const t = setInterval(() => { soz.textContent = sozler[k]; if (++k >= sozler.length) clearInterval(t); }, 640);

  const et = el('div', 't-etiketler');
  et.appendChild(el('div', 'sen', `SEN · kefe ${senAgir ? 'dolu' : 'hafif'}<br>${st.senSoru} soru · başlatan ${st.baslatan} · ort ${st.senOrt} kelime`));
  et.appendChild(el('div', 'sag', `O · kefe ${senAgir ? 'hafif' : 'dolu'}<br>%${st.kuruOran} kuru cevap · ort ${st.oOrt} kelime`));
  kart.appendChild(et);

  // barlar: mesaj başına kelime. Damla 15 Tem: TAMAMI gösterilir, kırpma yok
  // (analiz zaten hep tüm sohbette; uzun sohbette barlar inceldikçe yoğunluk şeridine döner).
  const senDizi = st.senKelimeler, oDizi = st.oKelimeler;
  const maks = Math.max(1, ...senDizi, ...oDizi);
  const barlar = el('div', 'barlar');
  const bloklar = [
    { dizi: senDizi, cls: '', etiket: `<span class="sen">SEN · her mesajın boyu · ${senDizi.length} mesaj</span><span>y: kelime</span>`,
      sol: 'ilk mesajın', sag: 'son mesajın' },
    { dizi: oDizi, cls: 'o', etiket: `<span>O · her mesajın boyu · ${oDizi.length} mesaj</span><span>soru ${st.senSoru}'e ${st.oSoru}</span>`,
      sol: 'ilk mesajı', sag: 'son mesajı' },
  ];
  for (const b of bloklar) {
    barlar.appendChild(el('div', 'b-etiket', b.etiket));
    const dizi = el('div', `dizi ${b.cls}${b.dizi.length > 16 ? ' sik' : ''}`);
    dizi.innerHTML = b.dizi.map((kk) =>
      `<i style="height:${Math.max(4, Math.round(100 * kk / maks))}%" data-k="${kk}" title="${kk} kelime"></i>`).join('');
    barlar.appendChild(dizi);
    barlar.appendChild(el('div', 'eksen', `<span>${b.sol}</span><span>${b.sag}</span>`));
  }
  kart.appendChild(barlar);

  const kuruSatir = st.oN > 0
    ? `kuru cevap oranı: <b>%${st.kuruOran}</b> (${st.kuru}/${st.oN})<br>`
    : '';
  kart.appendChild(el('div', 'olcumler',
    `konuşmayı başlatan: <b>${st.baslatan}</b><br>` +
    `soru dengesi: <b>${st.senSoru} · ${st.oSoru}</b><br>` +
    kuruSatir +
    `çift mesaj: <b>sende ${st.cift}</b> · plan ertelemesi: <b>${st.erteleme}</b>`));

  const kisaCumle = st.oN > 0
    ? `kefeye ağırlığı satırlar koydu: ${st.senSoru} soruna ${st.oSoru} soru döndü, cevapların %${st.kuruOran}'i kuru. bir sonraki taşı ${senAgir ? 'o' : 'sen'} koysun.`
    : `kefeye ağırlığı satırlar koydu: ${st.senSoru} soru sordun, karşı taraftan bu yazışmada dönüş yok. bir sonraki taşı o koysun.`;
  kart.appendChild(el('p', 'kisa', kisaCumle));
  kart.appendChild(el('p', 'dip', 'hüküm cihazda verildi · mesajlar kimseye gitmez · seviyorsevmiyor'));

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
      ? 'geldi, motor bundan öğrenecek. sağ ol. isim geçiyorsa bir dahakine silsen iyi olur.'
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
        ? `Model "${n.modelTone}" dedi (%${n.modelConf} güven) ama sayılan sinyaller ağır bastı. Hükmü onlar verdi.`
        : `Ton modeli %${n.modelConf} güvenle "${n.modelTone}" dedi.`,
      `${n.redKinds} red flag türü, ${n.greens} green flag sayıldı. Her cümle sayılan bir sinyale bağlı, hiçbir şey uydurulmaz.`,
      r.spiker
        ? 'Hüküm ve sayılar cihazında hesaplandı. Yorum cümlelerini onayınla canlı spiker yazdı, içerik saklanmadı.'
        : 'Hepsi cihazında hesaplandı. Mesajların hiçbir yere gitmedi.',
    ];
    const det = el('details', 'howread');
    det.appendChild(el('summary', null, 'nasıl okudum?'));
    for (const tt of rows) det.appendChild(el('p', null, esc(tt)));
    yorum.appendChild(det);
  }
  yorum.appendChild(el('div', 'reveal-note', 'Bu okuma otomatik bir tahmindir, kesin bir yargı ya da tavsiye değildir.'));

  const kart = buildKart(r, st, okumaNo, senAgir, async (btn) => {
    btn.disabled = true;
    btn.textContent = 'hazırlanıyor...';
    ping('paylasim');
    try {
      const { shareReveal } = await import('./share.js?v=56');
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
