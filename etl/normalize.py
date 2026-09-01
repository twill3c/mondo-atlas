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

`<del>`(校訂者が削除を提案した箇所)と `<add>` は OCT の紙面に現れるので本文に含める。
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
NON_BODY = {T + "label", T + "head"}


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


def _sections_from_body(body, abbr: str) -> tuple[list[dict], dict]:
    secs: list[dict] = []
    cur: dict | None = None
    pre_text: list[str] = []
    skipped: list[str] = []
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
            }
            secs.append(cur)
        elif kind == "siglum":
            if cur is not None:
                cur["sigla"].append(value)
        else:  # text
            (cur["_raw"] if cur is not None else pre_text).append(value)

    # 最初の節より前にある本文を捨てない(T-013b)。先頭の節に付ける
    preamble = "".join(pre_text)
    if preamble.strip() and secs:
        secs[0]["_raw"].insert(0, preamble.rstrip() + " ")

    prev_raw = ""
    for s in secs:
        raw = "".join(s.pop("_raw"))
        # 直前の節の末尾にも自分の先頭にも空白が無ければ、連結時に空白を入れない
        s["glue_prev"] = bool(
            prev_raw and raw
            and not prev_raw[-1:].isspace() and not raw[:1].isspace())
        s["grc"] = _clean(raw)
        prev_raw = raw

    info = {"skipped_milestones": skipped, "preamble_tokens": len(tokens(preamble))}
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
    print("篇 {} / 節 {} / 希語 {} 語 / 英訳 {} 語 / 英訳の無い節 {}".format(
        stats["works"], tot_sec, tot_w, tot_e, miss))
    print("補正の適用: {}".format(corpus["corrections_applied"]))
    for w in corpus["works"]:
        if w["eng_missing"] or w["eng_extra"] or w["skipped_milestones"]:
            print("  {:9} 英欠 {:3} / 英余 {:3} / 節でない milestone {}".format(
                w["abbr"], len(w["eng_missing"]), len(w["eng_extra"]),
                w["skipped_milestones"]))
