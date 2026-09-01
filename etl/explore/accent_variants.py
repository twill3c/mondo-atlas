"""L2 stage2: アクセントの異形で発話動詞を取りこぼしていないかを確かめる。

『国家』327b の実物は「ἦ δʼ ὃς ὁ Γλαύκων」で、**ὃς(重アクセント)** である。
L0 の調査は「ὅς(鋭アクセント)」で数えたので、取りこぼしている可能性がある。

ギリシャ語のアクセントは後続の語によって鋭 → 重に変わる。**字面で数えてはいけない。**
ここでは発音区別符号を落として照合し、L0 の数と突き合わせる。
"""

import glob
import os
import re
import sys
import unicodedata
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)

from etl import normalize  # noqa: E402

RAW = os.path.join(ROOT, "raw", "perseus")
CURATED = os.path.join(ROOT, "data", "curated", "works.json")

APOS = "[ʼ’']"


def strip_accents(text):
    """発音区別符号を落とす。語末シグマも揃える。"""
    d = unicodedata.normalize("NFD", text)
    d = "".join(c for c in d if not unicodedata.combining(c))
    return unicodedata.normalize("NFC", d).lower().replace("ς", "σ")


# 素の字形(アクセント無し)で書いた手がかり
CUES_BARE = {
    "ην d ego": re.compile("ην\\s+δ" + APOS + "\\s*εγω"),
    "η d hos": re.compile("η\\s+δ" + APOS + "\\s*ο\\u03c3\\b"),
    "ephe": re.compile("\\bεφη\\b"),
    "ephen": re.compile("\\bεφην\\b"),
}

# L0 で使った、字面そのままの手がかり
CUES_LITERAL = {
    "ην d ego": re.compile("ἦν\\s+δ" + APOS + "\\s*ἐγώ"),
    "η d hos": re.compile("ἦ\\s+δ" + APOS + "\\s*ὅς"),
    "ephe": re.compile("ἔφη"),
    "ephen": re.compile("ἔφην"),
}


def main():
    corpus = normalize.build_corpus(RAW, CURATED)
    print("{:14}{:>10}{:>10}{:>8}   {}".format("手がかり", "字面", "アクセント無視", "差", "篇(差の大きい順)"))
    per_cue_delta = {}
    for name in CUES_BARE:
        lit = 0
        bare = 0
        delta_by_work = Counter()
        for w in corpus["works"]:
            text = normalize.join_sections(w["sections"])
            a = len(CUES_LITERAL[name].findall(text))
            b = len(CUES_BARE[name].findall(strip_accents(text)))
            lit += a
            bare += b
            if b - a:
                delta_by_work[w["abbr"]] = b - a
        per_cue_delta[name] = delta_by_work
        top = ", ".join("{}+{}".format(k, v) for k, v in delta_by_work.most_common(4))
        print("{:14}{:>10}{:>10}{:>8}   {}".format(name, lit, bare, bare - lit, top))

    # 『国家』だけ内訳を出す(解説アーティファクトに数字を書いてしまっている)
    rep = next(w for w in corpus["works"] if w["abbr"] == "Rep")
    text = strip_accents(normalize.join_sections(rep["sections"]))
    print("\n『国家』の内訳(アクセント無視):")
    total = 0
    for name, pat in CUES_BARE.items():
        n = len(pat.findall(text))
        total += n
        print("  {:12} {}".format(name, n))
    # eipon も L0 では数えていた
    eipon = len(re.compile("\\bειπον\\b").findall(text))
    print("  {:12} {}".format("eipon", eipon))
    print("  合計 {}".format(total + eipon))


if __name__ == "__main__":
    main()
