"""Parity harness (Python side): score sample conversations from web/data/model.json using
the SAME math the browser uses, and dump probabilities to parity_expected.json. parity_check.mjs
then recomputes them in Node via web/js and asserts they match. Guards Python<->JS drift.

Run:  python3 train/parity_check.py  &&  node train/parity_check.mjs
"""
import json
import math
import os
import features as F

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = json.load(open(os.path.join(HERE, "..", "web", "data", "model.json"), encoding="utf-8"))

SAMPLES = [
    "A: bugün seni düşündüm\nB: aa öyle mi\nA: gülüşün aklımdaydı 😍",
    "A: ödevi çözdün mü\nB: yok bakıyorum\nA: beraber yapalım mı",
    "A: naber\nB: iyi\nA: müsait misin\nB: değilim",
    "A: neden yazmadın bütün gün\nB: uğraşamadım\nA: iki dakikan yok muydu",
    "A: aşkım günaydın 💕\nB: günaydın canım\nA: seni özledim",
    "A: konumunu aç\nB: neden açayım bu takıntı hastalık",
]


def infer(doc):
    logits = list(MODEL["bias"])
    nC = len(MODEL["classes"])
    counts = {}
    for g in F.ngrams(doc):
        if g in MODEL["idf"]:
            counts[g] = counts.get(g, 0) + 1
    norm = math.sqrt(sum((c * MODEL["idf"][g]) ** 2 for g, c in counts.items()))
    if norm > 0:
        for g, c in counts.items():
            val = (c * MODEL["idf"][g]) / norm
            w = MODEL["token_weights"][g]
            for k in range(nC):
                logits[k] += w[k] * val
    num = F.numeric_vector(doc)
    for j, name in enumerate(MODEL["numeric_names"]):
        z = (num[j] - MODEL["numeric_mean"][j]) / MODEL["numeric_std"][j]
        w = MODEL["numeric_weights"][j]
        for k in range(nC):
            logits[k] += w[k] * z
    mx = max(logits)
    e = [math.exp(v - mx) for v in logits]
    s = sum(e)
    return [v / s for v in e]


out = []
for d in SAMPLES:
    out.append({"text": d, "numeric": F.numeric_vector(d), "probs": infer(d)})
json.dump(out, open(os.path.join(HERE, "parity_expected.json"), "w", encoding="utf-8"), ensure_ascii=False)
print(f"wrote parity_expected.json ({len(out)} samples)")
for d, o in zip(SAMPLES, out):
    top = MODEL["classes"][o["probs"].index(max(o["probs"]))]
    print(f"  {top:9s} {max(o['probs']):.3f}  {d.splitlines()[0][:40]}")
