"""節境界の前後に空白があるかを、正しい文書順走査で測り直す。

probe_anomalies.py の C は `<said>` `<p>` `<q>` の tail を拾っておらず、
境界の直後テキストを取り違えていた(自分で書いた測定器の欠陥)。
ここでは normalize._iter_events(本実装と同じ走査)を使う。

判定したいこと: milestone は「空白の位置に立っている」のか
「語の途中に立っている」のか。前者なら節を空白で連結してよい。
"""

import os
import re
import sys
from collections import Counter

import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)

from etl import normalize  # noqa: E402

NS = {"t": "http://www.tei-c.org/ns/1.0"}
RAW = os.path.join(ROOT, "raw", "perseus")
SEC = re.compile(r"^\d+[a-e]$")


def measure(path):
    body = ET.parse(path).getroot().find(".//t:text/t:body", NS)
    events = list(normalize._iter_events(body))
    # 境界ごとに、直前の非空テキストの末尾文字と直後の非空テキストの先頭文字
    out = []
    for i, (kind, val) in enumerate(events):
        if kind != "boundary" or not SEC.match(val or ""):
            continue
        before = after = ""
        for j in range(i - 1, -1, -1):
            if events[j][0] == "text" and events[j][1]:
                before = events[j][1]
                break
        for j in range(i + 1, len(events)):
            if events[j][0] == "text" and events[j][1]:
                after = events[j][1]
                break
        if not before or not after:
            continue
        gap = before[-1].isspace() or after[0].isspace()
        out.append((val, gap, before[-16:], after[:16]))
    return out


def main():
    tally = Counter()
    total = 0
    examples = []
    for name in sorted(os.listdir(os.path.join(RAW, "grc"))):
        res = measure(os.path.join(RAW, "grc", name))
        total += len(res)
        glued = [r for r in res if not r[1]]
        if glued:
            tally[name.replace(".xml", "")] = len(glued)
            for g in glued[:2]:
                if len(examples) < 12:
                    examples.append((name.replace(".xml", ""), g[0],
                                     repr(g[2]), repr(g[3])))
    print("境界 {} 件中、前後どちらにも空白が無いもの: {} 件 / {} 篇".format(
        total, sum(tally.values()), len(tally)))
    for w, c in tally.most_common(10):
        print("  {} {}".format(w, c))
    print("\n例:")
    for e in examples:
        print("  {} {} …{} | {}…".format(*e))


if __name__ == "__main__":
    main()
