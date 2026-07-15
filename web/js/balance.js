// Deterministic layer: who-wants-it-more and green/red flags. Counted, not "predicted" —
// this is the honest statistics part the plan insists on. No fabrication: every number here
// comes from a countable signal in the conversation.

import { lowerTr } from './features.js?v=52';

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

// Warm "reaching" phrases beyond endearments — countable flirt/closeness language.
const REACH = ['özledim', 'ozledim', 'aklımdasın', 'aklimdasin', 'aklımdaydı', 'aklimdaydi',
  'seni düşündüm', 'seni dusundum', 'rüyamda', 'ruyamda', 'gülüşün', 'gulusun', 'çok güzelsin',
  'cok guzelsin', 'güzelsin', 'guzelsin', 'yakışıklı', 'yakisikli', 'tatlısın', 'tatlisin'];
const HEARTS = ['❤', '😍', '🥰', '😘', '💕', '💖', '💗', '💓', '💞', '💘', '💝'];
// Soft deferrals — the polite way of not saying yes.
const DEFER = ['bakarız', 'bakariz', 'belki', 'göreceğiz', 'gorecegiz', 'bilmiyorum', 'bilmem',
  'sonra konuşuruz', 'sonra konusuruz', 'yoğunum', 'yogunum', 'müsait değilim', 'musait degilim',
  'işim var', 'isim var'];
const DISMISS_RE = /^(hı|hı hı|hm+|peki|ok|okey|tamam|olur|evet|yok|iyi|👍)\.?$/;

// Per-speaker countable signals: who uses warm language, who answers short, who defers.
export function sideStats(messages) {
  const s = { A: { msgs: 0, warm: 0, shorts: 0, defers: 0, questions: 0 },
    B: { msgs: 0, warm: 0, shorts: 0, defers: 0, questions: 0 } };
  for (const m of messages) {
    const side = s[m.speaker];
    if (!side) continue;
    const low = lowerTr(m.text);
    side.msgs += 1;
    side.warm += countHits(low, ENDEAR) + countHits(low, REACH) + countHits(m.text, HEARTS);
    if (DISMISS_RE.test(low.trim()) || [...m.text].length <= 4) side.shorts += 1;
    side.defers += countHits(low, DEFER);
    if (m.text.includes('?')) side.questions += 1;
  }
  return s;
}

// Per-side flirt/closeness signal 0..100 — purely counted, no model.
export function flirtSides(messages) {
  const s = sideStats(messages);
  const score = (x) => x.msgs ? Math.round(Math.min(1, x.warm / Math.max(2, x.msgs * 0.5)) * 100) : 0;
  return { A: score(s.A), B: score(s.B), stats: s };
}

// A plan proposal answered by a deferral within the next two messages = a deflected plan.
export function deflectedPlans(messages) {
  let count = 0;
  for (let i = 0; i < messages.length; i++) {
    const low = lowerTr(messages[i].text);
    if (!GREEN.plans.some((w) => low.includes(w))) continue;
    for (let j = i + 1; j <= Math.min(i + 2, messages.length - 1); j++) {
      if (messages[j].speaker === messages[i].speaker) continue;
      const rlow = lowerTr(messages[j].text);
      if (DEFER.some((w) => rlow.includes(w)) || DISMISS_RE.test(rlow.trim())) { count += 1; break; }
      break; // the other side replied with something substantial → not deflected
    }
  }
  return count;
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
  const deflected = deflectedPlans(messages);
  for (const [kind, list] of Object.entries(GREEN)) {
    const hits = countHits(joined, list);
    if (!hits) continue;
    // plans that got deferred ("bakarız") are not a green flag — they are the story itself
    if (kind === 'plans' && deflected > 0) continue;
    found.push({ type: 'green', kind, hits });
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
