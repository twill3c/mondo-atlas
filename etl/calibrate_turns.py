"""発話交替の検出器を較正する(SPEC G-03 / G-11 / G-12)。

## 循環していないこと

検出器(etl/turns.py)は本文しか受け取らない。このスクリプトだけが校訂者の印を読み、
**書き終えた検出器の答え合わせ**に使う。印は較正の正解であって、検出器の材料ではない。

## 較正の相手が二系統に分かれる

- **上演型**: 印刷面の話者記号が全ての交替を示すので、位置の照合ができる。
  ただし**閾値を合わせた標本で検証しても何も分からない**(HC-073)ので、
  篇を半分に割り、片方で閾値を決め、**もう片方で報告する**。
- **語り直し型**: 話者記号が印刷されないので照合相手が無い。
  代わりに**人称の交替**を見る —— 二者の問答なら 1 人称(語り手)と 3 人称(相手)が
  交互に来るはずで、これは校訂者の判断ではなく文法の性質である。
  個数を保ったまま並びだけを崩す置換対照を置く。

## 測る前に宣言した予測(HC-064)

1. F1 は**話者記号の密度と正の相関**を持つ。密度の高い篇(短い応酬が続く)ほど当たり、
   長い演説が続く篇(メネクセノス・ティマイオス・クリティアス・エピノミス)ほど外す。
2. 無作為に同数の境界を置いた場合より、はっきり良い。
3. 語り直し型の人称の並びは、置換対照より有意に交替する(p < 0.01)。

**実測が宣言と食い違ったら、表ではなく対象の側を直す。**
食い違いを表の書き換えで消したら、この対照はもう何も言わない。
"""

from __future__ import annotations

import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from etl import normalize, turns  # noqa: E402

RAW = os.path.join(ROOT, "raw", "perseus")
CURATED = os.path.join(ROOT, "data", "curated", "works.json")
SEED = 20260902

#: 予測 1 で「外す」と名指しした篇。実測後に当たり外れを表示する
PREDICTED_HARD = {"Menex", "Ti", "Criti", "Epin"}


def pearson(xs, ys) -> float:
    n = len(xs)
    if n < 2:
        return 0.0
    mx, my = sum(xs) / n, sum(ys) / n
    cov = sum((a - mx) * (b - my) for a, b in zip(xs, ys))
    vx = sum((a - mx) ** 2 for a in xs) ** 0.5
    vy = sum((b - my) ** 2 for b in ys) ** 0.5
    return cov / (vx * vy) if vx and vy else 0.0


def gold_boundaries(work) -> dict[str, set[int]]:
    """節ごとの正解境界(話者記号の位置)。**較正の側だけが読む欄**。"""
    return {s["id"]: set(s["sigla_at"]) for s in work["sections"]}


def evaluate(work, threshold: float, tol: int = 0, detector=None):
    """1 篇について、検出器の予測と正解を突き合わせる。

    detector を差し替えると対照(文末素通し)も同じ物差しで測れる。
    """
    pred_all: list[int] = []
    gold_all: list[int] = []
    offset = 0
    for s in work["sections"]:
        tk = normalize.tokens(s["grc"])
        # 検出器に渡すのは本文だけ(G-03)
        pred = detector(tk) if detector else turns.detect(tk, threshold)
        gold = s["sigla_at"]
        pred_all += [offset + i for i in pred]
        gold_all += [offset + i for i in gold]
        offset += len(tk)
    p, r, f1, hit = turns.prf(set(pred_all), set(gold_all), tol)
    return {
        "abbr": work["abbr"], "title": work["title_ja"],
        "n_tokens": offset, "n_gold": len(gold_all), "n_pred": len(pred_all),
        "precision": p, "recall": r, "f1": f1, "hit": hit,
        "density": len(gold_all) * 1000 / max(offset, 1),
    }


def split_works(works):
    """篇を交互に振り分ける。決定論的で、順序は tlg 番号順(canonical)。"""
    ordered = sorted(works, key=lambda w: w["id"])
    calib = [w for i, w in enumerate(ordered) if i % 2 == 0]
    held = [w for i, w in enumerate(ordered) if i % 2 == 1]
    return calib, held


def main():
    corpus = normalize.build_corpus(RAW, CURATED)

    # 上演型の判定は**source の性質**で行う。自分の付けた narration ラベルを使うと
    # 「自分の分類を自分で確かめる」ことになる。
    # 使うのは L0 の実測: said == label が厳密に成り立ち、かつ記号が実在する篇。
    dramatic = [w for w in corpus["works"] if w["n_sigla"] > 0
                and sum(len(s["sigla"]) for s in w["sections"]) == w["n_sigla"]]
    # said == label は L0 で全数確認済み。ここでは記号が実在することだけを条件にする
    dramatic = [w for w in dramatic if w["n_sigla"] >= 20]

    calib, held = split_works(dramatic)
    print("上演型 {} 篇 → 較正 {} / 検証 {}".format(len(dramatic), len(calib), len(held)))
    print("  較正: {}".format(" ".join(w["abbr"] for w in calib)))
    print("  検証: {}".format(" ".join(w["abbr"] for w in held)))

    # ---------------------------------------------------------- 閾値を決める
    print("\n=== 閾値の掃引(較正の側だけで決める) ===")
    print("{:>7}{:>10}{:>10}{:>10}".format("閾値", "適合率", "再現率", "F1"))
    best = (None, -1.0)
    # 端で最良になるのは最適値を見つけていない兆候なので、下まで広げる
    for th in [0.05, 0.1, 0.2, 0.25, 0.3, 0.35, 0.4, 0.5, 0.55, 0.65,
               0.8, 0.85, 0.9, 1.0, 1.15, 1.2, 1.4]:
        rows = [evaluate(w, th) for w in calib]
        # 篇ごとの F1 の平均(長い篇に引きずられないようにする)
        f1 = sum(r["f1"] for r in rows) / len(rows)
        p = sum(r["precision"] for r in rows) / len(rows)
        r_ = sum(r["recall"] for r in rows) / len(rows)
        print("{:>7.2f}{:>10.3f}{:>10.3f}{:>10.3f}".format(th, p, r_, f1))
        # 同点なら**大きい方**を採る。同じ成績なら選択的で単純な方を選ぶ、という決め。
        # (掃引は 0.30 以下で平坦になる —— 手がかりの最小点が 0.30 なので、
        #  それ未満の閾値はすべて「手がかりが一つでもあれば境界」と同じ意味になる)
        if f1 > best[1] + 1e-12:
            best = (th, f1)
        elif abs(f1 - best[1]) <= 1e-12 and best[0] is not None and th > best[0]:
            best = (th, f1)
    th = best[0]
    print("→ 較正で選んだ閾値 {:.2f}(較正側 F1 {:.3f})".format(th, best[1]))
    if th in (0.05, 1.4):
        print("  ** 掃引範囲の端で最良になっている。最適値を見つけていない可能性がある **")

    # ------------------------------------------------------ 検証側で報告する
    print("\n=== 検証(閾値を合わせていない篇で報告) ===")
    print("{:10}{:>8}{:>8}{:>9}{:>9}{:>8}{:>9}".format(
        "篇", "語数", "正解", "適合率", "再現率", "F1", "偶然"))
    print("{:10}{:>8}{:>8}{:>9}{:>9}{:>8}{:>9}{:>9}".format(
        "篇", "語数", "正解", "適合率", "再現率", "F1", "偶然", "文末素通し"))
    held_rows = []
    for w in held:
        r = evaluate(w, th)
        base = turns.random_baseline_f1(r["n_tokens"], r["n_gold"], SEED, trials=60)
        # 対照: 手がかりを一切使わず、文の切れ目をすべて境界とする
        naive = evaluate(w, th, detector=turns.detect_every_sentence_end)
        r["baseline"] = base
        r["naive_f1"] = naive["f1"]
        r["naive_precision"] = naive["precision"]
        r["naive_recall"] = naive["recall"]
        held_rows.append(r)
        print("{:10}{:>8}{:>8}{:>9.3f}{:>9.3f}{:>8.3f}{:>9.3f}{:>9.3f}".format(
            r["abbr"], r["n_tokens"], r["n_gold"],
            r["precision"], r["recall"], r["f1"], base, naive["f1"]))

    mean_f1 = sum(r["f1"] for r in held_rows) / len(held_rows)
    mean_base = sum(r["baseline"] for r in held_rows) / len(held_rows)
    mean_naive = sum(r["naive_f1"] for r in held_rows) / len(held_rows)
    print("\n検証側の平均 F1 {:.3f} / 偶然 {:.3f} / 文末素通し {:.3f}".format(
        mean_f1, mean_base, mean_naive))
    won = sum(1 for r in held_rows if r["f1"] > r["naive_f1"])
    print("手がかりが文末素通しに勝った篇: {} / {}".format(won, len(held_rows)))

    # -------------------------------------------- 図が実際に見せるものを測る
    #
    # 画面②が読者に見せるのは「どこで問答が濃いか」であって、境界の厳密な位置ではない。
    # **見せるものの物差しで測り直す** —— 節ごとの交替数が正解とどれだけ揃うか。
    print("\n=== 節ごとの交替数の一致(図が実際に見せるもの) ===")
    # 交絡に注意(HC-025): 長い節は文も交替も多い。**節の語数だけ**でどこまで説明できるかを
    # 第三の対照として置く。これに勝てない検出器は「長さを測っているだけ」である。
    print("{:10}{:>8}{:>10}{:>10}{:>10}".format(
        "篇", "節数", "手がかり", "文末素通し", "語数だけ"))
    dens_rows = []
    for w in held:
        pred_counts, gold_counts, naive_counts, len_counts = [], [], [], []
        for s in w["sections"]:
            tk = normalize.tokens(s["grc"])
            pred_counts.append(len(turns.detect(tk, th)))
            naive_counts.append(len(turns.detect_every_sentence_end(tk)))
            len_counts.append(len(tk))
            gold_counts.append(len(s["sigla_at"]))
        r_cue = pearson(pred_counts, gold_counts)
        r_naive = pearson(naive_counts, gold_counts)
        r_len = pearson(len_counts, gold_counts)
        dens_rows.append({"abbr": w["abbr"], "n": len(gold_counts),
                          "r": r_cue, "r_naive": r_naive, "r_len": r_len})
        print("{:10}{:>8}{:>10.3f}{:>10.3f}{:>10.3f}".format(
            w["abbr"], len(gold_counts), r_cue, r_naive, r_len))
    mean_r = sum(d["r"] for d in dens_rows) / len(dens_rows)
    mean_rn = sum(d["r_naive"] for d in dens_rows) / len(dens_rows)
    mean_rl = sum(d["r_len"] for d in dens_rows) / len(dens_rows)
    print("\n節ごとの交替数の相関: 手がかり {:.3f} / 文末素通し {:.3f} / 語数だけ {:.3f}".format(
        mean_r, mean_rn, mean_rl))
    beat_len = sum(1 for d in dens_rows if d["r"] > d["r_len"])
    print("語数だけの対照に勝った篇: {} / {}".format(beat_len, len(dens_rows)))

    # ------------------------------------------------------ 予測の当たり外れ
    print("\n=== 宣言した予測との突き合わせ ===")
    ranked = sorted(held_rows, key=lambda r: r["f1"])
    worst = {r["abbr"] for r in ranked[: max(1, len(ranked) // 4)]}
    named = PREDICTED_HARD & {r["abbr"] for r in held_rows}
    print("予測 1(密度が低い篇ほど外す): 名指しして検証側に居るのは {}".format(
        ", ".join(sorted(named)) or "なし"))
    print("  実測で下位 1/4 に入ったのは {}".format(", ".join(sorted(worst))))
    print("  → 名指しのうち下位 1/4 に入ったのは {}".format(
        ", ".join(sorted(named & worst)) or "なし"))
    # 密度と F1 の相関(順位相関ではなく素の相関で足りる)
    xs = [r["density"] for r in held_rows]
    ys = [r["f1"] for r in held_rows]
    n = len(xs)
    mx, my = sum(xs) / n, sum(ys) / n
    cov = sum((a - mx) * (b - my) for a, b in zip(xs, ys))
    vx = sum((a - mx) ** 2 for a in xs) ** 0.5
    vy = sum((b - my) ** 2 for b in ys) ** 0.5
    corr = cov / (vx * vy) if vx and vy else 0.0
    print("  密度と F1 の相関 r = {:.3f}".format(corr))
    print("予測 2(偶然より良い): {} ({:.3f} vs {:.3f})".format(
        "成立" if mean_f1 > mean_base * 3 else "不成立", mean_f1, mean_base))
    print("対照(文末素通しで代替されないか): 平均 {:.3f} vs 素通し {:.3f} → {}".format(
        mean_f1, mean_naive,
        "手がかりが効いている" if mean_f1 > mean_naive else "**素通しに負けている**"))

    # -------------------------------------------------- 語り直し型の内部整合
    print("\n=== 語り直し型: 人称の交替と置換対照 ===")
    print("{:10}{:>8}{:>8}{:>10}{:>10}".format("篇", "手がかり", "1人称", "交替率", "p"))
    narrated_rows = []
    for w in corpus["works"]:
        text = normalize.join_sections(w["sections"])
        hits = turns.find_narrated(normalize.tokens(text))
        if len(hits) < 30:
            continue
        persons = [h["person"] for h in hits]
        rate = turns.alternation_rate(persons)
        p_val = turns.permutation_p(persons, seed=SEED, trials=2000)
        first = sum(1 for x in persons if x == 1)
        narrated_rows.append({
            "abbr": w["abbr"], "title": w["title_ja"], "cues": len(hits),
            "first_person": first, "alternation": rate, "p": p_val,
        })
        print("{:10}{:>8}{:>8}{:>10.3f}{:>10.4f}".format(
            w["abbr"], len(hits), first, rate, p_val))

    sig = [r for r in narrated_rows if r["p"] < 0.01]
    print("\n予測 3(置換対照より有意に交替): {} / {} 篇で p < 0.01".format(
        len(sig), len(narrated_rows)))

    out = {
        "seed": SEED,
        "threshold": th,
        "calibration_works": [w["abbr"] for w in calib],
        "heldout_works": [w["abbr"] for w in held],
        "heldout": held_rows,
        "heldout_mean_f1": mean_f1,
        "random_baseline_mean_f1": mean_base,
        "density_f1_corr": corr,
        "narrated": narrated_rows,
    }
    path = os.path.join(ROOT, "data", "derived", "turn-calibration.json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    json.dump(out, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("\n→ {}".format(path))


if __name__ == "__main__":
    main()
