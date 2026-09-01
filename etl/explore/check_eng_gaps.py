"""英訳が付かなかった 4 節が、本当に英側に無いのかを原文で確かめる(G-05)。

「対応づけに失敗した」のか「英訳側にその節が無い」のかは別物である。
前者なら実装の欠陥、後者は上流の性質。原文の milestone を直接数えて区別する。
"""

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)

from etl import normalize  # noqa: E402

RAW = os.path.join(ROOT, "raw", "perseus")
CURATED = os.path.join(ROOT, "data", "curated", "works.json")


def main():
    corpus = normalize.build_corpus(RAW, CURATED)
    for w in corpus["works"]:
        if not w["eng_missing"]:
            continue
        print("=== {} ({}) 英訳の無い節 {} ===".format(
            w["abbr"], w["title_ja"], w["eng_missing"]))
        raw = open(os.path.join(RAW, "eng", w["id"] + ".xml"), encoding="utf-8").read()
        for sid in w["eng_missing"]:
            n = sid.split(".")[-1]
            found = re.findall(
                r'<milestone[^>]*unit="section"[^>]*n="{}"[^>]*/>'.format(n), raw)
            print("  節 {}: 英 XML 内の同名 milestone {} 件".format(n, len(found)))
            for m in re.finditer(
                    r'<milestone[^>]*unit="section"[^>]*n="{}"[^>]*/>'.format(n), raw):
                a, b = max(0, m.start() - 120), m.end() + 160
                print("    …{}…".format(" ".join(raw[a:b].split())))
        # 希側の当該節に本文があるか(英が空なだけかもしれない)
        for s in w["sections"]:
            if s["id"] in w["eng_missing"]:
                print("    希本文({} 語): {}".format(
                    len(normalize.tokens(s["grc"])), s["grc"][:100]))


if __name__ == "__main__":
    main()
