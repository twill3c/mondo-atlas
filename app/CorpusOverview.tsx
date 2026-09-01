"use client";

import { useMemo, useState } from "react";
import {
  AUTHENTICITIES,
  MEASURES,
  type Measure,
  type SortMode,
  type Work,
  axisTicks,
  barPercent,
  fmt,
  groupByTetralogy,
  legendCounts,
  sortWorks,
} from "@/lib/chart";

const SERIES: Record<string, number> = { 真作: 1, 疑作: 2, 偽作: 3 };

export default function CorpusOverview({ works }: { works: Work[] }) {
  const [measure, setMeasure] = useState<Measure>("n_pages");
  const [sort, setSort] = useState<SortMode>("canonical");

  const spec = MEASURES.find((m) => m.key === measure)!;
  const sorted = useMemo(() => sortWorks(works, sort, measure), [works, sort, measure]);
  const max = useMemo(
    () => Math.max(...works.map((w) => w[measure])),
    [works, measure],
  );

  // 目盛り・格子・帯の長さはすべてこの 1 本から出る(G-07)
  const ticks = useMemo(() => axisTicks(max), [max]);
  const groups = useMemo(
    () => (sort === "canonical" ? groupByTetralogy(sorted) : [{ tetralogy: 0, works: sorted }]),
    [sorted, sort],
  );
  const legend = useMemo(() => legendCounts(sorted), [sorted]);

  return (
    <section aria-labelledby="overview-heading">
      <h2 id="overview-heading">全集の俯瞰 — 36 篇の長さと区分</h2>

      <div className="controls">
        <div>
          <span className="control__label" id="measure-label">
            長さの指標
          </span>
          <div className="segmented" role="group" aria-labelledby="measure-label">
            {MEASURES.map((m) => (
              <button
                key={m.key}
                type="button"
                aria-pressed={measure === m.key}
                onClick={() => setMeasure(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="control__label" id="sort-label">
            並び
          </span>
          <div className="segmented" role="group" aria-labelledby="sort-label">
            <button
              type="button"
              aria-pressed={sort === "canonical"}
              onClick={() => setSort("canonical")}
            >
              四部作順
            </button>
            <button
              type="button"
              aria-pressed={sort === "length"}
              onClick={() => setSort("length")}
            >
              長い順
            </button>
          </div>
        </div>
      </div>

      <ul className="legend">
        {legend.map((e) => (
          <li key={e.key}>
            <span className={`swatch swatch--${SERIES[e.key]}`} aria-hidden="true" />
            {e.key}
            <span className="row__class">{e.count} 篇</span>
          </li>
        ))}
      </ul>

      <div className="chart">
        <div
          className="chart__inner"
          style={
            {
              "--label-w": "9.5rem",
              // 「102,743 語 真作」が入る幅。指標を切り替えても切れない
              "--meta-w": "8.5rem",
            } as React.CSSProperties
          }
        >
          <div className="axis" aria-hidden="true">
            {ticks.map((t) => (
              <span
                key={t}
                className="axis__tick"
                style={{ left: `${barPercent(t, max)}%` }}
              >
                {fmt(t)}
              </span>
            ))}
          </div>

          <div className="rows">
            <div className="grid-lines" aria-hidden="true">
              {ticks.map((t) => (
                <span key={t} style={{ left: `${barPercent(t, max)}%` }} />
              ))}
            </div>

            {groups.map((g) => (
              <div className="tetralogy" key={g.tetralogy}>
                {sort === "canonical" && (
                  <div className="tetralogy__head">第 {g.tetralogy} 四部作</div>
                )}
                {g.works.map((w) => (
                  <div className="row" key={w.id} title={rowTitle(w, spec.label)}>
                    <span className="row__name">{w.title_ja}</span>
                    <span className="row__track">
                      <span
                        className={`bar bar--${SERIES[w.authenticity]}`}
                        style={{ width: `${barPercent(w[measure], max)}%` }}
                      />
                    </span>
                    <span className="row__meta">
                      <span className="row__value">
                        {fmt(w[measure])} {spec.unit}
                      </span>
                      <span className="row__class">{w.authenticity}</span>
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="source">
        長さの単位: {spec.label}。帯の色は真贋の<strong>通説</strong>による区分で、
        本アプリの主張ではない({AUTHENTICITIES.join(" / ")}の 3 区分)。
      </p>
    </section>
  );
}

function rowTitle(w: Work, measureLabel: string): string {
  const parts = [
    `${w.title_ja}(${w.title_grc})`,
    `第 ${w.tetralogy} 四部作`,
    `${measureLabel}`,
    `節 ${fmt(w.n_sections)} / 頁 ${fmt(w.n_pages)} / 希語 ${fmt(w.words_grc)} 語`,
    `通説: ${w.authenticity}`,
  ];
  return parts.join(" — ");
}
