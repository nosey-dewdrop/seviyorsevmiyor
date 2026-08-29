// v21 kart: 1080x1920 story PNG, TEK yüzey (kutu içinde kutu yok).
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

  // flört skoru barı (terazi/kalp yok — web kartıyla aynı sade dil)
  const skor = Math.max(0, Math.min(100, r.flort_sinyali.score || 0));
  hy += 20;
  x.fillStyle = '#8a8a92'; x.font = '26' + mono;
  x.fillText('flört skoru', 130, hy);
  x.fillStyle = '#fafafa'; x.textAlign = 'right'; x.font = '700 26' + mono;
  x.fillText(`%${skor}`, 950, hy); x.textAlign = 'left';
  hy += 22;
  x.fillStyle = '#3a3a40'; x.fillRect(130, hy, 820, 14);
  x.fillStyle = '#fafafa'; x.fillRect(130, hy, 820 * skor / 100, 14);
  hy += 70;

  // istatistik satırları — iki sütun, sade
  const rows = [
    ['başlatan', st.baslatan], ['soru dengesi', `${st.senSoru} · ${st.oSoru}`],
    ['çift mesaj', String(st.cift)], ['plan ertelemesi', String(st.erteleme)],
    ['ort. kelime', `${st.senOrt} · ${st.oOrt}`],
  ];
  if (st.oN > 0) rows.splice(2, 0, ['kuru cevap', `%${st.kuruOran}`]);
  x.font = '27' + mono;
  rows.forEach((row, i) => {
    const col = i % 2, rw = Math.floor(i / 2);
    const rx = 130 + col * 430, ry = hy + rw * 52;
    x.fillStyle = '#8a8a92'; x.fillText(row[0], rx, ry);
    x.fillStyle = '#fafafa'; x.textAlign = 'right'; x.fillText(row[1], rx + 390, ry); x.textAlign = 'left';
  });
  hy += Math.ceil(rows.length / 2) * 52 + 40;

  // mesaj boyu grafiği — düz bar şeridi (sen + o ayrı)
  const senDizi = st.senKelimeler, oDizi = st.oKelimeler;
  const maks = Math.max(1, ...senDizi, ...oDizi);
  const ciz = (dizi, y0, renk, etiket) => {
    x.fillStyle = '#8a8a92'; x.font = '22' + mono; x.fillText(etiket, 130, y0 - 12);
    const bw = 820 / Math.max(dizi.length, 1);
    const gap = dizi.length > 80 ? 0 : Math.min(6, bw * 0.2);
    dizi.forEach((k, i) => {
      const h = Math.max(6, 90 * k / maks);
      x.fillStyle = renk; x.fillRect(130 + i * bw, y0 + 90 - h, Math.max(1, bw - gap), h);
    });
  };
  ciz(senDizi, hy, '#a1a1aa', `sen · ${senDizi.length} mesaj`);
  hy += 140;
  if (oDizi.length) { ciz(oDizi, hy, '#4a4a52', `o · ${oDizi.length} mesaj`); hy += 140; }

  // kısa yorum
  x.fillStyle = '#a1a1aa'; x.font = '25' + mono;
  const yorum = st.oN > 0
    ? `${st.senSoru} soruna ${st.oSoru} soru döndü, %${st.kuruOran} kuru.`
    : `${st.senSoru} soru sordun, dönüş yok.`;
  x.fillText(yorum, 130, hy); hy += 60;

  // dip + viral çağrı — hy'ye bağlı (uzun sohbette çakışmaz), en az 1660'tan başlar
  let dy = Math.max(1660, hy);
  x.fillStyle = '#8a8a92'; x.font = '24' + mono;
  x.fillText('cihazda hesaplandı · mesajlar hiçbir yere gitmedi', 130, dy); dy += 56;
  // viral çağrı: story'de bu kartı gören biri nereye geleceğini bilsin (link tıklanamaz, adres yazılı).
  // NOT: gerçek canlı adres github.io. Damla özel domain bağlarsa burayı güncelle.
  x.fillStyle = '#fafafa'; x.font = '700 32' + mono;
  x.fillText('sen de dene →', 130, dy); dy += 46;
  x.fillStyle = '#fafafa'; x.font = '30' + mono;
  x.fillText('seviyorsevmiyor.noseydewdrop.com', 130, dy); dy += 40;
  x.fillStyle = '#55555c'; x.font = '20' + mono;
  x.fillText('otomatik tahmin, kesin yargı değil · eğlence amaçlı', 130, dy);

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
