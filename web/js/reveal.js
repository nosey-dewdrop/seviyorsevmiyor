// Build the Turkish reveal from the engine's outputs. Every sentence is TEMPLATED and keyed to
// a real computed value (tone class, flirt score, who-reaches-more, counted flags) — no made-up
// story (the yks-koc "no fabrication" rule). When the model is unsure, we say so plainly.

import { flirtSignal, interestBalance, flags as computeFlags } from './balance.js';
import { lowerTr } from './features.js';

const TONE_TR = {
  flirty: 'flört havası',
  friendly: 'arkadaşça',
  cold: 'mesafeli / soğuk',
  tense: 'gergin',
};
const TONE_LINE = {
  flirty: 'Bu konuşmanın altında açık bir ilgi var. Kelimeler arkadaşça görünse de yön flört tarafında.',
  friendly: 'Sıcak ama romantik değil. İki taraf da rahat, iş birbirini kollamaya değil muhabbete dayanıyor.',
  cold: 'Bir taraf mesafe koyuyor. Cevaplar kısa, kapı biraz aralık ama içeri davet yok.',
  tense: 'Havada bir gerginlik var. Konuşma sitem, savunma ve suçlama ekseninde dönüyor.',
};

const CONF_THRESHOLD = 0.15;   // margin below this = we are not sure → offer fallback

function balanceLine(bal) {
  const meLabel = bal.me === 'A' ? 'sen' : 'karşı taraf';
  if (bal.leans === 'even') {
    return 'İlgi iki tarafta da dengeli görünüyor. Kimse diğerinin peşinden koşmuyor, konuşmayı beraber taşıyorsunuz.';
  }
  const reachingIsMe = bal.leans === bal.me;
  const pct = Math.round((bal.leans === 'A' ? bal.aShare : 1 - bal.aShare) * 100);
  if (reachingIsMe) {
    return `Bu konuşmayı daha çok sen taşıyorsun (~%${pct}). Daha uzun yazan, daha çok soran, daha çok dönen taraf sensin.`;
  }
  return `Bu konuşmada daha çok isteyen taraf karşı taraf gibi görünüyor (~%${pct}). Sana doğru uzanan onlar.`;
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

// Pick a few messages worth a "what did they mean" reading, keyed to detectable signals.
function messageReadings(messages) {
  const out = [];
  for (const m of messages) {
    const low = lowerTr(m.text);
    const len = [...m.text].length;
    let read = null;
    if (/^(hı|hı hı|hm+|peki|ok|tamam|👍)\.?$/.test(low.trim()) || (len <= 4 && !m.text.includes('?'))) {
      read = 'Kısa ve düz. İlgiden çok "konuşmayı uzatmak istemiyorum" demenin nazik hali.';
    } else if (/(bakarız|göreceğiz|belki|artık bakarız)/.test(low)) {
      read = 'Yumuşak bir erteleme. "Hayır" demeden kapıyı yavaşça kapatıyor.';
    } else if (/(özledim|aklımdasın|aklımdaydı|düşündüm seni|rüyama)/.test(low)) {
      read = 'Açık bir yakınlaşma hamlesi. Karşıdakini kendine çekmeye çalışıyor.';
    } else if (/(neden yazmadın|neden aramadın|görüp geçiyorsun|umursam)/.test(low)) {
      read = 'Sitemin altında "sana ulaşamıyorum" kaygısı var. İlgi isteği, kırgınlık kılığında.';
    } else if (m.text.includes('?') && len > 12) {
      read = 'Gerçek bir soru: karşı tarafı konuşmaya, kendini açmaya davet ediyor.';
    }
    if (read) out.push({ speaker: m.speaker, text: m.text, read });
    if (out.length >= 3) break;
  }
  return out;
}

function closingLine(tone, bal, flagList) {
  const hasRed = flagList.some((f) => f.type === 'red');
  if (hasRed && (tone === 'tense' || tone === 'cold')) {
    return 'Bu konuşma seni iyi hissettiriyor mu? Cevabı zorlanıyorsan, cevabın kendisi bu.';
  }
  if (tone === 'flirty') return 'Kısacası: bu sadece muhabbet değil. Birileri diğerini merak ediyor.';
  if (tone === 'cold') {
    if (bal.leans === bal.me) return 'Sen uzanıyorsun, karşılık ölçülü geliyor. Bunu bilmek de bir cevap.';
    return 'Kapı aralık ama içeri davet yok. Belki de gördüğün mesafe, gerçekten mesafe.';
  }
  if (tone === 'tense') return 'İlgi hâlâ var ama iletişim yorulmuş. Mesele sevgi değil, konuşma biçimi.';
  return 'Net ve sağlıklı bir muhabbet. Bazen alt-metin, göründüğü gibidir.';
}

export function buildReveal({ toneResult, messages, me }) {
  const bal = interestBalance(messages, me);
  const flagList = computeFlags(messages);
  const signal = flirtSignal(toneResult.probs, toneResult.classes, messages);
  const unsure = toneResult.margin < CONF_THRESHOLD;
  return {
    unsure,
    genel_ton: { key: toneResult.top, label: TONE_TR[toneResult.top], line: TONE_LINE[toneResult.top] },
    flort_sinyali: {
      score: signal,
      reason: signal >= 65 ? 'Sıcaklık, iltifat ve yakınlaşma dili yüksek.'
        : signal >= 35 ? 'Ara ara ilgi kıvılcımı var ama net değil.'
          : 'İlgi sinyali düşük, konuşma daha çok işlevsel.',
    },
    ilgi_dengesi: { leans: bal.leans, line: balanceLine(bal), aShare: bal.aShare },
    mesaj_okumalari: messageReadings(messages),
    bayraklar: flagList.map((f) => ({ type: f.type, title: FLAG_TR[f.kind][0], line: FLAG_TR[f.kind][1] })),
    kapanis: closingLine(toneResult.top, bal, flagList),
    confidence: toneResult.confidence,
  };
}
