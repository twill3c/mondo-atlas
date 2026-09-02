"""L4 stage2: 語の切り方の問題を二つ測る。

A. **句読点で潰れた語**: `ἰδέαν;ναί.εἶτα` のように、空白が落ちて三語が一トークンになっている。
   台帳に「異なり語形」として現れるので、放っておくと採否の判断を汚す。
B. **畳むと別語になる形**: `ἐπιστήμων`(形容詞「知っている」)と `ἐπιστημῶν`(ἐπιστήμη の属格複数)は
   アクセントを畳むと同じ `επιστημων` になる。**畳みが情報を捨てている**。

どちらも規模を測ってから対処を決める。
"""

import os
import re
import sys
import unicodedata
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)

from etl import normalize  # noqa: E402

RAW = os.path.join(ROOT, "raw", "perseus")
CURATED = os.path.join(ROOT, "data", "curated", "works.json")

GREEK = re.compile(r"[Ͱ-Ͽἀ-῿]")
#: 語の内側に句読点があり、その後ろがギリシャ文字なら「潰れている」
GLUED = re.compile(r"[.,;·:·;][Ͱ-Ͽἀ-῿]")


def fold(text):
    d = unicodedata.normalize("NFD", text)
    d = "".join(c for c in d if not unicodedata.combining(c))
    return unicodedata.normalize("NFC", d).lower().replace("ς", "σ")


def main():
    corpus = normalize.build_corpus(RAW, CURATED)
    glued = Counter()
    surf = defaultdict(Counter)
    total = 0

    for w in corpus["works"]:
        for tok in normalize.tokens(normalize.join_sections(w["sections"])):
            total += 1
            if GLUED.search(tok):
                glued[tok] += 1
            surf[fold(tok.strip(".,;·:!?()[]'’ʼ\""))][
                tok.strip(".,;·:!?()[]'’ʼ\"")] += 1

    print("A. 句読点で潰れた語")
    print("   全トークン {:,} 中 {:,} 件({:.3%})・異なり {} 形".format(
        total, sum(glued.values()), sum(glued.values()) / total, len(glued)))
    for k, v in glued.most_common(8):
        print("     {:30} {}".format(k, v))

    print("\nB. 畳むと二つ以上の表層が混ざる形(上位 12)")
    amb = [(f, s) for f, s in surf.items()
           if len(s) > 1 and sum(s.values()) >= 30]
    amb.sort(key=lambda x: -sum(x[1].values()))
    print("   異なり語形 {:,} 中、表層が複数あるもの {:,}".format(len(surf), len(
        [1 for s in surf.values() if len(s) > 1])))
    for f, s in amb[:12]:
        print("     {:16} {}".format(f, "  ".join(
            "{}×{}".format(k, v) for k, v in s.most_common(4))))


if __name__ == "__main__":
    main()
