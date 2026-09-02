/** どの要素が横幅を超えているかを実測で特定する。目測で犯人を決めない。 */
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

const path = process.argv[2] ?? "/words/";
const width = Number(process.argv[3] ?? 390);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height: 900 } });
await page.goto(`http://127.0.0.1:${server.address().port}${path}`, { waitUntil: "networkidle" });

const culprits = await page.evaluate((w) => {
  const out = [];
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.right > w + 1 || r.width > w + 1) {
      out.push({
        tag: el.tagName.toLowerCase(),
        cls: el.className?.toString?.().slice(0, 60) ?? "",
        right: Math.round(r.right),
        width: Math.round(r.width),
        overflowX: getComputedStyle(el).overflowX,
        text: (el.textContent ?? "").trim().slice(0, 24),
      });
    }
  }
  return out;
}, width);

console.log(`${path} @ ${width}px — 幅を超える要素 ${culprits.length} 件`);
for (const c of culprits.slice(0, 14)) {
  console.log(
    `  ${c.tag}.${c.cls} 幅${c.width} 右端${c.right} overflow-x:${c.overflowX} 「${c.text}」`,
  );
}

await browser.close();
server.close();
