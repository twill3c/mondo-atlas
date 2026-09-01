/** 暗モードと「長い順」も実際に見る。自動の代理指標は目視の代わりにならない(HC-041)。 */
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

for (const [name, scheme, click] of [
  ["dark-canonical", "dark", null],
  ["light-length", "light", "長い順"],
  ["dark-length", "dark", "長い順"],
]) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 1500 }, colorScheme: scheme });
  await page.goto(base, { waitUntil: "networkidle" });
  if (click) {
    await page.getByRole("button", { name: click }).click();
    await page.waitForTimeout(150);
  }
  await page.screenshot({ path: join(ROOT, `shot-${name}.png`), fullPage: false });
  console.log("撮影", name);
  await page.close();
}

await browser.close();
server.close();
