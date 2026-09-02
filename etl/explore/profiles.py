"""L3 stage2 続き: 篇内の形を見て、図が語れる本当の話を探す。

「『国家』第 1 巻だけが問答」という通説は巻ごとの集計に出なかった
(1 巻 24.5 に対し 7 巻 29.6)。では、篇の中で問答が途切れる箇所は実在するのか。
候補: ティマイオス(短い対話の後に長大な独白)、法律 5 巻、饗宴(各人の演説)。

**図を作る前に、図が示せる話を実測で選ぶ。**
"""

import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TURNS = os.path.join(ROOT, "data", "turns.json")


def profile(work, bins=40):
    """篇を等分して、区間ごとの千語あたり交替数を出す。"""
    secs = work["sections"]
    total = sum(s["tokens"] for s in secs)
    out = []
    step = total / bins
    acc_t = acc_k = 0
    edge = step
    start_id = secs[0]["id"] if secs else "-"
    for s in secs:
        acc_t += s["turns"]
        acc_k += s["tokens"]
        if acc_k >= edge or s is secs[-1]:
            out.append((start_id, s["id"], acc_t * 1000 / max(acc_k, 1)))
            acc_t = acc_k = 0
            edge = step
            start_id = s["id"]
    return out


def spark(vals, lo, hi, chars=" ▁▂▃▄▅▆▇█"):
    out = ""
    for v in vals:
        r = 0 if hi <= lo else (v - lo) / (hi - lo)
        out += chars[max(0, min(len(chars) - 1, int(r * (len(chars) - 1))))]
    return out


def main():
    doc = json.load(open(TURNS, encoding="utf-8"))
    works = {w["abbr"]: w for w in doc["works"]}

    for abbr in ("Ti", "Leg", "Rep", "Symp", "Phd", "Grg", "Prm", "Menex"):
        w = works[abbr]
        prof = profile(w)
        vals = [p[2] for p in prof]
        lo, hi = 0.0, max(vals) if vals else 1.0
        print("{:9} {:12} 最大 {:5.1f} 最小 {:5.1f}".format(
            abbr, w["title_ja"][:10], hi, min(vals)))
        print("   {}".format(spark(vals, lo, hi)))
        # いちばん低い区間がどこか
        k = min(range(len(prof)), key=lambda i: prof[i][2])
        print("   最も薄い区間: {} 〜 {} ({:.1f}/千語)".format(
            prof[k][0], prof[k][1], prof[k][2]))
        k2 = max(range(len(prof)), key=lambda i: prof[i][2])
        print("   最も濃い区間: {} 〜 {} ({:.1f}/千語)".format(
            prof[k2][0], prof[k2][1], prof[k2][2]))
        print()


if __name__ == "__main__":
    main()
