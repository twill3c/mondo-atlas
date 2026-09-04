"""Perseus のプラトン TEI を、ステファヌス節を単位とした構造に正規化する(F-01/F-02/F-03)。

## 位置の決め方

節の境界は `<milestone unit="section" n="327a"/>` である。**空要素**なので、
「その milestone から次の milestone の直前まで」がその節の本文になる。
div の入れ子ではなく**文書順の走査**で決める必要がある。

## 実測にもとづく判断(2026-09-02、全 72 ファイル走査)

- `resp="Stephanus"` で絞ってはならない。希 19 件・英 546 件の節 milestone が
  `resp` を持たない。**属性の有無で本物を判定すると静かに取りこぼす**
- `unit="section"` でも節でないものがある。`n="imbedded dialogue"`(テアイテトス)が
  希英に 1 件ずつ。節 ID の形(`数字 + a–e`)で判定し、**合わないものは捨てずに数える**
- 節 milestone の総数は 希 8,559 / 英 8,556
- **『書簡集』では節番号だけでは一意にならない。** 13 通の手紙の切れ目がステファヌス節の
  内側に落ちるため、同じ `310b` が第 1 書簡の末尾と第 2 書簡の冒頭に現れる(7 件)。
  節 ID に手紙番号を含める(`Ep.2.310b`)
- 境界 8,559 件のうち、前後どちらにも空白が無いのは **7 件**。いずれも語の途中ではなく
  空白の省略である。節を連結するときはこの 7 件だけ空白を入れない(`glue_prev`)

## 本文に含めないもの

- `<label>`: 印刷面の話者記号(`ΣΩ.` `ΚΡ.`)。**本文ではなく校訂者の印**であり、
  L2 の発話交替検出器に読ませてはならない(G-03 循環の禁止)。`sigla` に分離する
- `<head>`: 篇の見出し
- `<note>`: Loeb 版の訳者注。**英訳側だけに 4,394 件 113,710 語**あり、
  地の文の内側に置かれているので、そのまま連結すると訳文として並ぶ
- `<bibl>`: 引用元の指示(`Hom. Il. 9.363`)。**希英どちらにもある**

## 本文に**残す**もの(2026-09-04 に実測で裏づけた)

`<del>` `<add>` `<sic>` `<corr>` `<gap>` は本文に含める。
はじめは「OCT の紙面に現れるから」という**測っていない理由**で残していたので、
二重計上が起きていないかを確かめた —— `<choice>` は 0 件、`sic`/`corr` は対でなく、
`del`/`add` の隣接は 599 件中 1 件。どれも唯一の読みとして本文中に立つ。
**外さないが、件数と語数は `index.json` に出す**(希語 559,157 語のうち 991 語)。
装置を外すときに量を載せるのと同じ理由で、残すときも中身が読めるようにしておく。

## 装置を外すときの約束(HC-140)

**外した量は数えて `index.json` に載せる。** 黙って消すと、
「本文語数」が何を数えていないのかが読めなくなる(HC-119 と同じ型)。
また、外す前に**節の区切りが内側に隠れていないか**を確かめ、
隠れていれば例外で止める —— 落とすと節が消えるからである。
"""

from __future__ import annotations

import copy
import json
import os
import re
import unicodedata
import xml.etree.ElementTree as ET

NS = {"t": "http://www.tei-c.org/ns/1.0"}
T = "{http://www.tei-c.org/ns/1.0}"

SECTION_N = re.compile(r"^(\d+)([a-e])$")
GREEK_LETTER = re.compile(r"[Ͱ-Ͽἀ-῿]")

#: 本文に含めない要素(中身ごと除く)
#:
#: `note` は Loeb 版の**訳者注**である。英訳の本文に地の文として溶け込んで
#: 出てくるので、放っておくと「英訳」の語数にも本文にも混ざる。
#: 実測 4,394 件・113,710 語で、**英訳語数の 12.8%** がこれだった
#: (法律だけで 2,767 件)。希語側には 1 件も無い。
#: 落とすが、**落とした量は index.json に載せる**(黙って消さない)。
#:
#: `bibl` は引用元の指示(`Hom. Il. 9.363` / `Stasinus Cypria Fr. 20`)で、
#: これも地の文の内側に置かれている。**希語側にもある**(178 件 528 語)——
#: ラテン文字の近代的な出典表記が「ギリシャ語本文」に数えられていた。
#: 上流の取り込みが崩れて `ηομ. ιλ. 9.363` とギリシャ文字に化けたものもある。
#: `quote` の中身(引用された詩句そのもの)は本文なので残す。
NON_BODY = {T + "label", T + "head", T + "note", T + "bibl"}

#: 本文から外す「装置」。要素ごとに件数と語数を数えて index.json に載せる
APPARATUS = {T + "note": "note", T + "bibl": "bibl"}


def tokens(text: str) -> list[str]:
    """本文を比較可能なトークン列にする。空白で切るだけ。NFC に揃える。"""
    return unicodedata.normalize("NFC", text).split()


def _clean(text: str) -> str:
    return unicodedata.normalize("NFC", " ".join(text.split()))


# --------------------------------------------------------------------- 走査

def _iter_events(el):
    """body を文書順に走査し、(種類, 値) を吐く。

    種類: "boundary"(節)/ "book"(巻)/ "letter"(書簡)/ "siglum"(話者記号)/ "text"(本文)
    """
    if el.tag == T + "milestone":
        if el.get("unit") == "section":
            yield ("boundary", el.get("n"))
        if el.tail:
            yield ("text", el.tail)
        return

    if el.tag in NON_BODY:
        # 中身は本文に入れないが、話者記号は別枠で拾う。tail は本文である
        if el.tag == T + "label":
            sig = _clean("".join(el.itertext()))
            if sig:
                yield ("siglum", sig)
        if el.tag in APPARATUS:
            # **落とす前に、節の区切りが内側に隠れていないか確かめる。**
            # 上流実測(2026-09-03)では装置の中の milestone は
            # `unit="para"` の 2 件だけで、節の区切りは 1 件も無い。
            # 上流が変わってここに節の区切りが入ったら、黙って落ちるのではなく止まる。
            for ms in el.iter(T + "milestone"):
                if ms.get("unit") == "section":
                    raise ValueError(
                        "{} の内側に節の区切りがある(n={}): "
                        "落とすと節が消えるので、扱いを決め直すこと".format(
                            APPARATUS[el.tag], ms.get("n")))
            yield ("apparatus", (APPARATUS[el.tag], _clean("".join(el.itertext()))))
        if el.tail:
            yield ("text", el.tail)
        return

    if el.tag == T + "div":
        sub = el.get("subtype") or el.get("type")
        if sub == "book":
            yield ("book", el.get("n"))
        elif sub == "letter":
            yield ("letter", el.get("n"))

    if el.text:
        yield ("text", el.text)
    for child in el:
        yield from _iter_events(child)
    if el.tail:
        yield ("text", el.tail)


#: 本文に**残す**校訂の印。OCT の紙面に印刷されているので本文である。
#:
#: 2026-09-04 の実測で残す判断を裏づけた(L8 から五ループ持ち越していた宿題)——
#:   - `<choice>` は **0 件**。つまり「あれかこれか」の対立候補という構造を持たない
#:   - `sic`(21)と `corr`(2)は**対になっていない**。親はいずれも本文の要素
#:     (`said` / `l` / `q` / `quote`)で、それぞれが唯一の読みとして本文中に立つ
#:   - `del`(402)と `add`(197)が空白なしで隣接するのは **599 件中 1 件**だけ。
#:     置き換えの対として並んでいるわけではない
#: よって二重計上は起きない。OCT は削除提案を角括弧、補いを山括弧で**印刷する**ので、
#: 紙面を写すという方針(`<label>` を外し `<note>` を外したのと同じ基準)では本文に含める。
#: ただし**数は出す** —— 出さないと「本文語数」の中身が読めない。
KEPT_MARKS = ("del", "add", "sic", "corr", "gap")


def count_marks(body) -> dict:
    """本文に残した校訂の印を数える(件数と語数)。"""
    out: dict = {}
    for tag in KEPT_MARKS:
        els = list(body.iter(T + tag))
        if not els:
            continue
        out[tag] = {
            "n": len(els),
            "words": sum(len(tokens("".join(e.itertext()))) for e in els),
        }
    return out


def _sections_from_body(body, abbr: str) -> tuple[list[dict], dict]:
    secs: list[dict] = []
    cur: dict | None = None
    pre_text: list[str] = []
    skipped: list[str] = []
    appar: dict[str, list[str]] = {"note": [], "bibl": []}
    book = letter = None

    for kind, value in _iter_events(body):
        if kind == "book":
            book = value
        elif kind == "letter":
            letter = value
        elif kind == "boundary":
            m = SECTION_N.match(value or "")
            if not m:
                # 節ではない milestone(実測: テアイテトスの 'imbedded dialogue')。
                # 黙って捨てず記録する。本文の流れは切らない
                skipped.append(value)
                continue
            page, ltr = int(m.group(1)), m.group(2)
            sid = "{}.{}{}{}".format(
                abbr, (letter + ".") if letter else "", page, ltr)
            cur = {
                "id": sid,
                "page": page,
                "letter": ltr,
                "book": book,
                "epistle": letter,
                "_raw": [],
                "sigla": [],
                # 話者記号の位置(本文の何トークン目の直前に立っていたか)。
                # **本文には入れない** —— L2 の検出器はこの欄を読まない(G-03)。
                # 読むのは較正の側だけで、そこが答え合わせの正解になる。
                "_sig_char": [],
            }
            secs.append(cur)
        elif kind == "apparatus":
            # 本文には入れないが、**落とした量は数えて持ち帰る**
            what, txt = value
            if txt:
                appar[what].append(txt)
        elif kind == "siglum":
            if cur is not None:
                cur["sigla"].append(value)
                cur["_sig_char"].append(len("".join(cur["_raw"])))
        else:  # text
            (cur["_raw"] if cur is not None else pre_text).append(value)

    # 最初の節より前にある本文を捨てない(T-013b)。先頭の節に付ける
    preamble = "".join(pre_text)
    if preamble.strip() and secs:
        secs[0]["_raw"].insert(0, preamble.rstrip() + " ")

    prev_raw = ""
    shift = len(preamble.rstrip()) + 1 if (preamble.strip() and secs) else 0
    for i, s in enumerate(secs):
        raw = "".join(s.pop("_raw"))
        # 直前の節の末尾にも自分の先頭にも空白が無ければ、連結時に空白を入れない
        s["glue_prev"] = bool(
            prev_raw and raw
            and not prev_raw[-1:].isspace() and not raw[:1].isspace())
        s["grc"] = _clean(raw)
        # 文字位置 → トークン位置。先頭節は前置きの分だけずれる
        offs = s.pop("_sig_char")
        adj = shift if i == 0 else 0
        s["sigla_at"] = [len(tokens(raw[: c + adj])) for c in offs]
        prev_raw = raw

    info = {
        "skipped_milestones": skipped,
        "preamble_tokens": len(tokens(preamble)),
        # 本文から外した装置。**件数と語数を持ち帰る**ので、
        # 「本文語数」が何を数えていないかが index.json から読める
        "n_notes": len(appar["note"]),
        "note_words": sum(len(tokens(n)) for n in appar["note"]),
        "n_bibl": len(appar["bibl"]),
        "bibl_words": sum(len(tokens(n)) for n in appar["bibl"]),
        # 本文に**残した**校訂の印。外さないが、数は出せるようにする ——
        # そうしないと「本文語数」の中身が読めない(HC-140 の裏返し)
        "marks": count_marks(body),
    }
    return secs, info


def join_sections(sections, field: str = "grc") -> str:
    """節を本文の順に連結する。境界に空白が無かった 7 件だけは詰めて繋ぐ。"""
    parts: list[str] = []
    for i, s in enumerate(sections):
        if i and not s.get("glue_prev"):
            parts.append(" ")
        parts.append(s[field])
    return "".join(parts)


def sections_from_tei_string(tei: str, abbr: str) -> list[dict]:
    """合成 TEI から節を作る(単体検査用 — T-013)。"""
    body = ET.fromstring(tei).find(".//t:text/t:body", NS)
    secs, _ = _sections_from_body(body, abbr)
    return secs


def _body(path: str):
    return ET.parse(path).getroot().find(".//t:text/t:body", NS)


def body_tokens_direct(path: str) -> list[str]:
    """節に配る経路を通さずに、本文トークン列を直接取り出す(T-004 の照合相手)。

    節の走査(`_iter_events` の再帰)とは**別の経路**で作る —— 除きたい要素を
    木から取り除いてから `itertext()` で一括に読む。結論だけでなく経路を変える(HC-065)。
    """
    body = copy.deepcopy(_body(path))
    for parent in body.iter():
        for child in list(parent):
            if child.tag in NON_BODY:
                # tail は本文なので、取り除く前に親側へ退避する
                if child.tail:
                    prev = None
                    for c in parent:
                        if c is child:
                            break
                        prev = c
                    if prev is None:
                        parent.text = (parent.text or "") + child.tail
                    else:
                        prev.tail = (prev.tail or "") + child.tail
                parent.remove(child)
    return tokens("".join(body.itertext()))


# --------------------------------------------------------------------- 補正

def load_corrections(path: str) -> list[dict]:
    return json.load(open(path, encoding="utf-8"))["corrections"]


def apply_corrections(sections, work_id: str, corrections, log: list) -> None:
    """上流の誤植を派生データにだけ当てる。件数が合わなければ落とす(HC-075)。

    上流が直れば期待件数に届かず例外になる —— 黙って通る道を残さない。
    """
    for c in corrections:
        if c["work"] != work_id or c.get("lang", "grc") != "grc":
            continue
        hits = 0
        for s in sections:
            if c["find"] not in s["grc"]:
                continue
            if c.get("only_after_greek_letter"):
                # 語中(直前がギリシャ文字)のものだけを対象にする
                def repl(m):
                    nonlocal hits
                    hits += 1
                    return m.group(1) + c["replace"]
                s["grc"] = re.sub(
                    "(" + GREEK_LETTER.pattern + ")" + re.escape(c["find"]),
                    repl, s["grc"])
            else:
                hits += s["grc"].count(c["find"])
                s["grc"] = s["grc"].replace(c["find"], c["replace"])
        if hits != c["expected"]:
            raise ValueError(
                "補正 {} の適用件数が期待と違う(期待 {} / 実際 {})。"
                "上流が変わった可能性がある —— 補正表を見直すこと。".format(
                    c["id"], c["expected"], hits))
        log.append({"id": c["id"], "work": work_id, "applied": hits})


# ------------------------------------------------------------------- 組み立て

def build_corpus(raw_dir: str, curated_path: str,
                 corrections_path: str | None = None,
                 apply_fixes: bool = True) -> dict:
    """apply_fixes=False は**取りこぼし検査(T-004)専用**。

    補正は上流の誤植を直すので、当てると原本のトークン列と一致しなくなる。
    構文解析の正しさと補正の正しさは別々に検査する。
    """
    curated = json.load(open(curated_path, encoding="utf-8"))
    if corrections_path is None:
        corrections_path = os.path.join(
            os.path.dirname(curated_path), "corrections.json")
    corrections = load_corrections(corrections_path) if apply_fixes else []

    works = []
    applied: list = []

    for meta in curated["works"]:
        wid, abbr = meta["id"], meta["abbr"]

        grc_body = _body(os.path.join(raw_dir, "grc", wid + ".xml"))
        secs, info = _sections_from_body(grc_body, abbr)
        apply_corrections(secs, wid, corrections, applied)

        eng_secs, eng_info = _sections_from_body(
            _body(os.path.join(raw_dir, "eng", wid + ".xml")), abbr)
        eng_by_id = {s["id"]: s["grc"] for s in eng_secs if s["grc"]}

        for s in secs:
            s["eng"] = eng_by_id.get(s["id"], "")

        w = dict(meta)
        w.update({
            "sections": secs,
            "n_sections": len(secs),
            "n_pages": len({s["page"] for s in secs}),
            "words_grc": sum(len(tokens(s["grc"])) for s in secs),
            "words_eng": sum(len(tokens(s["eng"])) for s in secs),
            "n_sigla": sum(len(s["sigla"]) for s in secs),
            "books": sorted({s["book"] for s in secs if s["book"]},
                            key=lambda x: int(x)) or None,
            "epistles": sorted({s["epistle"] for s in secs if s["epistle"]},
                               key=lambda x: int(x)) or None,
            "eng_missing": [s["id"] for s in secs if not s["eng"]],
            "eng_extra": sorted(set(eng_by_id) - {s["id"] for s in secs}),
            "skipped_milestones": info["skipped_milestones"],
            "eng_skipped_milestones": eng_info["skipped_milestones"],
            # 本文から外した装置。訳者注(Loeb)は英訳側だけ、出典表記は両側にある
            "eng_notes": eng_info["n_notes"],
            "eng_note_words": eng_info["note_words"],
            "eng_bibl": eng_info["n_bibl"],
            "eng_bibl_words": eng_info["bibl_words"],
            "grc_notes": info["n_notes"],
            "grc_bibl": info["n_bibl"],
            "grc_bibl_words": info["bibl_words"],
            # 本文に残した校訂の印(外していない。数だけ出す)
            "grc_marks": info["marks"],
            "eng_marks": eng_info["marks"],
            "preamble_tokens": info["preamble_tokens"],
            "glued_boundaries": sum(1 for s in secs if s.get("glue_prev")),
        })
        works.append(w)

    return {"works": works, "corrections_applied": applied}


def write_corpus(corpus: dict, out_dir: str) -> dict:
    """作品ごとに 1 ファイル + 索引(N-03: 1 篇単位で読み込む)。"""
    works_dir = os.path.join(out_dir, "works")
    derived_dir = os.path.join(out_dir, "derived")
    os.makedirs(works_dir, exist_ok=True)
    os.makedirs(derived_dir, exist_ok=True)

    index = []
    for w in corpus["works"]:
        path = os.path.join(works_dir, w["abbr"] + ".json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(w, f, ensure_ascii=False, separators=(",", ":"))
        entry = {k: v for k, v in w.items() if k not in ("sections", "eng_missing")}
        entry["bytes"] = os.path.getsize(path)
        entry["n_eng_missing"] = len(w["eng_missing"])
        index.append(entry)

    with open(os.path.join(out_dir, "index.json"), "w", encoding="utf-8") as f:
        json.dump({"works": index}, f, ensure_ascii=False, indent=1)
    with open(os.path.join(derived_dir, "corrections-applied.json"),
              "w", encoding="utf-8") as f:
        json.dump(corpus["corrections_applied"], f, ensure_ascii=False, indent=1)
    return {"works": len(index)}


if __name__ == "__main__":
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    corpus = build_corpus(os.path.join(root, "raw", "perseus"),
                          os.path.join(root, "data", "curated", "works.json"))
    stats = write_corpus(corpus, os.path.join(root, "data"))

    tot_sec = sum(w["n_sections"] for w in corpus["works"])
    tot_w = sum(w["words_grc"] for w in corpus["works"])
    tot_e = sum(w["words_eng"] for w in corpus["works"])
    miss = sum(len(w["eng_missing"]) for w in corpus["works"])
    tot_note = sum(w["eng_note_words"] for w in corpus["works"])
    tot_note_n = sum(w["eng_notes"] for w in corpus["works"])
    grc_note_n = sum(w["grc_notes"] for w in corpus["works"])
    print("篇 {} / 節 {} / 希語 {} 語 / 英訳 {} 語 / 英訳の無い節 {}".format(
        stats["works"], tot_sec, tot_w, tot_e, miss))
    gb_n = sum(w["grc_bibl"] for w in corpus["works"])
    gb_w = sum(w["grc_bibl_words"] for w in corpus["works"])
    eb_n = sum(w["eng_bibl"] for w in corpus["works"])
    eb_w = sum(w["eng_bibl_words"] for w in corpus["works"])
    print("本文から外した訳者注: 英 {} 件 / {} 語(希 {} 件)".format(
        tot_note_n, tot_note, grc_note_n))
    print("本文から外した出典表記: 希 {} 件 / {} 語、英 {} 件 / {} 語".format(
        gb_n, gb_w, eb_n, eb_w))

    # 本文に**残した**校訂の印。外していないので語数には入っている
    marks = {}
    for w in corpus["works"]:
        for tag, v in w["grc_marks"].items():
            cur = marks.setdefault(tag, {"n": 0, "words": 0})
            cur["n"] += v["n"]
            cur["words"] += v["words"]
    if marks:
        parts = ["{} {} 件/{} 語".format(t, v["n"], v["words"]) for t, v in sorted(marks.items())]
        print("本文に残した校訂の印(希): " + " / ".join(parts))
        print("  → 上の希語 {} 語には、この {} 語が含まれる".format(
            tot_w, sum(v["words"] for v in marks.values())))
    print("補正の適用: {}".format(corpus["corrections_applied"]))
    for w in corpus["works"]:
        if w["eng_missing"] or w["eng_extra"] or w["skipped_milestones"]:
            print("  {:9} 英欠 {:3} / 英余 {:3} / 節でない milestone {}".format(
                w["abbr"], len(w["eng_missing"]), len(w["eng_extra"]),
                w["skipped_milestones"]))
