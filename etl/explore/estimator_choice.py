"""L3 stage2: 推定器を篇ごとに切り替えるのをやめ、全篇で max(上演型, 語り直し型) に
できるかを実測で決める。

## なぜ変えたいか

『パルメニデス』の後半(推論の部分)は、実際には密な問答である。しかし
叙述内の発話動詞が現れないので、語り直し型の推定器は 0 を返す。
図に出せば「後半は沈黙している」という**嘘**になる。

両方とも本文だけを見る推定器なので、片方が拾える交替をもう片方が拾えないだけである。
**max を取れば篇ごとの切り替えが要らなくなる。**

## 何を確かめるか

切り替えをやめても、**照合できる 27 篇で成績が落ちないこと**。
落ちるなら採用しない。落ちないなら、規則がひとつ減って『パルメニデス』も直る。
"""

import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)

from etl import normalize, turns  # noqa: E402

RAW = os.path.join(ROOT, "raw", "perseus")
CURATED = os.path.join(ROOT, "data", "curated", "works.json")
CALIB = os.path.join(ROOT, "data", "derived", "turn-calibration.json")


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
    calib = json.load(open(CALIB, encoding="utf-8"))
    held = set(calib["heldout_works"])

    print("検証側 13 篇で、推定器を切り替えた場合と max を取った場合を比べる")
    print("{:10}{:>12}{:>12}{:>10}".format("篇", "上演型のみ", "max", "差"))
    d_only, d_max = [], []
    for w in corpus["works"]:
        if w["abbr"] not in held:
            continue
        pred_d, pred_m, gold = [], [], []
        for s in w["sections"]:
            tk = normalize.tokens(s["grc"])
            a = len(turns.detect(tk, 0.30))
            b = len(turns.detect_narrated(tk))
            pred_d.append(a)
            pred_m.append(max(a, b))
            gold.append(len(s["sigla_at"]))
        ra, rm = pearson(pred_d, gold), pearson(pred_m, gold)
        d_only.append(ra)
        d_max.append(rm)
        print("{:10}{:>12.3f}{:>12.3f}{:>10.3f}".format(w["abbr"], ra, rm, rm - ra))

    print("\n平均: 上演型のみ {:.3f} / max {:.3f} / 差 {:+.3f}".format(
        sum(d_only) / len(d_only), sum(d_max) / len(d_max),
        sum(d_max) / len(d_max) - sum(d_only) / len(d_only)))

    # 『パルメニデス』が直るか
    prm = next(w for w in corpus["works"] if w["abbr"] == "Prm")
    half = len(prm["sections"]) // 2
    for name, rng in (("前半", prm["sections"][:half]), ("後半", prm["sections"][half:])):
        tok = sum(len(normalize.tokens(s["grc"])) for s in rng)
        narr = sum(len(turns.detect_narrated(normalize.tokens(s["grc"]))) for s in rng)
        dram = sum(len(turns.detect(normalize.tokens(s["grc"]), 0.30)) for s in rng)
        print("パルメニデス {}: 語り直し型 {:>4} / 上演型 {:>4} / 千語あたり max {:.1f}".format(
            name, narr, dram, max(narr, dram) * 1000 / max(tok, 1)))


if __name__ == "__main__":
    main()
