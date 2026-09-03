"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fmt } from "@/lib/chart";
import {
  type ReaderWork,
  type WorkLink,
  byPage,
  isUntranslated,
  pageIndexOf,
  parseLoc,
  progress,
  workOf,
} from "@/lib/reader";

/**
 * 一篇ぶんのリーダー。**この画面は自分の篇しか受け取らない**(N-03)。
 * 他の篇へはリンクで移る —— 束ねて持つと篇を足すたびに全部が重くなる。
 */
export default function ReaderView({
  work,
  others,
}: {
  work: ReaderWork;
  others: WorkLink[];
}) {
  const pages = useMemo(() => byPage(work), [work]);
  const [pageIdx, setPageIdx] = useState(0);
  const [focus, setFocus] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const p = progress(work);
  const group = pages[Math.min(pageIdx, pages.length - 1)];

  // ?loc=Crit.51c で開いたら、その節を含む**頁**を開いてそこへ飛ぶ。
  // 形の検査を通った ID だけを使う(URL の文字列をそのまま要素の探索に渡さない)。
  // 別の篇の住所ならここでは何もしない —— 目次がその篇の頁へ送る
  useEffect(() => {
    const loc = parseLoc(window.location.search);
    if (!loc || workOf(loc) !== work.abbr) return;
    const idx = pageIndexOf(work, loc);
    if (idx < 0) return;
    setPageIdx(idx);
    setFocus(loc);
  }, [work]);

  useEffect(() => {
    if (!focus) return;
    const el = boxRef.current?.querySelector(`[data-sec="${CSS.escape(focus)}"]`);
    if (el) el.scrollIntoView({ block: "center", behavior: "auto" });
  }, [focus, pageIdx]);

  function go(idx: number) {
    setPageIdx(Math.max(0, Math.min(pages.length - 1, idx)));
    setFocus(null);
  }

  return (
    <section aria-labelledby="read-heading">
      <h2 id="read-heading">{work.title} — 希語・英訳・和訳</h2>

      <div className="controls">
        <div>
          <span className="control__label" id="rw-label">
            篇
          </span>
          <div className="segmented" role="group" aria-labelledby="rw-label">
            {others.map((w) => (
              <a
                key={w.slug}
                href={`/read/${w.slug}/`}
                aria-current={w.abbr === work.abbr ? "page" : undefined}
                className="segmented__link"
              >
                {w.title}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className={`trust trust--${work.complete ? "high" : "low"}`}>
        <span className="trust__badge">{work.complete ? "完訳" : "訳の途中"}</span>
        <span>
          和訳は {fmt(p.done)} / {fmt(p.total)} 節。
          {work.complete ? (
            <>この篇はすべての節に訳がある。</>
          ) : (
            <>
              <strong>訳の無い節は空欄のまま置いてある</strong> ——
              節そのものが無いのではなく、まだ訳していない。
            </>
          )}
        </span>
      </div>

      <p className="axis-note">
        行送りはステファヌス節で揃えてある。節は文の途中で切れることがあるが、
        <strong>原文の切れ目を直していない</strong> —— 訳も同じところで切る。
        めくる単位もステファヌス頁で、住所の単位とそろえてある。
      </p>

      <nav className="pager" aria-label="頁送り">
        <button type="button" onClick={() => go(pageIdx - 1)} disabled={pageIdx === 0}>
          ◀ 前の頁
        </button>
        <span className="pager__now">
          {group.page} 頁
          <span className="pager__of">
            {pageIdx + 1} / {pages.length}
          </span>
        </span>
        <button
          type="button"
          onClick={() => go(pageIdx + 1)}
          disabled={pageIdx === pages.length - 1}
        >
          次の頁 ▶
        </button>
      </nav>

      <div className="pager__jump" role="group" aria-label="頁を選ぶ">
        {pages.map((g, i) => (
          <button
            key={g.page}
            type="button"
            aria-pressed={i === pageIdx}
            className={
              g.sections.every(isUntranslated) ? "pager__num pager__num--none" : "pager__num"
            }
            title={
              g.sections.every(isUntranslated)
                ? `${g.page} 頁(この頁はまだ訳していない)`
                : `${g.page} 頁`
            }
            onClick={() => go(i)}
          >
            {g.page}
          </button>
        ))}
      </div>

      <div className="reader" ref={boxRef}>
        <div className="reader__page">
          <div className="reader__pageno">
            ステファヌス {group.page} 頁 — {group.sections.length} 節
          </div>
          {group.sections.map((s) => (
            <div
              key={s.id}
              data-sec={s.id}
              className={[
                "sec",
                isUntranslated(s) ? "sec--untranslated" : "",
                focus === s.id ? "sec--focus" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <a
                className="sec__id"
                href={`?loc=${s.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  setFocus(s.id);
                  window.history.replaceState(null, "", `?loc=${s.id}`);
                }}
                title={`${s.id} への直リンク`}
              >
                {s.page}
                {s.letter}
              </a>
              <div className="sec__cols">
                <p className="sec__grc" lang="grc">
                  {s.grc}
                </p>
                <p className="sec__eng" lang="en">
                  {s.eng || "(英訳なし)"}
                </p>
                <p className={`sec__ja${isUntranslated(s) ? " sec__ja--empty" : ""}`}>
                  {s.ja || "(未訳)"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <nav className="pager" aria-label="頁送り(下)">
        <button type="button" onClick={() => go(pageIdx - 1)} disabled={pageIdx === 0}>
          ◀ 前の頁
        </button>
        <span className="pager__now">
          {group.page} 頁
          <span className="pager__of">
            {pageIdx + 1} / {pages.length}
          </span>
        </span>
        <button
          type="button"
          onClick={() => go(pageIdx + 1)}
          disabled={pageIdx === pages.length - 1}
        >
          次の頁 ▶
        </button>
      </nav>
    </section>
  );
}
