/**
 * ビルドの刻印を作る(HC-141)。
 *
 * `npm run smoke:prod` は**本番が健やかか**は見るが、
 * **配られているものが手元と同じか**は見ていなかった。
 * その結果、デプロイが日次上限で失敗した直後にも全項目合格を返し、
 * 古い本番を検品して「合格」と報告しかけた(2026-09-03 実地)。
 *
 * そこで、配られる木の内容から刻印を作って `public/` に置く。
 * ビルドは手元でも Vercel でも同じ木から走るので、同じ刻印になる。
 * 検品はこれを引いて手元の値と突き合わせ、**違えば不合格にする**。
 *
 * 刻印の材料は「画面が読むデータ」だけにする ——
 * ここが変われば画面の中身が変わり、変わらなければ画面は同じだからである。
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** 画面がビルド時に import しているデータ。増やしたらここにも足す。 */
export const STAMPED = [
  "data/index.json",
  "data/breath.json",
  "data/words.json",
  "data/style.json",
  "data/japanese.json",
  "data/reader.json",
];

export function computeStamp(root = ROOT) {
  const h = createHash("sha256");
  const files = [];
  for (const rel of STAMPED) {
    const buf = readFileSync(join(root, rel));
    const one = createHash("sha256").update(buf).digest("hex").slice(0, 12);
    files.push({ path: rel, bytes: buf.length, sha: one });
    h.update(rel).update("\0").update(buf).update("\0");
  }
  return { stamp: h.digest("hex").slice(0, 16), files };
}

function main() {
  const out = join(ROOT, "public", "build-stamp.json");
  if (!existsSync(dirname(out))) mkdirSync(dirname(out), { recursive: true });
  const doc = computeStamp();
  writeFileSync(out, JSON.stringify(doc, null, 1));
  console.log(`刻印 ${doc.stamp}(${doc.files.length} ファイル)→ public/build-stamp.json`);
}

if (process.argv[1] && process.argv[1].endsWith("build_stamp.mjs")) main();
