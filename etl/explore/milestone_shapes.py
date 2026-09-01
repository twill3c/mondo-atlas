"""正規化器を書く前に、Stephanus milestone の n の表記ゆれを全数で確かめる(HC-075)。

「たいてい 327a の形」で書くと、例外に当たったとき黙って違う結果を出す。
先に全域の形を数え、想定外があればその場で目に見えるようにする。
"""

import glob
import os
import re
import sys
from collections import Counter

import xml.etree.ElementTree as ET

T = "{http://www.tei-c.org/ns/1.0}"
NS = {"t": "http://www.tei-c.org/ns/1.0"}
CANON = re.compile(r"^\d+[a-e]$")


def shapes(root_dir, lang):
    forms = Counter()
    odd = []
    for path in sorted(glob.glob(os.path.join(root_dir, lang, "*.xml"))):
        wid = os.path.basename(path).replace(".xml", "")
        body = ET.parse(path).getroot().find(".//t:text/t:body", NS)
        for m in body.iter(T + "milestone"):
            if m.get("unit") != "section":
                continue
            n = m.get("n")
            if n is None:
                forms["<n 属性なし>"] += 1
                odd.append((wid, None))
                continue
            if CANON.match(n):
                forms["数字+a-e"] += 1
            else:
                forms["その他: " + repr(n)] += 1
                odd.append((wid, n))
    return forms, odd


def main(raw):
    for lang in ("grc", "eng"):
        forms, odd = shapes(raw, lang)
        print("=== {} ===".format(lang))
        for k, v in forms.most_common(12):
            print("  {:26} {}".format(k, v))
        print("  想定外 {} 件 {}".format(len(odd), odd[:12]))

        # resp 属性の分布も見る(Stephanus 以外の節付けが混ざっていないか)
        resps = Counter()
        for path in sorted(glob.glob(os.path.join(raw, lang, "*.xml"))):
            body = ET.parse(path).getroot().find(".//t:text/t:body", NS)
            for m in body.iter(T + "milestone"):
                if m.get("unit") == "section":
                    resps[m.get("resp")] += 1
        print("  resp: {}".format(dict(resps)))


if __name__ == "__main__":
    main(sys.argv[1])
