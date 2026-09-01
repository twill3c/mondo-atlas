/**
 * フッタのリンク先。フリート共通のフッタ規約(koho-lens が正本)。
 *
 *   MIT License © 2026 坂田哲朗 ・ GitHub ・ <歩き方> ・ <設計図> ・ App Menu
 *
 * 解説アーティファクト 2 本は 2026-09-02 に発行済み。
 * **アーティファクトは既定で非公開なので、フッタから開けるようにするには
 * 各ページの共有設定が要る**(フリート共通の注意点)。
 *
 * GitHub リポジトリ `twill3c/mondo-atlas` は 2026-09-02 に public で作成し push 済み。
 * LICENSE / README.md / SPEC.md の 3 ファイルが存在することを確認してある
 * —— 無いと MIT License と歩き方・設計図のリンクが 404 になる。
 */

export const REPO = "https://github.com/twill3c/mondo-atlas";

const ARTIFACT = "https://claude.ai/code/artifact";

export const LINKS = {
  license: `${REPO}/blob/main/LICENSE`,
  github: REPO,
  walkthrough: `${ARTIFACT}/0bb289bb-636b-40f4-a8fe-7ee7aa01034d`,
  blueprint: `${ARTIFACT}/ec5d900a-a73e-4937-bb0a-5316a96a8f33`,
  appMenu: "https://app-menu-amber.vercel.app/",
} as const;

export const FOOTER_ITEMS = [
  { label: "MIT License", href: LINKS.license },
  { label: "GitHub", href: LINKS.github },
  { label: "問答アトラスの歩き方", href: LINKS.walkthrough },
  { label: "問答アトラス 設計図", href: LINKS.blueprint },
  { label: "App Menu", href: LINKS.appMenu },
] as const;
