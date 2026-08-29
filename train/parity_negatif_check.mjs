// NEGATIVE test for the parity gate: proves the gate can actually go RED.
//
// A gate that writes its own reference always passes. This test breaks features.py on
// purpose, runs the gate, and asserts the gate FAILS — then restores the file byte for
// byte. It also asserts the gate never touches parity_expected.json, and that the gate
// refuses to pass when the frozen reference is absent.
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

const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

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
}

if (sha(FEATURES) !== featuresSha || sha(EXPECTED) !== expectedSha) {
  console.error('NEGATIF FAIL: working tree not restored');
  process.exit(1);
}

if (failures) {
  console.error(`NEGATIF FAIL: ${failures} assertion(s) failed`);
  process.exit(1);
}
console.log('NEGATIF OK: gate goes red on tampering and on a missing reference');
