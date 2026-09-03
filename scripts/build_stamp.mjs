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
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * 画面がビルド時に import しているデータ。
 *
 * リーダーは篇ごとに分かれていて**篇を足すとファイルが増える**ので、
 * 一覧を手で書かず `data/reader/` を実際に見て作る ——
 * 書き忘れると刻印が本文の変化を見落とす。
 * T-720 が `app/` の import と突き合わせて漏れを撃つ。
 */
function readerFiles(root) {
  const dir = join(root, "data", "reader");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => n.endsWith(".json"))
    .sort()
    .map((n) => `data/reader/${n}`);
}

export function stampedFiles(root = ROOT) {
  return [
    "data/index.json",
    "data/breath.json",
    "data/words.json",
    "data/style.json",
    "data/japanese.json",
    ...readerFiles(root),
  ];
}

/** 既定の木での対象一覧(検査が読みやすいように名前を残す)。 */
export const STAMPED = stampedFiles();

/**
 * 改行を揃えてから測る。
 *
 * この機は `core.autocrlf=true` なので、**作業ツリーは CRLF・git と配信側は LF** になる。
 * 生のバイト列で測ると、同じ内容でも手元と本番で必ず食い違い、
 * 検査が毎回「違う」と言い続ける —— **狼少年になった検査は、何も検査しないのと
 * 同じか、それより悪い**(無視する癖がつくぶん)。
 * JSON にとって CRLF と LF は中身の違いではないので、揃えてから測る。
 */
function normalizeEol(buf) {
  return Buffer.from(buf.toString("utf8").split("\r\n").join("\n"), "utf8");
}

export function computeStamp(root = ROOT) {
  const h = createHash("sha256");
  const files = [];
  for (const rel of stampedFiles(root)) {
    const buf = normalizeEol(readFileSync(join(root, rel)));
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
