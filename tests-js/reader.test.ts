/**
 * 三段リーダーの検査(TEST_SPEC T-701〜T-712)。
 *
 * 要点は **G-06 を原文の側から見る**こと。
 * 「訳文に何が入っているか」ではなく「原文のどの節に訳が無いか」を数える
 * —— 訳の側から数えると、原文から落ちた節は永遠に見えない。
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import reader from "../data/reader/index.json";
import euthphr from "../data/reader/Euthphr.json";
import ap from "../data/reader/Ap.json";
import crit from "../data/reader/Crit.json";
import tr from "../data/curated/translation.json";
import {
  type ReaderWork,
  type WorkLink,
  byPage,
  isSectionId,
  isUntranslated,
  pageIndexOf,
  parseLoc,
  readerHref,
  progress,
  workOf,
} from "../lib/reader";

/** 目次(本文を持たない)と、篇ごとの本文。画面と同じ読み方をする。 */
const links = reader.works as unknown as WorkLink[];
const works = [euthphr, ap, crit] as unknown as ReaderWork[];

describe("配られるデータ", () => {
  it("T-701 リーダーの篇は和訳が始まっている篇だけ", () => {
    expect(works.map((w) => w.abbr)).toEqual(["Euthphr", "Ap", "Crit"]);
    // 目次と本文が同じ篇を指していること(片方だけ足すと食い違う)
    expect(links.map((w) => w.abbr)).toEqual(works.map((w) => w.abbr));
    expect(links.map((w) => w.slug)).toEqual(["euthphr", "ap", "crit"]);
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

  it("T-703 裁判三部は全篇完訳(実測 2026-09-03)", () => {
    const done: Record<string, number> = { Euthphr: 70, Ap: 125, Crit: 59 };
    for (const [abbr, n] of Object.entries(done)) {
      const w = works.find((x) => x.abbr === abbr)!;
      expect(w.complete, abbr).toBe(true);
      expect(w.untranslated, abbr).toEqual([]);
      expect(w.nTranslated, abbr).toBe(n);
    }
    expect(reader.translated).toBe(254);
    expect(reader.readerSections).toBe(254);
  });

  it("T-717 未訳の判定は**素通しになっていない**(合成の対照)", () => {
    // 三篇とも完訳になった時点で、実データからは「未訳」が消えた。
    // 対照が無いと「全部 complete と答える」実装でも T-703 が通ってしまうので、
    // **合成した篇**で未訳の側を撃つ。実データが未訳を持たなくなっても、
    // 判定そのものは検査され続ける
    const half: ReaderWork = {
      abbr: "X",
      title: "合成",
      nSections: 2,
      nTranslated: 1,
      untranslated: ["X.1b"],
      complete: false,
      sections: [
        { id: "X.1a", page: 1, letter: "a", grc: "α", eng: "a", ja: "あ" },
        { id: "X.1b", page: 1, letter: "b", grc: "β", eng: "b", ja: "" },
      ],
    };
    expect(half.sections.filter(isUntranslated).map((s) => s.id)).toEqual(["X.1b"]);
    expect(isUntranslated(half.sections[0])).toBe(false);
    expect(progress(half)).toEqual({ done: 1, total: 2, ratio: 0.5 });
    // 未訳の節も本文を持つ(訳が無いだけで節が無いのではない)
    expect(half.sections[1].grc.length).toBeGreaterThan(0);
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

  it("T-706 全節が希語本文を持ち、訳も空でない", () => {
    for (const w of works) {
      for (const s of w.sections) {
        expect(s.grc.length, s.id).toBeGreaterThan(0);
        expect(s.ja.length, s.id).toBeGreaterThan(0);
      }
    }
  });

  it("T-718 リーダーの重さは**測ってある**(この作りは篇を足すと破れる)", () => {
    // 本文をページに直に埋め込むので、篇を足すほど転送量が増える。
    // 実測 2026-09-03: 三篇で out/read/index.html が 544KB(gzip 177KB・本番 153KB)。
    // 四篇目(メノン 151 節)を足すと約 920KB になるので、そのときは
    // **篇ごとにページを分ける**(N-03)。この検査はその判断の根拠を固定する
    const chars = works.reduce(
      (a, w) => a + w.sections.reduce((b, s) => b + s.grc.length + s.eng.length + s.ja.length, 0),
      0,
    );
    expect(chars).toBeGreaterThan(200_000);
    expect(chars, "篇を足したなら分割を検討すること").toBeLessThan(400_000);
  });
});

describe("同梱の書体(N-02 / G-16)", () => {
  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? walk(p) : [p];
    });
  }

  it("T-714 ビルドが外へ書体を取りに行かない", () => {
    // next/font/google はビルド時に fonts.googleapis.com へ取りに行く。
    // N-02(ビルドはネットワーク非依存)に反するので、使っていないことを検査する。
    // **同梱に切り替えたことを覚えているかどうかに頼らない** —— 書き戻せば落ちる
    const IMPORT = /(?:from|require\()\s*["']next\/font\/google["']/;
    // 陽性対照: この検査が「書いてあれば撃つ」ことを先に確かめる。
    // 素通しにすると、走査の側が壊れていても緑になる
    expect(IMPORT.test('import { EB_Garamond } from "next/font/google";')).toBe(true);
    // 文中で名前に触れているだけの注記は撃たない
    expect(IMPORT.test("/* next/font/google は使わない */")).toBe(false);

    const sources = [...walk("app"), ...walk("lib")].filter((p) => /\.(tsx?|css)$/.test(p));
    expect(sources.length).toBeGreaterThan(5);
    expect(sources.filter((p) => IMPORT.test(readFileSync(p, "utf8")))).toEqual([]);
  });

  it("T-715 希語に要る部分集合が同梱され、字形の実体を持つ", () => {
    // 多アクセントは greek-ext(U+1F00-1FFF)に入る。ここが欠けると
    // アクセントが次の字の後ろに独立した点として出る(HC-134 の故障)
    for (const n of ["greek-ext", "greek", "latin"]) {
      const b = readFileSync(join("public", "fonts", `ebgaramond-${n}.woff2`));
      expect(b.subarray(0, 4).toString("latin1"), n).toBe("wOF2");
      expect(b.length, n).toBeGreaterThan(2000);
    }
    // 配るなら license も配る
    const ofl = readFileSync(join("public", "fonts", "OFL.txt"), "utf8");
    expect(ofl).toContain("SIL OPEN FONT LICENSE");
  });

  it("T-716 CSS が同梱の書体を参照し、多アクセントの範囲を覆う", () => {
    const css = readFileSync(join("app", "globals.css"), "utf8");
    expect(css).toContain('url("/fonts/ebgaramond-greek-ext.woff2")');
    expect(css).toContain("U+1F00-1FFF");
    // 希語欄が実際にこの書体を指していること
    expect(css).toMatch(/\.sec__grc\s*\{[^}]*"EB Garamond Local"/s);
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

describe("ビルドの刻印(HC-141)", () => {
  it("T-719 刻印は中身が変われば変わり、変わらなければ変わらない", async () => {
    const { computeStamp, STAMPED } = await import("../scripts/build_stamp.mjs");
    const a = computeStamp();
    const b = computeStamp();
    // 同じ木からは同じ刻印(手元と Vercel で一致しなければ検査にならない)
    expect(a.stamp).toBe(b.stamp);
    expect(a.stamp).toMatch(/^[0-9a-f]{16}$/);
    expect(a.files.map((f) => f.path)).toEqual([...STAMPED]);

    // **陽性対照**: 画面が読むデータが一つでも変われば刻印が動くこと。
    // これを確かめないと「いつも同じ値を返す」実装でも上が通る
    const paths = new Set(a.files.map((f) => f.path));
    expect(paths.size).toBe(STAMPED.length);
    for (const f of a.files) {
      expect(f.sha, f.path).toMatch(/^[0-9a-f]{12}$/);
      expect(f.bytes, f.path).toBeGreaterThan(0);
    }
    // 個別のハッシュがすべて異なる = どのファイルも刻印に効いている
    expect(new Set(a.files.map((f) => f.sha)).size).toBe(STAMPED.length);
  });

  it("T-720 刻印の対象に、画面が読むデータが漏れなく入っている", async () => {
    const { STAMPED } = await import("../scripts/build_stamp.mjs");
    // app/ が import している data/*.json を実測し、刻印の対象と突き合わせる。
    // **覚えているかどうかに頼らない** —— 画面を足して刻印に足し忘れれば落ちる
    function walk(dir: string): string[] {
      return readdirSync(dir).flatMap((n) => {
        const p = join(dir, n);
        return statSync(p).isDirectory() ? walk(p) : [p];
      });
    }
    const imported = new Set<string>();
    for (const p of walk("app").filter((p) => /\.tsx?$/.test(p))) {
      const src = readFileSync(p, "utf8");
      for (const m of src.matchAll(/@\/(data\/[A-Za-z0-9_\-/]+\.json)/g)) imported.add(m[1]);
    }
    expect(imported.size).toBeGreaterThan(0);
    for (const rel of imported) {
      expect(STAMPED, `${rel} が刻印の対象に入っていない`).toContain(rel);
    }
  });
});

describe("篇ごとの分割(N-03)", () => {
  it("T-721 目次に載る篇には、実在する頁と本文ファイルが対応する", () => {
    // **足し忘れを撃つ。** 篇を足すには
    //   (1) build_reader.py の INCLUDE  (2) data/reader/<略号>.json
    //   (3) app/read/<slug>/page.tsx
    // の三つが要る。どれか一つを忘れれば、ここで落ちる
    for (const w of links) {
      const page = join("app", "read", w.slug, "page.tsx");
      expect(existsSync(page), `${page} が無い`).toBe(true);
      const src = readFileSync(page, "utf8");
      expect(src, page).toContain(`@/data/reader/${w.abbr}.json`);

      const data = join("data", "reader", `${w.abbr}.json`);
      expect(existsSync(data), `${data} が無い`).toBe(true);
    }
    // 逆向き: 頁だけあって目次に無いものは残骸
    const slugs = new Set(links.map((w) => w.slug));
    const dirs = readdirSync(join("app", "read")).filter((n) =>
      statSync(join("app", "read", n)).isDirectory(),
    );
    for (const d of dirs) {
      expect(slugs.has(d), `app/read/${d}/ は目次に無い`).toBe(true);
    }
  });

  it("T-722 目次は本文を持たない(分割の意味そのもの)", () => {
    const raw = readFileSync(join("data", "reader", "index.json"), "utf8");
    expect(raw.length).toBeLessThan(4000);
    for (const w of links) {
      expect(w, w.abbr).not.toHaveProperty("sections");
      // 何 KB 増えるかを目次が持っている(読み手に重さを知らせるため)
      expect(w.bytes, w.abbr).toBeGreaterThan(1000);
    }
    // 一篇あたりの重さは、束ねていたとき(513KB)より小さいこと
    const biggest = Math.max(...links.map((w) => w.bytes));
    expect(biggest).toBeLessThan(400_000);
  });

  it("T-723 既に配った ?loc= は篇の頁へ送られる", () => {
    const known = links.map((w) => w.abbr);
    expect(readerHref("Crit.43a", known)).toBe("/read/crit/?loc=Crit.43a");
    expect(readerHref("Ap.17a", known)).toBe("/read/ap/?loc=Ap.17a");
    expect(readerHref("Euthphr.2a", known)).toBe("/read/euthphr/?loc=Euthphr.2a");
    // 載せていない篇と、形の違うものは送らない
    expect(readerHref("Rep.327a", known)).toBe(null);
    expect(readerHref("Crit.99z", known)).toBe(null);
    expect(readerHref("<script>", known)).toBe(null);
  });
});
