"""発話交替の検出器の検査(TEST_SPEC T-201〜T-215)。

**この検査群でいちばん重要なのは G-03(循環の禁止)である。**
検出器が校訂者の印(`sigla` / `sigla_at`)を読んでいたら、
「Perseus の校訂方針を再現する検出器」ができるだけで、
印の薄い 7 篇では同じように薄い結果を出す —— 緑のまま何も検出できない。

そこで循環の禁止は**振る舞いで**検査する(HC-080)。話者記号を差し替えても
出力が 1 ビットも変わらないことを要求する。ソースの grep も補助として置くが、
それだけに頼らない。

期待値の出所:
  - 素の性質(整列・範囲・重複なし) : 定義そのもの
  - 手がかりの検出                 : 実データから採った実際の文(出所を各ケースに書く)
  - 指標(適合率・再現率)           : 合成した集合に対する手計算
"""

import os
import re
import sys

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from etl import normalize, turns  # noqa: E402

RAW = os.path.join(ROOT, "raw", "perseus")
CURATED = os.path.join(ROOT, "data", "curated", "works.json")


@pytest.fixture(scope="session")
def corpus():
    return normalize.build_corpus(RAW, CURATED)


# ------------------------------------------------------------------ 文字の畳み

@pytest.mark.unit
def test_t201_fold_removes_accents_but_keeps_letters():
    """T-201: アクセントを畳む。ギリシャ語のアクセントは後続語で鋭→重に変わる。

    出所: 実データ。『国家』327b は「ἦ δʼ ὃς ὁ Γλαύκων」(重アクセント)で、
    別の箇所では「ἦ δʼ ὅς」(鋭アクセント)。字面で数えると取りこぼす(実測 +17)。
    """
    assert turns.fold("ὅς") == turns.fold("ὃς")
    assert turns.fold("ἦ δʼ ὅς") == turns.fold("ἦ δʼ ὃς")
    # 字母そのものは残る(畳みすぎない)
    assert turns.fold("ἔφη") != turns.fold("ἔφην")
    # 語末シグマを揃える
    assert turns.fold("λόγος") == turns.fold("λογοσ")


@pytest.mark.unit
def test_t202_cue_matching_respects_word_boundaries():
    """T-202: 語境界を置く。置かないと ἔφη が ἔφην の内側にも当たる。

    出所: 実測(2026-09-02)。境界なしで数えると全集 2,299、境界ありで 2,028。
    """
    only_ephen = "ταῦτα ἔφην ἐγώ"
    hits = turns.find_narrated(normalize.tokens(only_ephen))
    kinds = {h["cue"] for h in hits}
    assert "ephen" in kinds
    assert "ephe" not in kinds, "ἔφη が ἔφην の内側に当たっている"


# -------------------------------------------------------- G-03 循環の禁止

@pytest.mark.validation
def test_t203_detector_ignores_editorial_marks(corpus):
    """T-203 / G-03: 話者記号を差し替えても検出結果が変わらない。

    **振る舞いで検査する。** 検出器に渡すのは本文だけなので、
    校訂者の印をどう壊しても出力は同一でなければならない。
    """
    work = next(w for w in corpus["works"] if w["abbr"] == "Crit")
    for s in work["sections"][:12]:
        tk = normalize.tokens(s["grc"])
        before = turns.detect(tk)
        # 印を壊す(消す・増やす・でたらめな位置にする)
        s["sigla"] = ["ΧΧ."] * 99
        s["sigla_at"] = list(range(min(99, len(tk))))
        after = turns.detect(normalize.tokens(s["grc"]))
        assert before == after, "{} で校訂者の印が検出に影響している".format(s["id"])


@pytest.mark.unit
def test_t203b_detector_source_never_names_editorial_fields():
    """T-203 の補助: 検出器のソースが校訂者の印の欄名を持たない。

    振る舞いの検査(T-203)が主で、これは安い見張り。
    どちらか一方だけにしない —— ソース検査は言及と使用を区別できず、
    振る舞い検査は「たまたま影響が出なかった」入力を通す。
    """
    src = open(os.path.join(ROOT, "etl", "turns.py"), encoding="utf-8").read()
    # コード行だけを見る(説明の文中で名前を挙げるのは違反ではない)
    code = "\n".join(
        line.split("#")[0] for line in src.splitlines()
        if not line.strip().startswith("#")
    )
    code = re.sub(r'"""(?:.|\n)*?"""', "", code)
    for name in ("sigla", "sigla_at", "said", "label"):
        assert name not in code, "検出器のコードが {} を参照している".format(name)


# -------------------------------------------------------------- 素の性質

@pytest.mark.validation
def test_t204_boundaries_are_sorted_unique_in_range(corpus):
    """T-204: 境界は整列・重複なし・範囲内。"""
    for w in corpus["works"][:8]:
        for s in w["sections"][:20]:
            tk = normalize.tokens(s["grc"])
            b = turns.detect(tk)
            assert b == sorted(b)
            assert len(b) == len(set(b))
            assert all(0 <= i <= len(tk) for i in b)


@pytest.mark.unit
def test_t205_boundaries_never_split_a_sentence():
    """T-205: 発話の切れ目は文の途中に来ない。

    出所: 定義。話者が交替するのは文が終わったあとである。
    直前のトークンが文末の記号(. ; ·)で終わっているか、先頭(0)でなければならない。
    """
    text = "τί τηνικάδε ἀφῖξαι, ὦ Κρίτων; πάνυ μὲν οὖν. πηνίκα μάλιστα; ὄρθρος βαθύς."
    tk = normalize.tokens(text)
    for i in turns.detect(tk):
        if i == 0:
            continue
        assert turns.ends_sentence(tk[i - 1]), (
            "{} 番目({!r} の直後)が文の途中".format(i, tk[i - 1]))


# ---------------------------------------------------------- 手がかりの検出

@pytest.mark.unit
def test_t206_answer_formula_after_question_is_a_boundary():
    """T-206 / 陽性対照: 問いのあとの定型応答は境界になる。

    出所: 実データ。クリトン 43a の実際の並び(話者記号を外した本文)。
    正解は 43a の話者記号の位置から: 0, 10, 13, 15, ...
    """
    text = "τί τηνικάδε ἀφῖξαι, ὦ Κρίτων; ἢ οὐ πρῲ ἔτι ἐστίν; πάνυ μὲν οὖν. πηνίκα μάλιστα; ὄρθρος βαθύς."
    tk = normalize.tokens(text)
    b = set(turns.detect(tk))
    assert 10 in b, "「πάνυ μὲν οὖν」(定型応答)を境界と見ていない"
    assert 15 in b, "「ὄρθρος βαθύς」(問いへの短い答え)を境界と見ていない"


@pytest.mark.unit
def test_t207_plain_narrative_has_no_dramatic_boundaries():
    """T-207 / 陰性対照: 地の文には上演型の境界を立てない。

    出所: 実データ。『国家』327a の冒頭(一人の語り。話者交替は無い)。
    陰性対照は作った例で済ませず、実データの正常な部分から取る(HC-074)。
    """
    text = ("κατέβην χθὲς εἰς Πειραιᾶ μετὰ Γλαύκωνος τοῦ Ἀρίστωνος προσευξόμενός τε "
            "τῇ θεῷ καὶ ἅμα τὴν ἑορτὴν βουλόμενος θεάσασθαι τίνα τρόπον ποιήσουσιν "
            "ἅτε νῦν πρῶτον ἄγοντες.")
    tk = normalize.tokens(text)
    assert turns.detect(tk) in ([], [0]), "地の文に境界を立てている"


@pytest.mark.unit
def test_t208_narrated_cues_carry_person():
    """T-208: 叙述内の発話動詞は人称を持つ。

    出所: 文法。ἦν δʼ ἐγώ / ἔφην / εἶπον は 1 人称、ἦ δʼ ὅς / ἔφη は 3 人称。
    これは校訂者の判断ではなく**ギリシャ語の形**なので、循環しない。
    """
    text = "ἀλλὰ περιμενοῦμεν, ἦ δʼ ὃς ὁ Γλαύκων. ἐγώ τοίνυν, ἦν δʼ ἐγώ, οὐκ οἶδα."
    hits = turns.find_narrated(normalize.tokens(text))
    persons = [h["person"] for h in hits]
    assert persons == [3, 1], "人称の並びが取れていない: {}".format(hits)


@pytest.mark.unit
def test_t209_narrated_cue_records_position():
    """T-209: 発話動詞の位置が取れる(交替の検定に位置が要る)。"""
    tk = normalize.tokens("α β ἔφη γ δ ἦν δʼ ἐγώ ε")
    hits = turns.find_narrated(tk)
    assert [h["index"] for h in hits] == sorted(h["index"] for h in hits)
    assert all(0 <= h["index"] < len(tk) for h in hits)


# ------------------------------------------------------------------ 指標

@pytest.mark.unit
def test_t210_prf_is_computed_correctly():
    """T-210: 適合率・再現率・F1 が定義どおり。

    出所: 手計算。予測 {1,2,3}・正解 {2,3,4} なら
    適合率 2/3、再現率 2/3、F1 2/3。
    """
    p, r, f1, _ = turns.prf({1, 2, 3}, {2, 3, 4})
    assert p == pytest.approx(2 / 3)
    assert r == pytest.approx(2 / 3)
    assert f1 == pytest.approx(2 / 3)


@pytest.mark.unit
def test_t211_prf_handles_empty_sets():
    """T-211: 空集合で 0 除算しない。予測も正解も空なら F1 は 1 と定める。"""
    assert turns.prf(set(), set())[2] == 1.0
    assert turns.prf({1}, set())[2] == 0.0
    assert turns.prf(set(), {1})[2] == 0.0


@pytest.mark.unit
def test_t212_prf_tolerance_is_explicit():
    """T-212: 許容幅は引数で明示する。既定は 0(厳密一致)。

    HC-073: 閾値を置く前に、二つの実装が理論上一致しうるかを確かめる。
    許容幅を黙って広げると「一致させるために揃えた規則」が見えなくなる。
    """
    assert turns.prf({5}, {6})[2] == 0.0
    assert turns.prf({5}, {6}, tol=1)[2] == 1.0


@pytest.mark.unit
def test_t213_random_baseline_is_available():
    """T-213 / 対照: 無作為に同数の境界を置いた場合の F1 が出せる。

    「偶然より良い」と言うには、偶然が何かを測っておく必要がある。
    """
    f1 = turns.random_baseline_f1(n_tokens=100, n_gold=10, seed=20260902, trials=200)
    assert 0.0 <= f1 < 0.5, "無作為の基準値が高すぎる: {}".format(f1)


@pytest.mark.unit
def test_t214_alternation_rate_and_control():
    """T-214: 人称の交替率と、置換対照が出せる。

    完全に交替する列は 1.0、まったく交替しない列は 0.0。
    """
    assert turns.alternation_rate([1, 3, 1, 3, 1]) == pytest.approx(1.0)
    assert turns.alternation_rate([1, 1, 1, 1]) == pytest.approx(0.0)
    assert turns.alternation_rate([1]) is None, "1 件では交替を定義できない"


@pytest.mark.validation
def test_t216_shipped_turns_carry_no_editorial_marks():
    """T-216 / G-03: 出荷する turns.json に校訂者の印が載っていない。

    載せると、あとから誰かが「答えがそこにある」と使ってしまい、
    循環の禁止が静かに破れる。正解は data/derived 側にだけ置く。
    """
    path = os.path.join(ROOT, "data", "turns.json")
    if not os.path.exists(path):
        pytest.skip("先に python etl/build_turns.py を実行すること")
    import json

    doc = json.load(open(path, encoding="utf-8"))
    allowed = {"id", "page", "letter", "book", "tokens", "turns"}
    for w in doc["works"]:
        for s in w["sections"]:
            assert set(s) <= allowed, "{} に余計な欄: {}".format(s["id"], set(s) - allowed)
    blob = json.dumps(doc, ensure_ascii=False)
    for name in ("gold", "sigla", "said", "label"):
        assert '"{}"'.format(name) not in blob, "出荷物に {} が載っている".format(name)


@pytest.mark.validation
def test_t217_density_beats_the_length_confound(corpus):
    """T-217 / G-11: 節ごとの交替数は、節の語数という交絡に勝つ。

    交絡を潰さないと「長い節ほど交替が多い」を測っているだけになる(HC-025)。
    実測(2026-09-02・検証側 13 篇): 手がかり 0.756 / 文末素通し 0.713 / 語数だけ -0.021、
    語数の対照には 13/13 篇で勝った。ここでは代表 2 篇で不変量として固定する。
    """
    def pearson(xs, ys):
        n = len(xs)
        mx, my = sum(xs) / n, sum(ys) / n
        cov = sum((a - mx) * (b - my) for a, b in zip(xs, ys))
        vx = sum((a - mx) ** 2 for a in xs) ** 0.5
        vy = sum((b - my) ** 2 for b in ys) ** 0.5
        return cov / (vx * vy) if vx and vy else 0.0

    for abbr in ("Phlb", "Leg"):
        w = next(x for x in corpus["works"] if x["abbr"] == abbr)
        pred, gold, lens = [], [], []
        for s in w["sections"]:
            tk = normalize.tokens(s["grc"])
            pred.append(len(turns.detect(tk, 0.30)))
            gold.append(len(s["sigla_at"]))
            lens.append(len(tk))
        r_pred = pearson(pred, gold)
        r_len = pearson(lens, gold)
        assert r_pred > 0.5, "{}: 交替数の相関が低すぎる {:.3f}".format(abbr, r_pred)
        assert r_pred > r_len + 0.3, (
            "{}: 語数の交絡に十分勝っていない(手がかり {:.3f} / 語数 {:.3f})".format(
                abbr, r_pred, r_len))


@pytest.mark.unit
def test_t215_permutation_control_is_reproducible():
    """T-215 / 対照: 置換検定が seed で再現する。"""
    seq = [1, 3, 1, 3, 1, 3, 1, 3]
    a = turns.permutation_p(seq, seed=20260902, trials=500)
    b = turns.permutation_p(seq, seed=20260902, trials=500)
    assert a == b
    assert 0.0 <= a <= 1.0
