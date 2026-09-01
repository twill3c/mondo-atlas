"""L0 の検査 — 正規化器 etl/normalize.py に対する TEST_SPEC T-001〜T-014。

期待値の出所(HC-016):
  - 節 ID・節の集合    : TEI の <milestone unit="section" resp="Stephanus"> (外部権威)
  - 希英の節対応       : 希側と英側の独立した milestone 集合を突き合わせる(二経路一致)
  - 本文トークンの保存 : 正規化前の TEI から直接取り出した列との一致(自己照合)
  - 四部作の構造       : 36 = 9 x 4 (トラシュロス。tlg 番号順が四部作順と一致するか検査する)

件数の定数は使わない。集合の一致・取りこぼしの不在で書く(HC-016)。

制御文字の検査は**正規表現を使わず符号位置の比較で書く**(HC-121)。
エスケープを書こうとして生の制御バイトを埋め込む事故が、このファイルで実際に起きた。
比較で書けばソースに制御文字が現れる余地が無い。
"""

import json
import os
import re
import sys
import unicodedata

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from etl import normalize  # noqa: E402

RAW = os.path.join(ROOT, "raw", "perseus")
CURATED = os.path.join(ROOT, "data", "curated", "works.json")

# 節 ID: <略号>.<頁><字>。書簡集だけは手紙番号が入る(<略号>.<手紙>.<頁><字>)。
# 手紙番号が要る理由は実測 —— 13 通の切れ目がステファヌス節の内側に落ち、
# 節番号だけでは 7 件が重複する(docs/L0-findings.md)。
SECTION_ID = re.compile(r"^[A-Za-z0-9]+\.(?:\d+\.)?\d+[a-e]$")

# 字形がギリシャ文字と紛らわしい字種(G-02)
CYRILLIC = re.compile(r"[Ѐ-ӿԀ-ԯ]")  # text-hygiene:allow

ALLOWED_CONTROL = {9, 10, 13}  # タブ・改行・復帰


def has_control(text):
    """制御文字を含むか。正規表現を使わないのは HC-121 のため。"""
    return any((ord(c) < 32 or ord(c) == 127) and ord(c) not in ALLOWED_CONTROL
               for c in text)


@pytest.fixture(scope="session")
def corpus():
    """全 36 篇を正規化した結果。実データに対する結合検査なので session で 1 回だけ作る。"""
    return normalize.build_corpus(RAW, CURATED)


@pytest.fixture(scope="session")
def corpus_raw():
    """補正を当てていない正規化結果。取りこぼし検査(T-004)はこちらで行う。"""
    return normalize.build_corpus(RAW, CURATED, apply_fixes=False)


@pytest.fixture(scope="session")
def all_sections(corpus):
    return [s for w in corpus["works"] for s in w["sections"]]


# ---------------------------------------------------------------- T-001..T-003

@pytest.mark.validation
def test_t001_section_ids_unique_across_corpus(all_sections):
    """T-001 / G-01: 節 ID は全集で一意。"""
    ids = [s["id"] for s in all_sections]
    assert len(ids) == len(set(ids)), "節 ID に重複がある"
    # 対象が空でないことを別に確かめる(空集合はどんな一意性検査も通す)
    assert len(ids) > 1000


@pytest.mark.validation
def test_t002_section_ids_monotonic_within_work(corpus):
    """T-002 / G-01: 節は篇内でステファヌス順(頁昇順、同頁内は a<b<c<d<e)に単調増加する。

    書簡集だけは手紙番号を先に見る。ステファヌス頁は 13 通を通して振られているが、
    手紙の切れ目が節の内側に落ちるため、同じ頁字が隣り合って 2 度現れる(実測 7 件)。
    """
    for w in corpus["works"]:
        key = [(int(s["epistle"] or 0), s["page"], s["letter"]) for s in w["sections"]]
        assert key == sorted(key), "{} の節が順不同".format(w["abbr"])
        assert len(key) == len(set(key)), "{} に同一節の重複".format(w["abbr"])


@pytest.mark.validation
def test_t003_section_id_format(all_sections):
    """T-003 / F-01: 節 ID は <略号>.<頁><字> の形。"""
    bad = [s["id"] for s in all_sections if not SECTION_ID.match(s["id"])]
    assert not bad, "形式に合わない節 ID: {}".format(bad[:20])


# ---------------------------------------------------------------------- T-004

@pytest.mark.validation
def test_t004_no_token_loss(corpus_raw):
    """T-004 / G-04: 正規化で本文語が落ちていない。

    TEI から直接取り出した本文トークン列と、節に配った本文を連結した列が
    完全に一致することを要求する。件数ではなく列そのものを比べる。

    連結は join_sections を使う —— 境界に空白が無かった 7 件(実測 2026-09-02)を
    空白で繋ぐと、そこだけ語が 2 つに割れて偽の不一致が出る。
    """
    for w in corpus_raw["works"]:
        expected = normalize.body_tokens_direct(
            os.path.join(RAW, "grc", w["id"] + ".xml"))
        got = normalize.tokens(normalize.join_sections(w["sections"]))
        if got != expected:
            first = next((i for i, (a, b) in enumerate(zip(expected, got)) if a != b),
                         min(len(expected), len(got)))
            raise AssertionError(
                "{}: 本文トークンが一致しない(直接 {} / 節経由 {})。"
                "最初の相違 index={} 期待={!r} 実際={!r}".format(
                    w["abbr"], len(expected), len(got), first,
                    expected[first:first + 5], got[first:first + 5]))


@pytest.mark.unit
def test_t012_token_loss_check_is_positive_controlled():
    """T-012 / 陽性対照: 1 語落とした列を T-004 の比較が確かに落とす。

    HC-041: 「違反 0 件」を主張する検査は、壊れていても同じ緑を返す。
    比較そのものが差を検出できることをここで固定する。
    """
    full = normalize.tokens("ἦν δʼ ἐγώ καὶ ὁ Γλαύκων")
    assert len(full) > 3, "対照の入力が短すぎて差を作れない"
    assert full[:-1] != full, "1 語落としても差が出ないなら T-004 は何も検査していない"


# ---------------------------------------------------------------- T-005..T-006

@pytest.mark.validation
def test_t005_no_cyrillic_or_control_in_greek(corpus):
    """T-005 / G-02: 希語本文にキリル文字・制御文字が無い。"""
    hits = [s["id"] for w in corpus["works"] for s in w["sections"]
            if CYRILLIC.search(s["grc"]) or has_control(s["grc"])]
    assert not hits, "字種違反: {}".format(hits[:20])


@pytest.mark.unit
def test_t011_hygiene_checks_are_positive_controlled():
    """T-011 / 陽性対照: 検査器が実際に撃つこと、正常系で撃たないこと。

    陰性対照は実データの正常な部分から取る(HC-074)。
    「ἦν δʼ ἐγώ」は実際に『国家』に 601 回現れる文字列(実測 2026-09-02)。
    """
    clean = "ἦν δʼ ἐγώ"
    assert not CYRILLIC.search(clean), "正常な希語本文でキリル文字を誤検出した"
    assert not has_control(clean), "正常な希語本文で制御文字を誤検出した"

    # U+043E CYRILLIC SMALL LETTER O。ギリシャ語の ο(U+03BF)と字形がほぼ同じ
    assert CYRILLIC.search("λ" + chr(0x043E) + "γος"), "キリル文字を検出できていない"
    # 生のバイトをソースに書かずに対照を作る(HC-121)
    assert has_control("α" + chr(0x0B) + "β"), "制御文字を検出できていない"


@pytest.mark.validation
def test_t006_text_is_nfc(corpus):
    """T-006 / G-02: 希語本文は NFC 正規化済み。

    合成済み文字と結合文字の混在は、見た目が同じまま検索・照合を静かに壊す。
    """
    bad = [s["id"] for w in corpus["works"] for s in w["sections"]
           if unicodedata.normalize("NFC", s["grc"]) != s["grc"]]
    assert not bad, "NFC でない節: {}".format(bad[:20])


# ---------------------------------------------------------------------- T-007

@pytest.mark.validation
def test_t007_speaker_sigla_not_in_body(corpus):
    """T-007 / F-01・G-03: 話者記号(ΣΩ. 等)が本文フィールドに混入しない。

    L2 の発話交替検出器は本文だけを入力にする(G-03 循環の禁止)。
    本文に話者記号が残っていると、検出器が校訂者の印を読んでしまう。

    部分文字列ではなく**独立したトークン**として見る。部分一致で見ると、
    正規の語形に含まれる綴りを話者記号と取り違える(実測: メノンの `ΜΕΝ.` は
    上流の誤植であって混入ではなかった —— 補正表 C-001 で別に扱う)。
    """
    leaked = []
    for w in corpus["works"]:
        for s in w["sections"]:
            body_tokens = set(normalize.tokens(s["grc"]))
            for sig in s.get("sigla", []):
                if sig and sig in body_tokens:
                    leaked.append((s["id"], sig))
    assert not leaked, "本文に話者記号が残っている: {}".format(leaked[:20])


@pytest.mark.validation
def test_t007b_sigla_are_actually_present_somewhere(corpus):
    """T-007 の対照: そもそも話者記号が 1 件も無ければ T-007 は自明に通る。

    上演型の篇では sigla が実在することを確かめ、検査が空振りしていないことを示す。
    実測(2026-09-02): 全集の <label> は 12,544 件。
    """
    total = sum(len(s.get("sigla", [])) for w in corpus["works"] for s in w["sections"])
    assert total > 1000, "sigla が抽出できていない(T-007 が空振りしている)"


# ---------------------------------------------------------------- T-015..T-016

@pytest.mark.validation
def test_t015_corrections_applied_and_upstream_defect_gone(corpus, corpus_raw):
    """T-015 / G-02: 上流の誤植に対する補正が当たっている。

    期待値の出所: 実測(2026-09-02)。メノンの `ΜΕΝ.` 213 件のうち 208 件は
    正当な <label>、5 件が語中の誤植。補正前に 5 件あり、補正後に 0 件であること。
    """
    def midword_hits(c):
        return sum(
            len(re.findall(r"[Ͱ-Ͽἀ-῿]ΜΕΝ\.", s["grc"]))
            for w in c["works"] if w["id"] == "tlg024" for s in w["sections"])

    assert midword_hits(corpus_raw) == 5, "補正前の誤植が実測(5 件)と違う"
    assert midword_hits(corpus) == 0, "補正が当たっていない"

    applied = {a["id"]: a["applied"] for a in corpus["corrections_applied"]}
    assert applied.get("C-001") == 5


@pytest.mark.validation
def test_t016_corrections_are_narrow(corpus, corpus_raw):
    """T-016 / 対照: 補正が広く効きすぎていないこと。

    補正は「確実に誤りだと言えるもの」に限る(corrections.json の方針)。
    補正の前後で、対象の篇以外の本文が 1 文字も変わらないことを確かめる。
    緩める側だけを用意すると、補正表は静かに校訂の道具になる。
    """
    raw_by_id = {w["id"]: w for w in corpus_raw["works"]}
    changed = []
    for w in corpus["works"]:
        r = raw_by_id[w["id"]]
        if normalize.join_sections(w["sections"]) != normalize.join_sections(r["sections"]):
            changed.append(w["id"])
    assert changed == ["tlg024"], "補正が当たった篇: {}(想定は tlg024 のみ)".format(changed)


# ---------------------------------------------------------------------- T-008

@pytest.mark.validation
def test_t008_greek_english_section_alignment(corpus):
    """T-008 / G-05: 希英の節 ID の対応を、欠落として明示的に記録している。

    一致を要求しない —— 一致しない篇があることを黙って捨てないことを要求する。
    期待値は「欠落が記録されていること」であり、特定の数ではない。
    """
    for w in corpus["works"]:
        assert "eng_missing" in w, "{}: 希英対応の欠落が記録されていない".format(w["abbr"])
        assert isinstance(w["eng_missing"], list)
        # 記録された欠落は、実際に英訳を持たない節でなければならない
        with_eng = {s["id"] for s in w["sections"] if s.get("eng")}
        bogus = [m for m in w["eng_missing"] if m in with_eng]
        assert not bogus, "{}: 欠落と記録した節に英訳がある: {}".format(w["abbr"], bogus[:5])


# ---------------------------------------------------------------- T-009..T-014

@pytest.mark.validation
def test_t009_metadata_complete(corpus):
    """T-009 / F-03: 全 36 篇にメタデータが揃う。"""
    required = ("title_grc", "title_ja", "abbr", "tetralogy", "authenticity", "narration")
    for w in corpus["works"]:
        for k in required:
            assert w.get(k) not in (None, ""), "{}: {} が空".format(w["id"], k)


@pytest.mark.validation
def test_t010_abbr_unique(corpus):
    """T-010 / F-03: 略号は全集で一意(節 ID の接頭辞になるため)。"""
    abbrs = [w["abbr"] for w in corpus["works"]]
    assert len(abbrs) == len(set(abbrs)), "略号の重複"


@pytest.mark.validation
def test_t014_authenticity_vocabulary(corpus):
    """T-014 / F-03: 真贋区分・語り区分は定義済みの語彙のみ。"""
    auth = {"真作", "疑作", "偽作"}
    narr = {"dramatic", "narrated", "mixed", "monologue", "epistolary"}
    for w in corpus["works"]:
        assert w["authenticity"] in auth, "{}: 未定義の真贋区分".format(w["id"])
        assert w["narration"] in narr, "{}: 未定義の語り区分".format(w["id"])


@pytest.mark.validation
def test_tetralogy_structure(corpus):
    """F-03: トラシュロスの四部作は 9 群 x 4 篇 = 36。

    期待値の出所: 四部作の配列(ディオゲネス・ラエルティオス III.56–62 に伝わる)。
    Perseus の tlg 番号がこの配列に従っていれば tetralogy = (n-1)//4 + 1 が成り立つ。
    成り立たなければ、台帳(data/curated/works.json)の側が誤っている。
    """
    works = corpus["works"]
    assert len(works) == 36
    for w in works:
        n = int(w["id"].replace("tlg", ""))
        assert w["tetralogy"] == (n - 1) // 4 + 1, (
            "{} の四部作番号が tlg 番号順と食い違う".format(w["id"]))
    groups = {}
    for w in works:
        groups.setdefault(w["tetralogy"], []).append(w)
    assert len(groups) == 9
    assert all(len(v) == 4 for v in groups.values())


# ---------------------------------------------------------------------- T-013

@pytest.mark.unit
def test_t013_section_boundary_attribution():
    """T-013 / F-01: 節に属する本文は、その milestone から次の milestone の直前まで。

    合成 TEI で境界の帰属だけを見る。実データでは境界の誤りが
    「どこかの節が少し長い/短い」という形になり、総語数では相殺されて見えない。
    """
    tei = (
        '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body>'
        '<div type="edition"><div type="textpart" subtype="section" n="17">'
        '<p><milestone unit="section" resp="Stephanus" n="17a"/>'
        "ΑΑΑ ΒΒΒ"
        '<milestone unit="section" resp="Stephanus" n="17b"/>'
        "ΓΓΓ"
        "</p></div></div></body></text></TEI>"
    )
    secs = normalize.sections_from_tei_string(tei, abbr="X")
    got = {s["id"]: normalize.tokens(s["grc"]) for s in secs}
    assert got == {"X.17a": ["ΑΑΑ", "ΒΒΒ"], "X.17b": ["ΓΓΓ"]}, got


@pytest.mark.unit
def test_t013b_text_before_first_milestone_is_not_dropped():
    """T-013 の対照: 最初の milestone より前にある本文を黙って捨てない。

    捨てると T-004(取りこぼし検査)が落ちるはずだが、
    「捨てた分だけ期待値も減る」実装にすると両方が緑になる。
    ここで境界の扱いを直接固定しておく。
    """
    tei = (
        '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body>'
        '<div type="edition"><div type="textpart" subtype="section" n="17">'
        "<p>ΠΡΟΛΟΓΟΣ"
        '<milestone unit="section" resp="Stephanus" n="17a"/>'
        "ΑΑΑ"
        "</p></div></div></body></text></TEI>"
    )
    secs = normalize.sections_from_tei_string(tei, abbr="X")
    joined = normalize.tokens(" ".join(s["grc"] for s in secs))
    assert "ΠΡΟΛΟΓΟΣ" in joined, "最初の節より前の本文が消えている"
