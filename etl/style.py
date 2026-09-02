"""文体の指標を本文から数える(SPEC F-07)。

## ヒアトゥス(母音衝突)

母音で終わる語のあとに母音で始まる語が続く並び。ギリシャ語の散文では耳障りとされ、
**プラトンの後期の作品はこれを避ける**というのが 19 世紀以来の観察である
(Blass 1874 ほか)。避け方は語順の工夫やエリジョンで行われる。

数え方をここで決めておく:

- 対象は**隣り合う語の組**。強い句読点(. ; ·)をまたぐ組は数えない
  —— 文が切れれば声も切れるので、衝突が起きない
- 前の語が母音・二重母音で終わり、次の語が母音で始まるとき衝突とみなす
- **エリジョン済みの語は衝突しない**。`δ᾽` のように母音が落ちている形は、
  避けた結果なので分母にも分子にも入れない(末尾がアポストロフィなら除外)
- 気息記号は母音に付くので、`ἀ` `ἐ` `ὁ` などはすべて母音始まりである
- ν 音便(ἐστίν の ν)は子音終わりとして扱う —— これも衝突を避ける手段そのもの

**この定義は Blass らの数え方と同じではない。** 公刊値と直接くらべることはしない。
くらべるのは**篇どうし**であり、同じ物差しで測った相対の話に限る。

## 小辞と接続の癖

もう一つの軸として、応答・接続に使われる小辞の使い分けを測る。
語彙の主題に引きずられにくい語を選ぶ(文体計量の常套)。
"""

from __future__ import annotations

import re
import unicodedata

#: 母音(気息・アクセントを落とした後の素の字)
VOWELS = set("αεηιουω")

#: 強い句読点。ここで切れる組は数えない
STOPS = set(".;·;:!?")

#: エリジョンの印(この記号で終わる語は母音が落ちている)
APOS = "'’ʼ᾽"


#: 語の区切り。**アポストロフィは残す** —— エリジョンの印そのものなので、
#: 句読点として落とすと「避けた形」が数えられなくなる(実測で全篇 0 になった)
_SPLIT = re.compile(r"[\s—–\-]+")
_TAIL = ".,;·:!?()[]{}«»\"…"
_INNER = re.compile(r"(?<=[Ͱ-Ͽἀ-῿])[.,;·:;]+(?=[Ͱ-Ͽἀ-῿])")


def tokenize(text: str) -> list[str]:
    """文体の計測用に語へ切る。句読点は語末に残す(文の切れ目の判定に要る)。"""
    out: list[str] = []
    for chunk in _SPLIT.split(text):
        for piece in _INNER.split(chunk):
            w = piece.strip()
            if w:
                out.append(w)
    return out


def _strip_marks(ch: str) -> str:
    d = unicodedata.normalize("NFD", ch)
    return "".join(c for c in d if not unicodedata.combining(c)).lower()


def ends_with_vowel(word: str) -> bool:
    """母音(または二重母音)で終わるか。エリジョン済みなら False。"""
    w = word.rstrip("".join(STOPS) + ")]}»\"")
    if not w:
        return False
    if w[-1] in APOS:
        return False  # エリジョン済み。衝突を避けた形なので数えない
    last = _strip_marks(w[-1])
    return last in VOWELS


def starts_with_vowel(word: str) -> bool:
    w = word.lstrip("([{«\"" + "".join(APOS))
    if not w:
        return False
    return _strip_marks(w[0]) in VOWELS


def ends_sentence(word: str) -> bool:
    w = word.rstrip(")]}»\"" + "".join(APOS))
    return bool(w) and w[-1] in STOPS


def hiatus_stats(tokens: list[str]) -> dict:
    """隣り合う語の組を数え、衝突の割合を出す。

    分母は「文の中で隣り合い、前が母音で終わる組」。
    **前が母音で終わらない組を分母に入れない**のが要点で、
    そうしないと「母音で終わる語が多い篇ほど衝突が多い」だけの数になる。
    """
    pairs = 0          # 文の中で隣り合う組
    vowel_end = 0      # うち前が母音終わり
    hiatus = 0         # うち次が母音始まり
    elided = 0         # エリジョン済みの語(避けた形)
    for a, b in zip(tokens, tokens[1:]):
        aw = a.rstrip(")]}»\"")
        if aw and aw[-1] in APOS:
            elided += 1
        if ends_sentence(a):
            continue
        pairs += 1
        if not ends_with_vowel(a):
            continue
        vowel_end += 1
        if starts_with_vowel(b):
            hiatus += 1
    return {
        "pairs": pairs,
        "vowel_end": vowel_end,
        "hiatus": hiatus,
        "elided": elided,
        # 母音で終わった組のうち、実際に衝突した割合
        "hiatus_rate": hiatus / vowel_end if vowel_end else 0.0,
        # 千語あたりの衝突数(別の見方)
        "per_1k": hiatus * 1000 / len(tokens) if tokens else 0.0,
    }


#: 主題に引きずられにくい小辞。文体計量で伝統的に使われる類
PARTICLES = {
    "kathaper": "καθαπερ",   # καθάπερ(〜のように) 後期で増えるとされる
    "hosper": "ωσπερ",       # ὥσπερ(同義。前期で多いとされる)
    "toinyn": "τοινυν",
    "mentoi": "μεντοι",
    "alla": "αλλα",
    "kai_men": "καιμην",
}


def fold(text: str) -> str:
    d = unicodedata.normalize("NFD", text)
    d = "".join(c for c in d if not unicodedata.combining(c))
    return unicodedata.normalize("NFC", d).lower().replace("ς", "σ")


_WORD_STRIP = ".,;·:!?()[]{}«»‘’ʼ᾽'\"…"


def particle_stats(tokens: list[str]) -> dict[str, int]:
    bare = [fold(t.strip(_WORD_STRIP)) for t in tokens]
    out = {k: 0 for k in PARTICLES}
    for i, w in enumerate(bare):
        for k, form in PARTICLES.items():
            if k == "kai_men":
                if w == "καὶ" or w == "και":
                    nxt = bare[i + 1] if i + 1 < len(bare) else ""
                    if nxt == "μην":
                        out[k] += 1
                continue
            if w == form:
                out[k] += 1
    return out
