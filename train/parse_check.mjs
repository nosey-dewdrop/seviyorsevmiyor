// Parse regression + timestamp harness. Run: node train/parse_check.mjs
// Freezes existing paste/WhatsApp behaviour, then asserts the rescued `ts` field.
import { parseChat } from '../web/js/parse.js';

let pass = 0, fail = 0;
const fails = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  fail++; fails.push(`${name}\n    beklenen: ${w}\n    gelen   : ${g}`);
}
const shape = (r) => r.messages.map((m) => `${m.speaker}:${m.text}`);
const stamps = (r) => r.messages.map((m) => m.ts ?? null);

// ---- A. mevcut davranış (damga kurtarmadan ÖNCE de geçmeli) ----

check('bare "Name: msg" log',
  shape(parseChat('Ali: selam\nVeli: naber\nAli: iyidir')),
  ['A:selam', 'B:naber', 'A:iyidir']);

check('iOS bracketed, tarih-saat sırası',
  shape(parseChat('[10.06.2026, 01:12] Ali: selam\n[10.06.2026, 01:15] Veli: naber')),
  ['A:selam', 'B:naber']);

check('iOS bracketed, saat-tarih sırası',
  shape(parseChat('[01:12, 10.06.2026] Ali: selam\n[01:15, 10.06.2026] Veli: naber')),
  ['A:selam', 'B:naber']);

check('Android nokta ayraç 24 saat',
  shape(parseChat('10.06.2026, 21:34 - Ali: selam\n10.06.2026, 21:36 - Veli: naber')),
  ['A:selam', 'B:naber']);

check('Android slash ayraç AM/PM',
  shape(parseChat('10/06/2026, 9:34 PM - Ali: selam\n10/06/2026, 9:36 PM - Veli: naber')),
  ['A:selam', 'B:naber']);

check('sarma satır önceki mesaja eklenir',
  shape(parseChat('10.06.2026, 21:34 - Ali: birinci\ndevam satiri\n10.06.2026, 21:36 - Veli: ikinci')),
  ['A:birinci devam satiri', 'B:ikinci']);

check('isimsiz satırlar → alternating fallback',
  shape(parseChat('selam\nnaber\niyidir')),
  ['A:selam', 'B:naber', 'A:iyidir']);

check('url iki nokta ile isim sanılmaz',
  shape(parseChat('Ali: bak https://x.com/a\nVeli: tamam')),
  ['A:bak https://x.com/a', 'B:tamam']);

// MEVCUT DAVRANIŞ: üçüncü konuşmacının mesajı sessizce SİLİNİR (parse.js:57).
// Bu doğru değil ama donduruyoruz; grup tespiti ayrı bir bayrakla ele alınır.
check('en sık iki konuşmacı A/B olur, üçüncü silinir',
  shape(parseChat('Ali: a1\nVeli: b1\nAli: a2\nVeli: b2\nZeynep: c1')),
  ['A:a1', 'B:b1', 'A:a2', 'B:b2']);

check('üçüncü konuşmacı varsa grup bayrağı kalkar',
  parseChat('Ali: a1\nVeli: b1\nAli: a2\nVeli: b2\nZeynep: c1').group,
  true);

check('iki kişilik sohbette grup bayrağı yok',
  parseChat('Ali: a1\nVeli: b1').group,
  false);

// ---- B. zaman damgası (kurtarma sonrası) ----
// ts = epoch'tan bağımsız NAIVE dakika (Date.UTC tabanlı), TZ/DST bulaşmaz.

const iso = (min) => (min == null ? null : new Date(min * 60000).toISOString().slice(0, 16));

check('ts: iOS tarih-saat',
  stamps(parseChat('[10.06.2026, 01:12] Ali: selam\n[10.06.2026, 01:15] Veli: naber')).map(iso),
  ['2026-06-10T01:12', '2026-06-10T01:15']);

check('ts: iOS saat-tarih',
  stamps(parseChat('[01:12, 10.06.2026] Ali: selam\n[01:15, 10.06.2026] Veli: naber')).map(iso),
  ['2026-06-10T01:12', '2026-06-10T01:15']);

check('ts: Android 24 saat',
  stamps(parseChat('10.06.2026, 21:34 - Ali: selam\n10.06.2026, 21:36 - Veli: naber')).map(iso),
  ['2026-06-10T21:34', '2026-06-10T21:36']);

check('ts: Android PM → 21:36',
  stamps(parseChat('10/06/2026, 9:36 PM - Ali: selam\n10/06/2026, 9:40 PM - Veli: naber')).map(iso),
  ['2026-06-10T21:36', '2026-06-10T21:40']);

check('ts: Android AM 12 → 00:05',
  stamps(parseChat('10/06/2026, 12:05 AM - Ali: selam\n10/06/2026, 12:07 AM - Veli: naber')).map(iso),
  ['2026-06-10T00:05', '2026-06-10T00:07']);

check('ts: TR ÖS → 15:00',
  stamps(parseChat('10.06.2026, 3:00 ÖS - Ali: selam\n10.06.2026, 3:05 ÖS - Veli: naber')).map(iso),
  ['2026-06-10T15:00', '2026-06-10T15:05']);

check('ts: iki haneli yıl 26 → 2026',
  stamps(parseChat('10.06.26, 21:34 - Ali: selam\n10.06.26, 21:36 - Veli: naber')).map(iso),
  ['2026-06-10T21:34', '2026-06-10T21:36']);

check('ts: sarma satır önceki damgayı miras alır',
  stamps(parseChat('10.06.2026, 21:34 - Ali: birinci\ndevam\n10.06.2026, 21:36 - Veli: ikinci')).map(iso),
  ['2026-06-10T21:34', '2026-06-10T21:36']);

check('ts: damgasız yapıştırmada ts null',
  stamps(parseChat('Ali: selam\nVeli: naber')),
  [null, null]);

// MM/DD tespiti: ikinci alanda >12 varsa ay-gün sırasıdır
check('ts: MM/DD tespiti (06/25 → 25 Haziran)',
  stamps(parseChat('06/25/2026, 10:00 - Ali: a\n07/04/2026, 10:00 - Veli: b')).map(iso),
  ['2026-06-25T10:00', '2026-07-04T10:00']);

// DD/MM tespiti: ilk alanda >12 varsa gün-ay sırasıdır
check('ts: DD/MM tespiti (25/06 → 25 Haziran)',
  stamps(parseChat('25/06/2026, 10:00 - Ali: a\n04/07/2026, 10:00 - Veli: b')).map(iso),
  ['2026-06-25T10:00', '2026-07-04T10:00']);

// Belirsiz (her iki alan da <=12): monotonluk oyu → kronolojiyi bozmayan yorum
check('ts: belirsizlikte monotonluk oyu',
  stamps(parseChat('05/03/2026, 10:00 - Ali: a\n06/03/2026, 10:00 - Veli: b')).map(iso),
  ['2026-03-05T10:00', '2026-03-06T10:00']);

// Sistem satırları: mesaj sayılmaz
check('sistem satırı mesaj sayılmaz (şifreleme)',
  shape(parseChat('10.06.2026, 21:30 - Mesajlar uçtan uca şifrelidir.\n10.06.2026, 21:34 - Ali: selam\n10.06.2026, 21:36 - Veli: naber')),
  ['A:selam', 'B:naber']);

check('medya bildirimi mesaj kalır ama system=false değil',
  parseChat('10.06.2026, 21:34 - Ali: <Medya dahil edilmedi>\n10.06.2026, 21:36 - Veli: naber').messages.map((m) => m.media === true),
  [true, false]);

// ---- rapor ----
console.log(`parse_check: ${pass} geçti, ${fail} kaldı`);
if (fail) { console.log('\nKALANLAR:\n  ' + fails.join('\n  ')); process.exit(1); }
