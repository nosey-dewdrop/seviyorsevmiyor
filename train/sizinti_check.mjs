#!/usr/bin/env node
// sizinti kapisi: kisisel adres / hesap id hicbir dalda, hicbir commit'te,
// hicbir metadata alaninda ve calisma agacinda kalmayacak.
//
// Aranan desenler REPOYA YAZILMAZ. Kapi onlari .gitignore'daki bir desen
// dosyasindan okur (varsayilan: train/.sizinti_patterns.json, SIZINTI_PATTERNS
// ile degistirilebilir). Desen dosyasi yoksa kapi GECMEZ, exit 1.
// Sebep: S1.5'te kapi kendi referansini uretiyordu, tekrarlanmayacak.

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PATTERN_FILE = process.env.SIZINTI_PATTERNS
  ? resolve(process.env.SIZINTI_PATTERNS)
  : join(REPO, 'train', '.sizinti_patterns.json');

// bu iki yayin sayfasinda hic e-posta adresi bulunmayacak (iletisim kanali ayri faz)
const ADRESSIZ_SAYFALAR = ['web/gizlilik.html', 'web/kosullar.html'];
const EPOSTA = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

const hatalar = [];
const not = (s) => console.log(s);

function git(args, opts = {}) {
  return execFileSync('git', args, {
    cwd: REPO,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    ...opts,
  });
}
function gitSessiz(args) {
  try {
    return git(args, { stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) {
    return e.status === 1 ? (e.stdout ?? '') : null; // grep: 1 = eslesme yok
  }
}

// --- 0. desen dosyasi ---------------------------------------------------
if (!existsSync(PATTERN_FILE)) {
  console.error(`KIRMIZI: desen dosyasi yok: ${PATTERN_FILE}`);
  console.error('kapi kendi referansini uretmez. dosyayi kur, sonra kos.');
  process.exit(1);
}
let konf;
try {
  konf = JSON.parse(readFileSync(PATTERN_FILE, 'utf8'));
} catch (e) {
  console.error(`KIRMIZI: desen dosyasi okunamadi: ${e.message}`);
  process.exit(1);
}
const desenler = Array.isArray(konf.desenler) ? konf.desenler : [];
if (desenler.length === 0) {
  console.error('KIRMIZI: desen dosyasinda desen yok.');
  process.exit(1);
}
for (const d of desenler) {
  if (!d || typeof d.desen !== 'string' || d.desen.trim() === '') {
    console.error('KIRMIZI: desen dosyasinda bos/gecersiz kayit var.');
    process.exit(1);
  }
}
const metaIzinli = new RegExp(konf.metadata_izinli_email ?? '@users\\.noreply\\.github\\.com$');
const birlesikRe = new RegExp(desenler.map((d) => `(?:${d.desen})`).join('|'));
// git grep POSIX ERE kullanir: (?: ...) desteklemez, duz grup gerekir
const birlesikEre = desenler.map((d) => `(${d.desen})`).join('|');
const adBul = (metin) => {
  const v = desenler.filter((d) => new RegExp(d.desen).test(metin)).map((d) => d.ad ?? d.desen);
  return v.length ? v.join(', ') : 'desen';
};
not(`desen dosyasi: ${PATTERN_FILE} (${desenler.length} desen)`);

// --- 1. hangi dallar ----------------------------------------------------
const dallar = git(['for-each-ref', '--format=%(refname)', 'refs/heads/'])
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean);
if (dallar.length === 0) {
  console.error('KIRMIZI: taranacak dal yok.');
  process.exit(1);
}
not(`dallar: ${dallar.map((d) => d.replace('refs/heads/', '')).join(', ')}`);

// --- 2. metadata (author + committer, isim ve e-posta) ------------------
let metaSayim = 0;
for (const dal of dallar) {
  const satirlar = git(['log', dal, '--format=%H%x09%ae%x09%ce%x09%an%x09%cn'])
    .split('\n')
    .filter(Boolean);
  for (const satir of satirlar) {
    const [sha, ae, ce, an, cn] = satir.split('\t');
    metaSayim++;
    for (const [alan, deger] of [['author-email', ae], ['committer-email', ce]]) {
      if (!metaIzinli.test(deger)) {
        hatalar.push(`${dal} ${sha.slice(0, 8)} ${alan} noreply degil: ${deger}`);
      }
    }
    if (birlesikRe.test(satir)) {
      hatalar.push(`${dal} ${sha.slice(0, 8)} metadata desen tuttu: ${adBul(satir)} [${an}/${cn}]`);
    }
  }
}
not(`metadata: ${metaSayim} commit tarandi (author + committer)`);

// --- 3. tum commit'lerin icerigi ----------------------------------------
const commitler = git(['rev-list', ...dallar]).split('\n').filter(Boolean);
let icerikVurus = 0;
for (const sha of commitler) {
  const cikti = gitSessiz(['grep', '-I', '-l', '-E', birlesikEre, sha, '--']);
  if (cikti === null) {
    hatalar.push(`${sha.slice(0, 8)} icerik taranamadi`);
    continue;
  }
  for (const satir of cikti.split('\n').filter(Boolean)) {
    icerikVurus++;
    hatalar.push(`gecmis ${satir}`);
  }
}
not(`icerik: ${commitler.length} commit tarandi, ${icerikVurus} dosya vurusu`);

// --- 4. calisma agaci (izlenen dosyalar) --------------------------------
const izlenen = git(['ls-files', '-z']).split('\0').filter(Boolean);
let agacVurus = 0;
for (const yol of izlenen) {
  const tam = join(REPO, yol);
  if (!existsSync(tam)) continue;
  let metin;
  try {
    metin = readFileSync(tam, 'utf8');
  } catch {
    continue;
  }
  if (metin.includes('\0')) continue; // binary
  metin.split('\n').forEach((satir, i) => {
    if (birlesikRe.test(satir)) {
      agacVurus++;
      hatalar.push(`calisma agaci ${yol}:${i + 1} ${adBul(satir)}`);
    }
  });
}
not(`calisma agaci: ${izlenen.length} izlenen dosya tarandi, ${agacVurus} vurus`);

// --- 5. yayin sayfalarinda hic e-posta olmayacak ------------------------
for (const yol of ADRESSIZ_SAYFALAR) {
  const tam = join(REPO, yol);
  if (!existsSync(tam)) {
    hatalar.push(`${yol} yok`);
    continue;
  }
  readFileSync(tam, 'utf8').split('\n').forEach((satir, i) => {
    if (EPOSTA.test(satir) || /mailto:/i.test(satir)) {
      hatalar.push(`${yol}:${i + 1} e-posta adresi var: ${satir.trim().slice(0, 80)}`);
    }
  });
}
not(`yayin sayfalari: ${ADRESSIZ_SAYFALAR.join(', ')} adres taramasi bitti`);

// --- sonuc --------------------------------------------------------------
if (hatalar.length) {
  console.error(`\nKIRMIZI: ${hatalar.length} sizinti`);
  for (const h of hatalar) console.error(`  - ${h}`);
  process.exit(1);
}
console.log('\nYESIL: hicbir dalda, hicbir commit metadata/icerikte ve calisma agacinda sizinti yok.');
process.exit(0);
