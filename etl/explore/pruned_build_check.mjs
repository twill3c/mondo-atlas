/**
 * `.vercelignore` で削った後の木でビルドが通るかを確かめる(HC-062)。
 *
 * 手元でビルドが通ることと、**配られる木**でビルドが通ることは別である。
 * アップロードされる木は除外設定で削られているので、削った状態を作って一度ビルドする。
 *
 * 使い方: node etl/explore/pruned_build_check.mjs <作業ディレクトリ>
 */

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const DEST = resolve(process.argv[2] ?? join(ROOT, "..", "mondo-atlas-pruned"));

// .vercelignore を読んで、除外パターン(先頭一致のディレクトリ/ファイル名)を作る
const patterns = readFileSync(join(ROOT, ".vercelignore"), "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"));

console.log("除外パターン:", patterns.join(" "));

function excluded(rel) {
  const first = rel.split(/[\\/]/)[0];
  return patterns.some((p) =>
    p.includes("*")
      ? new RegExp("^" + p.replace(/[.]/g, "\\.").replace(/\*/g, ".*") + "$").test(first)
      : first === p,
  );
}

if (existsSync(DEST)) rmSync(DEST, { recursive: true, force: true });
mkdirSync(DEST, { recursive: true });

// トップ階層だけを見て、除外されないものを丸ごと複製する
// (.vercelignore の項目はすべてトップ階層のディレクトリ/名前である)
const { readdirSync } = await import("node:fs");
let copied = 0;
for (const entry of readdirSync(ROOT)) {
  if (excluded(entry)) continue;
  cpSync(join(ROOT, entry), join(DEST, entry), { recursive: true });
  copied++;
}
console.log(`複製 ${copied} 件 → ${DEST}`);

// 依存は改めて入れる(node_modules は送らないので、Vercel 側も入れ直す)
console.log("\nnpm ci …");
execFileSync("npm", ["ci", "--no-audit", "--no-fund"], {
  cwd: DEST,
  stdio: "inherit",
  shell: process.platform === "win32",
});

console.log("\nnext build …");
execFileSync("npx", ["next", "build"], {
  cwd: DEST,
  stdio: "inherit",
  shell: process.platform === "win32",
});

const out = join(DEST, "out", "index.html");
if (!existsSync(out)) {
  console.error("\n削った木で out/index.html が作られなかった");
  process.exit(1);
}
const html = readFileSync(out, "utf8");
for (const needle of ["問答アトラス", "App Menu", "MIT License"]) {
  if (!html.includes(needle)) {
    console.error(`\n出荷 HTML に「${needle}」が無い`);
    process.exit(1);
  }
}
console.log("\n削った木でビルド成功。out/index.html に主要な文言を確認した");
