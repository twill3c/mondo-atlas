"""画面②(問答の呼吸)が描く材料を作る(SPEC F-05a / F-05b / F-05c)。

## 何を出すか

**節ごとの交替の濃さ**であって、交替の厳密な位置ではない。
較正で分かったのは次の二つで、出すものはこれに合わせてある(docs/L2-findings.md)。

- 境界の**位置**は当てられない。手がかりの点数付けは「文の切れ目をすべて境界とする」
  素通しに勝てなかった(検証側 F1 0.567 対 0.569)
- 節ごとの**濃さ**は当てられる。相関 0.756(素通し 0.713 / 語数だけ −0.021)で、
  語数の交絡には 13/13 篇で勝った

## 語り口ごとに推定器が違う(F-05c)

| 語り口 | 推定器 | 検証の状態 |
|---|---|---|
| 上演型 | 上演型の手がかり | 印刷面の話者記号と照合済み(検証側 13 篇) |
| 語り直し型 | 叙述内の発話動詞 | 照合相手が無い。語り手が参加者の篇では人称の交替で内部整合を確認 |
| 独白・書簡 | — | 交替を推定しない |

**画面には必ずこの区別を出す。** 同じ図の中で、検証の済んだ数と済んでいない数が
同じ顔をしてはいけない。
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
CALIB = os.path.join(ROOT, "data", "derived", "turn-calibration.json")
SEED = 20260902

#: 較正で決めた閾値(etl/calibrate_turns.py)。掃引は 0.30 以下で平坦
THRESHOLD = 0.30

#: 語り直し型の推定に切り替える下限。実測で、上演型の篇の発話動詞は
#: 千語あたり 1 件未満、語り直し型は 5 件以上とはっきり分かれる
NARRATED_CUES_PER_1K = 3.0


def register_of(work, cues_per_1k: float) -> str:
    """どちらの推定器を使うかを、**実測した性質**で決める。

    人が書いた narration ラベルは使わない —— 自分の分類を自分で確かめることになる。
    """
    has_sigla = work["n_sigla"] >= 20
    if has_sigla and cues_per_1k < NARRATED_CUES_PER_1K:
        return "dramatic"
    if cues_per_1k >= NARRATED_CUES_PER_1K:
        return "narrated" if not has_sigla else "mixed"
    return "none"


def main():
    corpus = normalize.build_corpus(RAW, CURATED)
    calib = json.load(open(CALIB, encoding="utf-8")) if os.path.exists(CALIB) else {}
    heldout = {r["abbr"]: r for r in calib.get("heldout", [])}
    calib_set = set(calib.get("calibration_works", []))
    narrated_stats = {r["abbr"]: r for r in calib.get("narrated", [])}

    out = []
    # 校訂者の印は**出荷物に載せない**。載せると、あとから誰かが「答えがそこにある」と
    # 使ってしまい、循環の禁止(G-03)が静かに破れる。検査用に別ファイルへ出す。
    gold_rows: list[dict] = []
    for w in corpus["works"]:
        tokens_all = normalize.tokens(normalize.join_sections(w["sections"]))
        cues = turns.find_narrated(tokens_all)
        per1k = len(cues) * 1000 / max(len(tokens_all), 1)
        reg = register_of(w, per1k)

        sections = []
        for s in w["sections"]:
            tk = normalize.tokens(s["grc"])
            n_dram = len(turns.detect(tk, THRESHOLD))
            n_narr = len(turns.detect_narrated(tk))
            if reg == "dramatic":
                est = n_dram
            elif reg == "narrated":
                est = n_narr
            elif reg == "mixed":
                est = max(n_dram, n_narr)
            else:
                est = 0
            sections.append({
                "id": s["id"],
                "page": s["page"],
                "letter": s["letter"],
                "book": s["book"],
                "tokens": len(tk),
                "turns": est,
            })
            gold_rows.append({"id": s["id"], "gold": len(s["sigla_at"]), "turns": est})

        ns = narrated_stats.get(w["abbr"], {})
        out.append({
            "id": w["id"], "abbr": w["abbr"], "title_ja": w["title_ja"],
            "tetralogy": w["tetralogy"],
            "register": reg,
            "cues_per_1k": round(per1k, 3),
            "n_turns": sum(x["turns"] for x in sections),
            "n_sigla": w["n_sigla"],
            # 検証の状態。画面はこれを見て、数の確からしさを言い分ける
            "validation": {
                "kind": ("照合済み(検証側)" if w["abbr"] in heldout
                         else "照合済み(較正側)" if w["abbr"] in calib_set
                         else "内部整合のみ" if ns.get("p", 1) < 0.01
                         else "未検証"),
                "f1": heldout.get(w["abbr"], {}).get("f1"),
                "alternation": ns.get("alternation"),
                "p": ns.get("p"),
            },
            "sections": sections,
        })

    path = os.path.join(ROOT, "data", "turns.json")
    json.dump({"threshold": THRESHOLD, "seed": SEED, "works": out},
              open(path, "w", encoding="utf-8"), ensure_ascii=False,
              separators=(",", ":"))

    gold_path = os.path.join(ROOT, "data", "derived", "turns-gold.json")
    os.makedirs(os.path.dirname(gold_path), exist_ok=True)
    json.dump(gold_rows, open(gold_path, "w", encoding="utf-8"),
              ensure_ascii=False, separators=(",", ":"))

    from collections import Counter
    print("語り口の内訳: {}".format(dict(Counter(w["register"] for w in out))))
    print("交替の推定総数: {}".format(sum(w["n_turns"] for w in out)))
    print("検証の状態: {}".format(dict(Counter(w["validation"]["kind"] for w in out))))
    print("{:10}{:>10}{:>9}{:>9}{:>8}  {}".format(
        "篇", "語り口", "推定交替", "話者記号", "手/千語", "検証"))
    for w in sorted(out, key=lambda x: -x["n_turns"])[:12]:
        print("{:10}{:>10}{:>9}{:>9}{:>8.1f}  {}".format(
            w["abbr"], w["register"], w["n_turns"], w["n_sigla"],
            w["cues_per_1k"], w["validation"]["kind"]))
    print("→ {} ({:.1f} KB)".format(path, os.path.getsize(path) / 1000))


if __name__ == "__main__":
    main()
