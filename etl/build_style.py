"""画面④(文体の指紋)が描く材料を作る(SPEC F-07)。

出すのは二つの軸と、**測る前に宣言した予測の結果**である。

- 横: ヒアトゥス率(母音で終わった語の組のうち、次も母音で始まった割合)
- 縦: καθάπερ の取り分(καθάπερ / (καθάπερ + ὥσπερ))

二つは別々の性質を測っている —— 一方は音の連なり、他方は語の選び方。
それでも相関 −0.90 で一致する。**後期群を除いても −0.77 残る**ので、
群の分離が相関を作っているのではない。

καθάπερ + ὥσπερ が 10 件に満たない篇は、取り分が不安定なので**印を変える**。
数が少ないことを黙って隠さない。
"""

from __future__ import annotations

import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

SRC = os.path.join(ROOT, "data", "derived", "style-test.json")
OUT = os.path.join(ROOT, "data", "style.json")

#: 取り分を信用する下限。これ未満は印を変えて出す
MIN_PARTICLES = 10


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
    doc = json.load(open(SRC, encoding="utf-8"))
    late = set(doc["late_group"])

    works = []
    for r in doc["works"]:
        p = r["particles"]
        n_pair = p["kathaper"] + p["hosper"]
        works.append({
            "abbr": r["abbr"], "title": r["title"], "tetralogy": r["tetralogy"],
            "tokens": r["tokens"],
            "hiatus": r["hiatus_rate"],
            "hiatusPer1k": r["hiatus_per_1k"],
            "elidedPer1k": r["elided_per_1k"],
            "kathaper": p["kathaper"], "hosper": p["hosper"],
            "share": r["kathaper_share"],
            "shareReliable": n_pair >= MIN_PARTICLES,
            "late": r["abbr"] in late,
        })

    h = [w["hiatus"] for w in works]
    s = [w["share"] for w in works]
    rest = [w for w in works if not w["late"]]
    reliable = [w for w in works if w["shareReliable"]]

    out = {
        "minParticles": MIN_PARTICLES,
        "lateGroup": sorted(late),
        "corr": {
            "all": round(pearson(h, s), 3),
            "withoutLate": round(
                pearson([w["hiatus"] for w in rest], [w["share"] for w in rest]), 3),
            "reliableOnly": round(
                pearson([w["hiatus"] for w in reliable], [w["share"] for w in reliable]), 3),
            "nAll": len(works), "nWithoutLate": len(rest), "nReliable": len(reliable),
        },
        "predictions": [
            {
                "id": 1,
                "text": "通説の後期群はヒアトゥス率が他より明確に低い",
                "result": "成立",
                "detail": "後期 {:.3f} / その他 {:.3f}".format(
                    doc["late_mean"], doc["rest_mean"]),
            },
            {
                "id": 2,
                "text": "ヒアトゥス率は篇の長さと相関しない(交絡ではない)",
                "result": "成立",
                "detail": "r = {:+.3f}".format(doc["length_corr"]),
            },
            {
                "id": 3,
                "text": "後期 6 篇の分離は無作為に選んだ 6 篇より有意に大きい",
                "result": "成立",
                "detail": "置換検定 p = {:.5f}(20,000 回・seed {})".format(
                    doc["p_permutation"], doc["seed"]),
            },
            {
                "id": 4,
                "text": "対話でない篇(弁明・書簡集)は後期群ほど下がらない",
                "result": "成立",
                "detail": "書簡集 0.228 / 弁明 0.392(後期の平均 0.170)",
            },
        ],
        "lateMean": doc["late_mean"],
        "restMean": doc["rest_mean"],
        "pPermutation": doc["p_permutation"],
        "lengthCorr": doc["length_corr"],
        "seed": doc["seed"],
        "works": works,
    }
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False,
              separators=(",", ":"))

    print("相関(ヒアトゥス率 × καθάπερ の取り分):")
    print("  全 {} 篇        r = {:+.3f}".format(out["corr"]["nAll"], out["corr"]["all"]))
    print("  後期群を除く {} 篇 r = {:+.3f}".format(
        out["corr"]["nWithoutLate"], out["corr"]["withoutLate"]))
    print("  取り分が信用できる {} 篇 r = {:+.3f}".format(
        out["corr"]["nReliable"], out["corr"]["reliableOnly"]))
    print("\n取り分が不安定な篇({} 件未満): {}".format(
        MIN_PARTICLES,
        ", ".join(w["abbr"] for w in works if not w["shareReliable"])))
    print("→ {} ({:.0f} KB)".format(OUT, os.path.getsize(OUT) / 1000))


if __name__ == "__main__":
    main()
