/** 画面②を実ブラウザで見る。篇を切り替えたところも撮る。 */
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
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();

for (const [name, scheme, pick, w, h] of [
  ["breath-menex", "light", null, 1100, 1400],
  ["breath-rep", "dark", "国家", 1100, 1400],
  ["breath-ap", "light", "ソクラテスの弁明", 1100, 900],
  ["breath-390", "light", null, 390, 1200],
]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, colorScheme: scheme });
  await page.goto(base + "breath/", { waitUntil: "networkidle" });
  if (pick) {
    await page.getByRole("button", { name: new RegExp(pick) }).first().click();
    await page.waitForTimeout(200);
  }
  await page.screenshot({ path: join(ROOT, `shot-${name}.png`), fullPage: false });
  console.log("撮影", name);
  await page.close();
}

await browser.close();
server.close();
