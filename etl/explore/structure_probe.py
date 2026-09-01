"""L0 stage2 調査その3: 正規化器を書く前に、構造の例外を実物で確かめる。

確かめること:
  A. 『国家』『法律』は book > section の二層。section の n は篇内で通しか、巻ごとに振り直しか
  B. 英訳側にステファヌス milestone が入っているか(F-02 の節対応が成り立つか)
  C. 『書簡集』の letter 構造
  D. 本文に混ざる非本文要素(note / del / add / head / label)の実態
"""

import os
import re
import sys
import xml.etree.ElementTree as ET
from collections import Counter

NS = {"t": "http://www.tei-c.org/ns/1.0"}
T = "{http://www.tei-c.org/ns/1.0}"


def body_of(path):
    return ET.parse(path).getroot().find(".//t:text/t:body", NS)


def probe_multibook(path, name):
    body = body_of(path)
    books = [d for d in body.iter(T + "div") if (d.get("subtype") or d.get("type")) == "book"]
    print("\n=== {} : book div {} 件 ===".format(name, len(books)))
    for b in books[:3]:
        secs = [d.get("n") for d in b.iter(T + "div")
                if d.get("subtype") == "section"]
        ms = [m.get("n") for m in b.iter(T + "milestone") if m.get("unit") == "section"]
        print("  book n={:4} section div n= {} .. {} ({} 件) / Stephanus {} .. {}".format(
            b.get("n"), secs[0] if secs else "-", secs[-1] if secs else "-",
            len(secs), ms[0] if ms else "-", ms[-1] if ms else "-"))
    allsec = [d.get("n") for d in body.iter(T + "div") if d.get("subtype") == "section"]
    print("  篇全体の section div n: {} 件 / 重複 {} 件".format(
        len(allsec), len(allsec) - len(set(allsec))))


def probe_english(path, name):
    body = body_of(path)
    ms = [m for m in body.iter(T + "milestone")]
    units = Counter(m.get("unit") for m in ms)
    secdivs = [d.get("n") for d in body.iter(T + "div") if d.get("subtype") == "section"]
    print("\n=== {} (英) ===".format(name))
    print("  milestone unit 内訳: {}".format(dict(units)))
    print("  section div: {} 件  先頭 {}".format(len(secdivs), secdivs[:6]))
    steph = [m.get("n") for m in ms if m.get("unit") == "section"]
    print("  Stephanus milestone: {} 件  先頭 {}".format(len(steph), steph[:6]))


def probe_elements(paths):
    print("\n=== 本文中の要素の実態(希・全篇集計) ===")
    c = Counter()
    for p in paths:
        body = body_of(p)
        for el in body.iter():
            c[el.tag.replace(T, "")] += 1
    for k, v in c.most_common(20):
        print("  {:12} {}".format(k, v))


if __name__ == "__main__":
    base = sys.argv[1]
    g = lambda w: os.path.join(base, "grc", w + ".xml")
    probe_multibook(g("tlg030"), "Πολιτεία(国家)")
    probe_multibook(g("tlg034"), "Νόμοι(法律)")
    for w, nm in (("tlg002", "Ἀπολογία"), ("tlg030", "Πολιτεία")):
        ep = os.path.join(base, "eng", w + ".xml")
        if os.path.exists(ep):
            probe_english(ep, nm)
    import glob
    probe_elements(sorted(glob.glob(os.path.join(base, "grc", "*.xml"))))
