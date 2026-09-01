"""発話交替を**本文だけから**検出する(SPEC F-05a)。

## なぜ自前で書くのか

Perseus の話者マークアップは、36 篇中 29 篇で印刷面の話者記号と件数が厳密に一致する。
つまり OCT の紙面に印刷された記号の写しであって、**紙に記号を印刷しない篇では使えない**。
『国家』は 88,000 語を超えながら記号が 0 件である(docs/L0-findings.md)。

## 循環の禁止(G-03)

このモジュールは**本文のトークン列しか受け取らない**。校訂者の付けた印は引数にも
グローバルにも現れない。印を入力にすると「校訂方針を再現する検出器」ができるだけで、
印の薄い篇では同じように薄い結果を出す —— テストは緑のまま、何も検出できない。

印は**書き終えたあとの答え合わせにだけ**使う(etl/calibrate_turns.py)。

## 二つの語り口

プラトンの対話篇は、話者交替の示し方が二系統に分かれる。

- **上演型**: 紙面の話者記号が交替を示す。本文の側の手がかりは
  「定型応答」「呼びかけ」「問いのあとの短い返し」
- **語り直し型**: 誰かが回想して語るので、交替は**叙述内の発話動詞**で示される。
  ἦν δʼ ἐγώ(と私は言った)/ ἦ δʼ ὅς(と彼は言った)/ ἔφη / ἔφην / εἶπον。
  これは校訂者の印ではなく**ギリシャ語の文そのもの**なので、循環しない

## 文字の畳み方

ギリシャ語のアクセントは後続の語によって鋭 → 重に変わる。**字面で照合してはならない。**
実測(2026-09-02)では、字面で数えると ἦ δʼ ὅς を全集で 17 件取りこぼした。
逆に語境界を置かないと ἔφη が ἔφην の内側に当たり、271 件を過大に数えた。
両方向に誤るので、畳んだうえで語境界を置く。
"""

from __future__ import annotations

import random
import re
import unicodedata

# ------------------------------------------------------------------ 文字の畳み

def fold(text: str) -> str:
    """照合用にアクセントと大文字小文字を畳み、語末シグマを揃える。"""
    d = unicodedata.normalize("NFD", text)
    d = "".join(c for c in d if not unicodedata.combining(c))
    return unicodedata.normalize("NFC", d).lower().replace("ς", "σ")


def _bare(token: str) -> str:
    """句読点を落とした素の語形。"""
    return fold(token).strip(".,;·:!?()[]—–·;’ʼ'\"")


#: 文末とみなす記号。ギリシャ語の疑問符は U+037E だが、Perseus は ASCII の ; を使う
SENTENCE_END = ".;·;…!?"


def ends_sentence(token: str) -> bool:
    """このトークンで文が終わっているか。"""
    t = token.rstrip("’ʼ'\")]}")
    return bool(t) and t[-1] in SENTENCE_END


def is_question(token: str) -> bool:
    t = token.rstrip("’ʼ'\")]}")
    return bool(t) and t[-1] in ";;?"


# -------------------------------------------------------- 語り直し型の手がかり

#: エリジョン記号の異形。Perseus は U+02BC を使うが、資料により揺れる
_APOS = "['’ʼ]"

#: 叙述内の発話動詞。値は人称(1 = 語り手自身 / 3 = 相手)
_NARRATED = [
    ("hen_d_ego", re.compile(r"^ην$"), 1, ("δ", "εγω")),   # ἦν δʼ ἐγώ
    ("he_d_hos", re.compile(r"^η$"), 3, ("δ", "οσ")),      # ἦ δʼ ὅς
]

#: 単独で立つ発話動詞。**語境界で照合する**(ἔφη が ἔφην に当たらないように)
_NARRATED_SINGLE = {
    "ephe": ("εφη", 3),
    "ephen": ("εφην", 1),
    "eipon": ("ειπον", 1),
    "eipe": ("ειπε", 3),
    "eipen": ("ειπεν", 3),
    "phanai": ("φαναι", 3),
}


def find_narrated(tokens: list[str]) -> list[dict]:
    """叙述内の発話動詞を、位置と人称つきで拾う。"""
    bare = [_bare(t) for t in tokens]
    out: list[dict] = []
    for i, b in enumerate(bare):
        # 二語・三語にまたがる形(ἦν δʼ ἐγώ / ἦ δʼ ὅς)
        matched = False
        for name, head, person, tail in _NARRATED:
            if not head.match(b):
                continue
            # 次の語が δ(エリジョン)で、その次が求める語であること
            nxt = bare[i + 1] if i + 1 < len(bare) else ""
            nxt2 = bare[i + 2] if i + 2 < len(bare) else ""
            if re.match(r"^δ$", nxt) and nxt2.startswith(tail[1]):
                out.append({"index": i, "cue": name, "person": person})
                matched = True
                break
        if matched:
            continue
        for name, (form, person) in _NARRATED_SINGLE.items():
            if b == form:
                out.append({"index": i, "cue": name, "person": person})
                break
    return out


# ------------------------------------------------------------ 上演型の手がかり

#: 定型応答。相手の発言を受けて返す短い決まり文句。
#: 出所は実データの観察(クリトン・エウテュプロン・ゴルギアスの本文)。
#: **網羅ではない** —— 網羅でないことは較正の再現率に現れる。
_REPLY_OPENERS = {
    "ναι", "εγωγε", "μαλιστα", "πανυ", "ορθωσ", "αληθη", "αναγκη", "δηλον",
    "εοικε", "εστι", "ουδαμωσ", "ουδαμη", "ουκουν", "αληθεστατα", "κομιδη",
    "σφοδρα", "βεβαιωσ", "παντωσ", "ουδεν", "τι", "πωσ", "ποιον", "ποιαν",
    "αρα", "ουκ", "ου", "ναιχι", "καλωσ", "ευ", "συμφημι", "ομολογω",
    "φαινεται", "δοκει", "συγχωρω", "αληθεσ",
}

#: 呼びかけ。ὦ + 名前。**誰に話しかけているか**は話者の交替を強く示す
_VOCATIVE = "ω"


def _vocative_at(bare: list[str], i: int, window: int = 6) -> bool:
    """i から window 語のうちに呼びかけ(ὦ + 名前)があるか。"""
    for j in range(i, min(i + window, len(bare) - 1)):
        if bare[j] == _VOCATIVE and bare[j + 1] and bare[j + 1][:1].isalpha():
            return True
    return False


def score_gaps(tokens: list[str]) -> dict[int, float]:
    """境界の候補と、その手がかりの強さ。

    候補になるのは**文が終わった直後**だけである。話者が交替するのは
    文が終わったあとだから(T-205)。
    """
    bare = [_bare(t) for t in tokens]
    scores: dict[int, float] = {}
    if tokens:
        scores[0] = 1.0  # 冒頭は必ず誰かの発話の始まり

    for i in range(1, len(tokens)):
        if not ends_sentence(tokens[i - 1]):
            continue
        s = 0.0
        # 直前が問いなら、次は答えである見込みが高い
        if is_question(tokens[i - 1]):
            s += 0.55
        # 定型応答で始まる
        if bare[i] in _REPLY_OPENERS:
            s += 0.5
        # 短い文が続く(問答は短い応酬になる)
        nxt_end = next((j for j in range(i, len(tokens)) if ends_sentence(tokens[j])), None)
        if nxt_end is not None and nxt_end - i <= 3:
            s += 0.3
        # 呼びかけがある
        if _vocative_at(bare, i):
            s += 0.35
        if s > 0:
            scores[i] = s
    return scores


#: 較正で決める閾値。既定値は etl/calibrate_turns.py の実測に合わせて更新する。
DEFAULT_THRESHOLD = 0.8


def detect(tokens: list[str], threshold: float | None = None) -> list[int]:
    """上演型の手がかりから境界を出す。"""
    th = DEFAULT_THRESHOLD if threshold is None else threshold
    return sorted(i for i, s in score_gaps(tokens).items() if s >= th)


def detect_every_sentence_end(tokens: list[str]) -> list[int]:
    """**対照**: 文の切れ目をすべて境界とする(手がかりを一切使わない)。

    点数付けがこれで代替されるなら、検出器は「文を切っているだけ」である(HC-064)。
    較正では必ずこれと比べる。
    """
    out = [0] if tokens else []
    out += [i for i in range(1, len(tokens)) if ends_sentence(tokens[i - 1])]
    return out


def detect_narrated(tokens: list[str]) -> list[int]:
    """語り直し型: 発話動詞の位置をそのまま交替の印として返す。"""
    return sorted({h["index"] for h in find_narrated(tokens)})


# ---------------------------------------------------------------------- 指標

def prf(pred: set[int], gold: set[int], tol: int = 0) -> tuple[float, float, float, int]:
    """適合率・再現率・F1・一致数。

    許容幅 tol は**明示する**。黙って広げると、一致させるために揃えた規則が見えなくなる。
    """
    if not pred and not gold:
        return 1.0, 1.0, 1.0, 0
    if not pred or not gold:
        return 0.0, 0.0, 0.0, 0

    remaining = sorted(gold)
    hit = 0
    for p in sorted(pred):
        for k, g in enumerate(remaining):
            if abs(p - g) <= tol:
                hit += 1
                remaining.pop(k)
                break
    precision = hit / len(pred)
    recall = hit / len(gold)
    f1 = 0.0 if precision + recall == 0 else 2 * precision * recall / (precision + recall)
    return precision, recall, f1, hit


def random_baseline_f1(n_tokens: int, n_gold: int, seed: int,
                       trials: int = 200, tol: int = 0) -> float:
    """同数の境界を無作為に置いたときの F1 の平均(偶然の水準)。"""
    if n_tokens <= 0 or n_gold <= 0:
        return 0.0
    rng = random.Random(seed)
    total = 0.0
    for _ in range(trials):
        gold = set(rng.sample(range(n_tokens), min(n_gold, n_tokens)))
        pred = set(rng.sample(range(n_tokens), min(n_gold, n_tokens)))
        total += prf(pred, gold, tol)[2]
    return total / trials


def alternation_rate(persons: list[int]) -> float | None:
    """隣り合う人称が入れ替わる割合。1 件以下では定義しない。"""
    if len(persons) < 2:
        return None
    swaps = sum(1 for a, b in zip(persons, persons[1:]) if a != b)
    return swaps / (len(persons) - 1)


def permutation_p(persons: list[int], seed: int, trials: int = 2000) -> float:
    """観測された交替率が、並びを無作為に入れ替えた場合より高いかの p 値。

    **対照が無ければ「交替している」とは言えない。** 1 人称と 3 人称の個数が
    偏っているだけでも交替率はある水準になるので、個数を保ったまま並びだけを崩す。
    """
    obs = alternation_rate(persons)
    if obs is None:
        return 1.0
    rng = random.Random(seed)
    seq = list(persons)
    ge = 0
    for _ in range(trials):
        rng.shuffle(seq)
        if alternation_rate(seq) >= obs:
            ge += 1
    return (ge + 1) / (trials + 1)
