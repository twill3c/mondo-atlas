"""三段リーダー(希語 / 英訳 / 和訳)の材料を作る(SPEC F-08 / F-09 / F-12 / G-06)。

## G-06 は「原文の側から」数える

訳文に何が入っているかを見ても、**原文の何が落ちたか**は分からない
(uta-gaeshi の G-14/G-15 の教訓)。だからここでは、
**原文の節を全部並べたうえで、訳の付いていない節を数える**。

出荷するのは節ごとの三段。節 ID は `Crit.43a` の形で、
`?loc=Crit.43a` の直リンクに使う(F-09)。
"""

from __future__ import annotations

import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CUR = os.path.join(ROOT, "data", "curated")
OUT_DIR = os.path.join(ROOT, "data", "reader")

#: リーダーに載せる篇。全 36 篇の本文を配ると 12.5 MB になるので、
#: **和訳が始まっている篇だけ**を出す。増えたらここに足す。
INCLUDE = ["Euthphr", "Ap", "Crit", "Men"]


def _index_entry(work: dict, n_bytes: int) -> dict:
    """目次の 1 件。**本文(sections)は持たない** —— それが分割の意味である。"""
    # `untranslated`(節 ID の列)も落とす —— 未訳の篇が増えるほど目次が太る。
    # 数は nSections と nTranslated で足り、ID の列は篇のファイルが持っている
    entry = {k: v for k, v in work.items() if k not in ("sections", "untranslated")}
    entry["slug"] = work["abbr"].lower()
    entry["pages"] = sorted({s["page"] for s in work["sections"]})
    entry["bytes"] = n_bytes
    return entry


def main() -> int:
    tr = json.load(open(os.path.join(CUR, "translation.json"), encoding="utf-8"))["sections"]
    index = {w["abbr"]: w for w in
             json.load(open(os.path.join(ROOT, "data", "index.json"), encoding="utf-8"))["works"]}

    problems = []
    works = []
    all_ids = set()

    for abbr in INCLUDE:
        doc = json.load(open(os.path.join(ROOT, "data", "works", abbr + ".json"),
                             encoding="utf-8"))
        secs = []
        for s in doc["sections"]:
            all_ids.add(s["id"])
            secs.append({
                "id": s["id"], "page": s["page"], "letter": s["letter"],
                "grc": s["grc"], "eng": s["eng"], "ja": tr.get(s["id"], ""),
            })
        # **原文の側から**数える —— 訳の無い節がどれか
        untranslated = [s["id"] for s in secs if not s["ja"]]
        works.append({
            "abbr": abbr, "title": index[abbr]["title_ja"],
            "sections": secs,
            "nSections": len(secs),
            "nTranslated": len(secs) - len(untranslated),
            "untranslated": untranslated,
            "complete": not untranslated,
        })

    # 訳はあるが原文に無い節 = 節 ID の書き間違い
    stray = sorted(set(tr) - all_ids)
    # INCLUDE の外の篇に訳があるなら、それは載せ忘れ
    stray = [s for s in stray if s.split(".")[0] not in INCLUDE]
    for s in stray:
        problems.append("原文に無い節の訳: {}".format(s))

    total = sum(w["nSections"] for w in works)
    done = sum(w["nTranslated"] for w in works)
    # 全集の節数(充填率の分母は**全集**で取る。三篇だけを分母にすると進み具合が誇張される)
    corpus_sections = sum(w["n_sections"] for w in index.values())

    os.makedirs(OUT_DIR, exist_ok=True)

    # 篇ごとに本文を書き出す。画面はこのうち一つだけを読む
    sizes = {}
    for w in works:
        path = os.path.join(OUT_DIR, w["abbr"] + ".json")
        json.dump(w, open(path, "w", encoding="utf-8"), ensure_ascii=False,
                  separators=(",", ":"))
        sizes[w["abbr"]] = os.path.getsize(path)

    # 目次は**本文を持たない**。/read/ はこれだけを読むので軽い
    doc = {
        "corpusSections": corpus_sections,
        "readerSections": total,
        "translated": done,
        "coverageOfReader": round(done / total, 4) if total else 0.0,
        "coverageOfCorpus": round(done / corpus_sections, 5),
        "works": [_index_entry(w, sizes[w["abbr"]]) for w in works],
    }
    json.dump(doc, open(os.path.join(OUT_DIR, "index.json"), "w", encoding="utf-8"),
              ensure_ascii=False, separators=(",", ":"))

    print("リーダーに載せた篇: {}".format(", ".join(w["title"] for w in works)))
    for w in works:
        print("  {:9}{:12} 訳 {:>3} / {:>3} 節  {}".format(
            w["abbr"], w["title"][:10], w["nTranslated"], w["nSections"],
            "完訳" if w["complete"] else "未訳 {} 節".format(len(w["untranslated"]))))
    print("\n三篇で {} / {} 節 = {:.1%}".format(done, total, doc["coverageOfReader"]))
    print("全集では {} / {:,} 節 = {:.2%}".format(done, corpus_sections, doc["coverageOfCorpus"]))
    if problems:
        print("\n**検算に失敗**")
        for p in problems:
            print("  - " + p)
        return 1
    print("\n検算: 訳の節 ID はすべて原文に実在する(原文の側から数えた)")
    print("→ {}/".format(OUT_DIR))
    for w in works:
        print("   {:14} {:>6.0f} KB".format(w["abbr"] + ".json", sizes[w["abbr"]] / 1000))
    idx_bytes = os.path.getsize(os.path.join(OUT_DIR, "index.json"))
    print("   {:14} {:>6.1f} KB(本文を持たない目次)".format("index.json", idx_bytes / 1000))
    print("いちばん大きい篇 {:.0f} KB —— 一枚に束ねていたときは {:.0f} KB だった".format(
        max(sizes.values()) / 1000, sum(sizes.values()) / 1000))
    return 0


if __name__ == "__main__":
    sys.exit(main())
