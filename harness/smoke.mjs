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

function checkAtWidth(width, r, expected) {
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
  if (r.bars !== expected.works) problems.push(`帯が ${r.bars} 本(期待 ${expected.works})`);
  if (r.tetralogyHeads !== expected.tetralogies) {
    problems.push(`四部作の見出しが ${r.tetralogyHeads}(期待 ${expected.tetralogies})`);
  }
  if (r.ticks !== r.gridLines) {
    problems.push(`目盛り ${r.ticks} と格子 ${r.gridLines} の本数が違う(出所が一つでない)`);
  }
  if (r.ticks < 2) problems.push(`目盛りが ${r.ticks} 本しか無い`);
  if (r.zeroBars > 0) problems.push(`幅 0 の帯が ${r.zeroBars} 本ある`);
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
  };
  const expected = { works: 36, tetralogies: 9 };
  const failures = [];
  if (checkAtWidth(1280, ok, expected).length !== 0) {
    failures.push("正常な入力を落とした(偽陽性)");
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
  ];
  for (const [name, bad] of cases) {
    if (checkAtWidth(1280, bad, expected).length === 0) {
      failures.push(`「${name}」を捕まえられない`);
    }
  }
  return { failures, cases: cases.length };
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

  const index = JSON.parse(readFileSync(join(ROOT, "data", "index.json"), "utf8"));
  const expected = {
    works: index.works.length,
    tetralogies: new Set(index.works.map((w) => w.tetralogy)).size,
  };

  const server = liveBase ? null : await serve(OUT);
  const base = liveBase ?? `http://127.0.0.1:${server.address().port}/`;
  console.log(`対象: ${base}`);
  const browser = await chromium.launch();
  let bad = 0;

  try {
    for (const width of WIDTHS) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      const res = await page.goto(base, { waitUntil: "networkidle" });
      if (!res || !res.ok()) {
        console.error(`  幅 ${width}: 取得に失敗した(${res?.status()})`);
        bad++;
        await page.close();
        continue;
      }
      const r = await probe(page);
      const problems = checkAtWidth(width, r, expected);
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
        console.error(`幅 ${width}px — 不合格`);
        for (const p of problems) console.error("  - " + p);
      } else {
        console.log(
          `幅 ${width}px — OK(帯 ${r.bars} / 見出し ${r.tetralogyHeads} / ` +
            `目盛り ${r.ticks} / 高さ ${r.pageHeight}px / ` +
            `フッタ ${Math.round(r.footer.height)}px < 逃げ ${Math.round(r.bodyPaddingBottom)}px)`,
        );
      }
      if (process.argv.includes("--shot")) {
        await page.screenshot({ path: join(ROOT, `shot-${width}.png`), fullPage: false });
      }
      await page.close();
    }
  } finally {
    await browser.close();
    server?.close();
  }

  if (bad) {
    console.error(`\n${bad} / ${WIDTHS.length} の幅で不合格`);
    process.exit(1);
  }
  console.log(`\n全 ${WIDTHS.length} 幅で合格`);
}

main().catch((e) => {
  console.error("検品器が落ちた:", e);
  process.exit(2);
});
