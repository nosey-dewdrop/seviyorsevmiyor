// Parity harness (Node side): recompute numeric features + tone probabilities using the SAME
// web/js modules the browser uses, and assert they match parity_expected.json from Python.
// Run after parity_check.py. Exits non-zero on any mismatch beyond 1e-4.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { numericVector } from '../web/js/features.js';
import { setModel, scoreConversation } from '../web/js/model.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const model = JSON.parse(fs.readFileSync(path.join(here, '..', 'web', 'data', 'model.json'), 'utf-8'));
const expected = JSON.parse(fs.readFileSync(path.join(here, 'parity_expected.json'), 'utf-8'));
setModel(model);

let maxDiff = 0;
let fails = 0;
for (const ex of expected) {
  const num = numericVector(ex.text);
  const r = scoreConversation(ex.text);
  for (let i = 0; i < num.length; i++) maxDiff = Math.max(maxDiff, Math.abs(num[i] - ex.numeric[i]));
  for (let i = 0; i < r.probs.length; i++) maxDiff = Math.max(maxDiff, Math.abs(r.probs[i] - ex.probs[i]));
  const py = ex.probs.indexOf(Math.max(...ex.probs));
  const js = r.probs.indexOf(Math.max(...r.probs));
  if (py !== js) { fails++; console.log('CLASS MISMATCH:', ex.text.split('\n')[0]); }
}
console.log(`max feature/prob diff Python vs JS: ${maxDiff.toExponential(2)}`);
if (maxDiff > 1e-4 || fails) { console.error('PARITY FAIL'); process.exit(1); }
console.log('PARITY OK');
