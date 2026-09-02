"""文体の指標を測り、**測る前に宣言した予測**と突き合わせる(SPEC F-07 / G-14)。

## 測る前に宣言した予測(loop_007 の loop_start に記録済み)

1. 通説の**後期群**(ソピステス・政治家・ピレボス・ティマイオス・クリティアス・法律)は
   ヒアトゥス率が他より明確に低い
2. ヒアトゥス率は**篇の長さと相関しない**(長さの交絡ではない)
3. 後期 6 篇の分離は、**無作為に選んだ 6 篇より有意に大きい**(置換対照)
4. 対話でない篇(弁明・書簡集)は、後期群と同じようには下がらない

**通説の年代群は当てはめには一切使わない。** 検定の相手にだけ使う ——
先に予測し、あとで照合する。外れたら予測のほうを残し、群の定義を動かさない。
"""

from __future__ import annotations

import json
import os
import random
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from etl import normalize, style, words as W  # noqa: E402

RAW = os.path.join(ROOT, "raw", "perseus")
CURATED = os.path.join(ROOT, "data", "curated", "works.json")
SEED = 20260902

#: 通説の後期群。**測る前に決めてある**。実測に合わせて動かさない
LATE_GROUP = {"Sph", "Plt", "Phlb", "Ti", "Criti", "Leg"}
#: 対話でない篇(予測 4)
NON_DIALOGUE = {"Ap", "Ep"}


def pearson(xs, ys):
    n = len(xs)
    if n < 2:
        return 0.0
    mx, my = sum(xs) / n, sum(ys) / n
    cov = sum((a - mx) * (b - my) for a, b in zip(xs, ys))
    vx = sum((a - mx) ** 2 for a in xs) ** 0.5
    vy = sum((b - my) ** 2 for b in ys) ** 0.5
    return cov / (vx * vy) if vx and vy else 0.0


def main():
    corpus = normalize.build_corpus(RAW, CURATED)
    rows = []
    for w in corpus["works"]:
        # style.tokenize はアポストロフィと句読点を語末に残す
        # (エリジョンの印と文の切れ目の両方が判定に要る)
        toks = style.tokenize(normalize.join_sections(w["sections"]))
        h = style.hiatus_stats(toks)
        p = style.particle_stats(toks)
        rows.append({
            "abbr": w["abbr"], "title": w["title_ja"], "tetralogy": w["tetralogy"],
            "tokens": len(toks),
            "hiatus_rate": round(h["hiatus_rate"], 4),
            "hiatus_per_1k": round(h["per_1k"], 2),
            "vowel_end": h["vowel_end"], "hiatus": h["hiatus"], "elided": h["elided"],
            "elided_per_1k": round(h["elided"] * 1000 / max(len(toks), 1), 2),
            "particles": p,
            "kathaper_share": round(
                p["kathaper"] / max(p["kathaper"] + p["hosper"], 1), 4),
            "late_by_tradition": w["abbr"] in LATE_GROUP,
        })

    rows.sort(key=lambda r: r["hiatus_rate"])
    print("{:10}{:12}{:>9}{:>9}{:>9}{:>8}  {}".format(
        "篇", "", "衝突率", "千語あたり", "エリジョン", "語数", "通説"))
    for r in rows:
        print("{:10}{:12}{:>9.3f}{:>9.1f}{:>9.1f}{:>8,}  {}".format(
            r["abbr"], r["title"][:10], r["hiatus_rate"], r["hiatus_per_1k"],
            r["elided_per_1k"], r["tokens"], "後期" if r["late_by_tradition"] else ""))

    late = [r for r in rows if r["late_by_tradition"]]
    rest = [r for r in rows if not r["late_by_tradition"]]
    ml = sum(r["hiatus_rate"] for r in late) / len(late)
    mr = sum(r["hiatus_rate"] for r in rest) / len(rest)

    print("\n=== 宣言した予測との突き合わせ ===")
    print("予測 1(後期群は衝突率が低い): 後期 {:.3f} / その他 {:.3f} / 差 {:+.3f} → {}".format(
        ml, mr, ml - mr, "成立" if ml < mr else "**不成立**"))
    ranks = {r["abbr"]: i for i, r in enumerate(rows)}
    print("   後期 6 篇の順位(低い順・0 始まり): {}".format(
        sorted(ranks[a] for a in LATE_GROUP)))

    # 予測 2: 長さの交絡
    r_len = pearson([r["tokens"] for r in rows], [r["hiatus_rate"] for r in rows])
    print("予測 2(長さと相関しない): r = {:+.3f} → {}".format(
        r_len, "成立" if abs(r_len) < 0.3 else "**不成立**"))

    # 予測 3: 置換対照
    rng = random.Random(SEED)
    obs = mr - ml
    all_rates = [r["hiatus_rate"] for r in rows]
    ge = 0
    TRIALS = 20000
    for _ in range(TRIALS):
        pick = rng.sample(range(len(all_rates)), len(LATE_GROUP))
        sel = [all_rates[i] for i in pick]
        oth = [all_rates[i] for i in range(len(all_rates)) if i not in pick]
        if (sum(oth) / len(oth) - sum(sel) / len(sel)) >= obs:
            ge += 1
    p_val = (ge + 1) / (TRIALS + 1)
    print("予測 3(無作為 6 篇より有意): 観測差 {:+.3f} / p = {:.5f} → {}".format(
        obs, p_val, "成立" if p_val < 0.01 else "**不成立**"))

    # 予測 4: 対話でない篇
    nd = [r for r in rows if r["abbr"] in NON_DIALOGUE]
    print("予測 4(対話でない篇は後期群ほど下がらない):")
    for r in nd:
        print("   {} 衝突率 {:.3f}(後期の平均 {:.3f} / 全体 {:.3f})".format(
            r["title"], r["hiatus_rate"], ml, (ml * len(late) + mr * len(rest)) / len(rows)))
    ok4 = all(r["hiatus_rate"] > ml for r in nd)
    print("   → {}".format("成立" if ok4 else "**不成立**"))

    out = {
        "seed": SEED, "late_group": sorted(LATE_GROUP),
        "late_mean": ml, "rest_mean": mr, "p_permutation": p_val,
        "length_corr": r_len, "works": rows,
    }
    path = os.path.join(ROOT, "data", "derived", "style-test.json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    json.dump(out, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("\n→ {}".format(path))


if __name__ == "__main__":
    main()
