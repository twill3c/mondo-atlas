"""主要語の照合(SPEC F-06)。

## 語の切り方

- ダッシュ結合(`ἀρετήν—ὥσπερ`)と、**空白が落ちて潰れた語**(`ἰδέαν;ναί.εἶτα`)を割る。
  潰れた語は全集で 394 件(0.07%)。放っておくと採否の判断を汚す(実測 2026-09-02)
- 照合はアクセントを畳んで行う。**ただし畳みは情報を捨てる** ——
  `η` は ἢ / ἡ / ἦ / ᾖ を、`νομοσ` は νόμος(法)と νομός(牧草地)を同じにする。
  だから台帳は畳み形だけでなく**表層の除外**も持つ

## 台帳が主で、コードは従

採る語形は `data/curated/word-ledger.json` に人が書いてある。このモジュールは
その台帳を当てるだけで、語形を推測しない。台帳の検算は etl/audit_words.py。
"""

from __future__ import annotations

import json
import os
import re
import unicodedata

SPLIT = re.compile(r"[\s—–\-]+")
#: 語の内側の句読点(後ろがギリシャ文字なら空白の落ちた継ぎ目)
INNER_PUNCT = re.compile(r"(?<=[Ͱ-Ͽἀ-῿])[.,;·:;]+(?=[Ͱ-Ͽἀ-῿])")
STRIP = ".,;·:!?()[]{}«»‘’ʼ'\"·;…"


def fold(text: str) -> str:
    d = unicodedata.normalize("NFD", text)
    d = "".join(c for c in d if not unicodedata.combining(c))
    return unicodedata.normalize("NFC", d).lower().replace("ς", "σ")


def words(text: str) -> list[str]:
    """本文を語に切る。ダッシュ結合と、空白の落ちた継ぎ目を割る。"""
    out: list[str] = []
    for chunk in SPLIT.split(text):
        for piece in INNER_PUNCT.split(chunk):
            w = piece.strip(STRIP)
            if w:
                out.append(w)
    return out


def load_ledger(path: str) -> list[dict]:
    doc = json.load(open(path, encoding="utf-8"))
    for t in doc["terms"]:
        t["_forms"] = set(t["forms"])
        t["_exclude"] = set(t["exclude_surfaces"])
    return doc["terms"]


def match(term: dict, surface: str) -> bool:
    """この表層はこの見出し語の形か。台帳の判断をそのまま当てる。"""
    if surface in term["_exclude"]:
        return False
    return fold(surface) in term["_forms"]


def count_in(terms: list[dict], text: str) -> dict[str, int]:
    """本文中の各見出し語の出現数。"""
    out = {t["key"]: 0 for t in terms}
    for w in words(text):
        for t in terms:
            if match(t, w):
                out[t["key"]] += 1
                break
    return out


DEFAULT_LEDGER = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "data", "curated", "word-ledger.json")
