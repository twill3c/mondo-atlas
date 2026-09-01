"""L0 stage2 調査その2: said と label の関係、および label を持たない篇の said の正体。

cue_survey.py で「多くの篇で said == label が厳密に成り立つ」ように見えた。
本当に厳密なのか、例外は何かを確かめる。例外(リュシス・パルメニデス)は
label=0 なのに said が多い —— その said が何に付いているのかを実物で見る。
"""

import glob
import json
import os
import xml.etree.ElementTree as ET

NS = {"t": "http://www.tei-c.org/ns/1.0"}


def main(base):
    meta = {os.path.basename(r["id"]): r
            for r in json.load(open(os.path.join(base, "survey.json"), encoding="utf-8"))}
    cues = json.load(open(os.path.join(base, "cues.json"), encoding="utf-8"))

    eq, neq = [], []
    for wid, c in cues.items():
        (eq if c["said"] == c["label"] else neq).append((wid, c))

    print("said == label が厳密に成立: {} / {} 篇".format(len(eq), len(cues)))
    print("\n例外 {} 篇:".format(len(neq)))
    print("{:22}{:>7}{:>7}{:>8}".format("篇", "said", "label", "叙述動詞計"))
    for wid, c in sorted(neq, key=lambda x: -x[1]["said"]):
        narr = c["hen_d_ego"] + c["he_d_hos"] + c["ephe"] + c["ephen"] + c["eipon"]
        print("{:22}{:>7}{:>7}{:>8}".format(c["title"][:21], c["said"], c["label"], narr))

    # label を持たないのに said がある篇で、said の中身を実際に見る
    for wid in ("tlg020", "tlg009"):
        path = os.path.join(base, "grc", wid + ".xml")
        root = ET.parse(path).getroot()
        body = root.find(".//t:text/t:body", NS)
        saids = body.findall(".//t:said", NS)
        print("\n=== {} ({}) said {} 件 先頭 6 件 ===".format(
            wid, cues[wid]["title"], len(saids)))
        for s in saids[:6]:
            txt = " ".join("".join(s.itertext()).split())
            print("  who={:14} | {}".format(s.get("who", "-"), txt[:90]))
    return eq, neq


if __name__ == "__main__":
    import sys
    main(sys.argv[1])
