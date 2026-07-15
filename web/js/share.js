// v21 kart (mockups/21-final.html portu): 1080x1920 story PNG, TEK yüzey (kutu içinde kutu yok).
// Terazi + barlar + eksenler + ölçümler kanvasa çizilir; karttaki her sayı gerçek hesaplanan
// istatistiklerden gelir. Tamamı cihazda üretilir, sohbet hiçbir yere gitmez.

const KARAR_TEXT = { var: 'flört var.', yok: 'flört yok.', tek: 'flört var, ama tek taraflı.' };

function wrap(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxWidth && line) { lines.push(line); line = w; }
    else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

export function buildShareCard(r, st, okumaNo, senAgir) {
  const c = document.createElement('canvas');
  c.width = 1080; c.height = 1920;
  const x = c.getContext('2d');
  const mono = 'px "JetBrains Mono", "SF Mono", Menlo, monospace';

  x.fillStyle = '#1a1a1e'; x.fillRect(0, 0, 1080, 1920);

  // marka satırı
  x.fillStyle = '#8a8a92'; x.font = '30' + mono;
  x.fillText('seviyorsevmiyor', 130, 250);
  x.textAlign = 'right'; x.fillText(`okuma ${okumaNo}`, 950, 250); x.textAlign = 'left';

  // hüküm (motor kararı)
  x.fillStyle = '#fafafa'; x.font = '700 68' + mono;
  let hy = 380;
  for (const line of wrap(x, KARAR_TEXT[r.flort_sinyali.karar] || KARAR_TEXT.yok, 820)) {
    x.fillText(line, 130, hy); hy += 82;
  }

  // kalp puanı: flört skoru 5 kalbe iner (web kartıyla aynı) — story'de göz yakalar.
  // kalp için sistem sans fallback: mono kalbi (U+2665) desteklemese bile garanti çizilir.
  const kalpFont = 'px "Arial Unicode MS", "Helvetica Neue", Arial, sans-serif';
  const dolu = Math.max(0, Math.min(5, Math.round((r.flort_sinyali.score || 0) / 20)));
  x.font = '54' + kalpFont; hy += 6;
  x.fillStyle = '#fafafa'; x.fillText('♥'.repeat(dolu), 130, hy);
  const doluW = x.measureText('♥'.repeat(dolu)).width;
  x.fillStyle = '#4a4a52'; x.fillText('♥'.repeat(5 - dolu), 130 + doluW, hy);
  x.fillStyle = '#8a8a92'; x.font = '28' + mono;
  x.fillText(`${dolu}/5`, 130 + x.measureText('♥♥♥♥♥').width + 24, hy);
  hy += 40;

  // terazi: kaide, direk, eğik kol, zincirler, kefeler. ağır kefe aşağıda (sol = SEN).
  const cx = 540, ty = 560, a = (senAgir ? -9 : 9) * Math.PI / 180;
  x.strokeStyle = '#8a8a92'; x.fillStyle = '#4a4a52'; x.lineWidth = 6;
  x.beginPath(); x.moveTo(cx - 60, ty + 330); x.lineTo(cx + 60, ty + 330); x.lineTo(cx + 40, ty + 306); x.lineTo(cx - 40, ty + 306); x.closePath(); x.fill();
  x.fillRect(cx - 5, ty, 10, 310);
  x.beginPath(); x.arc(cx, ty, 11, 0, 7); x.fillStyle = '#8a8a92'; x.fill();
  x.beginPath(); x.arc(cx, ty, 4, 0, 7); x.fillStyle = '#fafafa'; x.fill();
  const kolX = Math.cos(a) * 300, kolY = Math.sin(a) * 300;
  x.strokeStyle = '#8a8a92';
  x.beginPath(); x.moveTo(cx - kolX, ty - kolY); x.lineTo(cx + kolX, ty + kolY); x.stroke();
  const kefe = (px, py, renk, agiz) => {
    x.strokeStyle = '#6a6a72'; x.lineWidth = 2.5;
    [[-46, 0], [0, -6], [46, 0]].forEach((d) => {
      x.beginPath(); x.moveTo(px, py); x.lineTo(px + d[0], py + 122 + d[1]); x.stroke();
    });
    x.fillStyle = agiz;
    x.beginPath(); x.ellipse(px, py + 122, 58, 9, 0, 0, 7); x.fill();
    x.fillStyle = renk;
    x.beginPath(); x.moveTo(px - 58, py + 124);
    x.quadraticCurveTo(px - 54, py + 176, px, py + 176);
    x.quadraticCurveTo(px + 54, py + 176, px + 58, py + 124);
    x.quadraticCurveTo(px, py + 140, px - 58, py + 124); x.closePath(); x.fill();
  };
  kefe(cx - kolX, ty - kolY, '#a1a1aa', '#c8c8ce');
  kefe(cx + kolX, ty + kolY, '#4a4a52', '#55555c');
  x.fillStyle = '#fafafa'; x.font = '30' + mono;
  x.fillText(`SEN: ${st.senSoru} soru · başlatan ${st.baslatan}`, 130, ty + 420);
  x.fillStyle = '#8a8a92'; x.textAlign = 'right';
  x.fillText(`O: %${st.kuruOran} kuru cevap`, 950, ty + 420); x.textAlign = 'left';

  // barlar (hesaplanan kelime sayıları), değerler + eksen etiketleri
  // Damla 15 Tem: kırpma yok, tüm mesajlar çizilir (uzunda yoğunluk şeridi olur).
  const senDizi = st.senKelimeler;
  const oDizi = st.oKelimeler;
  const maks = Math.max(1, ...senDizi, ...oDizi);
  const ciz = (dizi, y0, renk) => {
    const bw = 840 / Math.max(dizi.length, 1);
    const gap = dizi.length > 120 ? 0 : Math.min(12, bw * 0.25);
    dizi.forEach((k, i) => {
      const h = Math.max(10, 130 * k / maks);
      x.fillStyle = renk; x.fillRect(130 + i * bw, y0 - h, bw - gap, h);
      if (dizi.length <= 16) {
        x.fillStyle = '#8a8a92'; x.font = '20px Menlo, monospace'; x.textAlign = 'center';
        x.fillText(k, 130 + i * bw + (bw - gap) / 2, y0 - h - 10); x.textAlign = 'left';
      }
    });
    x.fillStyle = '#8a8a92'; x.font = '20px Menlo, monospace';
    x.fillText('ilk mesaj', 130, y0 + 30);
    x.textAlign = 'right'; x.fillText('son mesaj', 970, y0 + 30); x.textAlign = 'left';
  };
  x.fillStyle = '#8a8a92'; x.font = '26' + mono;
  x.fillText('SEN · her mesajın boyu (y: kelime)', 130, 1180);
  ciz(senDizi, 1340, '#a1a1aa');
  x.fillStyle = '#8a8a92'; x.font = '26' + mono;
  x.fillText('O · her mesajın boyu (y: kelime)', 130, 1400);
  ciz(oDizi, 1560, '#4a4a52');

  // ölçüm satırı — mono (kart terminal dili). O-yok sohbette kuru cevap satırı anlamsız, atla.
  x.fillStyle = '#e4e4e7'; x.font = '30' + mono;
  const kuruK = st.oN > 0 ? `    kuru cevap %${st.kuruOran}` : '';
  x.fillText(`soru ${st.senSoru} · ${st.oSoru}${kuruK}    çift ${st.cift}    erteleme ${st.erteleme}`, 130, 1640);
  x.fillStyle = '#8a8a92'; x.font = '24' + mono;
  x.fillText('hüküm cihazda verildi · mesajlar kimseye gitmez', 130, 1700);

  // viral çağrı: story'de bu kartı gören biri nereye geleceğini bilsin (link tıklanamaz, adres yazılı).
  // NOT: gerçek canlı adres github.io. Damla özel domain (seviyorsevmiyor.*) bağlarsa burayı güncelle.
  x.fillStyle = '#fafafa'; x.font = '700 32' + mono;
  x.fillText('sen de dene →', 130, 1772);
  x.fillStyle = '#fafafa'; x.font = '30' + mono;
  x.fillText('nosey-dewdrop.github.io/seviyorsevmiyor', 130, 1818);
  x.fillStyle = '#55555c'; x.font = '20' + mono;
  x.fillText('otomatik tahmin, kesin yargı değil · eğlence amaçlı', 130, 1862);

  return c;
}

export async function shareReveal(r, st, okumaNo, senAgir) {
  const canvas = buildShareCard(r, st, okumaNo, senAgir);
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) throw new Error('görsel üretilemedi');
  const name = `seviyorsevmiyor-${okumaNo}.png`;
  const file = new File([blob], name, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return 'shared'; } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return 'downloaded';
}
