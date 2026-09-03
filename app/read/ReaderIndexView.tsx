"use client";

import { useEffect, useState } from "react";
import { fmt } from "@/lib/chart";
import { type WorkLink, parseLoc, readerHref } from "@/lib/reader";

/**
 * 目次。**本文を持たない**ので軽い(N-03)。
 *
 * ここは `?loc=Crit.43a` の受け口も兼ねる ——
 * この住所は画面の断り書きにも解説にも載せて既に配ってしまったので、
 * 篇ごとに頁を分けたあとも**壊してはならない**。形の検査を通ったものだけ、
 * その篇の頁へ送る。通らないものは何もせず目次のまま置く。
 */
export default function ReaderIndexView({ works }: { works: WorkLink[] }) {
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    const loc = parseLoc(window.location.search);
    if (!loc) return;
    const href = readerHref(
      loc,
      works.map((w) => w.abbr),
    );
    if (!href) return;
    setSent(loc);
    window.location.replace(href);
  }, [works]);

  if (sent) {
    return (
      <p className="lede" role="status">
        {sent} の載っている篇へ移ります…
      </p>
    );
  }

  return (
    <ul className="worklist">
      {works.map((w) => (
        <li key={w.slug} className="worklist__item">
          <a className="worklist__link" href={`/read/${w.slug}/`}>
            {w.title}
          </a>
          <span className="worklist__meta">
            {fmt(w.nSections)} 節 / {fmt(w.pages.length)} 頁
            <span className={`row__class ${w.complete ? "is-done" : ""}`}>
              {w.complete ? "完訳" : `訳 ${fmt(w.nTranslated)} 節`}
            </span>
            <span className="worklist__bytes">{Math.round(w.bytes / 1000)} KB</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
