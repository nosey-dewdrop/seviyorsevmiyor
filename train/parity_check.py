"""Parity gate (Python side): recompute the sample scores with the CURRENT features.py
and assert they match the FROZEN reference in parity_expected.json.

This gate NEVER writes parity_expected.json. The reference is produced only by
train/parity_freeze.py and committed. If the reference is missing the gate FAILS —
silently regenerating it would make the gate compare a broken engine against itself.

Run:  python3 train/parity_check.py  &&  node train/parity_check.mjs
"""
import json
import os
import sys

from parity_freeze import EXPECTED_PATH, compute, load_model

TOL = 1e-12


def fail(msg):
    print(f"PARITY FAIL: {msg}", file=sys.stderr)
    sys.exit(1)


def main():
    if not os.path.exists(EXPECTED_PATH):
        fail("parity_expected.json missing. It is a FROZEN, committed reference. "
             "Run 'python3 train/parity_freeze.py' on purpose and commit the result.")

    with open(EXPECTED_PATH, encoding="utf-8") as fh:
        try:
            expected = json.load(fh)
        except json.JSONDecodeError as exc:
            fail(f"parity_expected.json is not valid JSON: {exc}")

    actual = compute()
    if not isinstance(expected, list) or len(expected) != len(actual):
        fail(f"reference has {len(expected) if isinstance(expected, list) else '?'} samples, "
             f"engine produced {len(actual)}. Reference is stale.")

    model = load_model()
    max_diff = 0.0
    problems = []
    for ex, ac in zip(expected, actual):
        if ex["text"] != ac["text"]:
            problems.append(f"sample text drift: {ac['text'].splitlines()[0][:40]!r}")
            continue
        head = ac["text"].splitlines()[0][:40]
        for key in ("numeric", "probs"):
            if len(ex[key]) != len(ac[key]):
                problems.append(f"{head}: {key} length {len(ex[key])} vs {len(ac[key])}")
                continue
            for i, (e, a) in enumerate(zip(ex[key], ac[key])):
                d = abs(e - a)
                max_diff = max(max_diff, d)
                if d > TOL:
                    problems.append(f"{head}: {key}[{i}] expected {e!r} got {a!r} (diff {d:.3e})")

    print(f"max diff vs frozen reference: {max_diff:.3e} (tol {TOL:.0e})")
    if problems:
        for p in problems[:20]:
            print(f"  {p}", file=sys.stderr)
        fail(f"{len(problems)} mismatch(es) against frozen parity_expected.json")

    for o in actual:
        top = model["classes"][o["probs"].index(max(o["probs"]))]
        print(f"  {top:9s} {max(o['probs']):.3f}  {o['text'].splitlines()[0][:40]}")
    print("PARITY PY OK (reference read-only)")


if __name__ == "__main__":
    main()
