// Input adapters → one normalized chat: { messages:[{speaker:'A'|'B', text}], speakers:{A,B}, me }.
// Handles pasted text, "Name: message" logs, and WhatsApp .txt exports. The two most frequent
// speakers map to A/B; everything downstream only sees A/B.

const NAME_LINE = /^([^:\n]{1,40}):\s(.*)$/;

// Leading WhatsApp timestamps come in many orders; strip whichever is present, then the rest is
// "Name: message". Handles iOS "[01:12, 10.06.2026]" and "[10.06.2026, 01:12]" (either order),
// and Android "10.06.2026, 21:34 -" / "10/06/2026, 9:34 PM -".
const STAMPS = [
  /^\[[^\]]*\]\s*/,                                                                              // any [ ... ] block (iOS, both orders)
  /^\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4}[,\s]+\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|ÖÖ|ÖS)?\s*[-–]\s*/i, // Android date time -
  /^\d{1,2}:\d{2}(?::\d{2})?[,\s]+\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4}\s*[-–]?\s*/i,                    // time, date (unbracketed)
];
function stripStamp(t) {
  for (const re of STAMPS) { const s = t.replace(re, ''); if (s !== t) return s.trim(); }
  return t;
}

function classifyLines(raw) {
  const lines = raw.replace(/\r/g, '').split('\n');
  const msgs = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    const s = stripStamp(t);
    const nm = s.match(NAME_LINE);
    if (nm && !/^https?$/i.test(nm[1])) { msgs.push({ name: nm[1].trim(), text: nm[2] }); continue; }
    // continuation of the previous message (wrapped line); keep the stamp-stripped text
    if (msgs.length) msgs[msgs.length - 1].text += ' ' + s;
    else msgs.push({ name: null, text: s });
  }
  return msgs;
}

// Alternating fallback when there are no speaker names at all (bare lines).
function alternating(raw) {
  const lines = raw.replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.map((text, i) => ({ speaker: i % 2 === 0 ? 'A' : 'B', text }));
}

export function parseChat(raw) {
  const rows = classifyLines(raw);
  const named = rows.filter((r) => r.name);
  if (named.length < 2 || new Set(named.map((r) => r.name)).size < 2) {
    // No usable speaker labels → alternate lines and let the user confirm who is who.
    const messages = alternating(raw);
    return { messages, speakers: { A: 'İlk kişi', B: 'İkinci kişi' }, me: 'A', ambiguous: true };
  }
  const freq = {};
  for (const r of named) freq[r.name] = (freq[r.name] || 0) + 1;
  const [nameA, nameB] = Object.entries(freq).sort((a, b) => b[1] - a[1]).map((e) => e[0]);
  const map = { [nameA]: 'A', [nameB]: 'B' };
  const messages = [];
  for (const r of rows) {
    const sp = r.name ? map[r.name] : (messages.length ? messages[messages.length - 1].speaker : 'A');
    if (!sp) continue;       // a third minor speaker → skip
    messages.push({ speaker: sp, text: r.text });
  }
  return { messages, speakers: { A: nameA, B: nameB }, me: 'A', ambiguous: false };
}

// Serialize normalized chat to the "A: ...\nB: ..." doc the model expects.
export function toDoc(messages) {
  return messages.map((m) => `${m.speaker}: ${m.text}`).join('\n');
}
