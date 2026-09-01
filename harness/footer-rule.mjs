/**
 * フリート共通フッタの判定規則。**検品器の中に書かない**(HC-080)。
 *
 * 規則を検品器に埋めると、規則が壊れたときに誰も気づかない。ここに切り出して
 * 壊し方ごとの陽性対照つきで単体テストする(tests-js/footer.test.ts)。
 *
 * 規約(koho-lens が正本):
 *   MIT License © 2026 坂田哲朗 ・ GitHub ・ <歩き方> ・ <設計図> ・ App Menu
 *
 * 見るところ:
 *  1. 5 項目が**この順**で現れる(出現順で照合する。文字列分割はしない)
 *  2. 項目のあいだに区切りの「・」が 4 個(CSS の ::before で描くと innerText に出ない)
 *  3. `© 2026 坂田哲朗` が MIT License より後・GitHub より前で、**リンク文言の外**
 *  4. 文言が固定の 3 項目(MIT License / GitHub / App Menu)は**その項目の行き先**を見る。
 *     「どれかが github.com を向いている」では足りない(HC-098)
 *  5. `position: fixed` かつ `bottom: 0`
 */

export const REQUIRED_ORDER = [
  "MIT License",
  "GitHub",
  "歩き方",
  "設計図",
  "App Menu",
];

export const COPYRIGHT = "© 2026 坂田哲朗";

/**
 * @param {{text: string, links: {label: string, href: string}[], position: string, bottom: string}} f
 * @returns {string[]} 違反の一覧(空なら合格)
 */
export function checkFooter(f) {
  const problems = [];
  const text = f.text ?? "";

  // 1. 出現順
  let cursor = -1;
  for (const label of REQUIRED_ORDER) {
    const at = text.indexOf(label, cursor + 1);
    if (at < 0) {
      problems.push(`項目が無い: ${label}`);
      continue;
    }
    if (at <= cursor) problems.push(`項目の順序が違う: ${label}`);
    cursor = at;
  }

  // 2. 区切り
  const seps = (text.match(/・/g) || []).length;
  if (seps !== REQUIRED_ORDER.length - 1) {
    problems.push(`区切りの「・」が ${seps} 個(期待 ${REQUIRED_ORDER.length - 1} 個)`);
  }

  // 3. 著作権表示の位置と、リンク文言の外にあること
  const c = text.indexOf(COPYRIGHT);
  if (c < 0) {
    problems.push(`著作権表示が無い: ${COPYRIGHT}`);
  } else {
    const mit = text.indexOf("MIT License");
    const gh = text.indexOf("GitHub");
    if (!(mit >= 0 && mit < c)) problems.push("著作権表示が MIT License より前にある");
    if (!(gh > c)) problems.push("著作権表示が GitHub より後にある");
    if (f.links.some((l) => l.label.includes(COPYRIGHT))) {
      problems.push("著作権表示がリンク文言の中にある");
    }
  }

  // 4. 行き先(項目ごと)
  const find = (label) => f.links.find((l) => l.label.includes(label));
  const mitLink = find("MIT License");
  if (!mitLink) problems.push("MIT License がリンクでない");
  else if (!/\/blob\/[^/]+\/LICENSE$/.test(mitLink.href)) {
    problems.push(`MIT License の行き先が LICENSE でない: ${mitLink.href}`);
  }

  const ghLink = find("GitHub");
  if (!ghLink) problems.push("GitHub がリンクでない");
  else if (!/^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/.test(ghLink.href)) {
    problems.push(`GitHub の行き先がリポジトリでない: ${ghLink.href}`);
  }

  const amLink = find("App Menu");
  if (!amLink) problems.push("App Menu がリンクでない");
  else if (!/app-menu/.test(amLink.href)) {
    problems.push(`App Menu の行き先が違う: ${amLink.href}`);
  }

  // 5. 固定
  if (f.position !== "fixed") problems.push(`position が ${f.position}(期待 fixed)`);
  if (parseFloat(f.bottom) !== 0) problems.push(`bottom が ${f.bottom}(期待 0px)`);

  return problems;
}
