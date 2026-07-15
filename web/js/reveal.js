// Build the Turkish reveal from the engine's outputs. Every sentence is TEMPLATED and keyed to
// a real computed value (tone class, flirt score, who-reaches-more, counted flags) — no made-up
// story (the yks-koc "no fabrication" rule). When the model is unsure, we say so plainly.
// The model PROPOSES the tone; counted signals can VETO it (red flags, one-sidedness) — the
// deterministic layer is the honest part, so on a clear conflict it wins and we say why.

import { flirtSignal, flirtSides, interestBalance, flags as computeFlags } from './balance.js?v=57';
import { lowerTr } from './features.js?v=57';

const TONE_TR = {
  flirty: 'flört havası',
  friendly: 'arkadaşça',
  cold: 'mesafeli / soğuk',
  tense: 'gergin',
  onesided: 'tek taraflı',
};
// Voice (Damla, 13 Tem): playful screenshot-bait "kanka" register, lowercase. Tense/red-flag
// screens stay serious — a joke under "kontrol dili" would cheapen the product.
// Voice bans (Damla, 13 Tem night): no sports metaphors, no gendered registers (neither
// bro-talk nor girl-talk), no AI filler. Reference register: The Pudding's Spotify roast bot —
// react to the data, don't narrate it.
const TONE_LINE = {
  flirty: 'kanka burada muhabbet muhabbeti aşmış, ikiniz de biliyorsunuz :D',
  friendly: 'temiz muhabbet kanka, hem de iyisinden. ama romantizm dedektörüm uyuyor.',
  cold: 'kanka cevaplar buz gibi. klimanın önünde yazışıyor gibisiniz.',
  tense: 'Havada bir gerginlik var. Konuşma sitem, savunma ve suçlama ekseninde dönüyor.',
  onesided: 'kanka üzülerek söylüyorum: bu sohbeti tek başına sen taşıyorsun, karşıdan gelen yok.',
};

const CONF_THRESHOLD = 0.15;   // margin below this = we are not sure → offer fallback
const SHORT_CHAT = 6;          // fewer messages than this = a snippet, read with a caveat

// Rule-guarded verdict. Returns { key, cssKey, label, line, why }.
function verdict(toneResult, { redKinds, oneSided }) {
  let key = toneResult.top;
  let why = null;
  if (redKinds >= 2 && (key === 'flirty' || key === 'friendly')) {
    key = 'tense';
    why = `Kelimelerde sıcaklık olabilir ama sayılanlar başka söylüyor: ${redKinds} ayrı red flag türü geçiyor.`;
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
  if (my.msgs !== their.msgs) bits.push(`mesaj sende ${my.msgs}, onda ${their.msgs}`);
  if (my.questions !== their.questions) bits.push(`soru sende ${my.questions}, onda ${their.questions}`);
  if (my.doubles >= 2 || their.doubles >= 2) bits.push(`üst üste yazma sende ${my.doubles}, onda ${their.doubles}`);
  const ev = bits.length ? ` Sayım: ${bits.join('; ')}.` : '';
  if (bal.leans === 'even') {
    return `dengeli gidiyor kanka, kimse kimsenin peşinden koşmuyor. konuşmayı beraber taşıyorsunuz.${ev}`;
  }
  const reachingIsMe = bal.leans === bal.me;
  const pct = Math.round((bal.leans === 'A' ? bal.aShare : 1 - bal.aShare) * 100);
  if (reachingIsMe) {
    return `kanka bu konuşmanın hamalı sensin (~%${pct}). daha uzun yazan, daha çok soran, daha çok dönen hep sen.${ev}`;
  }
  return `kanka daha çok isteyen karşı taraf (~%${pct}). sana doğru uzanan onlar, sen sadece varsın.${ev}`;
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
    read: '"bakarız" kanka, evrensel dilde "hayır ama kibarım" demek.' },
  { kind: 'reach', pri: 6, re: /(özledim|aklımdasın|aklımdaydı|seni düşündüm|rüyama|rüyamda)/,
    read: 'düpedüz yakınlaşma hamlesi kanka. seni kendine çekmeye çalışıyor.' },
  { kind: 'wish', pri: 5, re: /(keşke)/,
    read: '"keşke" bir itiraf kanka: orada olmanı istemiş, söylemenin en garantili yolunu seçmiş.' },
  { kind: 'pursue', pri: 5, re: /(ben seni bulurum|seni bulurum|ben yazarım|ben ararım|peşindeyim)/,
    read: 'takibi üstlenmiş kanka: bir dahaki adımı kendine görev yapmış. bundan net sinyal olmaz.' },
  { kind: 'sitem', pri: 5, re: /(neden yazmadın|neden aramadın|görüp geçiyorsun|umursam)/,
    read: 'sitemin altında "sana ulaşamıyorum" var kanka. ilgi isteği, kırgınlık kılığına girmiş.' },
  { kind: 'compliment', pri: 5, re: /(güzelsin|yakışıklısın|gülüşün|çok tatlısın|güzel olmuşsun|iddialısın)/,
    read: 'iltifat açık karttır kanka: arkadaşlıkta pek gerekmez, burada atılmış.' },
  { kind: 'dismiss', pri: 5, test: (low, text) => /^(hı|hı hı|hm+|peki|ok|okey|tamam|👍)\.?$/.test(low.trim()) || ([...text].length <= 4 && !text.includes('?')),
    read: 'kanka bu cevap kısa ve düz. "konuşmayı uzatmayalım"ın kibar hali.' },
  { kind: 'excuse', pri: 4, test: (low) => /(yoğunum|işim var|müsait değilim|vaktim yok|bu ara çok)/.test(low) && !/(olur|olabilir|gelirim|geliyorum|yaparız|ararım)/.test(low),
    read: 'meşguliyet gerçek olabilir kanka, ama tekrarlıyorsa adı mesafedir.' },
  { kind: 'stonewall', pri: 4, re: /(boşver|her neyse|fark etmez|konuşmak istemiyorum)/,
    read: 'Konu tartışılmadan kapatılıyor. Geri çekilmek de bir cevap, ama çözüm değil.' },
  { kind: 'repair', pri: 3, re: /(özür dilerim|kusura bakma|haklısın)/,
    read: 'özür gelmiş kanka: tansiyonu düşürme çabası. kavgada değerli bir işaret.' },
  { kind: 'question', pri: 1, test: (low, text) => text.includes('?') && [...text].length > 12,
    read: 'gerçek bir soru bu kanka: karşıyı konuşmaya, açılmaya davet ediyor.' },
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
      ? 'sen uzanıyorsun, karşılık ölçülü kanka. bunu bilmek de bir cevap.'
      : 'sana uzanan biri var, sen ölçülü dönüyorsun. kapıyı tutan sensin kanka.';
  }
  if (toneKey === 'flirty') return 'kısacası kanka: bu sadece muhabbet değil. gerisini sen anla 👀';
  if (toneKey === 'cold') {
    if (bal.leans === bal.me) return 'sen uzanıyorsun, karşılık ölçülü kanka. bunu bilmek de bir cevap.';
    return 'kapı aralık ama davet yok kanka. belki de gördüğün mesafe, gerçekten mesafe.';
  }
  if (toneKey === 'tense') return 'İlgi hâlâ var ama iletişim yorulmuş. Mesele sevgi değil, konuşma biçimi.';
  return 'temiz muhabbet kanka, alt-metin aramana gerek yok. bazen her şey göründüğü gibidir.';
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
  // Damla kanunu (13 Tem gece): "varsa var yoksa yok deyin" — the call commits, the honesty
  // lives in the evidence (score, counts, nasıl okudum). No mumbling middle band.
  const karar = v.key === 'onesided' ? 'tek'
    : v.key === 'flirty' || signal >= 50 ? 'var' : 'yok';
  let reason;
  if (v.key === 'onesided') {
    reason = `yakınlık dili tek yönlü kanka: sende %${meWarm}, onda %${otherWarm}. sinyal var ama karşılıklı değil.`;
  } else if (v.key === 'tense' && toneResult.top !== 'tense') {
    reason = 'Sıcak kelimeler geçiyor ama red flaglerin gölgesinde. Bu flört değil, tansiyon.';
  } else {
    reason = signal >= 65 ? 'sıcaklık, iltifat, yakınlaşma dili... kanka bu kadarı tesadüf olmaz :D'
      : signal >= 50 ? 'kıvılcım küçük ama gerçek kanka: dil, arkadaşlıktan bir tık sıcak.'
        : signal >= 35 ? 'tek tük sıcak cümle var ama toplam arkadaşlık tarafında kalıyor kanka.'
          : 'kanka ilgi sinyali dipte. bu daha çok ödev grubu enerjisi.';
  }

  return {
    unsure,
    genel_ton: {
      key: v.key, cssKey: v.cssKey, label: v.label, line: v.line, why: v.why,
      caveat: shortChat ? 'kanka bu çok kısa bir kesit; okuma sınırlı, kesin hüküm çıkaramam.' : null,
    },
    flort_sinyali: { karar, score: signal, reason, me: meWarm, other: otherWarm, oneSided: v.key === 'onesided' },
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
