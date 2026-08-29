// Input adapters → one normalized chat:
//   { messages:[{speaker:'A'|'B', text, ts, media}], speakers:{A,B}, me, group, tsAmbiguous }
// Handles pasted text, "Name: message" logs, and WhatsApp .txt exports. The two most frequent
// speakers map to A/B; everything downstream only sees A/B.
//
// `ts` is NAIVE MINUTES, not epoch: WhatsApp exports carry NO timezone offset — the stamp is the
// exporting phone's wall clock. Date.parse would inject the browser's TZ and DST jumps and corrupt
// every interval. We build it with Date.UTC so differences stay exactly what the user saw.
// `ts` is null when the source has no stamps (plain paste) — downstream must treat null as "unknown",
// never as zero.

const NAME_LINE = /^([^:\n]{1,40}):\s(.*)$/;

// Leading WhatsApp timestamps come in many orders. Each pattern captures date/time parts so the
// stamp can be READ, not just stripped. Handles iOS "[01:12, 10.06.2026]" and "[10.06.2026, 01:12]"
// (either order), and Android "10.06.2026, 21:34 -" / "10/06/2026, 9:34 PM -".
const D = String.raw`(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})`;
const T = String.raw`(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM|ÖÖ|ÖS)?`;
const STAMPS = [
  { re: new RegExp(`^\\[\\s*${D}[,\\s]+${T}\\s*\\]\\s*`, 'i'), order: 'dt' },   // [date, time]
  { re: new RegExp(`^\\[\\s*${T}[,\\s]+${D}\\s*\\]\\s*`, 'i'), order: 'td' },   // [time, date]
  { re: new RegExp(`^${D}[,\\s]+${T}\\s*[-–]\\s*`, 'i'), order: 'dt' },         // date, time -
  { re: new RegExp(`^${T}[,\\s]+${D}\\s*[-–]?\\s*`, 'i'), order: 'td' },        // time, date
];

// System notices carry a stamp but are not messages. Counting them inflates whichever speaker the
// parser guesses, which silently skews every balance number.
const SYSTEM_RE = /(uçtan uca şifrelidir|end-to-end encrypted|bu mesajı sildin|bu mesaj silindi|this message was deleted|güvenlik kodu değişti|security code changed|sesli arama|görüntülü arama|voice call|video call|cevapsız arama|missed call|gruba ekledi|gruba katıldı|gruptan ayrıldı|added you|joined using|left$|oluşturdu|created group|grup açıklamasını|changed the subject|konu değiştirildi)/i;
const MEDIA_RE = /^(<Medya dahil edilmedi>|<Media omitted>|görüntü dahil edilmedi|image omitted|video omitted|ses dahil edilmedi|audio omitted|sticker omitted|çıkartma dahil edilmedi|gif omitted|belge dahil edilmedi|document omitted)\.?$/i;

// Pull the raw stamp fields off a line. Returns { rest, a, b, c, hh, mm, mer, order } or null.
function matchStamp(t) {
  for (const { re, order } of STAMPS) {
    const m = t.match(re);
    if (!m) continue;
    const g = m.slice(1);
    const [d1, d2, d3, hh, mm, mer] = order === 'dt'
      ? [g[0], g[1], g[2], g[3], g[4], g[5]]
      : [g[3], g[4], g[5], g[0], g[1], g[2]];
    return { rest: t.slice(m[0].length).trim(), d1: +d1, d2: +d2, year: +d3, hh: +hh, mm: +mm, mer };
  }
  return null;
}

// Decide day-month vs month-day ONCE for the whole file, not per line.
//   - a field >12 anywhere settles it outright
//   - otherwise prefer the reading that keeps the file chronological (exports are ordered)
//   - still tied → TR convention DD/MM, flagged as ambiguous
function detectDateOrder(stamps) {
  const probe = stamps.slice(0, 400);
  for (const s of probe) {
    if (s.d1 > 12) return { dayFirst: true, ambiguous: false };
    if (s.d2 > 12) return { dayFirst: false, ambiguous: false };
  }
  const monotonic = (dayFirst) => {
    let prev = -Infinity;
    for (const s of probe) {
      const v = toMinutes(s, dayFirst);
      if (v < prev) return false;
      prev = v;
    }
    return true;
  };
  const dayOk = monotonic(true), monOk = monotonic(false);
  if (dayOk && !monOk) return { dayFirst: true, ambiguous: false };
  if (monOk && !dayOk) return { dayFirst: false, ambiguous: false };
  return { dayFirst: true, ambiguous: true };
}

function toMinutes(s, dayFirst) {
  const day = dayFirst ? s.d1 : s.d2;
  const mon = dayFirst ? s.d2 : s.d1;
  let year = s.year;
  if (year < 100) year += year < 70 ? 2000 : 1900;
  let h = s.hh;
  const mer = s.mer && s.mer.toUpperCase();
  if (mer === 'PM' || mer === 'ÖS') { if (h < 12) h += 12; }
  else if (mer === 'AM' || mer === 'ÖÖ') { if (h === 12) h = 0; }
  return Math.floor(Date.UTC(year, mon - 1, day, h, s.mm) / 60000);
}

function classifyLines(raw) {
  const lines = raw.replace(/\r/g, '').split('\n');
  const rows = [];
  const stamps = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    const st = matchStamp(t);
    const s = st ? st.rest : t;
    if (st) stamps.push(st);
    const nm = s.match(NAME_LINE);
    if (nm && !/^https?$/i.test(nm[1])) {
      const text = nm[2];
      rows.push({ name: nm[1].trim(), text, st, system: SYSTEM_RE.test(text), media: MEDIA_RE.test(text.trim()) });
      continue;
    }
    // A stamped line with no "Name:" is a system notice (join/leave/encryption banner).
    if (st) { rows.push({ name: null, text: s, st, system: true, media: false, standalone: true }); continue; }
    // Unstamped and unnamed → continuation of the previous message (wrapped line).
    if (rows.length) rows[rows.length - 1].text += ' ' + s;
    else rows.push({ name: null, text: s, st: null, system: false, media: false });
  }
  return { rows, order: stamps.length ? detectDateOrder(stamps) : null };
}

// Alternating fallback when there are no speaker names at all (bare lines).
function alternating(raw) {
  const lines = raw.replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.map((text, i) => ({ speaker: i % 2 === 0 ? 'A' : 'B', text, ts: null, media: false }));
}

export function parseChat(raw) {
  const { rows, order } = classifyLines(raw);
  const stampOf = (r) => (r.st && order ? toMinutes(r.st, order.dayFirst) : null);
  const named = rows.filter((r) => r.name && !r.system);
  if (named.length < 2 || new Set(named.map((r) => r.name)).size < 2) {
    // No usable speaker labels → alternate lines and let the user confirm who is who.
    const messages = alternating(raw);
    return {
      messages, speakers: { A: 'İlk kişi', B: 'İkinci kişi' }, me: 'A',
      ambiguous: true, group: false, tsAmbiguous: false, dropped: 0,
    };
  }
  const freq = {};
  for (const r of named) freq[r.name] = (freq[r.name] || 0) + 1;
  const ranked = Object.entries(freq).sort((a, b) => b[1] - a[1]).map((e) => e[0]);
  const [nameA, nameB] = ranked;
  const map = { [nameA]: 'A', [nameB]: 'B' };
  const messages = [];
  let dropped = 0;
  let lastTs = null;
  for (const r of rows) {
    const ts = stampOf(r);
    if (ts != null) lastTs = ts;
    if (r.system) continue;                 // stamped but not a message
    const sp = r.name ? map[r.name] : (messages.length ? messages[messages.length - 1].speaker : 'A');
    if (!sp) { dropped++; continue; }       // a third minor speaker → skip, but COUNT it
    messages.push({ speaker: sp, text: r.text, ts: ts != null ? ts : lastTs, media: !!r.media });
  }
  return {
    messages,
    speakers: { A: nameA, B: nameB },
    me: 'A',
    ambiguous: false,
    // More than two speakers means turn structure is broken; the longitudinal path must refuse it
    // rather than quietly report numbers built on deleted messages.
    group: ranked.length > 2,
    tsAmbiguous: !!(order && order.ambiguous),
    dropped,
  };
}

// Serialize normalized chat to the "A: ...\nB: ..." doc the model expects.
export function toDoc(messages) {
  return messages.map((m) => `${m.speaker}: ${m.text}`).join('\n');
}
