// Phrasebook. The engine decides WHAT is true; this file decides HOW it is said.
//
// Every line here was written once, offline, and shipped as data. There is no model call at run
// time and there is no network call in this path at all. Two reasons, both measured:
//   1. Groq's free tier gives 100k tokens a day. Even sending only the derived facts (~600 tokens)
//      that is about 160 analyses a day, so the first viral hour would return 429 to everyone.
//   2. A model handed the numbers writes numbers that were not there. The live spiker did exactly
//      that, quoting lines that never appeared in the chat, which is why worker.js grew a quote
//      validator. Here the sentence is fixed and the engine injects the value, so a wrong number is
//      impossible by construction.
//
// Voice: the observer. Distant, cold, short. It mostly talks about the other person, rarely to the
// reader. Lowercase, no "kanka", no jokes on the red screens, questions end with a question mark.
// Variants are picked by the file's own seed, so the same export always reads the same way.

// Deterministic pick: same seed and same slot always yield the same line.
export function sec(list, seed, slot) {
  if (!list || !list.length) return '';
  const h = Math.abs(Math.imul(seed ^ (slot * 2654435761), 2246822519)) >>> 0;
  return list[h % list.length];
}

// ---------------------------------------------------------------------------
// openers. shown above the date.
// ---------------------------------------------------------------------------
export const ACILIS_KIRILMA = [
  'bu sohbet bir gün ikiye ayrılıyor.',
  'bir tarihten sonra aynı sohbet değil.',
  'burada bir şey oldu ve iz bıraktı.',
  'sohbetin ortasında bir sınır var.',
];

export const ACILIS_YOK = [
  'bu sohbette bir sınır yok.',
  'aradım, bir gün bulamadım.',
];

export const ACILIS_KESINTI = [
  'burada bir kopukluk var, kırılma değil.',
  'arada bir boşluk var ve sayılar onun iki yanında duruyor.',
];

// ---------------------------------------------------------------------------
// per signal. {kim} {onceki} {sonraki} {fark} get filled by the engine.
// ---------------------------------------------------------------------------
export const CUMLE = {
  gecikme: [
    '{kim} eskiden {onceki} içinde dönüyordu. o günden sonra {sonraki}.',
    '{kim} için cevap süresi {onceki} idi, {sonraki} oldu. arada {fark} kat var.',
    'o tarihe kadar {kim} {onceki} içinde yazıyordu. sonrası {sonraki}.',
  ],
  sessizlik: [
    'konuşmalar arasındaki boşluk {onceki} iken {sonraki} oldu.',
    'iki konuşma arasında {onceki} geçiyordu. sonra {sonraki} geçmeye başladı.',
  ],
  baslatma: [
    '{kim} konuşmaları {onceki} oranında açıyordu, sonra {sonraki}.',
    'kimin başlattığı değişti. {kim} için {onceki} iken {sonraki} oldu.',
  ],
  bitiren: [
    'konuşmayı kimin kapattığı değişti. {kim} için {onceki} iken {sonraki}.',
    '{kim} artık son sözü söyleyen taraf. {onceki} iken {sonraki} oldu.',
  ],
  uzunluk: [
    '{kim} mesaj başına {onceki} yazıyordu, {sonraki} yazar oldu.',
    '{kim} kısaldı. {onceki} iken {sonraki}.',
  ],
  gece: [
    '{kim} için gece yazma payı {onceki} iken {sonraki} oldu.',
    'saatler kaydı. {kim} için gece payı {onceki} idi, {sonraki} oldu.',
  ],
};

// ---------------------------------------------------------------------------
// archetypes. computed from counts only, each one prints the number behind it.
// order matters: the first match wins, so the sharpest reading comes first.
// ---------------------------------------------------------------------------
// Names, never "you". This flow never asks the reader which side they are; `me` is just whoever
// wrote most, so addressing them as "sen" would be a guess dressed up as a fact. Naming both people
// is also the colder read, which is the voice this product wants anyway.
const ARKETIPLER = [
  {
    ad: 'bekleten',
    test: (d) => d.oranGecikme != null && d.oranGecikme >= 4,
    yaz: (d, ad) => `${ad.gec} ${d.oranGecikme.toFixed(1).replace('.', ',')} kat daha geç dönüyor.`,
  },
  {
    ad: 'kuru cevap',
    test: (d) => d.oKelime != null && d.oKelime <= 3 && d.senKelime >= d.oKelime * 2,
    yaz: (d, ad) => `${ad.o} mesaj başına ${d.oKelime} kelime yazıyor, ${ad.ben} ${d.senKelime}.`,
  },
  {
    ad: 'tek taraflı',
    test: (d) => d.senBaslatmaPay >= 0.7 || d.senBaslatmaPay <= 0.3,
    yaz: (d, ad) => {
      const acan = d.senBaslatmaPay >= 0.5 ? ad.ben : ad.o;
      const pay = Math.round((d.senBaslatmaPay >= 0.5 ? d.senBaslatmaPay : 1 - d.senBaslatmaPay) * 100);
      return `konuşmaların yüzde ${pay} kadarını ${acan} açıyor.`;
    },
  },
  {
    ad: 'kaybolan',
    test: (d) => d.uzunSessizlik != null && d.uzunSessizlik >= 3,
    yaz: (d) => `araya ${d.uzunSessizlik} gün süren sessizlikler giriyor.`,
  },
  {
    ad: 'gece hattı',
    test: (d) => d.geceBirlesik >= 0.25,
    yaz: (d) => `mesajların yüzde ${Math.round(d.geceBirlesik * 100)} kadarı gece yarısından sonra yazılmış.`,
  },
  {
    ad: 'dengeli',
    test: () => true,
    yaz: (d) => `${d.oturum} konuşma boyunca iki taraf da benzer sıklıkta yazıyor.`,
  },
];

/**
 * @param d  derived counts (see zamanYazi.arketipVerisi)
 * @param ad { ben, o } display names
 */
export function arketip(d, ad) {
  for (const a of ARKETIPLER) {
    if (a.test(d)) return { ad: a.ad, kanit: a.yaz(d, ad) };
  }
  return null;
}

// ---------------------------------------------------------------------------
// closing observation. never a lesson, never a slogan. it states one leftover fact.
// ---------------------------------------------------------------------------
export const KAPANIS_KIRILMA = [
  'sayılar o tarihte üst üste bindi.',
  'aynı hafta içinde birden fazla şey değişti.',
];

export const KAPANIS_YOK = [
  'değişmiş olabilir, ama bir gün gösteremiyorum.',
  'yavaş bir kayma varsa bu motor onu tarih olarak yazmaz.',
];
