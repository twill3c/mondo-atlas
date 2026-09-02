"use client";

import { useMemo, useState } from "react";
import {
  type StyleWork,
  axisRange,
  byHiatus,
  lateRanks,
  pos,
  ticksFor,
} from "@/lib/style";

const H = 360; // 散布図の高さ(px 相当。SVG は viewBox で伸縮させない)

export default function StyleView({
  works,
  corr,
  minParticles,
}: {
  works: StyleWork[];
  corr: { all: number; withoutLate: number; reliableOnly: number; nWithoutLate: number };
  minParticles: number;
}) {
  const [hover, setHover] = useState<string | null>(null);

  const xs = works.map((w) => w.hiatus);
  const ys = works.map((w) => w.share);
  const xr = useMemo(() => axisRange(xs), [works]);
  const yr = useMemo(() => ({ min: 0, max: 1 }), []);
  const xTicks = useMemo(() => ticksFor(xr.min, xr.max, 4), [xr]);
  const yTicks = useMemo(() => ticksFor(yr.min, yr.max, 4), [yr]);

  const ranks = useMemo(() => lateRanks(works), [works]);
  const sorted = useMemo(() => byHiatus(works), [works]);
  const active = works.find((w) => w.abbr === hover);

  return (
    <section aria-labelledby="style-heading">
      <h2 id="style-heading">文体の指紋 — 二つの物差しが同じことを言う</h2>

      <p className="axis-note">
        横は<strong>ヒアトゥス率</strong>(母音で終わった語の組のうち、次も母音で始まった割合)。
        縦は <strong>καθάπερ の取り分</strong>(καθάπερ ÷ (καθάπερ + ὥσπερ))。
        一方は音の連なり、他方は語の選び方で、<strong>測っている性質が違う</strong>。
        色を塗ってあるのは<strong>通説で後期とされる 6 篇</strong> —— この区分は
        当てはめには一切使っておらず、あとから重ねただけである。
      </p>

      <div className="chart">
        <div className="scatter">
          <div className="scatter__yaxis" aria-hidden="true">
            {yTicks.map((t) => (
              <span key={t} style={{ bottom: `${pos(t, yr.min, yr.max)}%` }}>
                {t.toFixed(2)}
              </span>
            ))}
          </div>

          <div className="scatter__plot" style={{ height: `${H}px` }}>
            {yTicks.map((t) => (
              <span
                key={`gy${t}`}
                className="scatter__grid scatter__grid--h"
                style={{ bottom: `${pos(t, yr.min, yr.max)}%` }}
                aria-hidden="true"
              />
            ))}
            {xTicks.map((t) => (
              <span
                key={`gx${t}`}
                className="scatter__grid scatter__grid--v"
                style={{ left: `${pos(t, xr.min, xr.max)}%` }}
                aria-hidden="true"
              />
            ))}

            {works.map((w) => (
              <button
                key={w.abbr}
                type="button"
                className={[
                  "dot",
                  w.late ? "dot--late" : "dot--other",
                  w.shareReliable ? "" : "dot--weak",
                  hover === w.abbr ? "dot--on" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{
                  left: `${pos(w.hiatus, xr.min, xr.max)}%`,
                  bottom: `${pos(w.share, yr.min, yr.max)}%`,
                }}
                onMouseEnter={() => setHover(w.abbr)}
                onFocus={() => setHover(w.abbr)}
                onMouseLeave={() => setHover(null)}
                onBlur={() => setHover(null)}
                aria-label={`${w.title} — ヒアトゥス率 ${w.hiatus.toFixed(3)}、καθάπερ の取り分 ${w.share.toFixed(2)}${w.shareReliable ? "" : "(件数が少なく不安定)"}`}
              >
                <span className="dot__label">{w.title}</span>
              </button>
            ))}
          </div>

          <div className="scatter__xaxis" aria-hidden="true">
            {xTicks.map((t) => (
              <span key={t} style={{ left: `${pos(t, xr.min, xr.max)}%` }}>
                {t.toFixed(2)}
              </span>
            ))}
          </div>
        </div>
      </div>

      <ul className="legend">
        <li>
          <span className="swatch swatch--1" aria-hidden="true" />
          通説で後期とされる 6 篇
        </li>
        <li>
          <span className="swatch swatch--muted" aria-hidden="true" />
          それ以外の 30 篇
        </li>
        <li>
          <span className="swatch swatch--weak" aria-hidden="true" />
          καθάπερ + ὥσπερ が {minParticles} 件未満(縦の位置が不安定)
        </li>
      </ul>

      {/* 図の中に名前を常時出すと、6 篇が固まっている領域で文字が重なる(目視で確認)。
          名前と実数はここに出し、図では触れたときだけ出す。 */}
      <ul className="late-list">
        {works
          .filter((w) => w.late)
          .sort((a, b) => a.hiatus - b.hiatus)
          .map((w) => (
            <li key={w.abbr}>
              <span className="late-list__mark" aria-hidden="true" />
              <span>{w.title}</span>
              <span className="late-list__num">
                {w.hiatus.toFixed(3)} / {w.share.toFixed(2)}
              </span>
            </li>
          ))}
      </ul>

      <p className="axis-note">
        {active ? (
          <>
            <strong>{active.title}</strong> — ヒアトゥス率 {active.hiatus.toFixed(3)}、
            καθάπερ {active.kathaper} 回 / ὥσπερ {active.hosper} 回(取り分{" "}
            {active.share.toFixed(2)}
            {active.shareReliable ? "" : "・件数が少なく不安定"})、
            エリジョン {active.elidedPer1k.toFixed(1)} 回/千語
          </>
        ) : (
          <>点に触れると、その篇の実数が出る。</>
        )}
      </p>

      <ul className="kpis kpis--tight">
        <li className="kpi">
          <span className="kpi__value">{corr.all.toFixed(2)}</span>
          <span className="kpi__label">二軸の相関(全 36 篇)</span>
        </li>
        <li className="kpi">
          <span className="kpi__value">{corr.withoutLate.toFixed(2)}</span>
          <span className="kpi__label">後期群を除く {corr.nWithoutLate} 篇でも</span>
        </li>
        <li className="kpi">
          <span className="kpi__value">
            {ranks.map((r) => r + 1).join("・")}
          </span>
          <span className="kpi__label">後期 6 篇の順位(ヒアトゥス率の低い順)</span>
        </li>
        <li className="kpi">
          <span className="kpi__value">{sorted[1].title}</span>
          <span className="kpi__label">2 位に入った通説外の篇</span>
        </li>
      </ul>
    </section>
  );
}
