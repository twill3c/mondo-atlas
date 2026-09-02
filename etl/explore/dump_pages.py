"""L6: ステファヌス頁ごとに英訳本文を出す。一行要旨はこれを読んで書く。

**要旨は本文から書く。** 記憶や概説からではない ——
そう書いたものは「たぶんこう書いてある」であって、要旨ではない。

使い方: python etl/explore/dump_pages.py <略号> [開始頁] [終了頁]
"""

import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def main():
    abbr = sys.argv[1]
    lo = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    hi = int(sys.argv[3]) if len(sys.argv) > 3 else 10**9

    path = os.path.join(ROOT, "data", "works", abbr + ".json")
    w = json.load(open(path, encoding="utf-8"))

    pages = {}
    for s in w["sections"]:
        if not (lo <= s["page"] <= hi):
            continue
        pages.setdefault(s["page"], []).append(s)

    print("=== {} ({}) — {} 頁 ===".format(abbr, w["title_ja"], len(pages)))
    for p in sorted(pages):
        secs = pages[p]
        eng = " ".join(s["eng"] for s in secs if s["eng"]).strip()
        n_words = len(eng.split())
        print("\n--- {} 頁({} 節・英訳 {} 語) ---".format(p, len(secs), n_words))
        print(eng if eng else "(英訳なし)")


if __name__ == "__main__":
    main()
