/** 画面④を実ブラウザで見る。 */
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

const base = `http://127.0.0.1:${server.address().port}/style/`;
const browser = await chromium.launch();

for (const [name, scheme, w, h] of [
  ["style-light", "light", 1100, 1500],
  ["style-dark", "dark", 1100, 1500],
  ["style-390", "light", 390, 1300],
]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, colorScheme: scheme });
  await page.goto(base, { waitUntil: "networkidle" });
  await page.screenshot({ path: join(ROOT, `shot-${name}.png`) });
  console.log("撮影", name);
  await page.close();
}

await browser.close();
server.close();
