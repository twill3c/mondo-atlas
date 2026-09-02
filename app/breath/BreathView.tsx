"use client";

import { useMemo, useState } from "react";
import {
  type BreathWork,
  areaPath,
  bookBoundaries,
  density,
  linePath,
  sectionLabel,
  sharedMax,
  smooth,
  summary,
  trustLevel,
} from "@/lib/breath";
import { axisTicks, fmt } from "@/lib/chart";

const H = 120; // 主図の高さ(SVG の座標系)
const SPARK_H = 26;
const WINDOW = 9; // 移動平均の窓(節)。節はほぼ等長なので節数で取る

export default function BreathView({ works }: { works: BreathWork[] }) {
  const [abbr, setAbbr] = useState("Menex");
  const work = works.find((w) => w.abbr === abbr) ?? works[0];

  const sparkMax = useMemo(() => sharedMax(works, WINDOW), [works]);
  const series = useMemo(() => smooth(density(work), WINDOW), [work]);
  const yMax = useMemo(() => {
    const m = Math.max(...series, 1);
    const ticks = axisTicks(Math.ceil(m), 4);
    return ticks[ticks.length - 1];
  }, [series]);
  const yTicks = useMemo(() => axisTicks(Math.ceil(Math.max(...series, 1)), 4), [series]);

  const books = useMemo(() => bookBoundaries(work), [work]);
  const sum = useMemo(() => summary(work), [work]);
  const trust = trustLevel(work.validation);
  const n = work.turns.length;

  // 横軸の目盛りは**実在する節**から取る(G-07)。等間隔に 5 本
  const xTicks = useMemo(() => {
    const out: { at: number; label: string }[] = [];
    const count = Math.min(5, n);
    for (let k = 0; k < count; k++) {
      const i = Math.round((k / (count - 1 || 1)) * (n - 1));
      out.push({ at: i, label: sectionLabel(work, i) });
    }
    return out;
  }, [work, n]);

  return (
    <section aria-labelledby="breath-heading">
      {/* 斜線の定義は 1 か所に置き、主図とスパークラインの両方から参照する。
          それぞれの SVG に持たせると、片方を直したときにもう片方が置き去りになる。 */}
      <svg className="defs-only" aria-hidden="true" focusable="false">
        <defs>
          <pattern
            id="hatch"
            width="4"
            height="4"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="4" className="breath__hatchline" />
          </pattern>
        </defs>
      </svg>

      <h2 id="breath-heading">問答の呼吸 — {work.title}</h2>

      <p className="axis-note">
        縦軸は<strong>千語あたりの交替の回数</strong>。横軸はステファヌス番号の順。
        節ごとの値は跳ねるので、前後 {WINDOW} 節の移動平均で均してある。
        <strong>これは「濃さ」の推定であって、交替の位置ではない。</strong>
      </p>

      {/* バッジは**表示している数**について語る。別の量の検証結果を借りてこない(HC-079)。
          表示値は二つの手がかりの大きい方なので、合成そのものが検証されたかを言い分ける。 */}
      <div className={`trust trust--${trust}`}>
        <span className="trust__badge">{work.validation}</span>
        <span>
          {trust === "high" && (
            <>
              この篇は印刷面の話者記号が全交替を示すので、推定値をそれと照合できた。
              照合したのは上演型の手がかりによる {fmt(work.n_dramatic)} 回である。
              {work.n_turns !== work.n_dramatic && (
                <>
                  {" "}
                  <strong>
                    表示している {fmt(work.n_turns)} 回は、叙述内の発話動詞
                    ({fmt(work.n_narrated)} 回)が上回った節でそちらを採った合成値なので、
                    差の {fmt(work.n_turns - work.n_dramatic)} 回ぶんは照合の外にある。
                  </strong>
                </>
              )}
            </>
          )}
          {trust === "mid" && (
            <>
              話者記号が印刷されないので照合の相手が無い。叙述内の発話動詞
              ({fmt(work.n_narrated)} 回)については、人称の交替が置換対照より有意である
              {work.p != null && <>(p = {work.p.toFixed(4)})</>}。
              <strong>
                ただし表示している {fmt(work.n_turns)} 回は二つの手がかりの大きい方で、
                この合成そのものは検証していない。
              </strong>
            </>
          )}
          {trust === "low" && (
            <>
              照合の相手も内部整合の手立ても無い。
              <strong>縦の絶対値は信用できない</strong> —— 形の変化だけを見てほしい。
              (上演型の手がかり {fmt(work.n_dramatic)} 回 / 叙述内の発話動詞{" "}
              {fmt(work.n_narrated)} 回)
            </>
          )}
        </span>
      </div>

      <div className="chart">
        <div className="breath">
          <div className="breath__yaxis" aria-hidden="true">
            {yTicks.map((t) => (
              <span key={t} style={{ bottom: `${(t / yMax) * 100}%` }}>
                {fmt(t)}
              </span>
            ))}
          </div>

          <div className="breath__plot">
            <svg
              viewBox={`0 0 100 ${H}`}
              preserveAspectRatio="none"
              className="breath__svg"
              role="img"
              aria-label={`${work.title}の問答の濃さ。最も濃いのは ${sum.densestAt}、最も薄いのは ${sum.sparsestAt}。`}
            >
              {yTicks.map((t) => (
                <line
                  key={t}
                  x1="0"
                  x2="100"
                  y1={H - (t / yMax) * H}
                  y2={H - (t / yMax) * H}
                  className="breath__grid"
                  vectorEffect="non-scaling-stroke"
                />
              ))}

              <path
                d={areaPath(series, yMax, H)}
                className={`breath__area breath__area--${trust}`}
                fill={trust === "low" ? "url(#hatch)" : undefined}
              />
              <path
                d={linePath(series, yMax, H)}
                className="breath__line"
                vectorEffect="non-scaling-stroke"
              />

              {books.map((b) => (
                <line
                  key={b.at}
                  x1={(b.at / (n - 1)) * 100}
                  x2={(b.at / (n - 1)) * 100}
                  y1="0"
                  y2={H}
                  className="breath__book"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>

            {books.length > 0 && (
              <div className="breath__booklabels" aria-hidden="true">
                {books.map((b) => (
                  <span key={b.at} style={{ left: `${(b.at / (n - 1)) * 100}%` }}>
                    {work.abbr === "Ep" ? `第${b.label}書簡` : `${b.label}`}
                  </span>
                ))}
              </div>
            )}

            <div className="breath__xaxis" aria-hidden="true">
              {xTicks.map((t) => (
                <span key={t.at} style={{ left: `${(t.at / (n - 1)) * 100}%` }}>
                  {t.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <ul className="kpis kpis--tight">
        <li className="kpi">
          <span className="kpi__value">{sum.per1k.toFixed(1)}</span>
          <span className="kpi__label">千語あたりの交替</span>
        </li>
        <li className="kpi">
          <span className="kpi__value">{fmt(sum.turns)}</span>
          <span className="kpi__label">推定される交替の総数</span>
        </li>
        <li className="kpi">
          <span className="kpi__value">{sum.densestAt}</span>
          <span className="kpi__label">最も濃い箇所({sum.densest.toFixed(1)})</span>
        </li>
        <li className="kpi">
          <span className="kpi__value">{sum.sparsestAt}</span>
          <span className="kpi__label">最も薄い箇所({sum.sparsest.toFixed(1)})</span>
        </li>
      </ul>

      <h3 className="spark-heading">36 篇を同じ物差しで</h3>
      <p className="axis-note">
        縦の高さは全篇で共通(上限 {sharedMax(works, WINDOW).toFixed(0)} 回/千語)。
        押すと上の図が入れ替わる。斜線は検証できていない篇。
      </p>

      <div className="sparks">
        {works.map((w) => {
          const s = smooth(density(w), WINDOW);
          const t = trustLevel(w.validation);
          return (
            <button
              key={w.abbr}
              type="button"
              className="spark"
              aria-pressed={w.abbr === abbr}
              onClick={() => setAbbr(w.abbr)}
              title={`${w.title} — ${w.validation}`}
            >
              <span className="spark__name">{w.title}</span>
              <svg viewBox={`0 0 100 ${SPARK_H}`} preserveAspectRatio="none" aria-hidden="true">
                <path
                  d={areaPath(s, sparkMax, SPARK_H)}
                  className={`breath__area breath__area--${t}`}
                  fill={t === "low" ? "url(#hatch)" : undefined}
                />
              </svg>
            </button>
          );
        })}
      </div>
    </section>
  );
}
