"use client";

import { useMemo, useState } from "react";
import { fmt } from "@/lib/chart";
import {
  type JapaneseWork,
  byTetralogy,
  fillState,
  summarizedPages,
} from "@/lib/japanese";

const FILL_WORDS: Record<string, string> = {
  full: "全頁の要旨あり",
  partial: "一部の頁に要旨あり",
  none: "頁の要旨はこれから",
};

export default function JapaneseView({ works }: { works: JapaneseWork[] }) {
  const [open, setOpen] = useState<string | null>("Crit");
  const groups = useMemo(() => byTetralogy(works), [works]);

  return (
    <section aria-labelledby="ja-heading">
      <h2 id="ja-heading">三十六篇の解題と、頁ごとの要旨</h2>

      <p className="axis-note">
        解題は全篇にある。頁ごとの要旨は<strong>書けたぶんだけ</strong>で、
        まだ書いていない頁は空欄のままにしてある ——
        <strong>「書いていない」を「無い」に見せないため</strong>である。
        篇名を押すと開く。
      </p>

      {groups.map((g) => (
        <div key={g.tetralogy} className="tetra">
          <h3 className="tetra__head">第 {g.tetralogy} 四部作</h3>
          <ul className="ja-list">
            {g.works.map((w) => {
              const state = fillState(w);
              const rows = summarizedPages(w);
              const isOpen = open === w.abbr;
              return (
                <li key={w.abbr} className="ja-item">
                  <button
                    type="button"
                    className="ja-item__head"
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? null : w.abbr)}
                  >
                    <span className="ja-item__title">{w.title}</span>
                    <span className="ja-item__meta">
                      <span className={`fill fill--${state}`}>{FILL_WORDS[state]}</span>
                      <span className="row__class">
                        {fmt(w.nSummaries)} / {fmt(w.nPages)} 頁
                      </span>
                    </span>
                  </button>

                  {isOpen && (
                    <div className="ja-item__body">
                      <p className="kaidai">{w.kaidai}</p>
                      {rows.length > 0 ? (
                        <ol className="pagelist">
                          {rows.map((r) => (
                            <li key={r.page}>
                              <span className="pagelist__no">{r.page}</span>
                              <span>{r.text}</span>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className="row__class">
                          この篇の頁ごとの要旨はまだ書いていない。
                          英訳本文を実際に読んで書くので、順に埋めていく。
                        </p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
