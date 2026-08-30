// Turkish-aware lowercasing for the leak gates.
//
// JavaScript's toLowerCase() is not Turkish. `İ` (U+0130, dotted capital I) does not fold to `i`:
// it decomposes into `i` + U+0307 COMBINING DOT ABOVE, so "GENELLİKLE".toLowerCase() is
// "genelli̇kle" and an `includes('genellikle')` test on it is false. `I` folds to `i` rather
// than to `ı`, which breaks the other direction.
//
// Both leak gates were scanning with the plain call, so a hedged word or an address written in
// capitals walked straight through a green gate. That is the exact failure the gates exist to
// catch, so the fix lives in one file that both of them import instead of two copies that can
// drift apart.
//
// Measured, not asserted: train/kapi_saglik_check.mjs runs these functions against the same
// strings and against plain toLowerCase(), and shows the plain call missing what these catch.

/** Lowercase a string the way Turkish reads it: İ -> i, I -> ı, then the ordinary fold. */
export function trKucult(s) {
  return String(s).replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase();
}

/**
 * Which of `kelimeler` occur in `metin`, Turkish-aware. Both the normalised text and the plainly
 * lowercased text are searched, so a page that is already ASCII loses nothing.
 */
export function kacamakBul(metin, kelimeler) {
  const a = trKucult(metin);
  const b = String(metin).toLowerCase();
  return kelimeler.filter((k) => {
    const kk = trKucult(k);
    return a.includes(kk) || b.includes(kk) || a.includes(k) || b.includes(k);
  });
}

/**
 * Does a (case-insensitive) pattern hit this text? The raw text, the Turkish-normalised text and
 * the plain fold are all offered to the regex, because a pattern may be written either way.
 */
export function desenVurdu(re, metin) {
  const s = String(metin);
  return re.test(s) || re.test(trKucult(s)) || re.test(s.toLowerCase());
}
