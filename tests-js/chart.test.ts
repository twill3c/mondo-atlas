/**
 * 画面①の幾何と並びの検査(TEST_SPEC T-101〜T-110)。
 *
 * 期待値の出所:
 *   - 並び・群の構成 : SPEC F-03(四部作 9 群 x 4 篇)。Python 側 test_tetralogy_structure と対
 *   - 目盛り         : 目盛り値の性質(単調・0 始まり・max を覆う)。定数で書かない
 *   - 帯の長さ       : 軸上限に対する割合という定義そのもの
 *
 * 図に添える文字は図と同じデータから導く(G-07)。ここでは
 * 「目盛りの配列がひとつしかない」「凡例は図に出ている作品から数える」を固定する。
 */

import { describe, expect, it } from "vitest";
import index from "../data/index.json";
import {
  AUTHENTICITIES,
  type Work,
  axisMax,
  axisTicks,
  barPercent,
  groupByTetralogy,
  legendCounts,
  niceStep,
  sortWorks,
} from "../lib/chart";

const works = index.works as unknown as Work[];

describe("実データの前提", () => {
  it("T-101 36 篇が揃い、四部作は 9 群 x 4 篇", () => {
    expect(works).toHaveLength(36);
    const groups = groupByTetralogy(sortWorks(works, "canonical", "n_pages"));
    expect(groups).toHaveLength(9);
    for (const g of groups) expect(g.works).toHaveLength(4);
  });

  it("T-102 図が使う数値がすべて有限の非負", () => {
    for (const w of works) {
      for (const k of ["n_pages", "n_sections", "words_grc", "words_eng"] as const) {
        expect(Number.isFinite(w[k]), `${w.abbr}.${k}`).toBe(true);
        expect(w[k], `${w.abbr}.${k}`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("T-103 真贋区分は定義済みの 3 種のみ", () => {
    for (const w of works) expect(AUTHENTICITIES).toContain(w.authenticity);
  });
});

describe("並び", () => {
  it("T-104 canonical は tlg 番号順で、四部作が連続する", () => {
    const sorted = sortWorks(works, "canonical", "n_pages");
    const ids = sorted.map((w) => w.id);
    expect(ids).toEqual([...ids].sort());
    // 四部作番号は非減少でなければ、群見出しが途中で復活してしまう
    const tet = sorted.map((w) => w.tetralogy);
    expect(tet).toEqual([...tet].sort((a, b) => a - b));
  });

  it("T-105 length は指標の降順で、同値でも安定する", () => {
    const sorted = sortWorks(works, "length", "n_pages");
    const v = sorted.map((w) => w.n_pages);
    for (let i = 1; i < v.length; i++) expect(v[i]).toBeLessThanOrEqual(v[i - 1]);
    // 同値の組が実在することを確かめてから安定性を主張する(HC-070)
    const ties = v.filter((x, i) => i > 0 && x === v[i - 1]).length;
    expect(ties, "同値が無いなら安定性の検査は何も言っていない").toBeGreaterThan(0);
    expect(sortWorks(works, "length", "n_pages").map((w) => w.id)).toEqual(
      sorted.map((w) => w.id),
    );
  });

  it("T-106 並べ替えても作品が増減しない", () => {
    for (const mode of ["canonical", "length"] as const) {
      const s = sortWorks(works, mode, "words_grc");
      expect(new Set(s.map((w) => w.id)).size).toBe(36);
    }
  });
});

describe("目盛りと帯", () => {
  it("T-107 目盛りは 0 から始まり、単調増加し、最大値を覆う", () => {
    for (const max of [1, 7, 26, 278, 327, 1355, 102743, 559618]) {
      const ticks = axisTicks(max);
      expect(ticks[0]).toBe(0);
      for (let i = 1; i < ticks.length; i++) expect(ticks[i]).toBeGreaterThan(ticks[i - 1]);
      expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(max);
    }
  });

  it("T-108 刻みは 1・2・5 × 10^n のいずれか", () => {
    for (const max of [3, 26, 327, 1355, 102743]) {
      const step = niceStep(max);
      const mant = step / Math.pow(10, Math.floor(Math.log10(step)));
      expect([1, 2, 5, 10]).toContain(Math.round(mant));
    }
  });

  it("T-109 帯は軸上限に対する割合で、0〜100 に収まる", () => {
    const max = Math.max(...works.map((w) => w.n_pages));
    for (const w of works) {
      const p = barPercent(w.n_pages, max);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(100);
    }
    // 最長の篇が軸を溢れないこと、かつ潰れていないこと
    expect(barPercent(max, max)).toBeLessThanOrEqual(100);
    expect(barPercent(max, max)).toBeGreaterThan(50);
    expect(barPercent(0, max)).toBe(0);
  });

  it("T-110 軸上限は目盛りの最後と一致する(格子とラベルの出所がひとつ)", () => {
    for (const max of [26, 327, 1355, 102743]) {
      const ticks = axisTicks(max);
      expect(axisMax(max)).toBe(ticks[ticks.length - 1]);
      // 目盛りの位置も同じ関数から出る = 格子とラベルがずれない
      const positions = ticks.map((t) => barPercent(t, max));
      expect(positions[0]).toBe(0);
      expect(positions[positions.length - 1]).toBeCloseTo(100, 10);
    }
  });
});

describe("凡例", () => {
  it("T-111 凡例は図に出ている作品から数える", () => {
    const counts = legendCounts(works);
    expect(counts.reduce((a, b) => a + b.count, 0)).toBe(36);
    // 部分集合を渡したら、その部分集合の数になる(定数で持っていない証拠)
    const only = works.filter((w) => w.authenticity === "偽作");
    const sub = legendCounts(only);
    expect(sub).toHaveLength(1);
    expect(sub[0].count).toBe(only.length);
  });
});
