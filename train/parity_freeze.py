"""Parity REFERENCE producer. This is the ONLY thing allowed to write parity_expected.json.

The gate (parity_check.py + parity_check.mjs) only READS that file. Keeping production
separate is the whole point: if the gate wrote its own reference, a broken features.py
would silently redefine "correct" and the gate would stay green forever.

Run this ONLY on purpose, when the model or the feature math legitimately changed, and
commit the resulting parity_expected.json in the same commit:

    python3 train/parity_freeze.py
"""
import json
import math
import os
import features as F

HERE = os.path.dirname(os.path.abspath(__file__))
EXPECTED_PATH = os.path.join(HERE, "parity_expected.json")
MODEL_PATH = os.path.join(HERE, "..", "web", "data", "model.json")

SAMPLES = [
    "A: bugün seni düşündüm\nB: aa öyle mi\nA: gülüşün aklımdaydı 😍",
    "A: ödevi çözdün mü\nB: yok bakıyorum\nA: beraber yapalım mı",
    "A: naber\nB: iyi\nA: müsait misin\nB: değilim",
    "A: neden yazmadın bütün gün\nB: uğraşamadım\nA: iki dakikan yok muydu",
    "A: aşkım günaydın 💕\nB: günaydın canım\nA: seni özledim",
    "A: konumunu aç\nB: neden açayım bu takıntı hastalık",
]


def load_model():
    return json.load(open(MODEL_PATH, encoding="utf-8"))


def infer(model, doc):
    logits = list(model["bias"])
    nC = len(model["classes"])
    counts = {}
    for g in F.ngrams(doc):
        if g in model["idf"]:
            counts[g] = counts.get(g, 0) + 1
    norm = math.sqrt(sum((c * model["idf"][g]) ** 2 for g, c in counts.items()))
    if norm > 0:
        for g, c in counts.items():
            val = (c * model["idf"][g]) / norm
            w = model["token_weights"][g]
            for k in range(nC):
                logits[k] += w[k] * val
    num = F.numeric_vector(doc)
    for j, name in enumerate(model["numeric_names"]):
        z = (num[j] - model["numeric_mean"][j]) / model["numeric_std"][j]
        w = model["numeric_weights"][j]
        for k in range(nC):
            logits[k] += w[k] * z
    mx = max(logits)
    e = [math.exp(v - mx) for v in logits]
    s = sum(e)
    return [v / s for v in e]


def compute():
    """Score every sample with the CURRENT features.py + model.json. No I/O side effects."""
    model = load_model()
    return [
        {"text": d, "numeric": F.numeric_vector(d), "probs": infer(model, d)}
        for d in SAMPLES
    ]


def main():
    model = load_model()
    out = compute()
    json.dump(out, open(EXPECTED_PATH, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"FROZE parity_expected.json ({len(out)} samples)")
    for o in out:
        top = model["classes"][o["probs"].index(max(o["probs"]))]
        print(f"  {top:9s} {max(o['probs']):.3f}  {o['text'].splitlines()[0][:40]}")


if __name__ == "__main__":
    main()
