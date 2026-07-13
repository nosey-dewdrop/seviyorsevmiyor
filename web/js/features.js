// Feature extractor — the INFERENCE side, mirrored byte-for-byte from train/features.py.
// The tone model trained in Python scores in the browser only if these two agree, so any
// change here must be made in features.py too (parity_check.py + a Node run guards it).
// ES module: exported for the app, and also usable from a plain Node parity harness.

const UPPER_MAP = { 'İ': 'i', 'I': 'ı', 'Ş': 'ş', 'Ğ': 'ğ', 'Ü': 'ü', 'Ö': 'ö', 'Ç': 'ç' };

export function lowerTr(text) {
  let out = '';
  for (const ch of text) {
    if (UPPER_MAP[ch] !== undefined) out += UPPER_MAP[ch];
    else if (ch >= 'A' && ch <= 'Z') out += ch.toLowerCase();
    else out += ch;
  }
  return out;
}

// Codepoint length, matching Python's len() on astral chars (emoji).
function cpLen(s) { return [...s].length; }

const HEART_EMOJI = ['❤', '❤️', '🖤', '💛', '💚', '💙', '💜', '🧡', '🤍', '🤎', '💕', '💖',
  '💗', '💓', '💞', '💘', '💝', '😍', '🥰', '😘', '😻'];
const LAUGH_EMOJI = ['😂', '🤣', '😅', '😆'];
const SAD_EMOJI = ['😔', '😞', '😢', '😭', '🥺', '☹', '🙁', '😩', '😪'];
const KISS_EMOJI = ['😘', '😗', '😙', '😚', '💋'];
const COLD_EMOJI = ['🙂', '👍', '😐', '😑', '🫠'];
const EMOJI_ALL = [...new Set([...HEART_EMOJI, ...KISS_EMOJI, ...LAUGH_EMOJI, ...SAD_EMOJI, ...COLD_EMOJI,
  '😊', '😄', '😃', '😁', '😉', '🥲', '😌', '🙃', '😏', '😬', '😳', '🥹', '😤',
  '😡', '😠', '🤔', '🙄', '😒', '😖', '😫', '🥱', '😴', '🤗', '🤭', '🫶', '👌',
  '🙏', '✨', '🔥', '💔', '💯', '🥳', '🎉', '😇', '🤨', '😶', '🫡', '👀'])]
  .sort((a, b) => b.length - a.length);

const ENDEARMENT = ['canım', 'canim', 'bir tanem', 'birtanem', 'aşkım', 'askim', 'tatlım',
  'tatlim', 'sevgilim', 'hayatım', 'hayatim', 'bebeğim', 'bebegim',
  'güzelim', 'guzelim', 'cicim', 'prensesim', 'meleğim', 'melegim'];
const FORMAL = ['rica ederim', 'teşekkür ederim', 'tesekkur ederim', 'iyi günler',
  'iyi gunler', 'iyi çalışmalar', 'müsait', 'musait', 'saygılarımla',
  'kolay gelsin', 'buyurun', 'ederim', 'efendim'];
const LAUGH_TEXT_RE = /(ah[ah]+|ha[ha]+|hah+|jsj[sj]*|ksk[sk]*|kdkd|kekw|lol|xd|:d)/;

export const NUMERIC_NAMES = [
  'question_ratio', 'exclaim_ratio', 'heart_per_msg', 'laugh_ratio',
  'endearment_per_msg', 'sad_per_msg', 'emoji_per_msg', 'avg_len',
  'len_asymmetry', 'double_text_ratio', 'formality', 'short_reply_ratio',
];

function countAny(hay, needles) {
  let c = 0;
  for (const n of needles) if (n.length) c += hay.split(n).length - 1;
  return c;
}

export function splitLines(doc) {
  const msgs = [];
  for (const raw of doc.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^([ABab])\s*:\s*(.*)$/);
    if (m) msgs.push([m[1].toUpperCase(), m[2]]);
    else if (msgs.length) msgs[msgs.length - 1][1] += ' ' + line;
    else msgs.push(['A', line]);
  }
  return msgs;
}

export function wordTokens(text) {
  const low = lowerTr(text);
  return low.match(/[a-zçğıöşü0-9]+/g) || [];
}

export function ngrams(doc) {
  const toks = [];
  for (const [, t] of splitLines(doc)) toks.push(...wordTokens(t));
  const grams = [...toks];
  for (let i = 0; i < toks.length - 1; i++) grams.push(toks[i] + ' ' + toks[i + 1]);
  return grams;
}

export function numericFeatures(doc) {
  const msgs = splitLines(doc);
  const n = Math.max(msgs.length, 1);
  let q = 0, ex = 0, hearts = 0, laughs = 0, endear = 0, sads = 0, emojis = 0, shorts = 0;
  let totalLen = 0, lenA = 0, lenB = 0, double = 0, prevSpeaker = null;
  for (const [sp, text] of msgs) {
    const low = lowerTr(text);
    if (text.includes('?')) q += 1;
    if (text.includes('!')) ex += 1;
    hearts += countAny(low, HEART_EMOJI);
    emojis += countAny(text, EMOJI_ALL);
    sads += countAny(low, SAD_EMOJI);
    if (LAUGH_TEXT_RE.test(low) || countAny(low, LAUGH_EMOJI)) laughs += 1;
    for (const w of ENDEARMENT) endear += low.split(w).length - 1;
    const L = cpLen(text);
    totalLen += L;
    if (L <= 6) shorts += 1;
    if (sp === 'A') lenA += L; else lenB += L;
    if (sp === prevSpeaker) double += 1;
    prevSpeaker = sp;
  }
  let formality = 0;
  for (const [, t] of msgs) { const lt = lowerTr(t); if (FORMAL.some((f) => lt.includes(f))) formality += 1; }
  const denomLen = Math.max(lenA + lenB, 1);
  return {
    question_ratio: q / n,
    exclaim_ratio: ex / n,
    heart_per_msg: hearts / n,
    laugh_ratio: laughs / n,
    endearment_per_msg: endear / n,
    sad_per_msg: sads / n,
    emoji_per_msg: emojis / n,
    avg_len: (totalLen / n) / 100.0,
    len_asymmetry: Math.abs(lenA - lenB) / denomLen,
    double_text_ratio: double / n,
    formality: formality / n,
    short_reply_ratio: shorts / n,
  };
}

export function numericVector(doc) {
  const f = numericFeatures(doc);
  return NUMERIC_NAMES.map((name) => f[name]);
}
