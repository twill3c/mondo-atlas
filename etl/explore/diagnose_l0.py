"""L0 stage4 の失敗 4 件の原因を実物で確かめる。

T-001/T-002: 節 ID の重複・順不同
T-004      : 本文トークンの不一致
T-007      : 話者記号が本文に残る(メノン 87d/96c)
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
T = "{http://www.tei-c.org/ns/1.0}"
RAW = os.path.join(ROOT, "raw", "perseus")
CURATED = os.path.join(ROOT, "data", "curated", "works.json")


def dup_and_order(corpus):
    print("=== T-001 / T-002: 節 ID の重複と順序 ===")
    for w in corpus["works"]:
        ids = [s["id"] for s in w["sections"]]
        dup = [k for k, v in Counter(ids).items() if v > 1]
        key = [(s["page"], s["letter"]) for s in w["sections"]]
        if dup or key != sorted(key):
            print("  {:9} 重複 {} 件 {} / 順不同 {}".format(
                w["abbr"], len(dup), dup[:6], key != sorted(key)))
            # 重複の周辺を文書順で出す
            for d in dup[:2]:
                pos = [i for i, x in enumerate(ids) if x == d]
                print("      {} の出現位置 {} / 前後 {}".format(
                    d, pos, [ids[max(0, p - 1):p + 2] for p in pos]))


def token_mismatch(corpus):
    print("\n=== T-004: 本文トークンの不一致 ===")
    for w in corpus["works"]:
        exp = normalize.body_tokens_direct(os.path.join(RAW, "grc", w["id"] + ".xml"))
        got = normalize.tokens(" ".join(s["grc"] for s in w["sections"]))
        if exp != got:
            i = next((i for i, (a, b) in enumerate(zip(exp, got)) if a != b),
                     min(len(exp), len(got)))
            print("  {:9} 直接 {} / 節経由 {} / 最初の相違 index={}".format(
                w["abbr"], len(exp), len(got), i))
            print("      期待 {}".format(exp[max(0, i - 3):i + 4]))
            print("      実際 {}".format(got[max(0, i - 3):i + 4]))


def siglum_leak():
    print("\n=== T-007: メノンの ΜΕΝ. を原文で探す ===")
    path = os.path.join(RAW, "grc", "tlg024.xml")
    raw = open(path, encoding="utf-8").read()
    for m in re.finditer(r"ΜΕΝ\.", raw):
        a, b = max(0, m.start() - 160), m.end() + 60
        seg = " ".join(raw[a:b].split())
        # label に包まれているものは正常。包まれていないものだけを見たい
        if not re.search(r"<label>\s*ΜΕΝ\.\s*</label>", raw[max(0, m.start() - 40):b]):
            print("  [label 外] ...{}...".format(seg[-190:]))


if __name__ == "__main__":
    corpus = normalize.build_corpus(RAW, CURATED)
    dup_and_order(corpus)
    token_mismatch(corpus)
    siglum_leak()
