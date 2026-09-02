"""L4 stage2: 語彙の実態を見る。主要語の語形がどう散らばっているかを、実物で確かめる。

屈折語なので「見出し語」で数えることはできない。何をどう数えるかを決める前に、
**語幹の前方一致で実際に何が現れるか**を見る。ここで見えたものが採否台帳の材料になる。
"""

import os
import sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)

from etl import normalize, turns  # noqa: E402

RAW = os.path.join(ROOT, "raw", "perseus")
CURATED = os.path.join(ROOT, "data", "curated", "works.json")

#: 語幹(アクセントを畳んだ形)。ここに挙げたもので前方一致して、現れる形を全部見る
STEMS = {
    "ἀρετή(徳)": "αρετ",
    "δικαιοσύνη(正義)": "δικαιοσυν",
    "ψυχή(魂)": "ψυχ",
    "εἶδος(形相)": "ειδ",
    "ἰδέα(イデア)": "ιδε",
    "λόγος(言葉・理)": "λογ",
    "ἐπιστήμη(知識)": "επιστημ",
    "ἡδονή(快)": "ηδον",
    "ἀγαθός(善)": "αγαθ",
    "νόμος(法)": "νομ",
    "φύσις(自然)": "φυσ",
    "ἀλήθεια(真理)": "αληθ",
    "σῶμα(身体)": "σωμα",
    "πόλις(国)": "πολι",
}


def main():
    corpus = normalize.build_corpus(RAW, CURATED)
    all_tokens: list[str] = []
    for w in corpus["works"]:
        all_tokens += normalize.tokens(normalize.join_sections(w["sections"]))
    print("全集のトークン {:,}".format(len(all_tokens)))

    bare = [turns._bare(t) for t in all_tokens]
    freq = Counter(b for b in bare if b)
    print("異なり語形 {:,}".format(len(freq)))
    print("\n=== 最頻 15 語形 ===")
    for k, v in freq.most_common(15):
        print("  {:14} {:>6}".format(k, v))

    print("\n=== 語幹の前方一致で現れる形(上位 14 まで) ===")
    for label, stem in STEMS.items():
        hits = [(k, v) for k, v in freq.items() if k.startswith(stem)]
        hits.sort(key=lambda x: -x[1])
        total = sum(v for _, v in hits)
        print("\n{}  語幹 {!r} — 異なり {} 形 / 延べ {:,}".format(
            label, stem, len(hits), total))
        for k, v in hits[:14]:
            print("    {:18} {:>6}".format(k, v))
        if len(hits) > 14:
            print("    … ほか {} 形".format(len(hits) - 14))


if __name__ == "__main__":
    main()
