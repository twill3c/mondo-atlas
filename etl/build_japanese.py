"""和訳(解題と頁ごとの要旨)を配布用にまとめる(SPEC F-10 / F-11)。

## 充填率を必ず出す

第二層は全 1,752 頁のうち、書けた分だけがある。**書いていない頁を「該当なし」に
見せないため**(HC-119)、篇ごとと全体の充填率を data に持たせ、画面に出す。

## 検算

- 解題が全 36 篇にあること
- 解題の本文に**算用数字が無い**こと —— 数は画面がデータから出す(G-07 の散文版)
- 要旨の頁番号が、その篇に**実在する頁**であること(存在しない頁の要旨は書き間違い)
"""

from __future__ import annotations

import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

CUR = os.path.join(ROOT, "data", "curated")
OUT = os.path.join(ROOT, "data", "japanese.json")

DIGIT = re.compile(r"[0-9０-９]")


def main() -> int:
    index = json.load(open(os.path.join(ROOT, "data", "index.json"), encoding="utf-8"))["works"]
    kaidai = {w["abbr"]: w["kaidai"]
              for w in json.load(open(os.path.join(CUR, "kaidai.json"), encoding="utf-8"))["works"]}
    summaries = json.load(open(os.path.join(CUR, "page-summaries.json"),
                               encoding="utf-8"))["pages"]

    # 篇ごとに実在する頁
    pages_of = {}
    for w in index:
        doc = json.load(open(os.path.join(ROOT, "data", "works", w["abbr"] + ".json"),
                             encoding="utf-8"))
        pages_of[w["abbr"]] = sorted({s["page"] for s in doc["sections"]})

    problems = []
    for w in index:
        a = w["abbr"]
        if a not in kaidai:
            problems.append("解題が無い: {}".format(a))
            continue
        if DIGIT.search(kaidai[a]):
            problems.append("解題に算用数字がある: {}".format(a))
    for a, pages in summaries.items():
        if a not in pages_of:
            problems.append("知らない略号の要旨: {}".format(a))
            continue
        real = set(pages_of[a])
        for p in pages:
            if int(p) not in real:
                problems.append("実在しない頁の要旨: {} {}".format(a, p))

    works = []
    total_pages = 0
    total_done = 0
    for w in index:
        a = w["abbr"]
        pages = pages_of[a]
        done = summaries.get(a, {})
        total_pages += len(pages)
        total_done += len(done)
        works.append({
            "abbr": a, "title": w["title_ja"], "tetralogy": w["tetralogy"],
            "authenticity": w["authenticity"],
            "kaidai": kaidai.get(a, ""),
            "pages": pages,
            "summaries": done,
            "nPages": len(pages),
            "nSummaries": len(done),
        })

    doc = {
        "totalPages": total_pages,
        "totalSummaries": total_done,
        "coverage": round(total_done / total_pages, 4) if total_pages else 0.0,
        "works": works,
    }
    json.dump(doc, open(OUT, "w", encoding="utf-8"), ensure_ascii=False,
              separators=(",", ":"))

    print("解題 {} 篇 / 頁の要旨 {:,} 件 ÷ {:,} 頁 = 充填率 {:.1%}".format(
        sum(1 for w in works if w["kaidai"]), total_done, total_pages, doc["coverage"]))
    for w in works:
        if w["nSummaries"]:
            print("  {:9}{:12}{:>4} / {:>4} 頁".format(
                w["abbr"], w["title"][:10], w["nSummaries"], w["nPages"]))
    if problems:
        print("\n**検算に失敗**")
        for p in problems:
            print("  - " + p)
        return 1
    print("\n検算: 解題 36 篇・算用数字なし・要旨の頁はすべて実在する")
    print("→ {} ({:.0f} KB)".format(OUT, os.path.getsize(OUT) / 1000))
    return 0


if __name__ == "__main__":
    sys.exit(main())
