// Build the Turkish reveal from the engine's outputs. Every sentence is TEMPLATED and keyed to
// a real computed value (tone class, flirt score, who-reaches-more, counted flags) — no made-up
// story (the yks-koc "no fabrication" rule). When the model is unsure, we say so plainly.
// The model PROPOSES the tone; counted signals can VETO it (red flags, one-sidedness) — the
// deterministic layer is the honest part, so on a clear conflict it wins and we say why.

import { flirtSignal, flirtSides, interestBalance, flags as computeFlags } from './balance.js?v=12';
import { lowerTr } from './features.js?v=12';

const TONE_TR = {
  flirty: 'flört havası',
  friendly: 'arkadaşça',
  cold: 'mesafeli / soğuk',
  tense: 'gergin',
  onesided: 'tek taraflı',
};
const TONE_LINE = {
  flirty: 'Bu konuşmanın altında açık bir ilgi var. Kelimeler arkadaşça görünse de yön flört tarafında.',
  friendly: 'Sıcak ama romantik değil. İki taraf da rahat, iş birbirini kollamaya değil muhabbete dayanıyor.',
  cold: 'Bir taraf mesafe koyuyor. Cevaplar kısa, kapı biraz aralık ama içeri davet yok.',
  tense: 'Havada bir gerginlik var. Konuşma sitem, savunma ve suçlama ekseninde dönüyor.',
  onesided: 'Bir taraf yakınlık dili kuruyor, diğeri kısa cevaplarla idare ediyor. İlgi var ama tek yönden akıyor.',
};

const CONF_THRESHOLD = 0.15;   // margin below this = we are not sure → offer fallback
const SHORT_CHAT = 6;          // fewer messages than this = a snippet, read with a caveat

// Rule-guarded verdict. Returns { key, cssKey, label, line, why }.
function verdict(toneResult, { redKinds, oneSided }) {
  let key = toneResult.top;
  let why = null;
  if (redKinds >= 2 && (key === 'flirty' || key === 'friendly')) {
    key = 'tense';
    why = `Kelimelerde sıcaklık olabilir ama sayılanlar başka söylüyor: ${redKinds} ayrı kırmızı bayrak türü geçiyor.`;
  } else if (oneSided && (key === 'flirty' || key === 'friendly')) {
    key = 'onesided';
    why = 'Yakınlık dili neredeyse tek taraftan geliyor; karşılık kısa ve erteleyici.';
  }
  return { key, cssKey: key === 'onesided' ? 'cold' : key, label: TONE_TR[key], line: TONE_LINE[key], why };
}

function balanceLine(bal) {
  const d = bal.detail;
  const meIsA = bal.me === 'A';
  const my = meIsA ? d.A : d.B;
  const their = meIsA ? d.B : d.A;
  const bits = [];
  if (my.msgs !== their.msgs) bits.push(`mesaj ${my.msgs}–${their.msgs}`);
  if (my.questions !== their.questions) bits.push(`soru ${my.questions}–${their.questions}`);
  if (my.doubles >= 2 || their.doubles >= 2) bits.push(`üst üste yazma ${my.doubles}–${their.doubles}`);
  const ev = bits.length ? ` Sayım (sen–o): ${bits.join(', ')}.` : '';
  if (bal.leans === 'even') {
    return `İlgi iki tarafta da dengeli görünüyor. Kimse diğerinin peşinden koşmuyor, konuşmayı beraber taşıyorsunuz.${ev}`;
  }
  const reachingIsMe = bal.leans === bal.me;
  const pct = Math.round((bal.leans === 'A' ? bal.aShare : 1 - bal.aShare) * 100);
  if (reachingIsMe) {
    return `Bu konuşmayı daha çok sen taşıyorsun (~%${pct}). Daha uzun yazan, daha çok soran, daha çok dönen taraf sensin.${ev}`;
  }
  return `Bu konuşmada daha çok isteyen taraf karşı taraf gibi görünüyor (~%${pct}). Sana doğru uzanan onlar.${ev}`;
}

const FLAG_TR = {
  controlling: ['Kontrol dili', 'Konum/telefon/nerede sorguları geçiyor. Bu, güvenden çok denetim işareti olabilir.'],
  contempt: ['Küçümseme', '"abartıyorsun / saçmalama / takıntı" gibi ifadeler var. Gottman bunu ilişkilerde en zehirli sinyal sayar.'],
  accusation: ['Suçlama', 'Sürekli "hep sen / senin yüzünden" ekseni. Sorumluluk tek tarafa yıkılıyor.'],
  stonewall: ['Duvar örme', '"boşver / neyse / fark etmez" ile konu kapatılıyor. Taraflardan biri geri çekiliyor.'],
  lovebomb: ['Hızlı yoğunluk', 'Daha ilk mesajlarda çok yoğun sevgi dili var. Bazen içten, bazen love-bombing olabilir.'],
  appreciation: ['Teşekkür/takdir', 'Karşılıklı minnet ve nezaket geçiyor. Sağlıklı bir işaret.'],
  care: ['Kollama', 'Birbirinin halini soran, merak eden bir dil var. İyi.'],
  plans: ['Plan yapma', 'Somut buluşma/plan cümleleri var. İlgi lafta kalmıyor, harekete geçiyor.'],
};

// "What did they mean" patterns, highest priority first. One reading per kind, max 4 total,
// scanned over the WHOLE conversation (not just the opening lines).
const READ_PATTERNS = [
  { kind: 'interrogate', pri: 7, re: /(neredeydin|nerdeydin|kiminleydin|kiminle|isim ver|hesap ver|konumunu|telefonunu)/,
    read: 'Bu bir merak sorusu değil, sorgu. Cevap değil kontrol arıyor.' },
  { kind: 'defer', pri: 6, re: /(bakarız|göreceğiz|belki sonra|sonra konuşuruz|artık bakarız)/,
    read: 'Yumuşak bir erteleme. "Hayır" demeden kapıyı yavaşça kapatıyor.' },
  { kind: 'reach', pri: 6, re: /(özledim|aklımdasın|aklımdaydı|seni düşündüm|rüyama|rüyamda)/,
    read: 'Açık bir yakınlaşma hamlesi. Karşıdakini kendine çekmeye çalışıyor.' },
  { kind: 'wish', pri: 5, re: /(keşke)/,
    read: '"Keşke" bir itiraf: orada olmanı istemiş, söylemenin en güvenli yolunu seçmiş.' },
  { kind: 'pursue', pri: 5, re: /(ben seni bulurum|seni bulurum|ben yazarım|ben ararım|peşindeyim)/,
    read: 'Takibi üstleniyor: bir dahaki adımı kendine görev yapıyor. Net sinyal.' },
  { kind: 'sitem', pri: 5, re: /(neden yazmadın|neden aramadın|görüp geçiyorsun|umursam)/,
    read: 'Sitemin altında "sana ulaşamıyorum" kaygısı var. İlgi isteği, kırgınlık kılığında.' },
  { kind: 'compliment', pri: 5, re: /(güzelsin|yakışıklısın|gülüşün|çok tatlısın|güzel olmuşsun|iddialısın)/,
    read: 'Bu bir açık kart: iltifat, arkadaşlıkta pek gerekmeyen bir risktir.' },
  { kind: 'dismiss', pri: 5, test: (low, text) => /^(hı|hı hı|hm+|peki|ok|okey|tamam|👍)\.?$/.test(low.trim()) || ([...text].length <= 4 && !text.includes('?')),
    read: 'Kısa ve düz. İlgiden çok "konuşmayı uzatmak istemiyorum" demenin nazik hali.' },
  { kind: 'excuse', pri: 4, test: (low) => /(yoğunum|işim var|müsait değilim|vaktim yok|bu ara çok)/.test(low) && !/(olur|olabilir|gelirim|geliyorum|yaparız|ararım)/.test(low),
    read: 'Meşguliyet gerçek olabilir; ama tekrar ediyorsa, nazikçe kurulmuş bir mesafedir.' },
  { kind: 'stonewall', pri: 4, re: /(boşver|her neyse|fark etmez|konuşmak istemiyorum)/,
    read: 'Konu tartışılmadan kapatılıyor. Geri çekilmek de bir cevap, ama çözüm değil.' },
  { kind: 'repair', pri: 3, re: /(özür dilerim|kusura bakma|haklısın)/,
    read: 'Bir onarım denemesi: tansiyonu düşürmeye çalışıyor. Kavgada değerli bir işaret.' },
  { kind: 'question', pri: 1, test: (low, text) => text.includes('?') && [...text].length > 12,
    read: 'Gerçek bir soru: karşı tarafı konuşmaya, kendini açmaya davet ediyor.' },
];

function messageReadings(messages) {
  const found = [];
  messages.forEach((m, idx) => {
    const low = lowerTr(m.text);
    for (const p of READ_PATTERNS) {
      const hit = p.re ? p.re.test(low) : p.test(low, m.text);
      if (hit) { found.push({ idx, speaker: m.speaker, text: m.text, kind: p.kind, pri: p.pri, read: p.read }); break; }
    }
  });
  // one per kind (keep the LAST occurrence — later messages carry the fresher subtext)
  const byKind = new Map();
  for (const f of found) byKind.set(f.kind, f);
  return [...byKind.values()]
    .sort((a, b) => b.pri - a.pri || a.idx - b.idx)
    .slice(0, 4)
    .sort((a, b) => a.idx - b.idx)
    .map(({ speaker, text, read }) => ({ speaker, text, read }));
}

function closingLine(toneKey, bal, flagList) {
  const redKinds = new Set(flagList.filter((f) => f.type === 'red').map((f) => f.kind)).size;
  if (redKinds >= 2 || (redKinds >= 1 && toneKey === 'tense')) {
    return 'Bu konuşma seni iyi hissettiriyor mu? Cevabı zorlanıyorsan, cevabın kendisi bu.';
  }
  if (toneKey === 'onesided') {
    return bal.leans === bal.me
      ? 'Sen uzanıyorsun, karşılık ölçülü geliyor. Bunu bilmek de bir cevap.'
      : 'Sana uzanan biri var ve sen ölçülü dönüyorsun. Kapıyı sen tutuyorsun.';
  }
  if (toneKey === 'flirty') return 'Kısacası: bu sadece muhabbet değil. Birileri diğerini merak ediyor.';
  if (toneKey === 'cold') {
    if (bal.leans === bal.me) return 'Sen uzanıyorsun, karşılık ölçülü geliyor. Bunu bilmek de bir cevap.';
    return 'Kapı aralık ama içeri davet yok. Belki de gördüğün mesafe, gerçekten mesafe.';
  }
  if (toneKey === 'tense') return 'İlgi hâlâ var ama iletişim yorulmuş. Mesele sevgi değil, konuşma biçimi.';
  return 'Net ve sağlıklı bir muhabbet. Bazen alt-metin, göründüğü gibidir.';
}

export function buildReveal({ toneResult, messages, me }) {
  const bal = interestBalance(messages, me);
  const flagList = computeFlags(messages);
  const sides = flirtSides(messages);
  const meWarm = me === 'A' ? sides.A : sides.B;
  const otherWarm = me === 'A' ? sides.B : sides.A;
  const meStats = me === 'A' ? sides.stats.A : sides.stats.B;
  const otherStats = me === 'A' ? sides.stats.B : sides.stats.A;
  const redKinds = new Set(flagList.filter((f) => f.type === 'red').map((f) => f.kind)).size;

  // one-sided = one side clearly reaching, the other cool AND answering short / deferring
  const reachWarm = bal.leans === 'A' ? sides.A : sides.B;
  const coolStats = bal.leans === 'A' ? sides.stats.B : sides.stats.A;
  const coolWarm = bal.leans === 'A' ? sides.B : sides.A;
  const oneSided = bal.leans !== 'even' && reachWarm >= 25 && coolWarm <= 15
    && (coolStats.shorts / Math.max(1, coolStats.msgs) >= 0.4 || coolStats.defers >= 1);

  const v = verdict(toneResult, { redKinds, oneSided });
  const shortChat = messages.length < SHORT_CHAT;
  const unsure = toneResult.margin < CONF_THRESHOLD || shortChat;

  const signal = flirtSignal(toneResult.probs, toneResult.classes, messages);
  let reason;
  if (v.key === 'onesided') {
    reason = `Yakınlık dili tek yönlü: sende %${meWarm}, onda %${otherWarm}. Sinyal var ama karşılıklı değil.`;
  } else if (v.key === 'tense' && toneResult.top !== 'tense') {
    reason = 'Sıcak kelimeler geçiyor ama kırmızı bayrakların gölgesinde. Bu flört değil, tansiyon.';
  } else {
    reason = signal >= 65 ? 'Sıcaklık, iltifat ve yakınlaşma dili yüksek.'
      : signal >= 35 ? 'Ara ara ilgi kıvılcımı var ama net değil.'
        : 'İlgi sinyali düşük, konuşma daha çok işlevsel.';
  }

  return {
    unsure,
    genel_ton: {
      key: v.key, cssKey: v.cssKey, label: v.label, line: v.line, why: v.why,
      caveat: shortChat ? 'Kısa bir kesit bu; okuma sınırlı, kesin hüküm yok.' : null,
    },
    flort_sinyali: { score: signal, reason, me: meWarm, other: otherWarm, oneSided: v.key === 'onesided' },
    ilgi_dengesi: { leans: bal.leans, line: balanceLine(bal), aShare: bal.aShare },
    mesaj_okumalari: messageReadings(messages),
    bayraklar: flagList.map((f) => ({ type: f.type, title: FLAG_TR[f.kind][0], line: FLAG_TR[f.kind][1] })),
    kapanis: closingLine(v.key, bal, flagList),
    confidence: toneResult.confidence,
    nasil: {
      msgs: messages.length,
      mine: meStats.msgs,
      theirs: otherStats.msgs,
      questionsMine: meStats.questions,
      questionsTheirs: otherStats.questions,
      modelTone: TONE_TR[toneResult.top],
      modelConf: Math.round(toneResult.confidence * 100),
      overridden: v.why !== null,
      redKinds,
      greens: flagList.filter((f) => f.type === 'green').length,
    },
  };
}
