// Deterministic layer: who-wants-it-more and green/red flags. Counted, not "predicted" —
// this is the honest statistics part the plan insists on. No fabrication: every number here
// comes from a countable signal in the conversation.

import { lowerTr } from './features.js';

const ENDEAR = ['canım', 'canim', 'aşkım', 'askim', 'sevgilim', 'hayatım', 'hayatim',
  'bir tanem', 'birtanem', 'tatlım', 'tatlim', 'bebeğim', 'bebegim', 'bir taneciğim'];

// Red-flag pattern lexicon (controlling, contempt, accusation, stonewalling).
const RED = {
  controlling: ['konumunu aç', 'konum at', 'telefonuna bak', 'telefonunu ver', 'kiminleydin',
    'kiminle', 'hesap ver', 'nerdeydin', 'neredeydin', 'engelledin', 'takip', 'şifreni'],
  contempt: ['saçmala', 'sacmala', 'abartıyorsun', 'abartma', 'dram', 'paranoya', 'takıntı',
    'takinti', 'hastalık', 'hastalik', 'salakça', 'salaklık', 'aptalca', 'kes artık', 'kes sunu'],
  accusation: ['yalan söyledin', 'yalan soyledin', 'aldatıyor', 'beni umursam', 'değer vermiyorsun',
    'deger vermiyorsun', 'suçluyorsun', 'hep sen', 'senin yüzünden', 'senin yuzunden'],
  stonewall: ['boşver', 'bosver', 'neyse', 'her neyse', 'fark etmez', 'önemli değil', 'onemli degil',
    'sen bilirsin', 'rahat bırak', 'rahat birak', 'konuşmak istemiyorum'],
};
// Green-flag lexicon (appreciation, plans, reciprocity, care).
const GREEN = {
  appreciation: ['teşekkür', 'tesekkur', 'sağ ol', 'sag ol', 'sağol', 'minnettar', 'iyi ki varsın',
    'iyi ki varsin', 'çok naziksin', 'ne demek', 'rica ederim'],
  care: ['geçmiş olsun', 'gecmis olsun', 'iyi misin', 'kendine iyi bak', 'dikkat et',
    'merak ettim', 'yanındayım', 'yanindayim', 'üzülme', 'uzulme'],
  plans: ['buluşalım', 'bulusalim', 'görüşelim', 'goruselim', 'gidelim', 'yapalım', 'yapalim',
    'gelir misin', 'geliyorum', 'çıkalım', 'cikalim', 'izleyelim'],
};

function countHits(text, list) {
  let c = 0;
  for (const w of list) c += text.split(w).length - 1;
  return c;
}

// interest balance: a lean per-speaker "reaching" score. Higher = wants it more.
export function interestBalance(messages, me) {
  const s = { A: { chars: 0, msgs: 0, doubles: 0, questions: 0, endear: 0 },
    B: { chars: 0, msgs: 0, doubles: 0, questions: 0, endear: 0 } };
  let prev = null;
  for (const m of messages) {
    const sp = m.speaker;
    if (!s[sp]) continue;
    const low = lowerTr(m.text);
    s[sp].chars += [...m.text].length;
    s[sp].msgs += 1;
    if (m.text.includes('?')) s[sp].questions += 1;
    s[sp].endear += countHits(low, ENDEAR);
    if (sp === prev) s[sp].doubles += 1;
    prev = sp;
  }
  const score = (x) => x.chars * 0.02 + x.msgs + x.doubles * 3 + x.questions * 1.5 + x.endear * 2;
  const sa = score(s.A);
  const sb = score(s.B);
  const total = sa + sb || 1;
  const aShare = sa / total;               // 0..1, A's share of the reaching
  const initiator = messages.length ? messages[0].speaker : null;
  return {
    aShare,
    leans: aShare > 0.62 ? 'A' : aShare < 0.38 ? 'B' : 'even',
    initiator,
    me,
    detail: s,
  };
}

export function flags(messages) {
  const joined = messages.map((m) => lowerTr(m.text)).join('\n');
  const found = [];
  for (const [kind, list] of Object.entries(RED)) {
    const hits = countHits(joined, list);
    if (hits) found.push({ type: 'red', kind, hits });
  }
  for (const [kind, list] of Object.entries(GREEN)) {
    const hits = countHits(joined, list);
    if (hits) found.push({ type: 'green', kind, hits });
  }
  // love-bombing: heavy endearment very early (first 3 messages) from one side.
  const early = messages.slice(0, 3).map((m) => lowerTr(m.text)).join(' ');
  if (countHits(early, ENDEAR) >= 2) found.push({ type: 'red', kind: 'lovebomb', hits: 1 });
  return found;
}

// flirt signal 0..100: model's flirty probability is the spine, nudged by countable warmth.
export function flirtSignal(probs, classes, messages) {
  const flirty = probs[classes.indexOf('flirty')] ?? 0;
  const joined = messages.map((m) => lowerTr(m.text)).join('\n');
  const warmth = Math.min(0.15, (countHits(joined, ENDEAR) + heartCount(joined)) * 0.02);
  return Math.round(Math.min(1, flirty + warmth) * 100);
}

function heartCount(low) {
  return countHits(low, ['❤', '😍', '🥰', '😘', '💕', '💖', '💗']);
}
