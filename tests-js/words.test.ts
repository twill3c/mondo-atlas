/**
 * 画面③(語の地層)の幾何と、配られるデータの検査(TEST_SPEC T-401〜T-412)。
 *
 * 期待値の出所:
 *   - データの整合  : 並列配列・区間数が揃うという不変量
 *   - 段の境目      : 定義そのもの(単調・値を覆う・0 は 0 段)
 *   - 台帳との一致  : data/curated/word-ledger.json(人が書いた台帳)が正
 *   - 実測          : 2026-09-02 の計数。実測日をケースに書く
 */

import { describe, expect, it } from "vitest";
import ledger from "../data/curated/word-ledger.json";
import wordsData from "../data/words.json";
import {
  LEVELS,
  type WordTerm,
  type WordWork,
  allBinValues,
  densestWork,
  levelBreaks,
  levelOf,
  peakBin,
  sortWorks,
} from "../lib/words";

const terms = wordsData.terms as unknown as WordTerm[];
const works = wordsData.works as unknown as WordWork[];
const BINS = wordsData.bins;

describe("配られるデータ", () => {
  it("T-401 36 篇あり、各篇に全見出し語の区間が揃う", () => {
    expect(works).toHaveLength(36);
    expect(terms.length).toBeGreaterThan(10);
    for (const w of works) {
      for (const t of terms) {
        expect(w.bins[t.key], `${w.abbr}/${t.key}`).toHaveLength(BINS);
        expect(typeof w.rates[t.key]).toBe("number");
        expect(typeof w.totals[t.key]).toBe("number");
      }
    }
  });

  it("T-402 見出し語が台帳と一致する(コードが語形を勝手に増やしていない)", () => {
    const fromLedger = ledger.terms.map((t) => t.key);
    expect(terms.map((t) => t.key)).toEqual(fromLedger);
    for (const t of terms) {
      const l = ledger.terms.find((x) => x.key === t.key)!;
      expect(t.n_forms, t.key).toBe(l.forms.length);
      expect(t.n_excluded_surfaces, t.key).toBe(l.exclude_surfaces.length);
    }
  });

  it("T-403 値はすべて非負の有限値", () => {
    for (const w of works) {
      for (const t of terms) {
        for (const v of w.bins[t.key]) {
          expect(Number.isFinite(v)).toBe(true);
          expect(v).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it("T-404 篇の合計が全集の合計と一致する", () => {
    for (const t of terms) {
      const sum = works.reduce((a, w) => a + w.totals[t.key], 0);
      expect(sum, t.key).toBe(t.total);
    }
  });

  it("T-405 千語あたりの値が件数と語数から導ける", () => {
    for (const w of works) {
      for (const t of terms) {
        const expected = (w.totals[t.key] * 1000) / w.tokens;
        expect(w.rates[t.key], `${w.abbr}/${t.key}`).toBeCloseTo(expected, 1);
      }
    }
  });

  it("T-406 台帳が両方向の判断を持っている", () => {
    // 誤検出側: 表層の除外が必要な語には実際に書かれている
    const withExcl = ledger.terms.filter((t) => t.exclude_surfaces.length > 0);
    expect(withExcl.map((t) => t.key)).toContain("eidos");
    expect(withExcl.map((t) => t.key)).toContain("agathon");
    expect(withExcl.map((t) => t.key)).toContain("nomos");
    // 取りこぼし側: 落とした群には必ず理由が書いてある
    for (const t of ledger.terms) {
      for (const r of t.rejected) {
        expect(r.why.length, `${t.key}/${r.group}`).toBeGreaterThan(3);
      }
    }
  });
});

describe("段の境目と色", () => {
  it("T-407 境目は単調増加で、0 は 0 段", () => {
    const vals = allBinValues(works, "logos");
    const breaks = levelBreaks(vals);
    expect(breaks).toHaveLength(LEVELS);
    for (let i = 1; i < breaks.length; i++) {
      expect(breaks[i]).toBeGreaterThan(breaks[i - 1]);
    }
    expect(levelOf(0, breaks)).toBe(0);
    expect(levelOf(breaks[0] / 2, breaks)).toBe(1);
    expect(levelOf(breaks[breaks.length - 1] * 10, breaks)).toBe(LEVELS);
  });

  it("T-408 段は 0..LEVELS に収まる", () => {
    for (const t of terms) {
      const vals = allBinValues(works, t.key);
      const breaks = levelBreaks(vals);
      for (const v of vals) {
        const l = levelOf(v, breaks);
        expect(l).toBeGreaterThanOrEqual(0);
        expect(l).toBeLessThanOrEqual(LEVELS);
      }
    }
  });

  it("T-409 上端を切り詰めている(一区間の突出で他が潰れない)", () => {
    // 95 パーセンタイルを上端にするので、最大値は最上段を超える
    const vals = allBinValues(works, "nomos");
    const breaks = levelBreaks(vals);
    const max = Math.max(...vals);
    expect(max).toBeGreaterThan(breaks[breaks.length - 1]);
    // 切り詰めた結果、最下段だけに偏っていないこと
    const levels = vals.filter((v) => v > 0).map((v) => levelOf(v, breaks));
    const top = levels.filter((l) => l >= 3).length;
    expect(top).toBeGreaterThan(0);
  });
});

describe("並びと要約", () => {
  it("T-410 並べ替えで篇が増減しない", () => {
    for (const mode of ["canonical", "rate"] as const) {
      const s = sortWorks(works, mode, "arete");
      expect(new Set(s.map((w) => w.abbr)).size).toBe(36);
    }
    const byRate = sortWorks(works, "rate", "arete");
    for (let i = 1; i < byRate.length; i++) {
      expect(byRate[i].rates.arete).toBeLessThanOrEqual(byRate[i - 1].rates.arete);
    }
  });

  it("T-411 最も濃い篇は図と同じデータから導く", () => {
    const w = densestWork(works, "arete")!;
    expect(w.rates.arete).toBe(Math.max(...works.map((x) => x.rates.arete)));
    // 実測(2026-09-02): ἀρετή が最も濃いのは『メノン』
    expect(w.abbr).toBe("Men");
  });

  it("T-412 篇内の山は区間の配列から導く", () => {
    for (const t of terms) {
      for (const w of works) {
        const p = peakBin(w, t.key);
        expect(p.index).toBeGreaterThanOrEqual(0);
        expect(p.index).toBeLessThan(BINS);
        expect(p.value).toBe(Math.max(...w.bins[t.key]));
      }
    }
  });

  it("T-413 εἶδος は ἰδέα より多い(実測 2026-09-02)", () => {
    // 「イデア論」と呼ばれるが、プラトンが使う語は εἶδος のほうが多い。
    // 台帳の判断(ἰδεῖν を落とし εἰδέναι を落とす)が効いていることの確認でもある
    const eidos = terms.find((t) => t.key === "eidos")!;
    const idea = terms.find((t) => t.key === "idea")!;
    expect(eidos.total).toBeGreaterThan(idea.total * 3);
  });
});
