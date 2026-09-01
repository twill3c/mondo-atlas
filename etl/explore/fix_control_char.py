"""HARNESS_CHANGELOG.md HC-121 に混入した生の NUL を、エスケープ表記に置き換える。

置換対象が見つからなければ例外で落とす(AGENTS.md HC-042 の (a))。
置換後の該当行を出力して目視できるようにする(同 (b))。
制御文字が残っていないことを確認する(同 (c))。
"""

import sys

PATH = r"C:\_ClaudeCode\harness-kit\HARNESS_CHANGELOG.md"

NUL = "\u0000"
REPLACEMENT = "\\u0000"  # 文書に載せるのはエスケープの字面そのもの


def main():
    src = open(PATH, encoding="utf-8").read()
    if NUL not in src:
        raise SystemExit("置換対象(生の NUL)が見つからない — 既に直っているか、経路が違う")
    n = src.count(NUL)
    fixed = src.replace(NUL, REPLACEMENT)
    open(PATH, "w", encoding="utf-8", newline="").write(fixed)

    lines = fixed.splitlines()
    for i, line in enumerate(lines, 1):
        if REPLACEMENT in line:
            print("置換後 line {}:".format(i))
            print("  ...{}...".format(line[280:400]))

    残り = [(i, j, hex(ord(c)))
            for i, line in enumerate(lines, 1)
            for j, c in enumerate(line)
            if (ord(c) < 32 or ord(c) == 127) and ord(c) != 9]
    print("置換 {} 件 / 残存する制御文字 {} 件".format(n, len(残り)))
    if 残り:
        print(残り[:10])
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
