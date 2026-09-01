"""L0 stage2 調査: 話者の手がかりが篇ごとにどう分布するかを実測する。

目的は F-05a(自前の発話交替検出器)が成り立つかを、書く前に確かめること。
Perseus の <said who> は篇ごとに方針が違う(SPEC「実測で壊れた前提」)。
印刷面由来の <label>(ΣΩ. など)と、叙述内の発話動詞(ἦν δʼ ἐγώ 等)が
その穴を埋められるかを見る。

注意: Perseus のエリジョンは U+02BC MODIFIER LETTER APOSTROPHE(ʼ)である。
ASCII のアポストロフィで書くと一件も当たらない。
"""

import glob
import json
import os
import re
import unicodedata
import xml.etree.ElementTree as ET

NS = {"t": "http://www.tei-c.org/ns/1.0"}

# エリジョン記号は資料により揺れるので three-way で受ける
APOS = "[ʼ’']"

CUES = {
    "hen_d_ego": re.compile("ἦν\\s+δ" + APOS + "\\s*ἐγώ"),   # 「と私は言った」1人称
    "he_d_hos": re.compile("ἦ\\s+δ" + APOS + "\\s*ὅς"),      # 「と彼は言った」3人称
    "ephe": re.compile("ἔφη"),                                # 彼は言った
    "ephen": re.compile("ἔφην"),                              # 私は言った
    "eipon": re.compile("εἶπον"),
}


def survey(grc_dir, meta_path, out_path):
    meta_rows = json.load(open(meta_path, encoding="utf-8"))
    meta = {os.path.basename(r["id"]): r for r in meta_rows}

    out = {}
    header = ("篇", "said", "label", "ἦνδʼἐγώ", "ἦδʼὅς", "ἔφη", "ἔφην", "εἶπον", "語数")
    print("{:22}{:>6}{:>7}{:>10}{:>8}{:>6}{:>6}{:>7}{:>8}".format(*header))

    for path in sorted(glob.glob(os.path.join(grc_dir, "*.xml"))):
        wid = os.path.basename(path).replace(".xml", "")
        root = ET.parse(path).getroot()
        body = root.find(".//t:text/t:body", NS)
        labels = body.findall(".//t:label", NS)
        text = unicodedata.normalize("NFC", " ".join(body.itertext()))
        counts = {k: len(v.findall(text)) for k, v in CUES.items()}
        m = meta[wid]
        out[wid] = dict(title=m["title"], said=m["said"], label=len(labels),
                        words=m["words"], **counts)
        print("{:22}{:>6}{:>7}{:>10}{:>8}{:>6}{:>6}{:>7}{:>8}".format(
            m["title"][:21], m["said"], len(labels),
            counts["hen_d_ego"], counts["he_d_hos"], counts["ephe"],
            counts["ephen"], counts["eipon"], m["words"]))

    json.dump(out, open(out_path, "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    return out


if __name__ == "__main__":
    import sys
    base = sys.argv[1]
    survey(os.path.join(base, "grc"),
           os.path.join(base, "survey.json"),
           os.path.join(base, "cues.json"))
