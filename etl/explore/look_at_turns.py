"""L2 stage2: 話者記号を外した本文が実際どう見えるかを、目で確かめる。

検出器を設計する前に、**手がかりが本文の中に実在するか**を見る。
上演型(クリトン)と語り直し型(国家)の両方を、話者記号を伏せた状態で並べる。
"""

import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)

from etl import normalize  # noqa: E402

RAW = os.path.join(ROOT, "raw", "perseus")
CURATED = os.path.join(ROOT, "data", "curated", "works.json")


def show(work, n_sections, title):
    print("=" * 78)
    print(title)
    print("=" * 78)
    for s in work["sections"][:n_sections]:
        print("\n--- {} (話者記号 {} 個: {}) ---".format(
            s["id"], len(s["sigla"]), " ".join(s["sigla"]) or "なし"))
        print(s["grc"])


def main():
    corpus = normalize.build_corpus(RAW, CURATED)
    by_abbr = {w["abbr"]: w for w in corpus["works"]}

    show(by_abbr["Crit"], 3, "上演型 — クリトン(印刷面に話者記号があるので label が完全)")
    show(by_abbr["Rep"], 2, "語り直し型 — 国家(話者記号は印刷されない)")


if __name__ == "__main__":
    main()
