"""語形の採否台帳を作る(SPEC F-06)。

## なぜ台帳が要るのか

ギリシャ語は屈折語なので、見出し語で数えることはできない。かといって語幹の前方一致で
拾うと、まったく別の語が混ざる。実測(2026-09-02)で見えた例:

- 語幹 `ψυχ` は **ψυχρόν(冷たい)・ψύχεσθαι(冷やす)** を拾う
- 語幹 `ειδ` は **εἰδέναι(知ること・241 件)・εἰδώς(87)・εἴδωλον(25)** を拾う。
  目当ての εἶδος(形相)より、οἶδα(知る)の活用形のほうが多い

**外部辞書の素通し照合は使えない**(半七アトラスで 320 語を全数目視した先例)。
そこでこのスクリプトは「語幹に前方一致する**異なり語形**」を全部並べ、
人が採否を書き込むための台帳を出す。目視できる粒度はトークンではなく異なり語形である。

## 両方向を潰す(HC-127)

- **誤検出**: 台帳に載った形を一つずつ見て、別語なら否にする
- **取りこぼし**: 語幹自体を広めに取り(例: `ιδε` は `ἰδέα` だけでなく `ἰδεῖν` も拾う)、
  拾いすぎたものを否で落とす。狭い語幹で取りこぼすより、広く取って落とすほうが数えられる

出力: data/curated/word-ledger.draft.json(人が採否を書き込む下書き)
"""

from __future__ import annotations

import json
import os
import re
import sys
import unicodedata
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from etl import normalize  # noqa: E402

RAW = os.path.join(ROOT, "raw", "perseus")
CURATED = os.path.join(ROOT, "data", "curated", "works.json")

#: 語の切れ目。ダッシュで繋がれた語は二語として扱う(実測: ἀρετήν—ὥσπερ)
SPLIT = re.compile(r"[\s—–\-]+")
STRIP = ".,;·:!?()[]{}«»‘’ʼ'\"·;…"


def fold(text: str) -> str:
    d = unicodedata.normalize("NFD", text)
    d = "".join(c for c in d if not unicodedata.combining(c))
    return unicodedata.normalize("NFC", d).lower().replace("ς", "σ")


def words(text: str) -> list[str]:
    """本文を語に切る。ダッシュ結合を割り、句読点を落とす。"""
    out = []
    for chunk in SPLIT.split(text):
        w = chunk.strip(STRIP)
        if w:
            out.append(w)
    return out


#: 見出し語と、拾うための語幹。**広めに取って台帳で落とす**
TERMS = [
    {"key": "arete", "lemma": "ἀρετή", "ja": "徳", "stem": "αρετ"},
    {"key": "dikaiosyne", "lemma": "δικαιοσύνη", "ja": "正義", "stem": "δικαιοσυν"},
    {"key": "psyche", "lemma": "ψυχή", "ja": "魂", "stem": "ψυχ"},
    {"key": "eidos", "lemma": "εἶδος", "ja": "形相", "stem": "ειδ"},
    {"key": "idea", "lemma": "ἰδέα", "ja": "イデア", "stem": "ιδε"},
    {"key": "logos", "lemma": "λόγος", "ja": "言葉・理", "stem": "λογ"},
    {"key": "episteme", "lemma": "ἐπιστήμη", "ja": "知識", "stem": "επιστημ"},
    {"key": "hedone", "lemma": "ἡδονή", "ja": "快", "stem": "ηδον"},
    {"key": "agathos", "lemma": "ἀγαθός", "ja": "善", "stem": "αγαθ"},
    {"key": "nomos", "lemma": "νόμος", "ja": "法", "stem": "νομ"},
    {"key": "physis", "lemma": "φύσις", "ja": "自然", "stem": "φυσ"},
    {"key": "aletheia", "lemma": "ἀλήθεια", "ja": "真理", "stem": "αληθ"},
    {"key": "soma", "lemma": "σῶμα", "ja": "身体", "stem": "σωμα"},
    {"key": "polis", "lemma": "πόλις", "ja": "国", "stem": "πολι"},
]


def main():
    corpus = normalize.build_corpus(RAW, CURATED)

    # 異なり語形ごとに、延べ数・表層の異形・用例を集める
    counts: Counter[str] = Counter()
    surfaces: dict[str, Counter] = defaultdict(Counter)
    example: dict[str, str] = {}

    for w in corpus["works"]:
        for s in w["sections"]:
            ws = words(s["grc"])
            for i, tok in enumerate(ws):
                f = fold(tok)
                if not f:
                    continue
                counts[f] += 1
                surfaces[f][tok] += 1
                if f not in example:
                    lo, hi = max(0, i - 4), min(len(ws), i + 5)
                    example[f] = "{} 〈{}〉".format(s["id"], " ".join(ws[lo:hi]))

    ledger = []
    for t in TERMS:
        forms = sorted(
            (f for f in counts if f.startswith(t["stem"])),
            key=lambda f: -counts[f],
        )
        rows = [
            {
                "form": f,
                "count": counts[f],
                "surfaces": [s for s, _ in surfaces[f].most_common(4)],
                "example": example[f],
                # 人が埋める欄。true = 採る / false = 落とす / null = 未判断
                "accept": None,
                "note": "",
            }
            for f in forms
        ]
        ledger.append({**t, "n_forms": len(rows), "n_tokens": sum(r["count"] for r in rows),
                       "forms": rows})

    path = os.path.join(ROOT, "data", "curated", "word-ledger.draft.json")
    json.dump({"_about": "語形の採否台帳の下書き。accept を人が埋める", "terms": ledger},
              open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    print("{:16}{:>8}{:>10}".format("見出し語", "異なり形", "延べ"))
    for t in ledger:
        print("{:16}{:>8}{:>10,}".format(t["lemma"], t["n_forms"], t["n_tokens"]))
    print("\n合計 異なり {} 形 / 延べ {:,}".format(
        sum(t["n_forms"] for t in ledger), sum(t["n_tokens"] for t in ledger)))
    print("→ {}".format(path))


if __name__ == "__main__":
    main()
