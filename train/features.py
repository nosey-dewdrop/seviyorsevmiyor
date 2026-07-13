"""Feature extractor for the whatdoyoumean tone classifier.

This file is the TRAINING side. It is mirrored exactly by web/js/features.js so the
weights trained here score identically in the browser. A parity check (parity_check.py
+ a Node run of features.js) guards against drift. Keep the two in lockstep.

A "document" is a whole conversation as raw text with A:/B: line prefixes. We produce:
  - a bag of word unigrams + bigrams (for TF-IDF),
  - a fixed vector of numeric features (question ratio, endearment density, ...).
The tone classifier is linear over [tfidf(ngrams) ++ zscore(numeric)].
"""

import re
import unicodedata

# Turkish-aware lowercasing done EXPLICITLY so Python and JS agree byte for byte.
_UPPER_MAP = {
    "İ": "i", "I": "ı", "Ş": "ş", "Ğ": "ğ", "Ü": "ü", "Ö": "ö", "Ç": "ç",
}


def lower_tr(text):
    out = []
    for ch in text:
        if ch in _UPPER_MAP:
            out.append(_UPPER_MAP[ch])
        elif "A" <= ch <= "Z":
            out.append(ch.lower())
        else:
            out.append(ch)
    return "".join(out)


# Emojis / clusters we treat as meaningful tokens (mirrored in JS).
HEART_EMOJI = ["❤", "❤️", "🖤", "💛", "💚", "💙", "💜", "🧡", "🤍", "🤎", "💕", "💖",
               "💗", "💓", "💞", "💘", "💝", "😍", "🥰", "😘", "😻"]
KISS_EMOJI = ["😘", "😗", "😙", "😚", "💋"]
LAUGH_EMOJI = ["😂", "🤣", "😅", "😆"]
SAD_EMOJI = ["😔", "😞", "😢", "😭", "🥺", "☹", "🙁", "😩", "😪"]
COLD_EMOJI = ["🙂", "👍", "😐", "😑", "🫠"]
# Any-emoji density uses an explicit union (substring counting) so Python and JS
# agree exactly — a general emoji regex would diverge between the two runtimes.
EMOJI_ALL = sorted(set(HEART_EMOJI + KISS_EMOJI + LAUGH_EMOJI + SAD_EMOJI + COLD_EMOJI + [
    "😊", "😄", "😃", "😁", "😉", "🥲", "😌", "🙃", "😏", "😬", "😳", "🥹", "😤",
    "😡", "😠", "🤔", "🙄", "😒", "😖", "😫", "🥱", "😴", "🤗", "🤭", "🫶", "👌",
    "🙏", "✨", "🔥", "💔", "💯", "🥳", "🎉", "😇", "🤨", "😶", "🫡", "👀",
]), key=len, reverse=True)

ENDEARMENT = ["canım", "canim", "bir tanem", "birtanem", "aşkım", "askim", "tatlım",
              "tatlim", "sevgilim", "hayatım", "hayatim", "bebeğim", "bebegim",
              "güzelim", "guzelim", "cicim", "prensesim", "meleğim", "melegim"]
FORMAL = ["rica ederim", "teşekkür ederim", "tesekkur ederim", "iyi günler",
          "iyi gunler", "iyi çalışmalar", "müsait", "musait", "saygılarımla",
          "kolay gelsin", "buyurun", "ederim", "efendim"]
LAUGH_TEXT_RE = re.compile(r"(ah[ah]+|ha[ha]+|hah+|jsj[sj]*|ksk[sk]*|kdkd|kekw|lol|xd|:d)")


def _split_lines(doc):
    """Return list of (speaker, text) from an A:/B: prefixed conversation.
    Lines without a prefix attach to the previous speaker (multi-line message)."""
    msgs = []
    for raw in doc.split("\n"):
        line = raw.strip()
        if not line:
            continue
        m = re.match(r"^([ABab])\s*:\s*(.*)$", line)
        if m:
            msgs.append([m.group(1).upper(), m.group(2)])
        elif msgs:
            msgs[-1][1] += " " + line
        else:
            msgs.append(["A", line])
    return [(s, t) for s, t in msgs]


def word_tokens(text):
    low = lower_tr(text)
    return re.findall(r"[a-zçğıöşü0-9]+", low)


def ngrams(doc):
    """Word unigrams + bigrams over the whole conversation (speaker tags dropped)."""
    toks = []
    for _, t in _split_lines(doc):
        toks.extend(word_tokens(t))
    grams = list(toks)
    for i in range(len(toks) - 1):
        grams.append(toks[i] + " " + toks[i + 1])
    return grams


def _count_any(low_text, needles):
    return sum(low_text.count(n) for n in needles)


NUMERIC_NAMES = [
    "question_ratio", "exclaim_ratio", "heart_per_msg", "laugh_ratio",
    "endearment_per_msg", "sad_per_msg", "emoji_per_msg", "avg_len",
    "len_asymmetry", "double_text_ratio", "formality", "short_reply_ratio",
]


def numeric_features(doc):
    msgs = _split_lines(doc)
    n = max(len(msgs), 1)
    q = ex = hearts = laughs = endear = sads = emojis = shorts = 0
    total_len = 0
    len_a = len_b = 0
    double = 0
    prev_speaker = None
    for i, (sp, text) in enumerate(msgs):
        low = lower_tr(text)
        if "?" in text:
            q += 1
        if "!" in text:
            ex += 1
        hearts += _count_any(low, HEART_EMOJI)
        emojis += _count_any(text, EMOJI_ALL)
        sads += _count_any(low, SAD_EMOJI)
        if LAUGH_TEXT_RE.search(low) or _count_any(low, LAUGH_EMOJI):
            laughs += 1
        endear += sum(low.count(w) for w in ENDEARMENT)
        L = len(text)
        total_len += L
        if L <= 6:
            shorts += 1
        if sp == "A":
            len_a += L
        else:
            len_b += L
        if sp == prev_speaker:
            double += 1
        prev_speaker = sp
    formality = sum(1 for _, t in msgs if any(f in lower_tr(t) for f in FORMAL))
    denom_len = max(len_a + len_b, 1)
    return {
        "question_ratio": q / n,
        "exclaim_ratio": ex / n,
        "heart_per_msg": hearts / n,
        "laugh_ratio": laughs / n,
        "endearment_per_msg": endear / n,
        "sad_per_msg": sads / n,
        "emoji_per_msg": emojis / n,
        "avg_len": (total_len / n) / 100.0,
        "len_asymmetry": abs(len_a - len_b) / denom_len,
        "double_text_ratio": double / n,
        "formality": formality / n,
        "short_reply_ratio": shorts / n,
    }


def numeric_vector(doc):
    f = numeric_features(doc)
    return [f[name] for name in NUMERIC_NAMES]
