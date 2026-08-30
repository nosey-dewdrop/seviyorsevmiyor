// NEGATIVE test for the parity gate: proves the gate can actually go RED.
//
// A gate that writes its own reference always passes. This test breaks the feature code on
// purpose, runs the gate, and asserts the gate FAILS — then restores the file byte for
// byte. It also asserts the gate never touches parity_expected.json, and that the gate
// refuses to pass when the frozen reference is absent.
//
// TWO sabotage vectors, because parity has two arms and only one of them was ever tested.
// The old file broke train/features.py only. python3 train/parity_check.py exits 1 on that, and
// runGate() returns at the first failure, so train/parity_check.mjs — the arm that guards
// web/js/features.js, the code the BROWSER actually runs — never executed even once during the
// negative test. Whether the JS gate could go red was an assumption, not a measurement. So the
// JS side is now skewed on its own: the Python arm must stay GREEN (its input did not change)
// while the JS arm goes RED, which also proves the two arms are independent.
//
// Run: node train/parity_negatif_check.mjs
// The working tree MUST be clean afterwards.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const FEATURES = path.join(here, 'features.py');
const EXPECTED = path.join(here, 'parity_expected.json');
// The browser's half of the parity pair. It is restored byte for byte in the finally block below;
// nothing here is a permanent edit to web/.
const JS_FEATURES = path.join(root, 'web', 'js', 'features.js');

const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

const ARMS = {
  py: ['python3', ['train/parity_check.py']],
  js: ['node', ['train/parity_check.mjs']],
};

// One arm on its own, so "which side went red" is a measurement instead of an inference.
function runArm(ad) {
  fs.rmSync(path.join(here, '__pycache__'), { recursive: true, force: true });
  const [cmd, args] = ARMS[ad];
  const env = { ...process.env, PYTHONDONTWRITEBYTECODE: '1' };
  try {
    const out = execFileSync(cmd, args, { cwd: root, env, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { ok: true, code: 0, out };
  } catch (e) {
    return { ok: false, code: e.status, out: String(e.stdout || '') + String(e.stderr || '') };
  }
}

// Run the full gate (py side then js side). Returns { ok, code, out }.
// The bytecode cache is purged first: our sabotage keeps features.py exactly the same
// byte length, so within one second Python would happily reuse the stale .pyc and we
// would be testing the cache instead of the gate.
function runGate() {
  fs.rmSync(path.join(here, '__pycache__'), { recursive: true, force: true });
  const env = { ...process.env, PYTHONDONTWRITEBYTECODE: '1' };
  const parts = [];
  for (const [cmd, args] of [['python3', ['train/parity_check.py']], ['node', ['train/parity_check.mjs']]]) {
    try {
      parts.push(execFileSync(cmd, args, { cwd: root, env, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }));
    } catch (e) {
      parts.push(String(e.stdout || '') + String(e.stderr || ''));
      return { ok: false, code: e.status, out: parts.join('') };
    }
  }
  return { ok: true, code: 0, out: parts.join('') };
}

let failures = 0;
const check = (name, cond, detail) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
};

const featuresOriginal = fs.readFileSync(FEATURES);
const featuresSha = sha(FEATURES);
const expectedOriginal = fs.readFileSync(EXPECTED);
const expectedSha = sha(EXPECTED);
const jsOriginal = fs.readFileSync(JS_FEATURES);
const jsSha = sha(JS_FEATURES);

try {
  // --- 1. baseline: clean tree, gate must be GREEN ---
  const base = runGate();
  check('baseline gate GREEN on clean tree', base.ok, base.ok ? '' : `exit ${base.code}`);

  // --- 2. gate must not rewrite the frozen reference ---
  check('parity_expected.json bit-identical after gate run', sha(EXPECTED) === expectedSha);

  // --- 3. deliberate drift in features.py -> gate must be RED ---
  const src = featuresOriginal.toString('utf-8');
  const NEEDLE = '"avg_len": (total_len / n) / 100.0,';
  const SABOTAGE = '"avg_len": (total_len / n) / 101.0,';
  if (!src.includes(NEEDLE)) throw new Error(`sabotage anchor not found in features.py: ${NEEDLE}`);
  fs.writeFileSync(FEATURES, src.replace(NEEDLE, SABOTAGE), 'utf-8');

  const broken = runGate();
  check('gate RED when features.py is deliberately skewed', !broken.ok,
    broken.ok ? 'gate stayed green — the gate is validating itself' : `exit ${broken.code}`);
  check('gate reported a mismatch, not a crash', /PARITY FAIL/.test(broken.out));
  check('frozen reference NOT overwritten while gate was red', sha(EXPECTED) === expectedSha);

  fs.writeFileSync(FEATURES, featuresOriginal);
  check('features.py restored byte-identical', sha(FEATURES) === featuresSha);

  // --- 3b. the SECOND vector: deliberate drift in web/js/features.js ---
  //
  // Same skew, other arm. The Python arm reads train/features.py and the frozen reference, neither
  // of which changed, so it must stay GREEN — that is what proves the JS gate went red on its own
  // merits rather than being dragged down by a shared failure.
  const jsSrc = jsOriginal.toString('utf-8');
  const JS_NEEDLE = 'avg_len: (totalLen / n) / 100.0,';
  const JS_SABOTAGE = 'avg_len: (totalLen / n) / 101.0,';
  if (!jsSrc.includes(JS_NEEDLE)) throw new Error(`sabotage anchor not found in web/js/features.js: ${JS_NEEDLE}`);
  fs.writeFileSync(JS_FEATURES, jsSrc.replace(JS_NEEDLE, JS_SABOTAGE), 'utf-8');

  const jsPy = runArm('py');
  const jsJs = runArm('js');
  check('python arm stays GREEN when only the JS side is skewed', jsPy.ok,
    jsPy.ok ? '' : `exit ${jsPy.code} — the two arms are not independent`);
  check('JS arm RED when web/js/features.js is deliberately skewed', !jsJs.ok,
    jsJs.ok ? 'JS gate stayed green — a browser-side drift would ship unnoticed' : `exit ${jsJs.code}`);
  check('JS arm reported a mismatch, not a crash', /PARITY FAIL/.test(jsJs.out),
    jsJs.out.split('\n').filter(Boolean).slice(-2).join(' | '));
  check('frozen reference NOT overwritten while the JS arm was red', sha(EXPECTED) === expectedSha);

  fs.writeFileSync(JS_FEATURES, jsOriginal);
  check('web/js/features.js restored byte-identical', sha(JS_FEATURES) === jsSha);
  check('both arms GREEN again after the JS restore', runArm('py').ok && runArm('js').ok);

  // --- 4. missing reference -> gate must NOT pass ---
  fs.rmSync(EXPECTED);
  const noRef = runGate();
  check('gate RED when parity_expected.json is absent', !noRef.ok,
    noRef.ok ? 'gate passed with no reference' : `exit ${noRef.code}`);
  check('gate did not silently regenerate the reference', !fs.existsSync(EXPECTED));

  fs.writeFileSync(EXPECTED, expectedOriginal);
  check('parity_expected.json restored byte-identical', sha(EXPECTED) === expectedSha);

  // --- 5. tree is green again ---
  const after = runGate();
  check('gate GREEN again after restore', after.ok, after.ok ? '' : `exit ${after.code}`);
} finally {
  // Never leave the working tree dirty, whatever happened above.
  fs.writeFileSync(FEATURES, featuresOriginal);
  fs.writeFileSync(EXPECTED, expectedOriginal);
  fs.writeFileSync(JS_FEATURES, jsOriginal);
}

if (sha(FEATURES) !== featuresSha || sha(EXPECTED) !== expectedSha || sha(JS_FEATURES) !== jsSha) {
  console.error('NEGATIF FAIL: working tree not restored');
  process.exit(1);
}

if (failures) {
  console.error(`NEGATIF FAIL: ${failures} assertion(s) failed`);
  process.exit(1);
}
console.log('NEGATIF OK: both arms go red on their own tampering, and on a missing reference');
