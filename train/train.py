"""Train the tone classifier and export a linear model the browser can score.

No sklearn: TF-IDF is computed by hand and multinomial logistic regression is fit with
plain numpy gradient descent + L2. The export (web/data/model.json) is a linear model:
per-token weights (over the TF-IDF ngram space) + per-numeric-feature weights + bias per
class, plus the idf table and numeric mean/std so features.js can reproduce the exact input.

Run:  python3 train/train.py
Prints held-out accuracy (honest, small seed set) and writes web/data/model.json.
"""

import json
import math
import os
import numpy as np

import features as F

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data.jsonl")
OUT = os.path.join(HERE, "..", "web", "data", "model.json")
CLASSES = ["flirty", "friendly", "cold", "tense"]
MIN_DF = 2          # drop ngrams seen in fewer than this many convos (noise)
L2 = 1e-3
LR = 0.5
EPOCHS = 4000
SEED = 7


def load():
    rows = []
    with open(DATA, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def load_synth():
    # teacher-distilled synthetic rows: TRAIN ONLY, never in the held-out split
    import glob
    rows = []
    for p in sorted(glob.glob(os.path.join(HERE, "synth_claude_*.jsonl"))):
        with open(p, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if line:
                    rows.append(json.loads(line))
    return rows


def build_vocab(docs):
    df = {}
    for d in docs:
        for g in set(F.ngrams(d)):
            df[g] = df.get(g, 0) + 1
    vocab = sorted(g for g, c in df.items() if c >= MIN_DF)
    idx = {g: i for i, g in enumerate(vocab)}
    n = len(docs)
    idf = {g: math.log((1 + n) / (1 + df[g])) + 1.0 for g in vocab}
    return vocab, idx, idf


def tfidf_row(doc, idx, idf, vocab):
    counts = {}
    for g in F.ngrams(doc):
        if g in idx:
            counts[g] = counts.get(g, 0) + 1
    vec = np.zeros(len(vocab))
    for g, c in counts.items():
        vec[idx[g]] = c * idf[g]
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec /= norm
    return vec


def softmax(z):
    z = z - z.max(axis=1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=1, keepdims=True)


def train(X, y, n_classes):
    rng = np.random.default_rng(SEED)
    W = rng.normal(0, 0.01, (X.shape[1], n_classes))
    b = np.zeros(n_classes)
    Y = np.eye(n_classes)[y]
    m = X.shape[0]
    for ep in range(EPOCHS):
        P = softmax(X @ W + b)
        gW = X.T @ (P - Y) / m + L2 * W
        gb = (P - Y).sum(axis=0) / m
        W -= LR * gW
        b -= LR * gb
    return W, b


def main():
    rows = load()
    synth = load_synth()
    n_real = len(rows)
    rows = rows + synth
    docs = [r["text"] for r in rows]
    y = np.array([CLASSES.index(r["tone"]) for r in rows])
    print(f"{n_real} real + {len(synth)} synth = {len(rows)} labeled conversations")

    vocab, idx, idf = build_vocab(docs)
    num_names = F.NUMERIC_NAMES
    Xtok = np.vstack([tfidf_row(d, idx, idf, vocab) for d in docs])
    Xnum_raw = np.array([F.numeric_vector(d) for d in docs])
    mean = Xnum_raw.mean(axis=0)
    std = Xnum_raw.std(axis=0)
    std[std < 1e-6] = 1.0
    Xnum = (Xnum_raw - mean) / std
    X = np.hstack([Xtok, Xnum])

    # Held-out split: every 5th of the REAL seed only. Synth rows are TRAIN ONLY,
    # so the accuracy read stays honest (never graded on our own synthetic dialect).
    rng = np.random.default_rng(SEED)
    order = rng.permutation(n_real)
    test_idx = order[::5]
    train_idx = np.array([i for i in order if i not in set(test_idx.tolist())] + list(range(n_real, len(rows))))
    W, b = train(X[train_idx], y[train_idx], len(CLASSES))
    P = softmax(X[test_idx] @ W + b)
    acc = (P.argmax(axis=1) == y[test_idx]).mean()
    print(f"held-out accuracy: {acc:.3f} on {len(test_idx)} REAL samples (synth never tested on)")

    # Final model on ALL data for shipping.
    Wf, bf = train(X, y, len(CLASSES))
    n_tok = len(vocab)
    token_weights = {}
    for g, i in idx.items():
        w = Wf[i]
        if np.abs(w).max() > 1e-4:            # skip dead tokens to keep the file small
            token_weights[g] = [round(float(v), 5) for v in w]
    model = {
        "version": 1,
        "classes": CLASSES,
        "idf": {g: round(float(idf[g]), 5) for g in vocab if g in token_weights},
        "token_weights": token_weights,
        "numeric_names": num_names,
        "numeric_mean": [round(float(v), 6) for v in mean],
        "numeric_std": [round(float(v), 6) for v in std],
        "numeric_weights": [[round(float(Wf[n_tok + j][c]), 5) for c in range(len(CLASSES))]
                            for j in range(len(num_names))],
        "bias": [round(float(v), 5) for v in bf],
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(model, fh, ensure_ascii=False)
    size_kb = os.path.getsize(OUT) / 1024
    print(f"wrote {OUT} ({size_kb:.1f} KB, {len(token_weights)} tokens)")


if __name__ == "__main__":
    main()
