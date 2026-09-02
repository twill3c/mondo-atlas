/**
 * 画面②(問答の呼吸)の幾何と、配られるデータの検査(TEST_SPEC T-301〜T-312)。
 *
 * 期待値の出所:
 *   - 幾何の性質      : 定義そのもの(単調・範囲・端の扱い)
 *   - データの整合    : 並列配列の長さが揃うという不変量
 *   - 検証の状態      : L2 の較正結果(SPEC G-11/G-12)。件数は定数で書かず集合で書く
 *   - 篇内の形        : 実測(2026-09-02)。出所と実測日をケースに書く
 */

import { describe, expect, it } from "vitest";
import breathData from "../data/breath.json";
import {
  type BreathWork,
  areaPath,
  bookBoundaries,
  density,
  linePath,
  sectionLabel,
  sharedMax,
  smooth,
  summary,
  trustLevel,
} from "../lib/breath";

const works = breathData.works as unknown as BreathWork[];
const byAbbr = (a: string) => works.find((w) => w.abbr === a)!;

describe("配られるデータ", () => {
  it("T-301 36 篇あり、並列配列の長さが揃う", () => {
    expect(works).toHaveLength(36);
    for (const w of works) {
      const n = w.turns.length;
      expect(w.pages.length, w.abbr).toBe(n);
      expect(w.tokens.length, w.abbr).toBe(n);
      expect(w.letters.length, w.abbr).toBe(n);
      if (w.books) expect(w.books.length, w.abbr).toBe(n);
      expect(n).toBeGreaterThan(0);
    }
  });

  it("T-302 校訂者の印が配られていない(G-03)", () => {
    const blob = JSON.stringify(breathData);
    for (const name of ["gold", "sigla", "said", "label"]) {
      expect(blob.includes(`"${name}"`), name).toBe(false);
    }
  });

  it("T-303 節の合計が全集の実測と一致する", () => {
    // 出所: L0 の実測(2026-09-02)。8,559 節・1,752 頁
    const total = works.reduce((a, w) => a + w.turns.length, 0);
    expect(total).toBe(8559);
  });

  it("T-304 頁は篇内で非減少(ステファヌス順)", () => {
    for (const w of works) {
      // 書簡集だけは手紙をまたぐと頁が戻る(13 通を通して振られているため)
      if (w.abbr === "Ep") continue;
      const p = w.pages;
      for (let i = 1; i < p.length; i++) expect(p[i], w.abbr).toBeGreaterThanOrEqual(p[i - 1]);
    }
  });

  it("T-305 交替数も語数も非負の有限値", () => {
    for (const w of works) {
      for (const v of [...w.turns, ...w.tokens]) {
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("T-306 検証の状態は定義済みの語彙のみで、照合済みが過半", () => {
    const allowed = new Set(["照合済み(検証側)", "照合済み(較正側)", "内部整合のみ", "未検証"]);
    for (const w of works) expect(allowed.has(w.validation), w.abbr).toBe(true);
    const verified = works.filter((w) => w.validation.startsWith("照合済み"));
    expect(verified.length).toBeGreaterThan(works.length / 2);
  });
});

describe("幾何", () => {
  it("T-307 濃さは千語あたりで、語数 0 の節は 0", () => {
    const w = byAbbr("Crit");
    const d = density(w);
    expect(d).toHaveLength(w.turns.length);
    for (const v of d) expect(Number.isFinite(v)).toBe(true);
    const synthetic = { ...w, turns: [3, 0], tokens: [1000, 0] } as BreathWork;
    expect(density(synthetic)).toEqual([3, 0]);
  });

  it("T-308 移動平均は長さを変えず、端を欠測にしない", () => {
    const v = [0, 10, 0, 10, 0];
    const s = smooth(v, 3);
    expect(s).toHaveLength(v.length);
    for (const x of s) expect(Number.isFinite(x)).toBe(true);
    // 端は縮めた窓。先頭は (0+10)/2 = 5
    expect(s[0]).toBeCloseTo(5);
    // 窓 1 は素通し
    expect(smooth(v, 1)).toEqual(v);
    // 均すと振れ幅は狭まる
    expect(Math.max(...s)).toBeLessThan(Math.max(...v));
  });

  it("T-309 面グラフの経路は閉じていて、値が軸を越えない", () => {
    const H = 100;
    const d = smooth(density(byAbbr("Leg")), 9);
    const max = Math.max(...d);
    const path = areaPath(d, max, H);
    expect(path.startsWith("M 0 100")).toBe(true);
    expect(path.endsWith("Z")).toBe(true);
    // すべての y が 0..H に収まる
    const ys = [...path.matchAll(/L [\d.]+ ([\d.]+)/g)].map((m) => Number(m[1]));
    expect(ys.length).toBeGreaterThan(10);
    for (const y of ys) {
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(H);
    }
    expect(linePath(d, max, H).startsWith("M ")).toBe(true);
  });

  it("T-310 巻の切れ目は同じ配列から導く", () => {
    const rep = byAbbr("Rep");
    const b = bookBoundaries(rep);
    // 出所: L0 の実測。国家は 10 巻・法律は 12 巻
    expect(b.map((x) => x.label)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
    expect(bookBoundaries(byAbbr("Leg"))).toHaveLength(12);
    // 巻を持たない篇では空
    expect(bookBoundaries(byAbbr("Crit"))).toEqual([]);
    // 位置は昇順で範囲内
    const at = b.map((x) => x.at);
    expect(at).toEqual([...at].sort((p, q) => p - q));
    expect(Math.max(...at)).toBeLessThan(rep.turns.length);
  });

  it("T-311 共通の縦軸上限は、どの篇の値も越えない", () => {
    const W = 9;
    const max = sharedMax(works, W);
    expect(max).toBeGreaterThan(0);
    for (const w of works) {
      for (const v of smooth(density(w), W)) expect(v).toBeLessThanOrEqual(max + 1e-9);
    }
  });
});

describe("要約と検証の言い分け", () => {
  it("T-312 要約の数は図と同じデータから導く", () => {
    const w = byAbbr("Menex");
    const s = summary(w);
    expect(s.sections).toBe(w.turns.length);
    expect(s.tokens).toBe(w.tokens.reduce((a, b) => a + b, 0));
    expect(s.turns).toBe(w.n_turns);
    expect(s.per1k).toBeCloseTo((w.n_turns * 1000) / s.tokens, 6);
    // 最濃・最薄の位置は実在する節 ID
    expect(sectionLabel(w, 0)).toMatch(/^\d+[a-e]$/);
    expect(s.densest).toBeGreaterThanOrEqual(s.sparsest);
  });

  it("T-313 検証の状態を三段に言い分ける", () => {
    expect(trustLevel("照合済み(検証側)")).toBe("high");
    expect(trustLevel("照合済み(較正側)")).toBe("high");
    expect(trustLevel("内部整合のみ")).toBe("mid");
    expect(trustLevel("未検証")).toBe("low");
  });

  it("T-314 実測した篇内の形が保たれている(2026-09-02)", () => {
    // メネクセノス: 葬送演説の間が平坦で、前後の対話が濃い。
    // 演説はおよそ 236b-249c。両端の対話部分が中央より濃いことを要求する
    const w = byAbbr("Menex");
    const d = smooth(density(w), 5);
    const idx = (p: number) => w.pages.findIndex((x) => x >= p);
    const head = d.slice(0, idx(236));
    const mid = d.slice(idx(236), idx(249));
    const tail = d.slice(idx(249));
    const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    expect(head.length).toBeGreaterThan(3);
    expect(mid.length).toBeGreaterThan(10);
    expect(tail.length).toBeGreaterThan(1);
    expect(avg(head)).toBeGreaterThan(avg(mid));
    expect(avg(tail)).toBeGreaterThan(avg(mid));
  });
});
