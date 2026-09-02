"""L3 stage2: 図にする前に、図が示すはずの話が実際にデータに出るかを確かめる。

確かめたいこと:
  A. 『国家』は第 1 巻だけが問答で、以降は独白に化けるか(通説)
  B. 『法律』12 巻はどう分布するか
  C. 36 篇を同じ物差しで並べたとき、何が見えるか
  D. 節あたりの交替数の分布(図の縦軸をどう取るか)
"""

import json
import os
import sys
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TURNS = os.path.join(ROOT, "data", "turns.json")


def by_book(work):
    acc = defaultdict(lambda: {"turns": 0, "tokens": 0, "sections": 0})
    for s in work["sections"]:
        k = s["book"] or "-"
        acc[k]["turns"] += s["turns"]
        acc[k]["tokens"] += s["tokens"]
        acc[k]["sections"] += 1
    return acc


def main():
    doc = json.load(open(TURNS, encoding="utf-8"))
    works = {w["abbr"]: w for w in doc["works"]}

    for abbr in ("Rep", "Leg"):
        w = works[abbr]
        print("=== {} ({}) 巻ごとの問答の濃さ ===".format(abbr, w["title_ja"]))
        print("{:>5}{:>9}{:>9}{:>12}".format("巻", "交替", "語数", "千語あたり"))
        acc = by_book(w)
        for k in sorted(acc, key=lambda x: int(x) if x.isdigit() else 0):
            a = acc[k]
            print("{:>5}{:>9}{:>9}{:>12.1f}".format(
                k, a["turns"], a["tokens"], a["turns"] * 1000 / max(a["tokens"], 1)))
        print()

    print("=== 36 篇を同じ物差しで(千語あたりの交替) ===")
    rows = []
    for w in doc["works"]:
        tok = sum(s["tokens"] for s in w["sections"])
        rows.append((w["abbr"], w["title_ja"], w["register"],
                     w["n_turns"] * 1000 / max(tok, 1), tok,
                     w["validation"]["kind"]))
    for r in sorted(rows, key=lambda x: -x[3]):
        print("{:10}{:14}{:10}{:8.1f}{:9}  {}".format(
            r[0], r[1][:12], r[2], r[3], r[4], r[5]))

    print("\n=== 節あたりの交替数の分布(縦軸の取り方を決める) ===")
    allv = [s["turns"] for w in doc["works"] for s in w["sections"]]
    allv.sort()
    n = len(allv)
    for q in (0.5, 0.9, 0.95, 0.99, 1.0):
        print("  {:>5.0%} 分位: {}".format(q, allv[min(n - 1, int(q * n))]))


if __name__ == "__main__":
    main()
