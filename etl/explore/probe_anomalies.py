"""異常 3 種を原文の生テキストで確かめる(推測で直さない)。

A. 『書簡集』で節 milestone が連続重複する箇所の生テキスト
B. 『メノン』の ΜΕΝ. が本当に大文字で本文中にあるのか
C. 節境界が語の途中に落ちている件数(全篇)
"""

import os
import re
import sys
import unicodedata
from collections import Counter

import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW = os.path.join(ROOT, "raw", "perseus")
NS = {"t": "http://www.tei-c.org/ns/1.0"}
T = "{http://www.tei-c.org/ns/1.0}"


def probe_duplicate_milestones():
    print("=== A. 書簡集の重複 milestone ===")
    raw = open(os.path.join(RAW, "grc", "tlg036.xml"), encoding="utf-8").read()
    for n in ("310b", "315a"):
        for m in re.finditer(r'<milestone unit="section"[^>]*n="{}"\s*/>'.format(n), raw):
            a, b = max(0, m.start() - 220), m.end() + 220
            print("  n={} @{}\n    ...{}...".format(n, m.start(), " ".join(raw[a:b].split())))
        print()


def probe_meno_sigla():
    print("=== B. メノンの ΜΕΝ. ===")
    raw = open(os.path.join(RAW, "grc", "tlg024.xml"), encoding="utf-8").read()
    inside_label = len(re.findall(r"<label>ΜΕΝ\.</label>", raw))
    total = len(re.findall(r"ΜΕΝ\.", raw))
    print("  ΜΕΝ. 総数 {} / <label> 内 {} / label 外 {}".format(
        total, inside_label, total - inside_label))
    # label 外のものが、語の途中(直前が小文字のギリシャ文字)かどうか
    for m in re.finditer(r"(.)ΜΕΝ\.", raw):
        prev = m.group(1)
        if prev not in "><\n \t":
            print("    語中: ...{}ΜΕΝ. | 直前文字 {!r} ({})".format(
                raw[max(0, m.start() - 18):m.start() + 1], prev,
                unicodedata.name(prev, "?")))


def probe_midword_boundaries():
    print("\n=== C. 節境界が語の途中に落ちる件数 ===")
    tally = Counter()
    examples = []
    for path in sorted(os.listdir(os.path.join(RAW, "grc"))):
        wid = path.replace(".xml", "")
        body = ET.parse(os.path.join(RAW, "grc", path)).getroot().find(".//t:text/t:body", NS)
        # 文書順に (テキスト or 境界) を並べ、境界の直前直後の文字を見る
        seq = []
        for el in body.iter():
            if el.tag == T + "milestone" and el.get("unit") == "section":
                if re.match(r"^\d+[a-e]$", el.get("n") or ""):
                    seq.append(("B", el.get("n")))
                if el.tail:
                    seq.append(("T", el.tail))
                continue
            if el.tag in (T + "label", T + "head"):
                if el.tail:
                    seq.append(("T", el.tail))
                continue
            if el.text:
                seq.append(("T", el.text))
        # 境界の前後に空白があるか
        for i, (k, v) in enumerate(seq):
            if k != "B":
                continue
            before = ""
            for j in range(i - 1, -1, -1):
                if seq[j][0] == "T" and seq[j][1]:
                    before = seq[j][1]
                    break
            after = ""
            for j in range(i + 1, len(seq)):
                if seq[j][0] == "T" and seq[j][1]:
                    after = seq[j][1]
                    break
            if before and after and not before[-1].isspace() and not after[0].isspace():
                tally[wid] += 1
                if len(examples) < 8:
                    examples.append((wid, v, repr(before[-14:]), repr(after[:14])))
    print("  語中で切れる境界: 合計 {} 件 / {} 篇".format(sum(tally.values()), len(tally)))
    for w, c in tally.most_common(8):
        print("    {} {}".format(w, c))
    print("  例:")
    for e in examples:
        print("    {} {} …{} | {}…".format(*e))


if __name__ == "__main__":
    probe_duplicate_milestones()
    probe_meno_sigla()
    probe_midword_boundaries()
