/**
 * 和訳(解題と頁ごとの要旨)の検査(TEST_SPEC T-601〜T-610)。
 *
 * ここでいちばん大事なのは **「書いていない」を「該当なし」に見せない**ことである(HC-119)。
 * 充填率は分子と分母を持ち、要旨の無い頁は空欄として扱われることを固定する。
 */

import { describe, expect, it } from "vitest";
import ja from "../data/japanese.json";
import kaidaiSrc from "../data/curated/kaidai.json";
import {
  type JapaneseWork,
  byTetralogy,
  coverage,
  fillState,
  summarizedPages,
  withSummaries,
} from "../lib/japanese";

const works = ja.works as unknown as JapaneseWork[];

describe("解題(第一層)", () => {
  it("T-601 全 36 篇に解題があり、空でない", () => {
    expect(works).toHaveLength(36);
    for (const w of works) {
      expect(w.kaidai.length, w.abbr).toBeGreaterThan(80);
    }
  });

  it("T-602 解題の本文に算用数字が無い(数は画面がデータから出す)", () => {
    // G-07 を散文に適用する。本文に数を書くと、データが動いたとき文だけが古くなる
    for (const w of works) {
      expect(/[0-9０-９]/.test(w.kaidai), `${w.abbr}: ${w.kaidai.slice(0, 40)}`).toBe(false);
    }
  });

  it("T-603 解題に別字種(キリル・ハングル)が混ざっていない", () => {
    // このセッションで四度踏んだ。data/ は字種検査の既定除外なので、ここで見る
    for (const w of works) {
      expect(/[Ѐ-ӿ가-힯ᄀ-ᇿ]/.test(w.kaidai), w.abbr).toBe(false); // text-hygiene:allow
    }
  });

  it("T-604 解題は台帳と一致する(コードが文を作っていない)", () => {
    const src = new Map(kaidaiSrc.works.map((w) => [w.abbr, w.kaidai]));
    for (const w of works) {
      expect(w.kaidai, w.abbr).toBe(src.get(w.abbr));
    }
  });
});

describe("頁ごとの要旨(第二層)", () => {
  it("T-605 要旨の頁はその篇に実在する", () => {
    for (const w of works) {
      const real = new Set(w.pages);
      for (const p of Object.keys(w.summaries)) {
        expect(real.has(Number(p)), `${w.abbr} ${p}`).toBe(true);
      }
    }
  });

  it("T-606 充填率は分子と分母から導ける", () => {
    const done = works.reduce((a, w) => a + w.nSummaries, 0);
    const total = works.reduce((a, w) => a + w.nPages, 0);
    expect(ja.totalSummaries).toBe(done);
    expect(ja.totalPages).toBe(total);
    expect(ja.coverage).toBeCloseTo(coverage(done, total), 4);
    // 実測(2026-09-02): 全集は 1,752 頁
    expect(total).toBe(1752);
  });

  it("T-607 裁判三部は全頁が埋まっている(実測 2026-09-02)", () => {
    for (const abbr of ["Euthphr", "Ap", "Crit"]) {
      const w = works.find((x) => x.abbr === abbr)!;
      expect(w.nSummaries, abbr).toBe(w.nPages);
      expect(fillState(w)).toBe("full");
    }
  });

  it("T-608 まだ書いていない篇は空欄であって 0 ではない", () => {
    // 「書いていない」と「該当なし」を区別する(HC-119)
    const empty = works.filter((w) => w.nSummaries === 0);
    expect(empty.length).toBeGreaterThan(0);
    for (const w of empty) {
      expect(fillState(w)).toBe("none");
      expect(summarizedPages(w)).toEqual([]);
      // 頁そのものは存在する —— 頁が無いのではなく、要旨が無い
      expect(w.nPages).toBeGreaterThan(0);
    }
  });

  it("T-609 要旨のある頁は昇順で、本文が空でない", () => {
    for (const w of withSummaries(works)) {
      const rows = summarizedPages(w);
      expect(rows.length).toBe(w.nSummaries);
      const pages = rows.map((r) => r.page);
      expect(pages).toEqual([...pages].sort((a, b) => a - b));
      for (const r of rows) expect(r.text.length).toBeGreaterThan(10);
    }
  });
});

describe("並び", () => {
  it("T-610 四部作ごとに束ねると 9 群 × 4 篇", () => {
    const groups = byTetralogy(works);
    expect(groups).toHaveLength(9);
    for (const g of groups) expect(g.works).toHaveLength(4);
  });

  it("T-611 0 除算で NaN を出さない", () => {
    expect(coverage(0, 0)).toBe(0);
    expect(coverage(1, 2)).toBe(0.5);
  });
});

describe("第2層は篇ごとに全頁で入れる", () => {
  it("T-612 要旨を書いた篇は、その篇の全頁が埋まっている", () => {
    // **半端に埋めない。** 途中まで書いた篇があると、充填率だけが上がって
    // 「この篇は読める」と誤読される。篇の単位で入れて、入れたら全頁書く。
    // 実測 2026-09-04: エウテュプロン 15 / 弁明 26 / クリトン 12 / メノン 31 / 饗宴 52
    const started = works.filter((w) => w.nSummaries > 0);
    expect(started.length).toBeGreaterThan(0);
    for (const w of started) {
      expect(w.nSummaries, `${w.abbr} が途中までしか埋まっていない`).toBe(w.nPages);
    }
    // 対照: まだ書いていない篇は 0 のまま(全部埋まっていることにしない)
    const untouched = works.filter((w) => w.nSummaries === 0);
    expect(untouched.length).toBeGreaterThan(0);
    for (const w of untouched) {
      expect(w.nSummaries, w.abbr).toBe(0);
    }
    // 書いた篇と書いていない篇の両方があること自体を固定する ——
    // どちらか一方だけになると、上の二つの検査は片方が空回りする
    expect(started.length + untouched.length).toBe(works.length);
  });
});
