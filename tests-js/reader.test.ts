/**
 * 三段リーダーの検査(TEST_SPEC T-701〜T-712)。
 *
 * 要点は **G-06 を原文の側から見る**こと。
 * 「訳文に何が入っているか」ではなく「原文のどの節に訳が無いか」を数える
 * —— 訳の側から数えると、原文から落ちた節は永遠に見えない。
 */

import { describe, expect, it } from "vitest";
import reader from "../data/reader.json";
import tr from "../data/curated/translation.json";
import {
  type ReaderWork,
  byPage,
  isSectionId,
  isUntranslated,
  pageIndexOf,
  parseLoc,
  progress,
  workOf,
} from "../lib/reader";

const works = reader.works as unknown as ReaderWork[];

describe("配られるデータ", () => {
  it("T-701 リーダーの篇は和訳が始まっている篇だけ", () => {
    expect(works.map((w) => w.abbr)).toEqual(["Euthphr", "Ap", "Crit"]);
    for (const w of works) {
      expect(w.sections.length).toBe(w.nSections);
      for (const s of w.sections) {
        expect(s.grc.length, s.id).toBeGreaterThan(0);
        expect(isSectionId(s.id), s.id).toBe(true);
      }
    }
  });

  it("T-702 G-06: 未訳は**原文の側から**数えられている", () => {
    for (const w of works) {
      const fromSource = w.sections.filter(isUntranslated).map((s) => s.id);
      expect(w.untranslated, w.abbr).toEqual(fromSource);
      expect(w.nTranslated, w.abbr).toBe(w.nSections - fromSource.length);
      expect(w.complete, w.abbr).toBe(fromSource.length === 0);
    }
  });

  it("T-703 クリトンは完訳(実測 2026-09-02)", () => {
    const crit = works.find((w) => w.abbr === "Crit")!;
    expect(crit.complete).toBe(true);
    expect(crit.untranslated).toEqual([]);
    expect(crit.nTranslated).toBe(59);
  });

  it("T-704 訳の節 ID はすべて原文に実在する", () => {
    const real = new Set(works.flatMap((w) => w.sections.map((s) => s.id)));
    for (const id of Object.keys(tr.sections)) {
      expect(real.has(id), id).toBe(true);
    }
  });

  it("T-705 充填率は全集を分母にした値も持つ", () => {
    // 三篇だけを分母にすると進み具合が誇張される。両方を出す
    expect(reader.corpusSections).toBe(8559);
    expect(reader.coverageOfCorpus).toBeCloseTo(reader.translated / 8559, 5);
    expect(reader.coverageOfCorpus).toBeLessThan(reader.coverageOfReader);
  });

  it("T-706 未訳の節も本文を持つ(訳が無いだけで節が無いのではない)", () => {
    const ap = works.find((w) => w.abbr === "Ap")!;
    expect(ap.untranslated.length).toBeGreaterThan(0);
    for (const s of ap.sections) {
      expect(s.grc.length).toBeGreaterThan(0);
      expect(isUntranslated(s)).toBe(true);
    }
  });
});

describe("節への直リンク(F-09)", () => {
  it("T-707 節 ID の形を判定する", () => {
    expect(isSectionId("Crit.43a")).toBe(true);
    expect(isSectionId("Ep.2.310b")).toBe(true);
    expect(isSectionId("Rep.327a")).toBe(true);
    expect(isSectionId("Crit.43")).toBe(false);
    expect(isSectionId("Crit.43z")).toBe(false);
    expect(isSectionId("../etc/passwd")).toBe(false);
  });

  it("T-708 ?loc= は形の検査を通ったものだけ返す", () => {
    expect(parseLoc("?loc=Crit.43a")).toBe("Crit.43a");
    expect(parseLoc("?x=1&loc=Ap.17a&y=2")).toBe("Ap.17a");
    expect(parseLoc("?loc=" + encodeURIComponent("Crit.43a"))).toBe("Crit.43a");
    // URL から来た文字列をそのまま要素 ID に使わない
    expect(parseLoc("?loc=<script>")).toBe(null);
    expect(parseLoc("?loc=")).toBe(null);
    expect(parseLoc("")).toBe(null);
  });

  it("T-713 直リンクの節を含む**頁**が開く", () => {
    const crit = works.find((w) => w.abbr === "Crit")!;
    const groups = byPage(crit);
    // 全節について、返る頁にその節が入っている(めくる単位と住所の単位が一致する)
    for (const s of crit.sections) {
      const i = pageIndexOf(crit, s.id);
      expect(i, s.id).toBeGreaterThanOrEqual(0);
      expect(groups[i].sections.some((x) => x.id === s.id), s.id).toBe(true);
    }
    // 他の篇の節や、形の違うものは -1
    expect(pageIndexOf(crit, "Ap.17a")).toBe(-1);
    expect(pageIndexOf(crit, "だめ")).toBe(-1);
  });

  it("T-709 節 ID から篇の略号が取れる", () => {
    expect(workOf("Crit.43a")).toBe("Crit");
    expect(workOf("Ep.2.310b")).toBe("Ep");
    expect(workOf("だめ")).toBe(null);
  });
});

describe("並びと要約", () => {
  it("T-710 頁ごとに束ねても節が増減しない", () => {
    for (const w of works) {
      const groups = byPage(w);
      expect(groups.reduce((a, g) => a + g.sections.length, 0)).toBe(w.nSections);
      const pages = groups.map((g) => g.page);
      expect(pages).toEqual([...new Set(pages)]);
    }
  });

  it("T-711 篇の進み具合は分子と分母を持つ", () => {
    for (const w of works) {
      const p = progress(w);
      expect(p.total).toBe(w.nSections);
      expect(p.done).toBe(w.nTranslated);
      expect(p.ratio).toBeCloseTo(p.done / p.total, 6);
    }
  });

  it("T-712 節は篇内でステファヌス順に並ぶ", () => {
    for (const w of works) {
      const key = w.sections.map((s) => [s.page, s.letter] as [number, string]);
      const sorted = [...key].sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1]));
      expect(key).toEqual(sorted);
    }
  });
});
