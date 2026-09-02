"""L6 stage2: 解題を書く前に、このアプリが各篇について実際に測った値を一覧にする。

解題は「よくある紹介文」ではなく、**この企画が測った値を背にした文**にしたい。
そのためにまず、四つの画面が出している数を篇ごとに並べる。

**解題の本文には算用数字を書かない。** 数は画面がデータから出す ——
そうすれば本文と数がずれない(G-07 を散文に適用)。ここで見るのは、
どの篇について何が言えるのかを掴むためである。
"""

import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

idx = json.load(open(os.path.join(ROOT, "data", "index.json"), encoding="utf-8"))["works"]
breath = {w["abbr"]: w for w in
          json.load(open(os.path.join(ROOT, "data", "breath.json"), encoding="utf-8"))["works"]}
words = json.load(open(os.path.join(ROOT, "data", "words.json"), encoding="utf-8"))
wmap = {w["abbr"]: w for w in words["works"]}
style = {w["abbr"]: w for w in
         json.load(open(os.path.join(ROOT, "data", "style.json"), encoding="utf-8"))["works"]}

hi_rank = {w["abbr"]: i + 1 for i, w in enumerate(
    sorted(style.values(), key=lambda x: x["hiatus"]))}
turn_rank = {}
tmp = sorted(breath.values(),
             key=lambda w: -w["n_turns"] * 1000 / max(sum(1 for _ in w["turns"]) or 1, 1))

for w in idx:
    a = w["abbr"]
    b = breath[a]
    tok = sum(b["tokens"])
    per1k = b["n_turns"] * 1000 / max(tok, 1)
    top_terms = sorted(words["terms"], key=lambda t: -wmap[a]["rates"][t["key"]])[:3]
    print("{:9} {:14} 頁{:>4} 節{:>5} 語{:>7}".format(
        a, w["title_ja"][:12], w["n_pages"], w["n_sections"], w["words_grc"]))
    print("   語り口 {:9} 交替 {:>5}({:.1f}/千語) 検証 {}".format(
        b["register"], b["n_turns"], per1k, b["validation"]))
    print("   ヒアトゥス {:.3f}(低い順 {} 位) καθάπερ {}/ὥσπερ {}".format(
        style[a]["hiatus"], hi_rank[a], style[a]["kathaper"], style[a]["hosper"]))
    print("   濃い語: {}".format(", ".join(
        "{}({}) {:.1f}".format(t["lemma"], t["ja"], wmap[a]["rates"][t["key"]])
        for t in top_terms)))
    print("   通説 {} / 第{}四部作 / 英訳の無い節 {}".format(
        w["authenticity"], w["tetralogy"], w["n_eng_missing"]))
    print()
