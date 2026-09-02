/**
 * 実ブラウザでの検品(G-08 / HC-041 / HC-078 / HC-080)。
 *
 * 見るのは一つの幅ではない。図・表に手を入れたループの完了条件として、
 * **複数の画面幅で実際に描かせて**、機械で捕まえられる代理指標を取る。
 *   - 横の溢れ(document.scrollWidth > clientWidth)
 *   - 縦の伸びすぎ(列の潰れがここに出る)
 *   - **固定フッタの高さ < body の逃げ**(各幅で。90px 級に育つ幅がある)
 *   - フッタ規約(判定規則は harness/footer-rule.mjs に分離してある)
 *   - 図の要素数が実データと一致すること
 *
 * 検品器は対象の実装ではなく**振る舞い**で書く。要素は毎回引き直し、
 * 数えるときは名前ではなく子の総数で数える(HC-080)。
 * **検品器自身にも陽性対照を置く**(--self-test)。異常を捕まえられることを一度確かめる。
 *
 * 終了コード: 合格 0 / 検品の不合格 1 / 検品器自身の異常 2。
 * パイプの先で $? がすり替わるので、呼び出し側で `| tail` しないこと。
 */

import { createServer } from "node:http";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { checkFooter } from "./footer-rule.mjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const OUT = join(ROOT, "out");
const WIDTHS = [390, 768, 1280];
const MAX_PAGE_HEIGHT = 16000; // 1 ページがこれを超えたら、まず表を疑う(HC-078)

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

function serve(dir) {
  const server = createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const file = join(dir, p);
    if (!file.startsWith(dir) || !existsSync(file)) {
      res.writeHead(404).end("not found");
      return;
    }
    res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(res);
  });
  return new Promise((ok) => server.listen(0, () => ok(server)));
}

/** ページから検品に必要な値を取る。実装の要素名に依存させない。 */
async function probe(page) {
  return page.evaluate(() => {
    // フッタは要素名で探さず、中身(App Menu と MIT License)で選ぶ
    const foot = [...document.querySelectorAll("body *")].find(
      (el) =>
        el.innerText?.includes("App Menu") &&
        el.innerText?.includes("MIT License") &&
        el.querySelector("a"),
    );
    const fs = foot ? getComputedStyle(foot) : null;
    // position: fixed は祖先に付いていることがあるのでさかのぼる
    let posEl = foot;
    while (posEl && getComputedStyle(posEl).position !== "fixed" && posEl !== document.body) {
      posEl = posEl.parentElement;
    }
    const ps = posEl ? getComputedStyle(posEl) : null;

    const bodyPad = parseFloat(getComputedStyle(document.body).paddingBottom);

    return {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      pageHeight: document.documentElement.scrollHeight,
      footer: foot
        ? {
            text: foot.innerText,
            links: [...foot.querySelectorAll("a")].map((a) => ({
              label: a.textContent ?? "",
              href: a.href,
            })),
            position: ps?.position ?? "none",
            bottom: ps?.bottom ?? "none",
            height: foot.getBoundingClientRect().height,
          }
        : null,
      bodyPaddingBottom: bodyPad,
      // 図の要素は毎回引き直し、名前ではなく総数で数える
      bars: document.querySelectorAll(".row").length,
      tetralogyHeads: document.querySelectorAll(".tetralogy__head").length,
      ticks: document.querySelectorAll(".axis__tick").length,
      gridLines: document.querySelectorAll(".grid-lines span").length,
      // 画面②。要素名ではなく「何個あるか」で見る
      sparks: document.querySelectorAll(".spark").length,
      breathPaths: document.querySelectorAll(".breath__area").length,
      trustBanners: document.querySelectorAll(".trust").length,
      navItems: document.querySelectorAll(".nav__item").length,
      // 面グラフの経路が空でないこと(空の d は「描いたつもり」で通る)
      emptyPaths: [...document.querySelectorAll(".breath__area, .breath__line")].filter(
        (p) => (p.getAttribute("d") ?? "").length < 20,
      ).length,
      // 画面③
      heatRows: document.querySelectorAll(".heat__row").length,
      heatCells: document.querySelectorAll(".heat__cell").length,
      termChips: document.querySelectorAll(".chip").length,
      // 段が全部同じなら、色が何も表していない
      heatLevels: new Set(
        [...document.querySelectorAll(".heat__cell")].map(
          (c) => [...c.classList].find((x) => x.startsWith("heat__cell--")) ?? "l0",
        ),
      ).size,
      // 画面④
      dots: document.querySelectorAll(".dot").length,
      lateDots: document.querySelectorAll(".dot--late").length,
      predictions: document.querySelectorAll(".prediction").length,
      // 点が一箇所に固まっていたら、軸が効いていない
      dotSpreadX: (() => {
        const xs = [...document.querySelectorAll(".dot")].map(
          (d) => d.getBoundingClientRect().left,
        );
        return xs.length ? Math.round(Math.max(...xs) - Math.min(...xs)) : 0;
      })(),
      // 画面⑤
      jaItems: document.querySelectorAll(".ja-item").length,
      meters: document.querySelectorAll(".meter__fill").length,
      // 充填率の表示が分子と分母を持っているか(割合だけを出さない)
      hasFraction: [...document.querySelectorAll(".kpi__value")].some((e) =>
        /\d[\d,]*\s*\/\s*\d/.test(e.textContent ?? ""),
      ),
      // 帯の幅が 0 のものが無いか(データはすべて正)
      zeroBars: [...document.querySelectorAll(".bar")].filter(
        (b) => b.getBoundingClientRect().width < 1,
      ).length,
      // 値ラベルが切れていないか。最長の篇で実際に切れたのを目視で見つけた ——
      // 横溢れの検査は緑のまま通したので、専用の代理指標を置く
      clippedLabels: [...document.querySelectorAll(".row__value, .row__class, .row__name")]
        .filter((el) => el.scrollWidth > el.clientWidth + 1)
        .map((el) => el.textContent?.trim() ?? "?"),
      // 帯が自分の帯域を越えていないか
      barsOverflowingTrack: [...document.querySelectorAll(".row__track")].filter((t) => {
        const bar = t.querySelector(".bar");
        if (!bar) return false;
        return bar.getBoundingClientRect().right > t.getBoundingClientRect().right + 1;
      }).length,
    };
  });
}

function checkAtWidth(width, r, expected, page = "/") {
  const problems = [];
  if (r.scrollWidth > r.clientWidth + 1) {
    problems.push(`横に溢れている(${r.scrollWidth} > ${r.clientWidth})`);
  }
  if (r.pageHeight > MAX_PAGE_HEIGHT) {
    problems.push(`縦に伸びすぎ(${r.pageHeight}px) — 表か列の潰れを疑う`);
  }
  if (!r.footer) {
    problems.push("フッタが見つからない");
  } else {
    problems.push(...checkFooter(r.footer));
    if (r.footer.height >= r.bodyPaddingBottom) {
      problems.push(
        `フッタの高さ ${Math.round(r.footer.height)}px が逃げ ${Math.round(
          r.bodyPaddingBottom,
        )}px 以上 — 本文末尾が隠れる`,
      );
    }
  }
  if (r.navItems !== expected.pages) {
    problems.push(`画面の切り替えが ${r.navItems} 個(期待 ${expected.pages})`);
  }

  if (page === "/") {
    if (r.bars !== expected.works) problems.push(`帯が ${r.bars} 本(期待 ${expected.works})`);
    if (r.tetralogyHeads !== expected.tetralogies) {
      problems.push(`四部作の見出しが ${r.tetralogyHeads}(期待 ${expected.tetralogies})`);
    }
    if (r.ticks !== r.gridLines) {
      problems.push(`目盛り ${r.ticks} と格子 ${r.gridLines} の本数が違う(出所が一つでない)`);
    }
    if (r.ticks < 2) problems.push(`目盛りが ${r.ticks} 本しか無い`);
    if (r.zeroBars > 0) problems.push(`幅 0 の帯が ${r.zeroBars} 本ある`);
  } else if (page === "/breath/") {
    // 画面②: 36 篇ぶんのスパークライン + 主図の面と線
    if (r.sparks !== expected.works) {
      problems.push(`スパークラインが ${r.sparks} 個(期待 ${expected.works})`);
    }
    if (r.breathPaths !== expected.works + 1) {
      problems.push(`面グラフが ${r.breathPaths} 個(期待 ${expected.works + 1} = 主図 + 一覧)`);
    }
    if (r.trustBanners !== 1) problems.push(`検証の断りが ${r.trustBanners} 個(期待 1)`);
    if (r.emptyPaths > 0) problems.push(`中身の無い経路が ${r.emptyPaths} 本ある`);
  } else if (page === "/japanese/") {
    // 画面⑤: 36 篇の項目と、充填率の帯
    if (r.jaItems !== expected.works) {
      problems.push(`篇の項目が ${r.jaItems}(期待 ${expected.works})`);
    }
    if (r.meters !== 1) problems.push(`充填率の帯が ${r.meters} 本(期待 1)`);
    if (!r.hasFraction) problems.push("充填率が分子と分母で出ていない(割合だけになっている)");
  } else if (page === "/style/") {
    // 画面④: 36 篇の点と、宣言した予測
    if (r.dots !== expected.works) problems.push(`点が ${r.dots} 個(期待 ${expected.works})`);
    if (r.lateDots !== expected.late) {
      problems.push(`後期群の点が ${r.lateDots} 個(期待 ${expected.late})`);
    }
    if (r.predictions !== expected.predictions) {
      problems.push(`予測が ${r.predictions} 件(期待 ${expected.predictions})`);
    }
    if (r.dotSpreadX < 100) problems.push(`点が横に ${r.dotSpreadX}px しか散っていない`);
  } else {
    // 画面③: 36 篇 × 区間の升目
    if (r.heatRows !== expected.works) {
      problems.push(`地層の行が ${r.heatRows}(期待 ${expected.works})`);
    }
    if (r.heatCells !== expected.works * expected.bins) {
      problems.push(
        `升目が ${r.heatCells}(期待 ${expected.works * expected.bins} = ${expected.works} × ${expected.bins})`,
      );
    }
    if (r.termChips !== expected.terms) {
      problems.push(`見出し語が ${r.termChips}(期待 ${expected.terms})`);
    }
    // 色が何も表していない状態を捕まえる
    if (r.heatLevels < 3) problems.push(`升目の段が ${r.heatLevels} 種類しかない`);
  }
  if (r.clippedLabels?.length) {
    problems.push(`ラベルが切れている ${r.clippedLabels.length} 件: ${r.clippedLabels.slice(0, 4).join(" / ")}`);
  }
  if (r.barsOverflowingTrack > 0) {
    problems.push(`帯が帯域を越えている ${r.barsOverflowingTrack} 本`);
  }
  return problems;
}

/** 検品器自身の陽性対照。壊れた入力を確かに落とすか。 */
function selfTest() {
  const ok = {
    scrollWidth: 1280,
    clientWidth: 1280,
    pageHeight: 4000,
    footer: {
      text: "MIT License © 2026 坂田哲朗・GitHub・歩き方・設計図・App Menu",
      links: [
        { label: "MIT License", href: "https://github.com/twill3c/mondo-atlas/blob/main/LICENSE" },
        { label: "GitHub", href: "https://github.com/twill3c/mondo-atlas" },
        { label: "歩き方", href: "x" },
        { label: "設計図", href: "y" },
        { label: "App Menu", href: "https://app-menu-amber.vercel.app/" },
      ],
      position: "fixed",
      bottom: "0px",
      height: 40,
    },
    bodyPaddingBottom: 88,
    bars: 36,
    tetralogyHeads: 9,
    ticks: 5,
    gridLines: 5,
    zeroBars: 0,
    clippedLabels: [],
    barsOverflowingTrack: 0,
    sparks: 36,
    breathPaths: 37,
    trustBanners: 1,
    navItems: 4,
    emptyPaths: 0,
    heatRows: 36,
    heatCells: 36 * 40,
    termChips: 14,
    heatLevels: 5,
    dots: 36,
    lateDots: 6,
    predictions: 4,
    dotSpreadX: 600,
    jaItems: 36,
    meters: 1,
    hasFraction: true,
  };
  const expected = { works: 36, tetralogies: 9, bins: 40, terms: 14, pages: 4, late: 6, predictions: 4 };
  const failures = [];
  if (checkAtWidth(1280, ok, expected).length !== 0) {
    failures.push("正常な入力を落とした(偽陽性)");
  }
  if (checkAtWidth(1280, ok, expected, "/breath/").length !== 0) {
    failures.push("画面②の正常な入力を落とした(偽陽性)");
  }
  if (checkAtWidth(1280, ok, expected, "/words/").length !== 0) {
    failures.push("画面③の正常な入力を落とした(偽陽性)");
  }
  if (checkAtWidth(1280, ok, expected, "/style/").length !== 0) {
    failures.push("画面④の正常な入力を落とした(偽陽性)");
  }
  if (checkAtWidth(1280, ok, expected, "/japanese/").length !== 0) {
    failures.push("画面⑤の正常な入力を落とした(偽陽性)");
  }
  const cases = [
    ["横溢れ", { ...ok, scrollWidth: 1400 }],
    ["縦伸び", { ...ok, pageHeight: 20000 }],
    ["フッタ欠", { ...ok, footer: null }],
    ["逃げ不足", { ...ok, footer: { ...ok.footer, height: 100 } }],
    ["帯の本数", { ...ok, bars: 35 }],
    ["目盛りと格子の不一致", { ...ok, gridLines: 4 }],
    ["幅 0 の帯", { ...ok, zeroBars: 2 }],
    ["ラベルの切れ", { ...ok, clippedLabels: ["327 頁"] }],
    ["帯の溢れ", { ...ok, barsOverflowingTrack: 1 }],
    ["画面の切り替え欠落", { ...ok, navItems: 1 }],
  ];
  for (const [name, bad] of cases) {
    if (checkAtWidth(1280, bad, expected).length === 0) {
      failures.push(`「${name}」を捕まえられない`);
    }
  }
  // 画面②側の対照
  const breathCases = [
    ["スパークライン欠落", { ...ok, sparks: 35 }],
    ["面グラフの数違い", { ...ok, breathPaths: 36 }],
    ["検証の断り欠落", { ...ok, trustBanners: 0 }],
    ["中身の無い経路", { ...ok, emptyPaths: 3 }],
  ];
  for (const [name, bad] of breathCases) {
    if (checkAtWidth(1280, bad, expected, "/breath/").length === 0) {
      failures.push(`「${name}」を捕まえられない`);
    }
  }
  // 画面③側の対照
  const wordCases = [
    ["地層の行の欠落", { ...ok, heatRows: 35 }],
    ["升目の数違い", { ...ok, heatCells: 36 * 39 }],
    ["見出し語の欠落", { ...ok, termChips: 13 }],
    ["色が一様", { ...ok, heatLevels: 1 }],
  ];
  for (const [name, bad] of wordCases) {
    if (checkAtWidth(1280, bad, expected, "/words/").length === 0) {
      failures.push(`「${name}」を捕まえられない`);
    }
  }
  // 画面④側の対照
  const styleCases = [
    ["点の欠落", { ...ok, dots: 35 }],
    ["後期群の印の欠落", { ...ok, lateDots: 5 }],
    ["予測の欠落", { ...ok, predictions: 3 }],
    ["点が散らない", { ...ok, dotSpreadX: 20 }],
  ];
  for (const [name, bad] of styleCases) {
    if (checkAtWidth(1280, bad, expected, "/style/").length === 0) {
      failures.push(`「${name}」を捕まえられない`);
    }
  }
  const jaCases = [
    ["篇の項目の欠落", { ...ok, jaItems: 35 }],
    ["充填率の帯の欠落", { ...ok, meters: 0 }],
    ["充填率が割合だけ", { ...ok, hasFraction: false }],
  ];
  for (const [name, bad] of jaCases) {
    if (checkAtWidth(1280, bad, expected, "/japanese/").length === 0) {
      failures.push(`「${name}」を捕まえられない`);
    }
  }
  return {
    failures,
    cases:
      cases.length + breathCases.length + wordCases.length + styleCases.length + jaCases.length,
  };
}

async function main() {
  // 件数は対照の配列から導く。定数で書くと、対照を足したときに表示だけが古くなる
  const { failures: selfFailures, cases: selfCases } = selfTest();
  if (selfFailures.length) {
    console.error("検品器の自己対照に失敗:");
    for (const f of selfFailures) console.error("  - " + f);
    process.exit(2);
  }
  console.log(`検品器の自己対照: OK(正常 1 件を通し、壊れ ${selfCases} 件を落とした)`);

  if (process.argv.includes("--self-test")) return;

  // --url で本番を見る。手元の出荷物検査と**別に**、配られているものを引く。
  // ビルド生成物のどこにも書かれていない故障(配信の Content-Type、反映漏れ)は
  // デプロイして実際に取得するまで存在しない。
  const urlArg = process.argv.indexOf("--url");
  const liveBase = urlArg >= 0 ? process.argv[urlArg + 1] : null;

  if (!liveBase && !existsSync(join(OUT, "index.html"))) {
    console.error("out/index.html が無い。先に `npm run build` を実行すること");
    process.exit(2);
  }

  const PAGES = ["/", "/breath/", "/words/", "/style/", "/japanese/"];

  // 期待値は**実データから導く**。定数で書くと、データが増えたときに検査だけが古くなる
  const index = JSON.parse(readFileSync(join(ROOT, "data", "index.json"), "utf8"));
  const wordsData = JSON.parse(readFileSync(join(ROOT, "data", "words.json"), "utf8"));
  const styleData = JSON.parse(readFileSync(join(ROOT, "data", "style.json"), "utf8"));
  const expected = {
    works: index.works.length,
    tetralogies: new Set(index.works.map((w) => w.tetralogy)).size,
    bins: wordsData.bins,
    terms: wordsData.terms.length,
    pages: PAGES.length,
    late: styleData.lateGroup.length,
    predictions: styleData.predictions.length,
  };

  const server = liveBase ? null : await serve(OUT);
  const base = liveBase ?? `http://127.0.0.1:${server.address().port}/`;
  console.log(`対象: ${base}`);
  const browser = await chromium.launch();
  let bad = 0;


  try {
    for (const width of WIDTHS) {
      for (const pagePath of PAGES) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      const res = await page.goto(base.replace(/\/$/, "") + pagePath, {
        waitUntil: "networkidle",
      });
      if (!res || !res.ok()) {
        console.error(`  幅 ${width} ${pagePath}: 取得に失敗した(${res?.status()})`);
        bad++;
        await page.close();
        continue;
      }
      const r = await probe(page);
      const problems = checkAtWidth(width, r, expected, pagePath);
      if (errors.length) problems.push(`JS エラー: ${errors.join(" / ")}`);

      // 本番では配信の型まで見る。静的書き出しは拡張子の無いファイルを作ることがあり、
      // 手元の出荷物検査では原理的に見つからない(HC-048)
      if (liveBase) {
        const ct = res.headers()["content-type"] ?? "";
        if (!ct.startsWith("text/html")) {
          problems.push(`本文の Content-Type が ${ct}(期待 text/html)`);
        }
      }

      if (problems.length) {
        bad++;
        console.error(`幅 ${width}px ${pagePath} — 不合格`);
        for (const p of problems) console.error("  - " + p);
      } else {
        const detail =
          pagePath === "/"
            ? `帯 ${r.bars} / 見出し ${r.tetralogyHeads} / 目盛り ${r.ticks}`
            : pagePath === "/breath/"
              ? `一覧 ${r.sparks} / 面 ${r.breathPaths} / 断り ${r.trustBanners}`
              : pagePath === "/words/"
                ? `行 ${r.heatRows} / 升目 ${r.heatCells} / 語 ${r.termChips} / 段 ${r.heatLevels}`
                : pagePath === "/style/"
                  ? `点 ${r.dots} / 後期 ${r.lateDots} / 予測 ${r.predictions} / 横の散り ${r.dotSpreadX}px`
                  : `篇 ${r.jaItems} / 充填の帯 ${r.meters}`;
        console.log(
          `幅 ${width}px ${pagePath} — OK(${detail} / 高さ ${r.pageHeight}px / ` +
            `フッタ ${Math.round(r.footer.height)}px < 逃げ ${Math.round(r.bodyPaddingBottom)}px)`,
        );
      }
      if (process.argv.includes("--shot")) {
        const slug = pagePath === "/" ? "top" : pagePath.replace(/\//g, "");
        await page.screenshot({
          path: join(ROOT, `shot-${slug}-${width}.png`),
          fullPage: false,
        });
      }
      await page.close();
      }
    }
  } finally {
    await browser.close();
    server?.close();
  }

  if (bad) {
    console.error(`\n${bad} / ${WIDTHS.length * PAGES.length} の組で不合格`);
    process.exit(1);
  }
  console.log(`\n全 ${WIDTHS.length} 幅 × ${PAGES.length} 画面で合格`);
}

main().catch((e) => {
  console.error("検品器が落ちた:", e);
  process.exit(2);
});
