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
      // 画面⑥
      secs: document.querySelectorAll(".sec").length,
      secCols: document.querySelectorAll(".sec__cols").length,
      pageNos: document.querySelectorAll(".reader__pageno").length,
      workLinks: document.querySelectorAll(".worklist__link").length,
      pagerNums: document.querySelectorAll(".pager__num").length,
      // 未訳の節が「空欄」として出ているか(0 や空白で埋めていないか)
      emptyJa: document.querySelectorAll(".sec__ja--empty").length,
      // 希語の本文が空の節が無いか
      emptyGrc: [...document.querySelectorAll(".sec__grc")].filter(
        (e) => (e.textContent ?? "").trim().length === 0,
      ).length,
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
  } else if (page === "/read/") {
    // 画面⑥の目次: **本文を持たない**(N-03)。ここに節が出たら分割が壊れている
    if (r.workLinks !== expected.readerWorks) {
      problems.push(`篇の一覧が ${r.workLinks} 件(期待 ${expected.readerWorks})`);
    }
    if (r.secs !== 0) problems.push(`目次に本文の節が ${r.secs} 件ある(分割が効いていない)`);
    if (!r.hasFraction) problems.push("充填率が分子と分母で出ていない");
  } else if (expected.perWork[page]) {
    // 篇の頁: ステファヌス頁ごとにめくる。開くのは**一頁ぶん**
    const want = expected.perWork[page];
    if (r.pageNos !== 1) problems.push(`頁見出しが ${r.pageNos} 個(期待 1 = 一頁ぶんだけ出す)`);
    if (r.pagerNums !== want.pagerNums) {
      problems.push(`頁を選ぶ釦が ${r.pagerNums}(期待 ${want.pagerNums})`);
    }
    if (r.secs !== want.secs) {
      problems.push(`初手の頁の節が ${r.secs}(期待 ${want.secs})`);
    }
    if (r.secCols !== r.secs) problems.push(`三段の欄が ${r.secCols}(節は ${r.secs})`);
    if (r.emptyGrc > 0) problems.push(`希語が空の節が ${r.emptyGrc} 件`);
    // 未訳の空欄は**その頁の未訳節数と一致する**。完訳の篇なら 0、
    // 未訳の篇なら全節。0 に決め打ちすると、未訳の表示経路が検査から消える
    if (r.emptyJa !== want.emptyJa) {
      problems.push(`未訳の空欄が ${r.emptyJa} 件(期待 ${want.emptyJa})`);
    }
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
    secs: 5,
    secCols: 5,
    pageNos: 1,
    pagerNums: 12,
    workLinks: 4,
    emptyJa: 0,
    emptyGrc: 0,
  };
  const expected = {
    works: 36, tetralogies: 9, bins: 40, terms: 14, pages: 4, late: 6, predictions: 4,
    readerWorks: 4,
    perWork: {
      "/read/crit/": { pagerNums: 12, secs: 5, emptyJa: 0 },
      // 未訳の篇。空欄が出るのが正しい
      "/read/men/": { pagerNums: 31, secs: 3, emptyJa: 3 },
    },
  };
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
  if (checkAtWidth(1280, ok, expected, "/read/crit/").length !== 0) {
    failures.push("篇の頁の正常な入力を落とした(偽陽性)");
  }
  if (checkAtWidth(1280, { ...ok, secs: 0 }, expected, "/read/").length !== 0) {
    failures.push("目次の正常な入力を落とした(偽陽性)");
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
  const readCases = [
    ["節の欠落", { ...ok, secs: 4 }],
    ["三段の欄の不足", { ...ok, secCols: 4 }],
    ["希語が空", { ...ok, emptyGrc: 1 }],
    ["頁送りが効かず全節が一度に出る", { ...ok, secs: 59, pageNos: 12 }],
    ["頁を選ぶ釦の欠落", { ...ok, pagerNums: 11 }],
    ["完訳の篇なのに未訳の空欄", { ...ok, emptyJa: 1 }],
  ];
  for (const [name, bad] of readCases) {
    if (checkAtWidth(1280, bad, expected, "/read/crit/").length === 0) {
      failures.push(`「${name}」を捕まえられない`);
    }
  }
  // 未訳の篇の対照。**空欄が出ないことも異常**である
  const menOk = { ...ok, secs: 3, secCols: 3, pagerNums: 31, emptyJa: 3 };
  if (checkAtWidth(1280, menOk, expected, "/read/men/").length !== 0) {
    failures.push("未訳の篇の正常な入力を落とした(偽陽性)");
  }
  const menCases = [
    ["未訳なのに空欄が出ていない", { ...menOk, emptyJa: 0 }],
    ["未訳の空欄が多すぎる", { ...menOk, emptyJa: 4 }],
  ];
  for (const [name, bad] of menCases) {
    if (checkAtWidth(1280, bad, expected, "/read/men/").length === 0) {
      failures.push(`「${name}」を捕まえられない`);
    }
  }
  // 目次の対照。**分割が壊れて目次に本文が出る**のがいちばん見たい故障
  const indexCases = [
    ["目次に本文が出ている", { ...ok, secs: 5 }],
    ["篇の一覧の欠落", { ...ok, secs: 0, workLinks: 3 }],
    ["充填率が割合だけ", { ...ok, secs: 0, hasFraction: false }],
  ];
  for (const [name, bad] of indexCases) {
    if (checkAtWidth(1280, bad, expected, "/read/").length === 0) {
      failures.push(`「${name}」を捕まえられない`);
    }
  }
  return {
    failures,
    cases:
      cases.length +
      breathCases.length +
      wordCases.length +
      styleCases.length +
      jaCases.length +
      readCases.length +
      indexCases.length +
      menCases.length,
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

  // 期待値は**実データから導く**。定数で書くと、データが増えたときに検査だけが古くなる
  const index = JSON.parse(readFileSync(join(ROOT, "data", "index.json"), "utf8"));
  const wordsData = JSON.parse(readFileSync(join(ROOT, "data", "words.json"), "utf8"));
  const styleData = JSON.parse(readFileSync(join(ROOT, "data", "style.json"), "utf8"));
  const readerIndex = JSON.parse(
    readFileSync(join(ROOT, "data", "reader", "index.json"), "utf8"),
  );

  // 篇ごとに頁が分かれた(N-03)ので、走る道筋も目次から導く ——
  // 篇を足したら検品の対象も自動で増える
  const WORK_PAGES = readerIndex.works.map((w) => `/read/${w.slug}/`);
  const PAGES = ["/", "/breath/", "/words/", "/style/", "/japanese/", "/read/", ...WORK_PAGES];

  // 画面の切り替えの数は**道筋の数ではない**(篇の頁は切り替えに出ない)。
  // Nav の中身を実測する —— 定数で書くと、画面を足したとき検査だけが古くなる
  const navSrc = readFileSync(join(ROOT, "app", "Nav.tsx"), "utf8");
  const navCount = (navSrc.match(/href:\s*"/g) ?? []).length;

  /** 篇ごとの期待値(頁の束の数と、初手に開く頁の節数)。 */
  const perWork = {};
  for (const w of readerIndex.works) {
    const doc = JSON.parse(
      readFileSync(join(ROOT, "data", "reader", `${w.abbr}.json`), "utf8"),
    );
    const first = doc.sections[0].page;
    const onFirst = doc.sections.filter((s) => s.page === first);
    perWork[`/read/${w.slug}/`] = {
      pagerNums: new Set(doc.sections.map((s) => s.page)).size,
      secs: onFirst.length,
      // 初手の頁に未訳が何節あるか。**完訳かどうかで期待値が変わる** ——
      // 「未訳は空欄で出す」経路は、未訳の篇が載っていて初めて実データで撃てる
      emptyJa: onFirst.filter((s) => !s.ja).length,
    };
  }

  const expected = {
    works: index.works.length,
    tetralogies: new Set(index.works.map((w) => w.tetralogy)).size,
    bins: wordsData.bins,
    terms: wordsData.terms.length,
    pages: navCount,
    readerWorks: readerIndex.works.length,
    perWork,
    late: styleData.lateGroup.length,
    predictions: styleData.predictions.length,
  };
  if (navCount < 5) {
    console.error(`Nav の項目が ${navCount} 個しか読めない —— 実測の仕方が壊れている`);
    process.exit(2);
  }

  const server = liveBase ? null : await serve(OUT);
  const base = liveBase ?? `http://127.0.0.1:${server.address().port}/`;
  console.log(`対象: ${base}`);

  // **何を検品しているのかを先に確かめる**(HC-141)。
  // 本番が健やかかを見る前に、配られているものが手元と同じかを見る ——
  // デプロイが失敗しても本番は健やかなままなので、
  // 健やかさの検査は「反映されたか」を一切語らない。
  if (liveBase) {
    const { computeStamp } = await import("../scripts/build_stamp.mjs");
    const want = computeStamp(ROOT);
    let got = null;
    let why = "";
    try {
      const res = await fetch(new URL("/build-stamp.json", base));
      if (!res.ok) why = `取得に失敗した(${res.status})`;
      else got = await res.json();
    } catch (e) {
      why = String(e);
    }
    if (!got) {
      console.error(`本番の刻印を読めない: ${why}`);
      console.error("  → 刻印より前のビルドが配られている可能性がある");
      server?.close();
      process.exitCode = 1;
      return;
    }
    if (got.stamp !== want.stamp) {
      console.error(`**本番は手元と違うものを配っている**`);
      console.error(`  手元 ${want.stamp} / 本番 ${got.stamp}`);
      const byPath = new Map((got.files ?? []).map((f) => [f.path, f]));
      for (const f of want.files) {
        const g = byPath.get(f.path);
        if (!g) console.error(`  - ${f.path}: 本番に無い`);
        else if (g.sha !== f.sha) {
          console.error(`  - ${f.path}: 手元 ${f.bytes}B / 本番 ${g.bytes}B`);
        }
      }
      console.error("  → デプロイが済んでいない。検品の合否はこの本番については語れない");
      server?.close();
      process.exitCode = 1;
      return;
    }
    console.log(`刻印 ${want.stamp} — 本番は手元と同じものを配っている`);
  }
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
                  : pagePath === "/japanese/"
                    ? `篇 ${r.jaItems} / 充填の帯 ${r.meters}`
                    : pagePath === "/read/"
                      ? `篇の一覧 ${r.workLinks} 件(本文なし)`
                      : `頁 ${r.pagerNums} 束 / 開いた頁の節 ${r.secs} / 三段 ${r.secCols}`;
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

    // 直リンク(F-09)。**単体試験では見えない** —— 節 ID の解釈も頁の選び直しも
    // ブラウザの中でしか起きない。「verify は緑なのに開かない」を捕まえる
    bad += await checkDeepLinks(browser, base, expected);

    // 希語が**実際にどの書体で描かれたか**を見る(HC-134)
    bad += await checkGreekFont(browser, base);
  } finally {
    await browser.close();
    server?.close();
  }

  if (bad) {
    console.error(`\n${bad} 件で不合格(${WIDTHS.length} 幅 × ${PAGES.length} 画面 + 直リンク)`);
    process.exit(1);
  }
  console.log(`\n全 ${WIDTHS.length} 幅 × ${PAGES.length} 画面 + 直リンクで合格`);
}

/**
 * 希語の本文が**どの書体で描かれたか**を実測する(HC-134)。
 *
 * CSS の `font-family` に何と書いたかは、実際に何で描かれたかを教えない。
 * この機の Georgia / Palatino Linotype / Times New Roman / 既定の serif は
 * 多アクセントの合成済み符号を持たず、アクセントを次の字の後ろに
 * 独立した点として描いた。**指定は正しいのに字は壊れている**状態で、
 * 代理指標(高さ・溢れ・要素数)は全部緑のままだった。
 *
 * Chrome に「この節点をどの書体で描いたか」を直接聞く。
 * 同梱の書体ひとつで描き切れていなければ、どこかが代替に落ちている。
 */
async function checkGreekFont(browser, base) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  // 希語の本文があるのは**篇の頁**である(目次は本文を持たない)
  await page.goto(`${base.replace(/\/$/, "")}/read/crit/`, { waitUntil: "networkidle" });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const { root } = await cdp.send("DOM.getDocument");
  const { nodeId } = await cdp.send("DOM.querySelector", {
    nodeId: root.nodeId,
    selector: ".sec__grc",
  });
  const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });

  // **陽性対照** —— 和訳の欄は別の書体で組んである。ここまで同じ答えが返るなら、
  // この問い合わせは書体を見ていない(定数を返している)
  const { nodeId: jaId } = await cdp.send("DOM.querySelector", {
    nodeId: root.nodeId,
    selector: ".sec__ja",
  });
  const ja = (await cdp.send("CSS.getPlatformFontsForNode", { nodeId: jaId })).fonts.filter(
    (f) => f.glyphCount > 0,
  );
  await page.close();

  const problems = [];
  const used = fonts.filter((f) => f.glyphCount > 0);
  if (ja.length && used.length && ja.every((f) => /garamond/i.test(f.familyName))) {
    problems.push("対照が効いていない: 和訳の欄まで同じ書体だと報告された");
  }
  if (used.length === 0) {
    problems.push("希語がひと文字も描かれていない");
  } else {
    const main = used.reduce((a, b) => (a.glyphCount >= b.glyphCount ? a : b));
    if (!/garamond/i.test(main.familyName)) {
      problems.push(`希語を ${main.familyName} で描いている(同梱の書体に届いていない)`);
    }
    // 一部の字だけ代替に落ちるのが**まさに多アクセントの壊れ方**なので、
    // 「大半が正しい」では通さない。全字が同じ書体で描かれていること
    const stray = used.filter((f) => f !== main);
    if (stray.length) {
      problems.push(
        "希語の一部が別書体に落ちた: " +
          stray.map((f) => `${f.familyName}(${f.glyphCount} 字)`).join(" / "),
      );
    }
  }
  if (problems.length) {
    console.error("希語の書体 — 不合格");
    for (const p of problems) console.error("  - " + p);
    return 1;
  }
  console.log(
    `希語の書体 — OK(${used[0].familyName} ひとつで ${used[0].glyphCount} 字すべてを描いた` +
      `。対照: 和訳の欄は ${ja.map((f) => f.familyName).join("+") || "不明"})`,
  );
  return 0;
}

/**
 * 直リンク(F-09)を**実ブラウザで**確かめる。
 *
 * 正例だけでなく**壊れた住所**も渡す —— 形の検査を素通りさせていないかは、
 * 通る例をいくら並べても分からない。壊れた住所では既定の頁に落ちるのが正しい。
 */
async function checkDeepLinks(browser, base, expected) {
  // [道筋, 期待する data-sec(null = 焦点なし), 期待する頁見出しの数字]
  //
  // **`/read/?loc=` は既に配ってしまった住所**である(画面の断り書きにも解説にも載せた)。
  // 篇ごとに頁を分けたあとも、そこから篇の頁へ送られることを確かめる ——
  // 分割で古いリンクを壊すのがいちばん起こりやすい事故なので、正例と壊れ例を両方置く。
  const cases = [
    ["/read/crit/?loc=Crit.51c", "Crit.51c", 51],
    ["/read/crit/?loc=Crit.43a", "Crit.43a", 43],
    ["/read/ap/?loc=Ap.17a", "Ap.17a", 17],
    ["/read/euthphr/?loc=Euthphr.10a", "Euthphr.10a", 10],
    // 古い住所からの送り直し(目次が受けて篇の頁へ送る)
    ["/read/?loc=Crit.51c", "Crit.51c", 51],
    ["/read/?loc=Ap.38b", "Ap.38b", 38],
    // 別の篇の住所を篇の頁に渡しても、その頁は何もしない(既定の頁のまま)
    ["/read/crit/?loc=Ap.17a", null, null],
    // 壊れた住所
    ["/read/?loc=%3Cscript%3E", null, null],
    ["/read/?loc=Crit.99z", null, null],
    ["/read/?loc=Rep.327a", null, null],
    ["/read/crit/", null, null],
  ];
  let bad = 0;
  for (const [path, wantSec, wantPage] of cases) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(`${base.replace(/\/$/, "")}${path}`, { waitUntil: "networkidle" });
    // 目次からの送り直しは location.replace なので、移動を待つ
    if (path.startsWith("/read/?loc=") && wantSec) {
      await page.waitForURL(/\/read\/[a-z]+\//, { timeout: 15000 }).catch(() => {});
      await page.waitForLoadState("networkidle");
    }
    const r = await page.evaluate(() => ({
      focus: document.querySelector(".sec--focus")?.getAttribute("data-sec") ?? null,
      nFocus: document.querySelectorAll(".sec--focus").length,
      pageno: document.querySelector(".reader__pageno")?.textContent ?? "",
      heading: document.querySelector("#read-heading")?.textContent ?? "",
      secs: document.querySelectorAll(".sec").length,
      // 焦点の節が画面の中に入っているか(飛んだつもりで飛んでいないのを捕まえる)
      inView: (() => {
        const el = document.querySelector(".sec--focus");
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return b.top < window.innerHeight && b.bottom > 0;
      })(),
    }));
    const problems = [];
    if (errors.length) problems.push(`JS エラー: ${errors.join(" / ")}`);
    const onWorkPage = /\/read\/[a-z]+\//.test(page.url());
    if (wantSec && !onWorkPage) {
      problems.push(`篇の頁へ送られていない(${page.url()})`);
    }
    // **壊れた住所を目次に渡したら、目次に留まる**のが正しい。
    // 送り直してしまうと、形の検査を素通りさせたことになる
    if (!wantSec && path.startsWith("/read/?") && onWorkPage) {
      problems.push(`壊れた住所で篇の頁へ送られた(${page.url()})`);
    }
    // 本文があるのは篇の頁だけ。目次に節が出たら分割が壊れている
    if (onWorkPage && r.secs === 0) problems.push("節がひとつも出ていない");
    if (!onWorkPage && r.secs > 0) problems.push(`目次に本文の節が ${r.secs} 件ある`);
    if (!onWorkPage && r.workLinks === 0) problems.push("目次に篇の一覧が無い");
    if (r.nFocus > 1) problems.push(`焦点が ${r.nFocus} 個(期待 1 以下)`);
    if (wantSec === null) {
      if (r.focus !== null) problems.push(`壊れた住所で ${r.focus} に飛んだ(既定の頁に落ちるべき)`);
    } else {
      if (r.focus !== wantSec) problems.push(`焦点が ${r.focus}(期待 ${wantSec})`);
      if (!r.pageno.includes(String(wantPage))) {
        problems.push(`開いた頁が「${r.pageno.trim()}」(期待 ${wantPage} 頁)`);
      }
      if (r.inView !== true) problems.push("焦点の節が画面の中に来ていない");
    }
    if (problems.length) {
      bad++;
      console.error(`直リンク ${path} — 不合格`);
      for (const p of problems) console.error("  - " + p);
    } else {
      console.log(
        `直リンク ${path} — OK` +
          (wantSec ? `(${r.focus} を ${wantPage} 頁で開いた)` : "(既定の頁に落ちた)"),
      );
    }
    await page.close();
  }
  return bad;
}

main().catch((e) => {
  console.error("検品器が落ちた:", e);
  process.exit(2);
});
