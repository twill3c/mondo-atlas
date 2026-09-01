/**
 * フッタのリンク先。フリート共通のフッタ規約(koho-lens が正本)。
 *
 *   MIT License © 2026 坂田哲朗 ・ GitHub ・ <歩き方> ・ <設計図> ・ App Menu
 *
 * **暫定がひとつある。** 解説アーティファクト 2 本(歩き方 / 設計図)はまだ発行していない。
 * senoto-mori の先例に倣い、発行するまでは GitHub 上の README.md / SPEC.md を指しておく。
 * 発行したら `WALKTHROUGH` と `BLUEPRINT` を差し替える。
 *
 * GitHub リポジトリ自体も未作成である。**本番公開の前に作ること** ——
 * 作らないまま出すと MIT License / GitHub の 2 項目が 404 になる。
 */

export const REPO = "https://github.com/twill3c/mondo-atlas";

export const LINKS = {
  license: `${REPO}/blob/main/LICENSE`,
  github: REPO,
  // 暫定: 解説アーティファクト発行までの仮リンク
  walkthrough: `${REPO}/blob/main/README.md`,
  blueprint: `${REPO}/blob/main/SPEC.md`,
  appMenu: "https://app-menu-amber.vercel.app/",
} as const;

export const FOOTER_ITEMS = [
  { label: "MIT License", href: LINKS.license },
  { label: "GitHub", href: LINKS.github },
  { label: "問答アトラスの歩き方", href: LINKS.walkthrough },
  { label: "問答アトラス 設計図", href: LINKS.blueprint },
  { label: "App Menu", href: LINKS.appMenu },
] as const;
