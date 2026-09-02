"""画面③(語の地層)が描く材料を作る(SPEC F-06)。

縦=作品、横=作品内の位置。値は**千語あたりの出現数**であって、素の件数ではない。
篇の長さが 1,509 語から 102,743 語まで 68 倍違うので、件数のまま並べると
長い篇が濃く見えるだけの図になる(HC-025 の標本サイズ交絡と同じ話)。

位置は篇を等分した区間で取る。ステファヌス節はほぼ等長なので、節数で等分してよい。
"""

from __future__ import annotations

import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from etl import normalize, words as W  # noqa: E402

RAW = os.path.join(ROOT, "raw", "perseus")
CURATED = os.path.join(ROOT, "data", "curated", "works.json")
BINS = 40


def main():
    corpus = normalize.build_corpus(RAW, CURATED)
    terms = W.load_ledger(W.DEFAULT_LEDGER)

    works_out = []
    corpus_totals = {t["key"]: 0 for t in terms}
    corpus_tokens = 0

    for w in corpus["works"]:
        secs = w["sections"]
        # 節ごとの語数と、見出し語ごとの出現数
        per_sec_tokens = []
        per_sec_counts = []
        for s in secs:
            ws = W.words(s["grc"])
            per_sec_tokens.append(len(ws))
            row = {t["key"]: 0 for t in terms}
            for word in ws:
                for t in terms:
                    if W.match(t, word):
                        row[t["key"]] += 1
                        break
            per_sec_counts.append(row)

        total_tokens = sum(per_sec_tokens)
        corpus_tokens += total_tokens
        totals = {t["key"]: sum(r[t["key"]] for r in per_sec_counts) for t in terms}
        for k, v in totals.items():
            corpus_totals[k] += v

        # 篇を等分して区間ごとの千語あたり出現数を出す
        bins = {t["key"]: [0.0] * BINS for t in terms}
        bin_tokens = [0] * BINS
        acc_counts = {t["key"]: [0] * BINS for t in terms}
        n = len(secs)
        for i in range(n):
            b = min(BINS - 1, i * BINS // n)
            bin_tokens[b] += per_sec_tokens[i]
            for t in terms:
                acc_counts[t["key"]][b] += per_sec_counts[i][t["key"]]
        for t in terms:
            for b in range(BINS):
                k = bin_tokens[b]
                bins[t["key"]][b] = round(
                    acc_counts[t["key"]][b] * 1000 / k, 2) if k else 0.0

        works_out.append({
            "abbr": w["abbr"], "title": w["title_ja"], "tetralogy": w["tetralogy"],
            "tokens": total_tokens,
            "totals": totals,
            "rates": {k: round(v * 1000 / max(total_tokens, 1), 2)
                      for k, v in totals.items()},
            "bins": bins,
        })

    out = {
        "bins": BINS,
        "corpus_tokens": corpus_tokens,
        "terms": [{"key": t["key"], "lemma": t["lemma"], "ja": t["ja"],
                   "total": corpus_totals[t["key"]],
                   "rate": round(corpus_totals[t["key"]] * 1000 / corpus_tokens, 2),
                   "n_forms": len(t["forms"]),
                   "n_excluded_surfaces": len(t["exclude_surfaces"])}
                  for t in terms],
        "works": works_out,
    }
    path = os.path.join(ROOT, "data", "words.json")
    json.dump(out, open(path, "w", encoding="utf-8"), ensure_ascii=False,
              separators=(",", ":"))

    print("{:14}{:>8}{:>10}{:>8}  {}".format("見出し語", "延べ", "千語あたり", "語形", "最も濃い篇"))
    for t in out["terms"]:
        top = max(works_out, key=lambda w: w["rates"][t["key"]])
        print("{:14}{:>8,}{:>10.2f}{:>8}  {} ({:.1f})".format(
            t["lemma"], t["total"], t["rate"], t["n_forms"],
            top["title"], top["rates"][t["key"]]))
    print("\n全集 {:,} 語 / 主要語 延べ {:,}".format(
        corpus_tokens, sum(corpus_totals.values())))
    print("→ {} ({:.0f} KB)".format(path, os.path.getsize(path) / 1000))


if __name__ == "__main__":
    main()
