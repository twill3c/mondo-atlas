"""L7: 節ごとに希語と英訳を並べて出す。完訳はこれを見ながら書く。

訳の単位は**ステファヌス節**である。リーダーの行送りを節で揃えるので、
訳も節ごとに区切っておかないと並ばない。

使い方: python etl/explore/dump_sections.py <略号> [開始頁] [終了頁]
"""

import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def main():
    abbr = sys.argv[1]
    lo = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    hi = int(sys.argv[3]) if len(sys.argv) > 3 else 10**9

    w = json.load(open(os.path.join(ROOT, "data", "works", abbr + ".json"), encoding="utf-8"))
    secs = [s for s in w["sections"] if lo <= s["page"] <= hi]
    print("=== {} ({}) — {} 節 ===".format(abbr, w["title_ja"], len(secs)))
    for s in secs:
        print("\n[{}] 希 {} 語".format(s["id"], len(s["grc"].split())))
        print("希: {}".format(s["grc"]))
        print("英: {}".format(s["eng"] or "(英訳なし)"))


if __name__ == "__main__":
    main()
