import { FOOTER_ITEMS } from "@/lib/links";

/**
 * フリート共通フッタ。
 *
 *   MIT License © 2026 坂田哲朗 ・ GitHub ・ <歩き方> ・ <設計図> ・ App Menu
 *
 * 規約の要点(実装で外しやすいところ):
 *  - 区切りの「・」は**文字として置く**。CSS の ::before で描くと innerText に出ず、
 *    検品器から見えない
 *  - `© 2026 坂田哲朗` は **MIT License より後・GitHub より前**で、
 *    **リンク文言の外**(直後の地の文)に置く
 *  - `position: fixed; bottom: 0`。body 側に逃げの padding を取る
 */
export default function Footer() {
  return (
    <footer className="fleet-footer">
      {FOOTER_ITEMS.map((item, i) => (
        <span key={item.href + item.label}>
          {i > 0 && <span className="fsep">・</span>}
          <a href={item.href} target="_blank" rel="noreferrer noopener">
            {item.label}
          </a>
          {i === 0 && " © 2026 坂田哲朗"}
        </span>
      ))}
    </footer>
  );
}
