// Build the Turkish reveal from the engine's outputs. Every sentence is TEMPLATED and keyed to
// a real computed value (tone class, flirt score, who-reaches-more, counted flags) — no made-up
// story (the yks-koc "no fabrication" rule). When the model is unsure, we say so plainly.
// The model PROPOSES the tone; counted signals can VETO it (red flags, one-sidedness) — the
// deterministic layer is the honest part, so on a clear conflict it wins and we say why.

import { flirtSignal, flirtSides, interestBalance, flags as computeFlags } from './balance.js?v=72';
import { lowerTr } from './features.js?v=72';

const TONE_TR = {
  flirty: 'flört havası',
  friendly: 'arkadaşça',
  cold: 'mesafeli / soğuk',
  tense: 'gergin',
  onesided: 'tek taraflı',
};
// Voice (Damla, 15 Tem): theyseeyourphotos tonu — mesafeli, gözlemci, biraz ürkütücü. Seni
// gözlemleyen üçüncü bir göz; "kanka" YOK, sana seslenmek az, karşı tarafı okur. Cümleler kısa,
// soğuk, kesin. "seni görüyorum" enerjisi ama iddiasız değil.
const TONE_LINE = {
  flirty: 'bu satırların arasında bir yakınlaşma var. ikiniz de görmezden geliyorsunuz ama orada.',
  friendly: 'sıcak ama mesafeli. yakınlık var, arzu yok. bunu ayırmayı öğrenmişler.',
  cold: 'cevaplar buz gibi. karşı taraf konuşmayı bitirmek için yazıyor, sürdürmek için değil.',
  tense: 'havada gerginlik var. sitem, savunma, suçlama. kelimeler birbirine değil, birbirinin üstüne yazılmış.',
  onesided: 'bu sohbeti bir kişi taşıyor. diğeri sadece cevap veriyor, ulaşmıyor.',
};

const CONF_THRESHOLD = 0.15;   // margin below this = we are not sure → offer fallback
const SHORT_CHAT = 6;          // fewer messages than this = a snippet, read with a caveat

// Rule-guarded verdict. Returns { key, cssKey, label, line, why }.
function verdict(toneResult, { redKinds, oneSided }) {
  let key = toneResult.top;
  let why = null;
  if (redKinds >= 2 && (key === 'flirty' || key === 'friendly')) {
    key = 'tense';
    why = `kelimelerde sıcaklık olabilir ama sayılanlar başka söylüyor: ${redKinds} ayrı red flag türü geçiyor.`;
  } else if (oneSided && (key === 'flirty' || key === 'friendly')) {
    key = 'onesided';
    why = 'yakınlık dili neredeyse tek taraftan geliyor; karşılık kısa ve erteleyici.';
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
  const ev = bits.length ? ` sayım: ${bits.join('; ')}.` : '';
  if (bal.leans === 'even') {
    return `denge eşit. kimse kimsenin peşinde değil, ikisi de aynı mesafede duruyor.${ev}`;
  }
  const reachingIsMe = bal.leans === bal.me;
  const pct = Math.round((bal.leans === 'A' ? bal.aShare : 1 - bal.aShare) * 100);
  if (reachingIsMe) {
    return `konuşmayı taşıyan sensin (~%${pct}). daha uzun yazan, daha çok soran hep aynı taraf. diğeri sadece orada.${ev}`;
  }
  return `uzanan taraf karşındaki (~%${pct}). sana doğru gelen o; sen yerinde duruyorsun.${ev}`;
}

const FLAG_TR = {
  controlling: ['kontrol dili', 'konum, telefon, "neredeydin" sorguları geçiyor. güvenden çok denetim işareti.'],
  contempt: ['küçümseme', '"abartıyorsun / saçmalama / takıntı" gibi ifadeler var. ilişkilerde en zehirli sinyallerden.'],
  accusation: ['suçlama', 'sürekli "hep sen / senin yüzünden" ekseni. sorumluluk tek tarafa yıkılıyor.'],
  stonewall: ['duvar örme', '"boşver / neyse / fark etmez" ile konu kapatılıyor. bir taraf geri çekiliyor.'],
  lovebomb: ['hızlı yoğunluk', 'daha ilk mesajlarda yoğun sevgi dili. bazen içten, bazen love-bombing.'],
  appreciation: ['teşekkür / takdir', 'karşılıklı minnet ve nezaket geçiyor. sağlıklı bir işaret.'],
  care: ['kollama', 'birbirinin halini soran, merak eden bir dil var. iyi.'],
  plans: ['plan yapma', 'somut buluşma cümleleri var. ilgi lafta kalmıyor, harekete geçiyor.'],
};

// "What did they mean" patterns, highest priority first. One reading per kind, max 4 total,
// scanned over the WHOLE conversation (not just the opening lines).
const READ_PATTERNS = [
  { kind: 'interrogate', pri: 7, re: /(neredeydin|nerdeydin|kiminleydin|kiminle|isim ver|hesap ver|konumunu|telefonunu)/,
    read: 'bu bir merak sorusu değil, sorgu. cevap değil, kontrol arıyor.' },
  { kind: 'defer', pri: 6, re: /(bakarız|göreceğiz|belki sonra|sonra konuşuruz|artık bakarız)/,
    read: '"bakarız" bir kapıyı kapatmanın en kibar yolu. hayır demeden hayır demek.' },
  { kind: 'reach', pri: 6, re: /(özledim|aklımdasın|aklımdaydı|seni düşündüm|rüyama|rüyamda)/,
    read: 'bu bir yakınlaşma hamlesi. kendini ele veriyor, farkında bile değil.' },
  { kind: 'wish', pri: 5, re: /(keşke)/,
    read: '"keşke" bir itiraf. orada olmanı istemiş, en korunaklı yoldan söylemiş.' },
  { kind: 'pursue', pri: 5, re: /(ben seni bulurum|seni bulurum|ben yazarım|ben ararım|peşindeyim)/,
    read: 'takibi kendi üstüne almış. sıradaki adımı bekleyen değil, atan taraf.' },
  { kind: 'sitem', pri: 5, re: /(neden yazmadın|neden aramadın|görüp geçiyorsun|umursam)/,
    read: 'sitemin altında "sana ulaşamıyorum" yatıyor. özlem, kırgınlık kılığına girmiş.' },
  { kind: 'compliment', pri: 5, re: /(güzelsin|yakışıklısın|gülüşün|çok tatlısın|güzel olmuşsun|iddialısın)/,
    read: 'iltifat açık bir karttır. arkadaşlıkta gereksiz, burada bilerek atılmış.' },
  { kind: 'dismiss', pri: 5, test: (low, text) => /^(hı|hı hı|hm+|peki|ok|okey|tamam|👍)\.?$/.test(low.trim()) || ([...text].length <= 4 && !text.includes('?')),
    read: 'bu cevap kısa ve düz. "konuşmayı uzatmayalım"ın kibar hali.' },
  { kind: 'excuse', pri: 4, test: (low) => /(yoğunum|işim var|müsait değilim|vaktim yok|bu ara çok)/.test(low) && !/(olur|olabilir|gelirim|geliyorum|yaparız|ararım)/.test(low),
    read: 'meşguliyet gerçek olabilir. ama tekrarlıyorsa artık meşguliyet değil, mesafe.' },
  { kind: 'stonewall', pri: 4, re: /(boşver|her neyse|fark etmez|konuşmak istemiyorum)/,
    read: 'konu tartışılmadan kapatılıyor. geri çekilmek de bir cevap, ama çözüm değil.' },
  { kind: 'repair', pri: 3, re: /(özür dilerim|kusura bakma|haklısın)/,
    read: 'bir özür var. tansiyonu düşürme çabası; gerginlikte nadir bir işaret.' },
  { kind: 'question', pri: 1, test: (low, text) => text.includes('?') && [...text].length > 12,
    read: 'gerçek bir soru. karşısındakini konuşmaya, açılmaya çağırıyor.' },
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
    return 'bu konuşma seni iyi hissettiriyor mu? cevabı zorlanıyorsan, cevabın kendisi orada.';
  }
  if (toneKey === 'onesided') {
    return bal.leans === bal.me
      ? 'sen uzanıyorsun, karşılık ölçülü. bunu görmek de bir cevap.'
      : 'sana uzanan biri var, sen ölçülü dönüyorsun. kapıyı tutan sensin.';
  }
  if (toneKey === 'flirty') return 'bu sadece muhabbet değil. ikiniz de biliyorsunuz, kimse söylemiyor.';
  if (toneKey === 'cold') {
    if (bal.leans === bal.me) return 'sen uzanıyorsun, karşılık ölçülü. gördüğün mesafe, gerçek mesafe.';
    return 'kapı aralık ama davet yok. o soğukluk bir tercih, tesadüf değil.';
  }
  if (toneKey === 'tense') return 'ilgi hâlâ var ama iletişim yorulmuş. mesele sevgi değil, konuşma biçimi.';
  return 'temiz bir muhabbet. altında bir şey aramana gerek yok; bazen her şey göründüğü gibidir.';
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
    reason = `yakınlık dili tek yönlü: sende %${meWarm}, onda %${otherWarm}. sinyal var ama karşılıksız.`;
  } else if (v.key === 'tense' && toneResult.top !== 'tense') {
    reason = 'sıcak kelimeler geçiyor ama red flaglerin gölgesinde. bu flört değil, tansiyon.';
  } else {
    reason = signal >= 65 ? 'sıcaklık, iltifat, yakınlaşma dili. bu kadarı tesadüf olmaz.'
      : signal >= 50 ? 'kıvılcım küçük ama gerçek. dil, arkadaşlıktan bir tık sıcak.'
        : signal >= 35 ? 'tek tük sıcak cümle var ama toplam arkadaşlık tarafında.'
          : 'ilgi sinyali dipte. bu daha çok tanıdık enerjisi, flört değil.';
  }

  return {
    unsure,
    genel_ton: {
      key: v.key, cssKey: v.cssKey, label: v.label, line: v.line, why: v.why,
      caveat: shortChat ? 'bu çok kısa bir kesit. okuma sınırlı; kesin bir hüküm için yeterli veri yok.' : null,
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
