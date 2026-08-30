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
import { desenVurdu, trKucult } from './tr_kucult.mjs';

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
// Case-insensitive on purpose. A leak written in capitals is the same leak, and JS lowercasing is
// not Turkish, so desenVurdu() also offers the İ->i / I->ı normalised text to the regex.
const birlesikRe = new RegExp(desenler.map((d) => `(?:${d.desen})`).join('|'), 'i');
// git grep POSIX ERE kullanir: (?: ...) desteklemez, duz grup gerekir. -i is passed as a flag.
const birlesikEre = desenler.map((d) => `(${d.desen})`).join('|');

// --- turkce buyuk harf, GECMISTE de -------------------------------------
//
// `-i` only folds I<->i. It never folds `İ` (U+0130) to `i`, and git grep cannot be taught Turkish
// casing, so an address written `İLETİSİM@...` in an old commit walked through a green gate: the
// working-tree scan caught it (desenVurdu normalises), the history scan did not. The pattern is
// therefore re-emitted with every dotted/dotless variant spelled out.
//
// Alternation `(i|İ)`, not a bracket class `[iİ]`: measured, a bracket class holding a multibyte
// character matches under a UTF-8 locale and silently matches NOTHING under LC_ALL=C, while the
// alternation holds in C, en_US.UTF-8 and tr_TR.UTF-8 alike. The gate must not depend on the
// locale it happens to be started with.
// The dotted capital I is listed twice on purpose: once composed (U+0130) and once decomposed
// (I + U+0307 COMBINING DOT ABOVE), which is what an NFD-normalised export or a JS toLowerCase()
// round trip leaves behind. A pattern that only knows the composed form is still half blind.
const TR_VARYANT = {
  i: ['i', '\u0130', 'I\u0307'],
  I: ['I', '\u0131'],
  ['\u0130']: ['\u0130', 'i', 'I\u0307'],
  ['\u0131']: ['\u0131', 'I'],
};
// Returns the widened pattern and the chars it could NOT widen (inside a bracket expression),
// so blindness that remains is reported by name instead of being assumed away.
function trEreGenislet(desen) {
  let cikti = '';
  let kacis = false;
  let koseIcinde = false;
  const korOlan = new Set();
  for (const ch of desen) {
    if (kacis) { cikti += ch; kacis = false; continue; }
    if (ch === '\\') { cikti += ch; kacis = true; continue; }
    if (koseIcinde) {
      cikti += ch;
      if (ch === ']') koseIcinde = false;
      else if (TR_VARYANT[ch]) korOlan.add(ch);
      continue;
    }
    if (ch === '[') { cikti += ch; koseIcinde = true; continue; }
    const v = TR_VARYANT[ch];
    cikti += v ? `(${v.join('|')})` : ch;
  }
  return { ere: cikti, korOlan: [...korOlan] };
}

const genisletmeler = desenler.map((d) => ({ ad: d.ad ?? d.desen, desen: d.desen, ...trEreGenislet(d.desen) }));
const birlesikEreTr = genisletmeler.map((g) => `(${g.ere})`).join('|');
const trGenisletildi = genisletmeler.filter((g) => g.ere !== g.desen).length;
for (const g of genisletmeler) {
  if (g.korOlan.length) {
    hatalar.push(`desen "${g.ad}": kose parantez icindeki ${g.korOlan.join(', ')} turkce genisletilemedi `
      + '— bu desen GECMISTE turkce buyuk harfe kor. deseni kose parantezsiz yaz.');
  }
}
const vurdu = (metin) => desenVurdu(birlesikRe, metin);
const adBul = (metin) => {
  const v = desenler
    .filter((d) => desenVurdu(new RegExp(d.desen, 'i'), metin))
    .map((d) => d.ad ?? d.desen);
  return v.length ? v.join(', ') : 'desen';
};
not(`desen dosyasi: ${PATTERN_FILE} (${desenler.length} desen)`);

// --- 1. hangi ref'ler ---------------------------------------------------
//
// The gate used to read refs/heads/ only. That is what a fresh clone carries, which is why it
// looked clean — but it is not what this folder carries. refs/backup/* and
// refs/original/refs/heads/* still hold the pre-rewrite history, and `git push --mirror`, a stray
// `git push refs/*`, or simply copying the directory takes them along.
//
// Two severities, on purpose. A dirty ref under refs/heads is a live branch: RED. A dirty ref
// outside it is a deliberately kept backup: it gets its own named warning line and does NOT turn
// the gate red, because deleting the backups to make a gate green would be the gate lying.
const tumRefler = git(['for-each-ref', '--format=%(refname)', 'refs/'])
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean);
const dallar = tumRefler.filter((r) => r.startsWith('refs/heads/'));
const digerRefler = tumRefler.filter((r) => !r.startsWith('refs/heads/'));
if (dallar.length === 0) {
  console.error('KIRMIZI: taranacak dal yok.');
  process.exit(1);
}
const uyarilar = [];
not(`dallar (KIRMIZI kapsami): ${dallar.map((d) => d.replace('refs/heads/', '')).join(', ')}`);
not(`refs/heads disi ref (uyari kapsami): ${digerRefler.length ? digerRefler.join(', ') : 'yok'}`);

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
    if (vurdu(satir)) {
      hatalar.push(`${dal} ${sha.slice(0, 8)} metadata desen tuttu: ${adBul(satir)} [${an}/${cn}]`);
    }
  }
}
not(`metadata: ${metaSayim} commit tarandi (author + committer)`);

// --- 3. tum commit'lerin icerigi ----------------------------------------
// Two passes per commit: the plain ERE with `-i` (catches ASCII capitals), and the Turkish-widened
// ERE (catches `İ` / `ı`, which `-i` never folds). A finding that only the second pass sees is
// labelled, so "the history scan is Turkish-aware" is something you can read in the output rather
// than something you have to take on faith.
function icerikTara(commitler, topla) {
  let vurus = 0;
  for (const sha of commitler) {
    const bulunan = new Map(); // dosya yolu -> hangi taramalar buldu
    let patladi = false;
    for (const [etiket, ere] of [['ascii', birlesikEre], ['turkce', birlesikEreTr]]) {
      const cikti = gitSessiz(['grep', '-I', '-i', '-l', '-E', ere, sha, '--']);
      if (cikti === null) {
        topla(`${sha.slice(0, 8)} icerik taranamadi (${etiket} taramasi kosmadi)`);
        patladi = true;
        continue;
      }
      for (const satir of cikti.split('\n').filter(Boolean)) {
        if (!bulunan.has(satir)) bulunan.set(satir, []);
        bulunan.get(satir).push(etiket);
      }
    }
    if (patladi) continue;
    for (const [satir, etiketler] of bulunan) {
      vurus++;
      // Named on purpose: a hit only the widened pass sees is a leak the old gate was blind to.
      const not2 = etiketler.includes('ascii') ? '' : ' [yalnizca turkce buyuk harf taramasi buldu]';
      topla(`gecmis ${satir}${not2}`);
    }
  }
  return vurus;
}

const commitler = git(['rev-list', ...dallar]).split('\n').filter(Boolean);
const icerikVurus = icerikTara(commitler, (h) => hatalar.push(h));
not(`icerik: ${commitler.length} commit tarandi (refs/heads), ${icerikVurus} dosya vurusu`);
not(`gecmis taramasi: ascii (-i) + turkce buyuk harf varyanti, ${trGenisletildi}/${desenler.length} desen genisletildi`);

// --- 3b. refs/heads disindaki ref'ler: ayri, kirmizi yakmayan uyari -----
if (digerRefler.length) {
  // Scanned ref by ref, so every finding is reported with the NAME of the ref that carries it.
  // Commits already covered by refs/heads (or by an earlier ref in this loop) are skipped, so the
  // 125 above are not walked again.
  const gorulen = new Set(commitler);
  let ekToplam = 0;
  const kirliRefler = [];
  for (const ref of digerRefler) {
    const bulgular = [];
    for (const satir of git(['log', ref, '--format=%H%x09%ae%x09%ce%x09%an%x09%cn']).split('\n').filter(Boolean)) {
      const [sha, ae, ce, an, cn] = satir.split('\t');
      if (!metaIzinli.test(ae)) bulgular.push(`${sha.slice(0, 8)} author-email noreply degil: ${ae}`);
      if (!metaIzinli.test(ce)) bulgular.push(`${sha.slice(0, 8)} committer-email noreply degil: ${ce}`);
      if (vurdu(satir)) bulgular.push(`${sha.slice(0, 8)} metadata desen tuttu: ${adBul(satir)} [${an}/${cn}]`);
    }
    const yeni = git(['rev-list', ref, '--not', ...dallar]).split('\n')
      .filter((s) => s && !gorulen.has(s));
    for (const s of yeni) gorulen.add(s);
    ekToplam += yeni.length;
    ekToplam += 0;
    icerikTara(yeni, (h) => bulgular.push(h));
    if (bulgular.length) kirliRefler.push({ ref, bulgular });
  }
  not(`refs/heads disi: ${ekToplam} ek commit tarandi, ${kirliRefler.length} kirli ref`);
  if (kirliRefler.length) {
    uyarilar.push('refs/heads DISINDA kirli ref var. bunlar yedek amacli tutuluyor, o yuzden kapi');
    uyarilar.push('bu yuzden KIRMIZI yanmaz. ama "git push --all/--mirror" ya da klasoru kopyalamak');
    uyarilar.push('bunlari da tasir:');
    for (const { ref, bulgular } of kirliRefler) {
      uyarilar.push(`  ${ref}  (${bulgular.length} bulgu)`);
      for (const b of bulgular.slice(0, 3)) uyarilar.push(`      ${b}`);
      if (bulgular.length > 3) uyarilar.push(`      ... +${bulgular.length - 3} bulgu daha`);
    }
  }
}

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
    if (vurdu(satir)) {
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
    // trKucult too: "AHMET@ORNEK.COM" folds fine, "İLETISIM@ORNEK.COM" does not without it.
    if (EPOSTA.test(satir) || EPOSTA.test(trKucult(satir)) || /mailto:/i.test(satir)) {
      hatalar.push(`${yol}:${i + 1} e-posta adresi var: ${satir.trim().slice(0, 80)}`);
    }
  });
}
not(`yayin sayfalari: ${ADRESSIZ_SAYFALAR.join(', ')} adres taramasi bitti`);

// --- sonuc --------------------------------------------------------------
// Warnings are printed whether the gate is red or green: a finding that only shows up on failure
// is a finding nobody reads.
if (uyarilar.length) {
  console.log('\nUYARI (kapi kirmizi degil):');
  for (const u of uyarilar) console.log(`  ${u}`);
}
if (hatalar.length) {
  console.error(`\nKIRMIZI: ${hatalar.length} sizinti (refs/heads + calisma agaci)`);
  for (const h of hatalar) console.error(`  - ${h}`);
  process.exit(1);
}
console.log('\nYESIL: refs/heads altinda, commit metadata/icerikte ve calisma agacinda sizinti yok.');
process.exit(0);
