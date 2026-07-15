// On-device inference for the tone classifier. Loads web/data/model.json (a linear model
// exported by train/train.py) and scores a conversation entirely in the browser — no network,
// data never leaves the device. Mirrors the Python TF-IDF + softmax math exactly.

import { ngrams, numericVector, NUMERIC_NAMES } from './features.js?v=54';

let MODEL = null;
let LOADING = null;   // in-flight guard: idle-prefetch + tıklama aynı anda tek fetch yapsın

export async function loadModel(url = './data/model.json?v=54') {
  if (MODEL) return MODEL;
  if (LOADING) return LOADING;
  LOADING = fetch(url).then((res) => res.json()).then((m) => { MODEL = m; return m; });
  return LOADING;
}

export function setModel(m) { MODEL = m; }   // for tests / node parity harness

function softmax(z) {
  const mx = Math.max(...z);
  const e = z.map((v) => Math.exp(v - mx));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
}

// Returns { classes, probs, top, confidence, margin, logits }.
export function scoreConversation(doc) {
  const m = MODEL;
  if (!m) throw new Error('model not loaded');
  const nC = m.classes.length;
  const logits = m.bias.slice();

  // TF-IDF over the ngram vocabulary, L2-normalized, dotted with token weights.
  const counts = new Map();
  for (const g of ngrams(doc)) if (m.idf[g] !== undefined) counts.set(g, (counts.get(g) || 0) + 1);
  let norm = 0;
  const tfidf = new Map();
  for (const [g, c] of counts) { const v = c * m.idf[g]; tfidf.set(g, v); norm += v * v; }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (const [g, v] of tfidf) {
      const w = m.token_weights[g];
      const val = v / norm;
      for (let c = 0; c < nC; c++) logits[c] += w[c] * val;
    }
  }

  // Numeric block: z-scored with stored mean/std, dotted with numeric weights.
  const num = numericVector(doc);
  for (let j = 0; j < NUMERIC_NAMES.length; j++) {
    const z = (num[j] - m.numeric_mean[j]) / m.numeric_std[j];
    const w = m.numeric_weights[j];
    for (let c = 0; c < nC; c++) logits[c] += w[c] * z;
  }

  const probs = softmax(logits);
  const order = probs.map((p, i) => [p, i]).sort((a, b) => b[0] - a[0]);
  const top = m.classes[order[0][1]];
  return {
    classes: m.classes,
    probs,
    top,
    confidence: order[0][0],
    margin: order[0][0] - order[1][0],
    logits,
  };
}
