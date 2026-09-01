/**
 * フッタ判定規則そのものの検査(TEST_SPEC T-120〜T-128)。
 *
 * 検出系の規則は、壊れているときも対象が正しいときも同じ「違反 0 件」を返す。
 * ここで**壊し方ごとの陽性対照**を置き、規則が緩んだら落ちるようにする(HC-041 / HC-080)。
 *
 * 期待値の出所: フリート共通フッタ規約(koho-lens が正本)。
 */

import { describe, expect, it } from "vitest";
import type { FooterProbe } from "../harness/footer-rule.mjs";
import { COPYRIGHT, REQUIRED_ORDER, checkFooter } from "../harness/footer-rule.mjs";
import { FOOTER_ITEMS } from "../lib/links";

/** 規約どおりのフッタ(陰性対照)。実装の links.ts から組み立てる。 */
function goodFooter(): FooterProbe {
  const labels = FOOTER_ITEMS.map((i) => i.label);
  const text = labels
    .map((l, i) => (i === 0 ? `${l} ${COPYRIGHT}` : l))
    .join("・");
  return {
    text,
    links: FOOTER_ITEMS.map((i) => ({ label: i.label, href: i.href })),
    position: "fixed",
    bottom: "0px",
  };
}

describe("陰性対照", () => {
  it("T-120 規約どおりのフッタは違反 0 件", () => {
    expect(checkFooter(goodFooter())).toEqual([]);
  });

  it("T-121 実装の links.ts が規約の並びを満たす", () => {
    const labels = FOOTER_ITEMS.map((i) => i.label);
    let cursor = -1;
    for (const req of REQUIRED_ORDER) {
      const at = labels.findIndex((l, i) => i > cursor && l.includes(req));
      expect(at, `${req} が並びに無い`).toBeGreaterThan(cursor);
      cursor = at;
    }
    expect(labels).toHaveLength(5);
  });
});

describe("陽性対照 — 壊し方ごとに落ちること", () => {
  it("T-122 項目が欠けたら落ちる", () => {
    const f = goodFooter();
    f.text = f.text.replace("App Menu", "");
    f.links = f.links.filter((l) => l.label !== "App Menu");
    expect(checkFooter(f).join()).toMatch(/App Menu/);
  });

  it("T-123 並びが入れ替わったら落ちる", () => {
    const f = goodFooter();
    f.text = `GitHub・MIT License ${COPYRIGHT}・問答アトラスの歩き方・問答アトラス 設計図・App Menu`;
    expect(checkFooter(f).length).toBeGreaterThan(0);
  });

  it("T-124 区切りが CSS 描画で innerText から消えたら落ちる", () => {
    const f = goodFooter();
    f.text = f.text.replace(/・/g, " ");
    expect(checkFooter(f).join()).toMatch(/区切り/);
  });

  it("T-125 著作権表示が無い / リンク文言の中にあると落ちる", () => {
    const noCopy = goodFooter();
    noCopy.text = noCopy.text.replace(` ${COPYRIGHT}`, "");
    expect(checkFooter(noCopy).join()).toMatch(/著作権/);

    const inLink = goodFooter();
    inLink.links = inLink.links.map((l) =>
      l.label === "MIT License" ? { ...l, label: `MIT License ${COPYRIGHT}` } : l,
    );
    expect(checkFooter(inLink).join()).toMatch(/リンク文言の中/);
  });

  it("T-126 MIT License の行き先が LICENSE 以外だと落ちる", () => {
    const f = goodFooter();
    f.links = f.links.map((l) =>
      l.label === "MIT License" ? { ...l, href: "https://opensource.org/licenses/MIT" } : l,
    );
    expect(checkFooter(f).join()).toMatch(/MIT License の行き先/);
  });

  it("T-127 GitHub の行き先が別ホストに化けたら落ちる", () => {
    // 「どれかが github.com を向いている」では通ってしまう壊し方(HC-098)
    const f = goodFooter();
    f.links = f.links.map((l) =>
      l.label === "GitHub" ? { ...l, href: "https://example.com/twill3c/mondo-atlas" } : l,
    );
    expect(checkFooter(f).join()).toMatch(/GitHub の行き先/);
  });

  it("T-128 固定でなくなったら落ちる", () => {
    const notFixed = goodFooter();
    notFixed.position = "static";
    expect(checkFooter(notFixed).join()).toMatch(/position/);

    const notBottom = goodFooter();
    notBottom.bottom = "24px";
    expect(checkFooter(notBottom).join()).toMatch(/bottom/);
  });
});
