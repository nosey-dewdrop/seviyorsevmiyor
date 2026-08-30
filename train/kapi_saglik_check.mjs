#!/usr/bin/env node
// KAPI SAGLIK KAPISI — "yesil yanan kapi yalan soylemiyor, ve bir yabanci siteyi kota bitirerek
// kapatamiyor."
//
// Run: node train/kapi_saglik_check.mjs
//
// Five debts, each measured on its own, and each measured the only way a gate can be trusted:
// the real code is run, then MUTATED so the thing being claimed is broken, then run again to see
// the measurement actually go red, then restored byte for byte. A gate that only ever sees a
// healthy tree cannot tell "correct" from "always passes", and this file exists because four of
// the five debts below were exactly that.
//
//   1. /api/stats had no ticket, no counter and no cache: 84 KV reads per call, ~1200 calls kill
//      the free tier's daily read quota — and the rate limiter lives in the same namespace, so the
//      whole site goes with it.
//   2. the parity negative test sabotaged the Python arm only, so the JS arm's red light was
//      never once observed.
//   3. both leak gates lowercased with JS rules, so Turkish `İ` walked through — and in the
//      history pass `git grep -i` never folded `İ` at all, so a leak in Turkish capitals was
//      visible in the working tree and invisible in every commit.
//   4. the leak gate read refs/heads only, while refs/backup/* and refs/original/* carry the
//      dirty history in this folder.
//   5. the enum allowlists were hand-copied, so the engine could grow a value and both copies
//      would go stale together with every gate still green.
//
// Nothing is deployed, nothing is deleted. The backup refs are read, named, and left alone.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { createHash, randomBytes } from 'node:crypto';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OWN = 'https://nosey-dewdrop.github.io';

let fails = 0;
const ok = (ad, kosul, detay = '') => {
  if (kosul) console.log(`ok   ${ad}`);
  else { fails++; console.log(`***  ${ad}${detay ? `\n       ${detay}` : ''}`); }
};
const baslik = (s) => console.log(`\n=== ${s} ===`);
async function blok(ad, fn) {
  try { await fn(); } catch (e) { fails++; console.log(`***  ${ad} PATLADI\n       ${(e && e.stack) || e}`); }
}

const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const git = (args, opts = {}) =>
  execFileSync('git', args, { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 28, ...opts });

// Run a gate as its own process and report exit code + combined output.
function kos(cmd, args, opts = {}) {
  try {
    const out = execFileSync(cmd, args, {
      cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], ...opts,
    });
    return { ok: true, kod: 0, out };
  } catch (e) {
    return { ok: false, kod: e.status, out: String(e.stdout || '') + String(e.stderr || '') };
  }
}

// Edit a file, run something, put the file back byte for byte no matter what happened.
async function mutasyon(yol, degistir, fn) {
  const tam = join(REPO, yol);
  const asil = readFileSync(tam);
  const asilSha = sha(tam);
  const yeni = degistir(asil.toString('utf8'));
  if (yeni === asil.toString('utf8')) throw new Error(`mutasyon hicbir sey degistirmedi: ${yol}`);
  try {
    writeFileSync(tam, yeni, 'utf8');
    return await fn();
  } finally {
    writeFileSync(tam, asil);
    if (sha(tam) !== asilSha) throw new Error(`GERI KONULAMADI: ${yol}`);
  }
}

// ---- 1. /api/stats: quota + cache, and the panel still works ----------------------------------
//
// The worker module is imported with a cache-busting query so the mutated copy is really re-read
// rather than served from the ESM module cache.
let workerSayac = 0;
async function workerYukle() {
  const m = await import(`../backend/worker.js?k=${workerSayac++}`);
  return m.default;
}

function sayanKV() {
  const store = new Map();
  const s = { okuma: 0, yazma: 0, writes: [] };
  return {
    s,
    async get(k) { s.okuma++; return store.has(k) ? store.get(k) : null; },
    async put(k, v, o) { s.yazma++; s.writes.push({ key: k, opts: o || null }); store.set(k, v); },
  };
}

function statsEnv(kv) {
  return {
    RATE_LIMIT: kv, CORPUS: kv, ALLOWED_ORIGINS: OWN,
    TURNSTILE_SECRET: 'test-turnstile', BILET_SECRET: 'test-bilet-secret-0123456789',
  };
}

// n calls to /api/stats from ONE ip. Returns how many were served, how many refused, and what the
// KV traffic cost. This is the yardstick; it is applied to the healthy worker and to a mutated one.
async function statsOlc(worker, n, ip = '203.0.113.9') {
  const kv = sayanKV();
  const env = statsEnv(kv);
  // one real counter, so the panel has something to show
  await worker.fetch(new Request('https://api/api/ping', {
    method: 'POST',
    headers: { origin: OWN, 'cf-connecting-ip': '198.51.100.1', 'content-type': 'application/json' },
    body: JSON.stringify({ olay: 'analiz' }),
  }), env);
  kv.s.okuma = 0; kv.s.yazma = 0; kv.s.writes.length = 0;

  let servis = 0; let ret = 0; let ilk = null;
  for (let i = 0; i < n; i++) {
    const res = await worker.fetch(new Request('https://api/api/stats', {
      method: 'POST',
      headers: { origin: OWN, 'cf-connecting-ip': ip, 'content-type': 'application/json' },
      body: '{}',
    }), env);
    if (res.status === 200) { servis++; if (!ilk) ilk = await res.json(); } else ret++;
  }
  return { servis, ret, okuma: kv.s.okuma, yazma: kv.s.yazma, ilk, writes: kv.s.writes, istekBasi: kv.s.okuma / n };
}

baslik('1. /api/stats kota deligi');

await blok('stats kapisi', async () => {
  const workerYol = join(REPO, 'backend/worker.js');
  const workerSha = sha(workerYol);
  const worker = await workerYukle();
  const m = await statsOlc(worker, 50);
  console.log(`     50 istek / tek IP: servis ${m.servis}, ret ${m.ret}, KV okuma ${m.okuma} `
    + `(istek basina ${m.istekBasi.toFixed(1)}), KV yazma ${m.yazma}`);

  ok('biletsiz+kotasiz cagrilamiyor: tek IP 50 istekten reddedilen var', m.ret > 0,
    `${m.ret} ret — rota hala sinirsiz`);
  ok('kabul edilen istek sayisi bir tavana oturuyor', m.servis > 0 && m.servis <= 15,
    `${m.servis} istek servis edildi`);
  ok('istek basina KV okumasi 84 ten cok asagi', m.istekBasi < 10, `${m.istekBasi.toFixed(1)} okuma`);
  ok('100k gunluk okuma kotasini bitirmek artik ~1200 istek degil',
    100000 / m.istekBasi > 20000, `${Math.ceil(100000 / m.istekBasi)} istek gerekiyor`);

  // The point of the fix is NOT that the panel died.
  ok('panel calismaya devam ediyor (200 ve gercek sayilar geldi)',
    !!m.ilk && m.ilk.analiz && m.ilk.analiz[new Date().toISOString().slice(0, 10)] === 1,
    JSON.stringify(m.ilk));
  ok('panelin bekledigi tum olay alanlari duruyor',
    !!m.ilk && ['analiz', 'spiker', 'paylasim', 'itiraz', 'itiraz_bagis'].every((k) => k in m.ilk),
    JSON.stringify(m.ilk && Object.keys(m.ilk)));
  ok('stats yolunda TTL siz KV yazimi yok',
    m.writes.every((w) => w.opts?.expirationTtl > 0), JSON.stringify(m.writes.map((w) => w.opts)));

  // MUTATION: take the quota back out and confirm the measurement above goes red. Without this,
  // "the route is protected" is a sentence, not a finding.
  const mut = await mutasyon('backend/worker.js', (src) => src.replace(
    /if \(await limited\(env, `st:\$\{ip\}`[^]*?\n        \}\n/,
    ''), async () => {
    const w2 = await workerYukle();
    return statsOlc(w2, 50);
  });
  console.log(`     [mutasyon: kota sokuldu] servis ${mut.servis}, ret ${mut.ret}, `
    + `istek basina okuma ${mut.istekBasi.toFixed(1)}`);
  ok('MUTASYON A: kota sokulunca ret sayisi sifira dusuyor (olcum gercekten olcuyor)', mut.ret === 0,
    `${mut.ret} ret — mutasyon tutmadi, bu olcum bir sey ispatlamiyor`);

  // MUTATION B: keep the quota, take the CACHE out. The read-count assertion has to be the thing
  // that goes red, otherwise "84 -> 3" is a number nobody is guarding.
  const mutB = await mutasyon('backend/worker.js',
    (src) => src.replace('  const ham = await env.RATE_LIMIT?.get(STATS_ONBELLEK_ANAHTAR);',
      '  const ham = null;'),
    async () => statsOlc(await workerYukle(), 50));
  console.log(`     [mutasyon: onbellek sokuldu] servis ${mutB.servis}, ret ${mutB.ret}, `
    + `istek basina okuma ${mutB.istekBasi.toFixed(1)}`);
  ok('MUTASYON B: onbellek sokulunca istek basina okuma yeniden tavana cikiyor', mutB.istekBasi >= 10,
    `${mutB.istekBasi.toFixed(1)} okuma — okuma olcumu bir sey korumuyor`);

  ok('MUTASYONLAR sonrasi worker.js bit-ayni geri kondu', sha(workerYol) === workerSha,
    'worker.js degismis kaldi');
});

// ---- 2. parity: the JS arm's red light, observed ----------------------------------------------

baslik('2. parity negatif testi: JS kolu');

await blok('parity JS kolu', async () => {
  // Direct measurement, not a reading of the test file: skew web/js/features.js and watch the two
  // arms separately. The Python arm's inputs did not change, so it must stay green — that is what
  // makes the JS arm's failure attributable to the JS drift.
  const NEEDLE = 'avg_len: (totalLen / n) / 100.0,';
  const jsYol = join(REPO, 'web/js/features.js');
  const jsSha = sha(jsYol);

  const r = await mutasyon('web/js/features.js', (src) => {
    if (!src.includes(NEEDLE)) throw new Error('sabotaj capasi bulunamadi');
    return src.replace(NEEDLE, 'avg_len: (totalLen / n) / 101.0,');
  }, async () => ({
    py: kos('python3', ['train/parity_check.py']),
    js: kos('node', ['train/parity_check.mjs']),
  }));

  ok('MUTASYON: JS tarafi bozulunca parity_check.mjs KIRMIZI', !r.js.ok, `exit ${r.js.kod}`);
  ok('JS kolu cokme degil, uyusmazlik bildirdi', /PARITY FAIL/.test(r.js.out),
    r.js.out.split('\n').filter(Boolean).slice(-1)[0]);
  ok('ayni anda python kolu YESIL kaldi (iki kol bagimsiz)', r.py.ok, `exit ${r.py.kod}`);
  ok('web/js/features.js bit-ayni geri kondu', sha(jsYol) === jsSha);

  // And the negative gate now carries that vector itself, so it is not this file's private trick.
  const neg = kos('node', ['train/parity_negatif_check.mjs']);
  ok('parity_negatif_check.mjs gecti', neg.ok, `exit ${neg.kod}`);
  ok('parity_negatif_check.mjs artik JS kolunu da sabote ediyor',
    /JS arm RED when web\/js\/features\.js is deliberately skewed/.test(neg.out)
    && /python arm stays GREEN/.test(neg.out),
    neg.out.split('\n').filter((l) => /arm/.test(l)).join(' | '));
});

// ---- 3. Turkish uppercase blindness ------------------------------------------------------------

baslik('3. sizinti kapilari turkce buyuk harf koru muydu');

const { trKucult, kacamakBul } = await import('./tr_kucult.mjs');

await blok('turkce kucultme', async () => {
  ok('JS toLowerCase() gercekten kaciriyor: GENELLIKLE (İ ile) -> genellikle DEGIL',
    'GENELLİKLE'.toLowerCase() !== 'genellikle', JSON.stringify('GENELLİKLE'.toLowerCase()));
  ok('trKucult duzeltiyor', trKucult('GENELLİKLE') === 'genellikle', JSON.stringify(trKucult('GENELLİKLE')));
  ok('I -> ı de dogru', trKucult('IŞIK') === 'ışık', JSON.stringify(trKucult('IŞIK')));
  ok('kacamak taramasi buyuk harfli hedge kelimeyi buluyor',
    kacamakBul('Mesajların GENELLİKLE cihazından çıkmaz.', ['genellikle']).length === 1);
});

// The bulut gate carries this as an assertion of its own; the mutation proves that assertion is
// load-bearing. tr_kucult.mjs is downgraded to the plain call and the gate has to notice.
await blok('bulut_check_eski turkce mutasyonu', async () => {
  const once = kos('node', ['train/bulut_check_eski.mjs']);
  ok('bulut_check_eski temiz agacta YESIL', once.ok, `exit ${once.kod}`);
  ok('bulut_check_eski GENELLİKLE olcumunu yapiyor',
    /turkce buyuk harf: GENELLİKLE yakalaniyor/.test(once.out), 'olcum satiri yok');

  const sonra = await mutasyon('train/tr_kucult.mjs',
    (src) => src.replace(
      "return String(s).replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase();",
      'return String(s).toLowerCase();'),
    async () => kos('node', ['train/bulut_check_eski.mjs']));
  ok('MUTASYON: duz toLowerCase a donulunce bulut_check_eski KIRMIZI', !sonra.ok, `exit ${sonra.kod}`);
  ok('kirmizi yanan sey tam da turkce olcumu',
    /\*\*\* turkce buyuk harf: GENELLİKLE yakalaniyor/.test(sonra.out),
    sonra.out.split('\n').filter((l) => l.startsWith('***')).join(' | '));
});

// End to end through the leak gate: a real address written in Turkish capitals, sitting in a
// tracked file, has to turn sizinti_check red. The pattern is synthetic and the pattern FILE lives
// in a temp dir outside the repo, so nothing personal is written anywhere.
//
// The local parts are MINTED AT RUNTIME from random bytes, and that is the whole point. The first
// version of this gate spelled them out as literals, so once this file was committed the leak gate
// found its own source and `sizinti_check` went red on a clean tree — the gate was the leak. A
// working-tree-only fix would not have been enough either: the history pass greps every commit, and
// the literal is already sitting in an old one. Only a string that exists in no commit, and in no
// file, can be searched for without the searcher matching itself. Splitting a fixed literal across
// concatenated fragments would still lose, because the widened history scan reads whole lines from
// blobs, not from this source. Reading them from a pattern file would only move the literal into a
// second file that has the same problem the day it is committed.
//
// The domain stays `ornek.test`: `.test` is reserved by RFC 6761 and can never resolve, and the
// bare string `ornek.test` is not a pattern by itself, so it is safe to keep in plain sight.
const rastgeleYerel = (onek) => onek + randomBytes(6).toString('hex'); // hex: hic `i` icermez
const ASCII_YEREL = rastgeleYerel('zb');   // saf ASCII kol
const TR_YEREL = rastgeleYerel('i');       // turkce kol: bas harf `i`, buyugu `İ`
const ALAN = 'ornek.test';
const ASCII_ADRES_BUYUK = `${ASCII_YEREL.toUpperCase()}@${ALAN.toUpperCase()}`;
// Turkish uppercase, done by hand: `'i'.toUpperCase()` is `I` in JS, not `İ`. The rest is hex.
const TR_ADRES_BUYUK = `İ${TR_YEREL.slice(1).toUpperCase()}@${ALAN.toUpperCase()}`;

const tmp = mkdtempSync(join(tmpdir(), 'kapi-saglik-'));
const DESEN_DOSYA = join(tmp, 'desenler.json');
writeFileSync(DESEN_DOSYA, JSON.stringify({
  metadata_izinli_email: '@users\\.noreply\\.github\\.com$',
  desenler: [
    { ad: 'sentetik adres', desen: `${ASCII_YEREL}@ornek\\.test` },
    { ad: 'sentetik tr adres', desen: `${TR_YEREL}@ornek\\.test` },
  ],
}, null, 2));
const sizintiKos = () => kos('node', ['train/sizinti_check.mjs'], {
  env: { ...process.env, SIZINTI_PATTERNS: DESEN_DOSYA },
});

await blok('sizinti_check turkce buyuk harf, uctan uca', async () => {
  // The green below only means something if the minted patterns are genuinely absent. Asked of
  // git directly, over the working tree AND over every commit reachable from any ref.
  const SENTETIK_ERE = `(${ASCII_YEREL}@ornek\\.test)|(${TR_YEREL}@ornek\\.test)`;
  const agactaVar = kos('git', ['grep', '-I', '-i', '-l', '-E', SENTETIK_ERE, '--']);
  // `git grep --all` is not a thing (that is --all-match); the revisions are listed explicitly.
  const tumCommitler = git(['rev-list', '--all']).split('\n').filter(Boolean);
  const gecmisteVar = kos('git', ['grep', '-I', '-i', '-l', '-E', SENTETIK_ERE, ...tumCommitler, '--']);
  ok('sentetik desenler calisma agacinda HIC gecmiyor (kapi kendi kaynagini yakalamiyor)',
    agactaVar.kod === 1, agactaVar.out.trim());
  ok('sentetik desenler hicbir commit te de gecmiyor (gecmis de temiz)',
    gecmisteVar.kod === 1, gecmisteVar.out.trim());

  const temiz = sizintiKos();
  ok('sentetik desenlerle temiz agac YESIL', temiz.ok, `exit ${temiz.kod}`);

  const kirli = await mutasyon('train/synth.mjs',
    (src) => `// gecici sizinti testi: ${TR_ADRES_BUYUK}\n${src}`,
    async () => sizintiKos());
  ok('MUTASYON: turkce buyuk harfli adres calisma agacinda KIRMIZI yakiyor', !kirli.ok, `exit ${kirli.kod}`);
  ok('kirmizi satir dosyayi ve deseni adiyla soyluyor',
    /calisma agaci train\/synth\.mjs:1 sentetik tr adres/.test(kirli.out),
    kirli.out.split('\n').filter((l) => /synth/.test(l)).join(' | '));

  const geri = sizintiKos();
  ok('geri konulunca yeniden YESIL', geri.ok, `exit ${geri.kod}`);
});

// ---- 4. refs/heads disi: uyari, refs/heads: kirmizi --------------------------------------------

baslik('4. sizinti kapisi refs/ altinin tamamina bakiyor mu');

const refOnce = git(['for-each-ref', '--format=%(refname) %(objectname)', 'refs/']).trim();

// The working tree as it was BEFORE this gate ran. The old check compared against a hand-written
// list of file names, which meant it went red every time the repo had unrelated work in progress
// and it went green if a mutation leaked into a file that happened to be on the list. The question
// is not "which files are dirty" but "did THIS gate leave anything behind", so it is asked as a
// before/after difference.
const agacOnce = git(['status', '--porcelain']);

// A synthetic dirty commit, built with plumbing so no branch, no index and no working file is
// touched. Its author is the noreply identity on purpose: the finding has to come from the
// CONTENT, so the metadata rule cannot be what trips the gate.
function sentetikKirliCommit(adres) {
  const blob = git(['hash-object', '-w', '--stdin'], { input: `iletisim: ${adres}\n` }).trim();
  const tree = git(['mktree'], { input: `100644 blob ${blob}\tkirli.txt\n` }).trim();
  return git(['commit-tree', tree, '-m', 'sentetik kirli commit'], {
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'nosey-dewdrop', GIT_AUTHOR_EMAIL: 'nosey-dewdrop@users.noreply.github.com',
      GIT_COMMITTER_NAME: 'nosey-dewdrop', GIT_COMMITTER_EMAIL: 'nosey-dewdrop@users.noreply.github.com',
      GIT_AUTHOR_DATE: '2020-01-01T00:00:00 +0000', GIT_COMMITTER_DATE: '2020-01-01T00:00:00 +0000',
    },
  }).trim();
}

const GECICI_DIGER = 'refs/kapisaglik/kirli';
const GECICI_HEAD = 'refs/heads/kapisaglik-kirli';

await blok('ref kapsami', async () => {
  const commit = sentetikKirliCommit(ASCII_ADRES_BUYUK);
  const commitTr = sentetikKirliCommit(TR_ADRES_BUYUK);
  try {
    // 4a. dirty ref OUTSIDE refs/heads: named in a warning, exit code stays green
    git(['update-ref', GECICI_DIGER, commit]);
    const disari = sizintiKos();
    ok('refs/heads DISINDAKI kirli ref kapiyi KIRMIZI yakmiyor', disari.ok, `exit ${disari.kod}`);
    ok('ama ayri bir UYARI satirinda gorunuyor', /UYARI \(kapi kirmizi degil\)/.test(disari.out),
      'uyari blogu yok');
    ok('uyari kirli ref i ADIYLA soyluyor', new RegExp(GECICI_DIGER).test(disari.out),
      disari.out.split('\n').filter((l) => /kapisaglik/.test(l)).join(' | '));
    git(['update-ref', '-d', GECICI_DIGER]);

    // 4b. the same commit under refs/heads: RED
    git(['update-ref', GECICI_HEAD, commit]);
    const icerde = sizintiKos();
    ok('AYNI commit refs/heads altinda KIRMIZI yakiyor', !icerde.ok, `exit ${icerde.kod}`);
    ok('kirmizi satir dali adiyla soyluyor', /gecmis [0-9a-f]{40}:kirli\.txt/.test(icerde.out),
      icerde.out.split('\n').filter((l) => /kirli\.txt/.test(l)).slice(0, 2).join(' | '));
    git(['update-ref', '-d', GECICI_HEAD]);

    // 4c. THE SAME THING IN TURKISH CAPITALS. 4b above is pure ASCII, so `git grep -i` folds it and
    // the gate would have looked fine while being completely blind to `İ` in history — the
    // working-tree scan normalises, the history scan did not. This is the measurement that was
    // never taken.
    git(['update-ref', GECICI_HEAD, commitTr]);
    const trIcerde = sizintiKos();
    ok('turkce buyuk harfli adres GECMISTE de KIRMIZI yakiyor (git grep -i tek basina bulamaz)',
      !trIcerde.ok, `exit ${trIcerde.kod} — gecmis taramasi hala turkce koru`);
    ok('kirmizi satir commit i ve dosyayi adiyla soyluyor',
      /gecmis [0-9a-f]{40}:kirli\.txt/.test(trIcerde.out),
      trIcerde.out.split('\n').filter((l) => /kirli\.txt/.test(l)).slice(0, 2).join(' | '));
    ok('bulgu, yalnizca turkce taramanin buldugu diye ISARETLENIYOR',
      /yalnizca turkce buyuk harf taramasi buldu/.test(trIcerde.out),
      trIcerde.out.split('\n').filter((l) => /kirli\.txt/.test(l)).slice(0, 2).join(' | '));
    ok('kapi turkce varyant taramasini kostugunu ADIYLA yaziyor',
      /gecmis taramasi: ascii \(-i\) \+ turkce buyuk harf varyanti/.test(trIcerde.out),
      'gecmis tarama satiri yok');

    // MUTATION: take the widened pass back out, leaving only `git grep -i`. The same commit,
    // still sitting under refs/heads, has to go UNNOTICED — that is the proof that the widening
    // is what catches it and not something else in the gate.
    const kor = await mutasyon('train/sizinti_check.mjs',
      (src) => src.replace(
        "for (const [etiket, ere] of [['ascii', birlesikEre], ['turkce', birlesikEreTr]]) {",
        "for (const [etiket, ere] of [['ascii', birlesikEre]]) {"),
      async () => sizintiKos());
    ok('MUTASYON: turkce kol sokulunce ayni commit gecmiste GORULMUYOR (kapi yeniden kor)',
      kor.ok, `exit ${kor.kod} — mutasyon tutmadi, bu olcum bir sey ispatlamiyor`);
    git(['update-ref', '-d', GECICI_HEAD]);

    // 4d. and outside refs/heads the Turkish one is a named warning, not a red light
    git(['update-ref', GECICI_DIGER, commitTr]);
    const trDisari = sizintiKos();
    ok('turkce kirli ref refs/heads DISINDA kapiyi kirmizi yakmiyor', trDisari.ok, `exit ${trDisari.kod}`);
    ok('ama uyarida commit iyle birlikte gorunuyor',
      new RegExp(GECICI_DIGER).test(trDisari.out) && /kirli\.txt/.test(trDisari.out),
      trDisari.out.split('\n').filter((l) => /kapisaglik|kirli\.txt/.test(l)).join(' | '));
    git(['update-ref', '-d', GECICI_DIGER]);

    // 4e. the real backup refs are seen, named, and NOT deleted
    const gercek = sizintiKos();
    ok('gecici refler temizlenince kapi yeniden YESIL', gercek.ok, `exit ${gercek.kod}`);
    ok('gercek yedek refleri uyarida adiyla geciyor',
      /refs\/backup\/main/.test(gercek.out) && /refs\/original\/refs\/heads\/main/.test(gercek.out),
      'yedek refler uyarida gorunmuyor');
    ok('uyari sayisi > 0 ama exit 0 (yedekler silinmedi, kapi yalan da soylemedi)',
      gercek.ok && /kirli ref/.test(gercek.out));
  } finally {
    for (const r of [GECICI_DIGER, GECICI_HEAD]) {
      try { git(['update-ref', '-d', r]); } catch { /* zaten yok */ }
    }
  }
});

ok('hicbir ref silinmedi/degismedi (yedekler dahil)',
  git(['for-each-ref', '--format=%(refname) %(objectname)', 'refs/']).trim() === refOnce,
  'ref listesi degisti');

// ---- 5. enum listeleri motorun sozlugunden turetiliyor mu --------------------------------------

baslik('5. enum listeleri motorun sozlugunden dogrulaniyor mu');

await blok('enum turetme', async () => {
  const temiz = kos('node', ['train/bulut_check_eski.mjs']);
  ok('temiz agacta enum kapisi YESIL', temiz.ok, `exit ${temiz.kod}`);
  ok('kapi sozlugu reveal.js ten gercekten okuyor',
    /motorun sozlugu \(reveal\.js \+ signals\.js'ten okundu\)/.test(temiz.out)
    && /hukum : flirty, friendly, cold, tense, onesided/.test(temiz.out),
    temiz.out.split('\n').filter((l) => /hukum :|karar :|kavram:/.test(l)).join(' | '));

  // MUTATION A: the client list goes stale against the engine's tone vocabulary.
  const a = await mutasyon('web/js/api.js',
    (src) => src.replace(
      "  hukum: ['flirty', 'friendly', 'cold', 'tense', 'onesided'],",
      "  hukum: ['flirty', 'friendly', 'cold', 'tense'],"),
    async () => kos('node', ['train/bulut_check_eski.mjs']));
  ok('MUTASYON A: api.js listesinden bir ton dusunce KIRMIZI', !a.ok, `exit ${a.kod}`);
  ok('kirmizi satir eksik degeri adiyla soyluyor',
    /sozlukte var listede YOK: onesided/.test(a.out),
    a.out.split('\n').filter((l) => l.startsWith('***')).slice(0, 2).join(' | '));

  // MUTATION B: the server's concept list goes stale against signals.js.
  const b = await mutasyon('backend/worker.js',
    (src) => src.replace(
      "const KAVRAMLAR = ['gecikme', 'baslatma', 'bitiren', 'uzunluk', 'gece', 'sessizlik'];",
      "const KAVRAMLAR = ['gecikme', 'baslatma', 'bitiren', 'uzunluk', 'gece'];"),
    async () => kos('node', ['train/bulut_check_eski.mjs']));
  ok('MUTASYON B: worker KAVRAMLAR dan bir kavram dusunce KIRMIZI', !b.ok, `exit ${b.kod}`);
  ok('kirmizi satir eksik kavrami adiyla soyluyor',
    /sozlukte var listede YOK: sessizlik/.test(b.out),
    b.out.split('\n').filter((l) => l.startsWith('***')).slice(0, 2).join(' | '));

  const geri = kos('node', ['train/bulut_check_eski.mjs']);
  ok('mutasyonlar geri alininca yeniden YESIL', geri.ok, `exit ${geri.kod}`);
});

// ---- calisma agaci temiz mi -------------------------------------------------------------------

baslik('calisma agaci');

rmSync(tmp, { recursive: true, force: true });

await blok('temizlik', async () => {
  // .rabadon is machine-local session state written by an outside tool while this runs, so it is
  // dropped from BOTH snapshots rather than excused in one of them.
  const suz = (metin) => metin.split('\n').map((x) => x.trim()).filter(Boolean)
    .filter((x) => !x.includes('.rabadon/'));
  const once = suz(agacOnce);
  const simdi = suz(git(['status', '--porcelain']));
  const yeni = simdi.filter((x) => !once.includes(x));
  const kaybolan = once.filter((x) => !simdi.includes(x));
  console.log(once.length
    ? `     kapi baslarken zaten kirli olan ${once.length} dosya vardi, bunlar sayilmiyor`
    : '     kapi temiz bir agacta kostu');
  for (const x of [...yeni, ...kaybolan]) console.log(`     ${x}`);
  ok('kapi hicbir dosyayi kirli birakmadi (mutasyonlarin hepsi geri kondu)',
    yeni.length === 0 && kaybolan.length === 0,
    [...yeni.map((x) => `yeni: ${x}`), ...kaybolan.map((x) => `kayboldu: ${x}`)].join(', '));
});

console.log('');
if (fails) { console.log(`KIRMIZI: ${fails} olcum dustu`); process.exit(1); }
console.log('YESIL: bes borcun besi de olculdu, her biri kendi mutasyonuyla kirmizi yandi.');
process.exit(0);
