"use client";

import { useMemo, useState } from "react";
import { fmt } from "@/lib/chart";
import {
  LEVELS,
  type WordSort,
  type WordTerm,
  type WordWork,
  allBinValues,
  densestWork,
  levelBreaks,
  levelOf,
  peakBin,
  sortWorks,
} from "@/lib/words";

export default function WordsView({
  terms,
  works,
  bins,
}: {
  terms: WordTerm[];
  works: WordWork[];
  bins: number;
}) {
  const [key, setKey] = useState("eidos");
  const [sort, setSort] = useState<WordSort>("rate");

  const term = terms.find((t) => t.key === key) ?? terms[0];
  const breaks = useMemo(() => levelBreaks(allBinValues(works, term.key)), [works, term.key]);
  const rows = useMemo(() => sortWorks(works, sort, term.key), [works, sort, term.key]);
  const top = useMemo(() => densestWork(works, term.key), [works, term.key]);
  const peak = top ? peakBin(top, term.key) : null;

  return (
    <section aria-labelledby="words-heading">
      <h2 id="words-heading">
        語の地層 — {term.lemma}({term.ja})
      </h2>

      <div className="controls">
        <div>
          <span className="control__label" id="term-label">
            見出し語
          </span>
          <div className="chips" role="group" aria-labelledby="term-label">
            {terms.map((t) => (
              <button
                key={t.key}
                type="button"
                className="chip"
                aria-pressed={t.key === key}
                onClick={() => setKey(t.key)}
                title={`${t.lemma}(${t.ja}) — 延べ ${fmt(t.total)}`}
              >
                <span className="chip__grc">{t.lemma}</span>
                <span className="chip__ja">{t.ja}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="control__label" id="wsort-label">
            並び
          </span>
          <div className="segmented" role="group" aria-labelledby="wsort-label">
            <button type="button" aria-pressed={sort === "rate"} onClick={() => setSort("rate")}>
              濃い順
            </button>
            <button
              type="button"
              aria-pressed={sort === "canonical"}
              onClick={() => setSort("canonical")}
            >
              四部作順
            </button>
          </div>
        </div>
      </div>

      <p className="axis-note">
        値は<strong>千語あたりの出現数</strong>。篇の長さは 1,509 語から 102,743 語まで
        68 倍違うので、素の件数で並べると長い篇が濃く見えるだけの図になる。
        横は篇を {bins} 等分した位置(左が冒頭、右が末尾)。
      </p>

      <ul className="legend legend--scale">
        <li>薄い</li>
        {Array.from({ length: LEVELS }, (_, i) => (
          <li key={i}>
            <span className={`swatch swatch--l${i + 1}`} aria-hidden="true" />
            <span className="row__class">
              {i === LEVELS - 1
                ? `${breaks[i - 1].toFixed(1)}+`
                : `〜${breaks[i].toFixed(1)}`}
            </span>
          </li>
        ))}
        {/* 長い注記に nowrap を効かせると狭い幅で横に溢れる(390px で実測) */}
        <li className="legend__note">
          濃い(上端は 95 パーセンタイルで<strong>切り詰めてある</strong> —
          一区間の突出で他が潰れないように)
        </li>
      </ul>

      <div className="chart">
        <div className="heat" style={{ ["--bins" as string]: String(bins) }}>
          {rows.map((w) => (
            <div className="heat__row" key={w.abbr}>
              <span className="heat__name" title={`${w.title} — 千語あたり ${w.rates[term.key]}`}>
                {w.title}
              </span>
              <span className="heat__cells">
                {w.bins[term.key].map((v, i) => (
                  <span
                    key={i}
                    className={`heat__cell heat__cell--l${levelOf(v, breaks)}`}
                    title={`${w.title} ${Math.round((i / bins) * 100)}%地点 — ${v} 回/千語`}
                  />
                ))}
              </span>
              <span className="heat__rate">{w.rates[term.key].toFixed(1)}</span>
            </div>
          ))}
        </div>
      </div>

      <ul className="kpis kpis--tight">
        <li className="kpi">
          <span className="kpi__value">{fmt(term.total)}</span>
          <span className="kpi__label">全集での延べ出現</span>
        </li>
        <li className="kpi">
          <span className="kpi__value">{term.rate.toFixed(2)}</span>
          <span className="kpi__label">千語あたり(全集)</span>
        </li>
        <li className="kpi">
          <span className="kpi__value">{top?.title ?? "—"}</span>
          <span className="kpi__label">
            最も濃い篇({top ? top.rates[term.key].toFixed(1) : "—"})
          </span>
        </li>
        <li className="kpi">
          <span className="kpi__value">
            {peak ? `${Math.round((peak.index / bins) * 100)}%` : "—"}
          </span>
          <span className="kpi__label">その篇の中で最も濃い位置</span>
        </li>
      </ul>

      <div className="note">
        <p>
          <strong>この語をどう数えたか。</strong>
          {term.lemma} は <strong>{term.n_forms} 個の語形</strong>を採っている。
          {term.n_excluded_surfaces > 0 && (
            <>
              {" "}
              さらに <strong>{term.n_excluded_surfaces} 個の表層</strong>を
              「アクセントを外すと同じになるが別語」として落としてある。
            </>
          )}{" "}
          採否は{" "}
          <a
            href="https://github.com/twill3c/mondo-atlas/blob/main/data/curated/word-ledger.json"
            target="_blank"
            rel="noreferrer noopener"
          >
            台帳
          </a>
          に全部書いてある。
        </p>
      </div>
    </section>
  );
}
