/** 出荷 HTML のフッタを実ブラウザで開き、innerText と各リンクの行き先をそのまま出す。
 *  画面写真の縮小では「・」の有無が判別できないので、文字列で確かめる。 */
import { createServer } from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const OUT = join(ROOT, "out");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css" };

const server = await new Promise((ok) => {
  const s = createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const f = join(OUT, p);
    if (!existsSync(f)) return res.writeHead(404).end();
    res.writeHead(200, { "content-type": MIME[extname(f)] ?? "application/octet-stream" });
    createReadStream(f).pipe(res);
  });
  s.listen(0, () => ok(s));
});

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "networkidle" });

const info = await page.evaluate(() => {
  const foot = [...document.querySelectorAll("body *")].find(
    (el) => el.innerText?.includes("App Menu") && el.innerText?.includes("MIT License") && el.querySelector("a"),
  );
  const seps = [...foot.querySelectorAll(".fsep")].map((s) => ({
    text: s.textContent,
    w: s.getBoundingClientRect().width,
    opacity: getComputedStyle(s).opacity,
    display: getComputedStyle(s).display,
  }));
  return {
    innerText: foot.innerText,
    textContent: foot.textContent,
    dotCount: (foot.innerText.match(/・/g) || []).length,
    links: [...foot.querySelectorAll("a")].map((a) => `${a.textContent} -> ${a.href}`),
    seps,
  };
});

console.log("innerText  :", JSON.stringify(info.innerText));
console.log("textContent:", JSON.stringify(info.textContent));
console.log("・の数     :", info.dotCount);
console.log("区切り要素 :", JSON.stringify(info.seps));
console.log("リンク     :");
for (const l of info.links) console.log("   " + l);

await browser.close();
server.close();
