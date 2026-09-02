"""L5 stage2: 第二の軸になる指標があるかを確かめる。

図を散布図にするなら、軸が二本とも何かを語っていなければならない。
片方しか効いていないなら、散布図ではなく**一次元の並び**にすべきである
(dataviz: 一つの系列が主題なら emphasis、二軸あるふりをしない)。

候補: エリジョン率・καθάπερ / ὥσπερ の使い分け・応答小辞の頻度。
"""

import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PATH = os.path.join(ROOT, "data", "derived", "style-test.json")

LATE = {"Sph", "Plt", "Phlb", "Ti", "Criti", "Leg"}


def pearson(xs, ys):
    n = len(xs)
    mx, my = sum(xs) / n, sum(ys) / n
    cov = sum((a - mx) * (b - my) for a, b in zip(xs, ys))
    vx = sum((a - mx) ** 2 for a in xs) ** 0.5
    vy = sum((b - my) ** 2 for b in ys) ** 0.5
    return cov / (vx * vy) if vx and vy else 0.0


def separation(rows, key):
    """後期群と他の平均差を、全体の標準偏差で割った値(効果量)。"""
    late = [r[key] for r in rows if r["abbr"] in LATE]
    rest = [r[key] for r in rows if r["abbr"] not in LATE]
    allv = [r[key] for r in rows]
    m = sum(allv) / len(allv)
    sd = (sum((v - m) ** 2 for v in allv) / len(allv)) ** 0.5
    ml, mr = sum(late) / len(late), sum(rest) / len(rest)
    return (mr - ml) / sd if sd else 0.0, ml, mr


def main():
    doc = json.load(open(PATH, encoding="utf-8"))
    rows = doc["works"]
    for r in rows:
        p = r["particles"]
        r["kathaper_per_10k"] = p["kathaper"] * 10000 / r["tokens"]
        r["hosper_per_10k"] = p["hosper"] * 10000 / r["tokens"]
        r["toinyn_per_10k"] = p["toinyn"] * 10000 / r["tokens"]
        r["mentoi_per_10k"] = p["mentoi"] * 10000 / r["tokens"]

    print("{:22}{:>10}{:>10}{:>10}".format("指標", "効果量", "後期平均", "他平均"))
    for key, label in [
        ("hiatus_rate", "ヒアトゥス率"),
        ("elided_per_1k", "エリジョン率"),
        ("kathaper_share", "καθάπερ の取り分"),
        ("kathaper_per_10k", "καθάπερ 万語あたり"),
        ("hosper_per_10k", "ὥσπερ 万語あたり"),
        ("toinyn_per_10k", "τοίνυν 万語あたり"),
        ("mentoi_per_10k", "μέντοι 万語あたり"),
    ]:
        d, ml, mr = separation(rows, key)
        print("{:22}{:>10.2f}{:>10.3f}{:>10.3f}".format(label, d, ml, mr))

    print("\nヒアトゥス率との相関:")
    h = [r["hiatus_rate"] for r in rows]
    for key, label in [("elided_per_1k", "エリジョン率"),
                       ("kathaper_share", "καθάπερ の取り分"),
                       ("toinyn_per_10k", "τοίνυν"),
                       ("mentoi_per_10k", "μέντοι")]:
        print("  {:22} r = {:+.3f}".format(label, pearson(h, [r[key] for r in rows])))

    print("\nκαθάπερ / ὥσπερ の実数(後期群と主な篇):")
    for r in sorted(rows, key=lambda x: -x["kathaper_per_10k"])[:10]:
        p = r["particles"]
        print("  {:10}{:12} καθάπερ {:>4} / ὥσπερ {:>4}  取り分 {:.2f}  {}".format(
            r["abbr"], r["title"][:10], p["kathaper"], p["hosper"],
            r["kathaper_share"], "後期" if r["abbr"] in LATE else ""))


if __name__ == "__main__":
    main()
