// Share card: render the reveal as a 1080x1350 PNG entirely on device (canvas), so sharing a
// result never sends the conversation anywhere — the user downloads/shares an image they chose.
// This is the growth loop: the verdict is the artifact people screenshot anyway; we make it pretty.

const TONE_COLOR = { flirty: '#ff6b52', tense: '#ff6b52', friendly: '#3ddc8a', cold: '#8fb4d6', onesided: '#8fb4d6' };

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

export async function buildShareCard(r) {
  try { await document.fonts.load('600 100px Fraunces'); await document.fonts.load('400 40px Inter'); } catch {}
  const W = 1080, H = 1350, PAD = 90;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');

  x.fillStyle = '#0b0b0c';
  x.fillRect(0, 0, W, H);

  // brand
  x.fillStyle = '#71717a';
  x.font = '500 40px Inter, sans-serif';
  x.fillText('whatdoyoumean.', PAD, 150);

  // verdict
  const tone = r.genel_ton;
  x.fillStyle = TONE_COLOR[tone.key] || '#fafafa';
  x.font = '600 108px Fraunces, Georgia, serif';
  let y = 320;
  for (const line of wrap(x, tone.label, W - PAD * 2)) { x.fillText(line, PAD, y); y += 116; }

  // tone line
  x.fillStyle = '#a1a1aa';
  x.font = '400 42px Inter, sans-serif';
  y += 10;
  for (const line of wrap(x, tone.line, W - PAD * 2)) { x.fillText(line, PAD, y); y += 60; }

  // flirt signal
  y += 70;
  x.fillStyle = '#71717a';
  x.font = '500 34px Inter, sans-serif';
  x.fillText('FLÖRT SİNYALİ', PAD, y);
  y += 86;
  x.fillStyle = '#fafafa';
  x.font = '600 84px Fraunces, Georgia, serif';
  if (r.flort_sinyali.oneSided) {
    x.fillText(`sende %${r.flort_sinyali.me} · onda %${r.flort_sinyali.other}`, PAD, y);
  } else {
    x.fillText(`%${r.flort_sinyali.score}`, PAD, y);
  }
  // meter
  y += 44;
  const mw = W - PAD * 2;
  x.fillStyle = '#27272a';
  x.beginPath(); x.roundRect(PAD, y, mw, 16, 8); x.fill();
  const pct = r.flort_sinyali.oneSided ? Math.max(r.flort_sinyali.me, r.flort_sinyali.other) : r.flort_sinyali.score;
  x.fillStyle = TONE_COLOR[tone.key] || '#ff6b52';
  x.beginPath(); x.roundRect(PAD, y, Math.max(16, mw * pct / 100), 16, 8); x.fill();

  // balance one-liner (first sentence only — keep the card clean)
  y += 110;
  x.fillStyle = '#a1a1aa';
  x.font = '400 42px Inter, sans-serif';
  const balFirst = (r.ilgi_dengesi.line.split('.')[0] || '') + '.';
  for (const line of wrap(x, balFirst, W - PAD * 2)) { x.fillText(line, PAD, y); y += 60; }

  // closing punch
  y += 60;
  x.fillStyle = '#fafafa';
  x.font = 'italic 500 52px Fraunces, Georgia, serif';
  for (const line of wrap(x, r.kapanis, W - PAD * 2)) { x.fillText(line, PAD, y); y += 70; }

  // footer
  x.fillStyle = '#52525b';
  x.font = '400 34px Inter, sans-serif';
  x.fillText('otomatik tahmin · analiz cihazda yapıldı', PAD, H - 150);
  x.fillStyle = '#71717a';
  x.font = '500 36px Inter, sans-serif';
  x.fillText('damlahelloworld.github.io/whatdoyoumean', PAD, H - 90);

  return c;
}

export async function shareReveal(r) {
  const canvas = await buildShareCard(r);
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) throw new Error('görsel üretilemedi');
  const file = new File([blob], 'whatdoyoumean.png', { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return 'shared'; } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'whatdoyoumean.png';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return 'downloaded';
}
