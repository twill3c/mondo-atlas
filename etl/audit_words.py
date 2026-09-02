"""採否台帳を両方向で検算する(HC-127 / SPEC G-13)。

照合器は「取りこぼし」と「過大計上」の両方に誤りうる。片側だけ直すと、
二つの誤りが打ち消し合って総数がそれらしく見える。だから両方向を測る。

1. **書いた語形は実在するか** —— 台帳に挙げた形が本文に 1 件も無ければ、
   語形変化表の書き間違いである。0 件の形は必ず報告する
2. **畳みが別語を巻き込んでいないか** —— 採った形ごとに表層を並べる。
   複数の表層が出たら、それがすべて同じ語かを人が見る
3. **取りこぼしていないか** —— 広い語幹で拾える形のうち、採らなかったものを全部並べる。
   台帳の `rejected` に理由が書かれている群に収まるかを人が見る
"""

from __future__ import annotations

import json
import os
import sys
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from etl import normalize, words as W  # noqa: E402

RAW = os.path.join(ROOT, "raw", "perseus")
CURATED = os.path.join(ROOT, "data", "curated", "works.json")


def collect(corpus):
    """表層ごとの出現数と、畳み形→表層の対応。"""
    surf = Counter()
    for w in corpus["works"]:
        for s in w["sections"]:
            for tok in W.words(s["grc"]):
                surf[tok] += 1
    folded = defaultdict(Counter)
    for s, n in surf.items():
        folded[W.fold(s)][s] += n
    return surf, folded


def main():
    corpus = normalize.build_corpus(RAW, CURATED)
    terms = W.load_ledger(W.DEFAULT_LEDGER)
    surf, folded = collect(corpus)

    problems = 0
    report = []

    print("=== 1. 台帳に書いた語形が実在するか ===")
    for t in terms:
        missing = [f for f in t["forms"] if not folded.get(f)]
        if missing:
            problems += 1
            print("  {} — 本文に無い形 {}".format(t["lemma"], missing))
    if problems == 0:
        print("  すべて実在する")

    print("\n=== 2. 採った形の表層(畳みが別語を巻き込んでいないか) ===")
    for t in terms:
        rows = []
        for f in t["forms"]:
            for s, n in folded.get(f, {}).items():
                rows.append((s, n, s in t["_exclude"]))
        kept = sum(n for s, n, ex in rows if not ex)
        dropped = sum(n for s, n, ex in rows if ex)
        multi = [f for f in t["forms"] if len(folded.get(f, {})) > 1]
        print("  {:12} 採用 {:>6,} / 表層で除外 {:>4,} / 表層が複数ある形 {}".format(
            t["lemma"], kept, dropped, len(multi)))
        for f in multi:
            ss = ", ".join("{}×{}".format(s, n) + ("[除外]" if s in t["_exclude"] else "")
                           for s, n in folded[f].most_common(6))
            print("      {:14} {}".format(f, ss))
        report.append({"key": t["key"], "lemma": t["lemma"], "kept": kept,
                       "dropped_by_surface": dropped})

    print("\n=== 3. 取りこぼし検査(広い語幹で拾えるが採らなかった形) ===")
    for t in terms:
        stem = t["audit_stem"]
        others = [(f, sum(c.values())) for f, c in folded.items()
                  if f.startswith(stem) and f not in t["_forms"]]
        others.sort(key=lambda x: -x[1])
        total = sum(n for _, n in others)
        print("\n  {} — 語幹 {!r} で拾えて採らなかった: 異なり {} 形 / 延べ {:,}".format(
            t["lemma"], stem, len(others), total))
        print("    理由の群: {}".format(
            " / ".join(r["group"] for r in t["rejected"]) or "(無し)"))
        print("    上位: {}".format(", ".join(
            "{}×{}".format(f, n) for f, n in others[:10]) or "(無し)"))

    out = os.path.join(ROOT, "data", "derived", "word-audit.json")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    json.dump(report, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("\n→ {}".format(out))
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
