/**
 * 画面④(文体の指紋)の検査(TEST_SPEC T-501〜T-511)。
 *
 * 期待値の出所:
 *   - 幾何      : 定義そのもの(範囲・目盛り・写像)
 *   - 相関      : 手計算できる合成データ
 *   - 予測の結果: **測る前に宣言した 4 つ**(loop_007 の loop_start に記録)
 *   - 実測      : 2026-09-02。実測日をケースに書く
 */

import { describe, expect, it } from "vitest";
import styleData from "../data/style.json";
import {
  type StyleWork,
  axisRange,
  byHiatus,
  lateRanks,
  pearson,
  pos,
  ticksFor,
} from "../lib/style";

const works = styleData.works as unknown as StyleWork[];

describe("配られるデータ", () => {
  it("T-501 36 篇あり、値が有限", () => {
    expect(works).toHaveLength(36);
    for (const w of works) {
      for (const v of [w.hiatus, w.share, w.hiatusPer1k, w.elidedPer1k]) {
        expect(Number.isFinite(v), w.abbr).toBe(true);
      }
      expect(w.hiatus).toBeGreaterThan(0);
      expect(w.share).toBeGreaterThanOrEqual(0);
      expect(w.share).toBeLessThanOrEqual(1);
    }
  });

  it("T-502 後期群は 6 篇で、通説どおりの顔ぶれ", () => {
    // 出所: 測る前に決めた群(SPEC F-07)。実測に合わせて動かさない
    const late = works.filter((w) => w.late).map((w) => w.abbr).sort();
    expect(late).toEqual(["Criti", "Leg", "Phlb", "Plt", "Sph", "Ti"]);
    expect(styleData.lateGroup).toEqual(late);
  });

  it("T-503 取り分の信頼性が件数から導かれている", () => {
    for (const w of works) {
      expect(w.shareReliable).toBe(w.kathaper + w.hosper >= styleData.minParticles);
    }
    // 実測(2026-09-02): 13 篇が 10 件未満
    expect(works.filter((w) => !w.shareReliable)).toHaveLength(13);
  });

  it("T-504 取り分は実数から導ける", () => {
    for (const w of works) {
      const n = w.kathaper + w.hosper;
      if (n === 0) continue;
      expect(w.share, w.abbr).toBeCloseTo(w.kathaper / n, 3);
    }
  });
});

describe("測る前に宣言した予測", () => {
  it("T-505 予測が 4 つ記録され、結果が付いている", () => {
    expect(styleData.predictions).toHaveLength(4);
    for (const p of styleData.predictions) {
      expect(p.text.length).toBeGreaterThan(10);
      expect(["成立", "不成立"]).toContain(p.result);
      expect(p.detail.length).toBeGreaterThan(3);
    }
  });

  it("T-506 予測 1: 後期群のヒアトゥス率が他より低い(実測 2026-09-02)", () => {
    const late = works.filter((w) => w.late).map((w) => w.hiatus);
    const rest = works.filter((w) => !w.late).map((w) => w.hiatus);
    const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    expect(mean(late)).toBeLessThan(mean(rest));
    // 分離は小さくない。効果量ではなく素の差で固定する
    expect(mean(rest) - mean(late)).toBeGreaterThan(0.1);
  });

  it("T-507 予測 2: ヒアトゥス率は篇の長さと相関しない", () => {
    const r = pearson(works.map((w) => w.tokens), works.map((w) => w.hiatus));
    expect(Math.abs(r)).toBeLessThan(0.3);
  });

  it("T-508 予測 3 の置換検定の結果が記録されている", () => {
    expect(styleData.pPermutation).toBeLessThan(0.01);
    expect(styleData.seed).toBe(20260902);
  });

  it("T-509 二つの軸は、後期群を除いても一致する", () => {
    // 群の分離が相関を作っているだけなら、除いた途端に消えるはず
    const rest = works.filter((w) => !w.late);
    const r = pearson(rest.map((w) => w.hiatus), rest.map((w) => w.share));
    expect(r).toBeLessThan(-0.5);
    expect(styleData.corr.withoutLate).toBeLessThan(-0.5);
  });
});

describe("幾何", () => {
  it("T-510 軸の範囲は値を覆い、目盛りは範囲に収まる", () => {
    const xs = works.map((w) => w.hiatus);
    const { min, max } = axisRange(xs);
    expect(min).toBeLessThan(Math.min(...xs));
    expect(max).toBeGreaterThan(Math.max(...xs));
    const ticks = ticksFor(min, max);
    expect(ticks.length).toBeGreaterThanOrEqual(2);
    for (const t of ticks) {
      expect(t).toBeGreaterThanOrEqual(min);
      expect(t).toBeLessThanOrEqual(max);
    }
    for (let i = 1; i < ticks.length; i++) expect(ticks[i]).toBeGreaterThan(ticks[i - 1]);
  });

  it("T-511 写像は 0..100 に収まり、順序を保つ", () => {
    const xs = works.map((w) => w.hiatus);
    const { min, max } = axisRange(xs);
    for (const v of xs) {
      const p = pos(v, min, max);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(100);
    }
    expect(pos(min, min, max)).toBe(0);
    expect(pos(max, min, max)).toBe(100);
    expect(pos(0.2, 0, 1)).toBeLessThan(pos(0.3, 0, 1));
  });

  it("T-512 相関は手計算と一致する", () => {
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 10);
    expect(pearson([1, 2, 3], [6, 4, 2])).toBeCloseTo(-1, 10);
    expect(pearson([1, 1, 1], [1, 2, 3])).toBe(0);
  });

  it("T-513 後期群の順位が図と同じデータから導ける(実測 2026-09-02)", () => {
    const ranks = lateRanks(works);
    expect(ranks).toHaveLength(6);
    // 実測: ヒアトゥス率の低い順で 0,2,3,4,5,6 位。1 位はエピノミス
    expect(Math.max(...ranks)).toBeLessThan(8);
    const sorted = byHiatus(works);
    expect(sorted[1].abbr).toBe("Epin");
  });
});
