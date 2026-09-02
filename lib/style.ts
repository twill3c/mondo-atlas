/**
 * 画面④(文体の指紋)の幾何。
 *
 * 二つの軸はどちらも何かを語っている(効果量 2.08 と 2.31)ので散布図にする。
 * 片方しか効いていないなら散布図にしてはいけない —— 二軸あるふりになる。
 *
 * 軸の範囲・目盛りは図と同じデータから導く(G-07)。
 */

export type StyleWork = {
  abbr: string;
  title: string;
  tetralogy: number;
  tokens: number;
  hiatus: number;
  hiatusPer1k: number;
  elidedPer1k: number;
  kathaper: number;
  hosper: number;
  share: number;
  shareReliable: boolean;
  late: boolean;
};

/** 軸の範囲。データの最小・最大に少しだけ余白を足す。 */
export function axisRange(values: number[], pad = 0.06): { min: number; max: number } {
  if (values.length === 0) return { min: 0, max: 1 };
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  return { min: lo - span * pad, max: hi + span * pad };
}

/** 目盛り。1・2・2.5・5 × 10^n から、目標本数に近いものを選ぶ。 */
export function ticksFor(min: number, max: number, target = 4): number[] {
  const span = max - min;
  if (!(span > 0)) return [min];
  const rough = span / target;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  let step = mag;
  let best = Infinity;
  for (const m of [1, 2, 2.5, 5, 10]) {
    const cand = m * mag;
    const err = Math.abs(span / cand - target);
    if (err < best) {
      best = err;
      step = cand;
    }
  }
  const out: number[] = [];
  const start = Math.ceil(min / step) * step;
  for (let v = start; v <= max + step * 1e-9; v += step) {
    out.push(Number(v.toFixed(10)));
  }
  return out;
}

/** 値を 0..100 の位置に写す。軸の範囲は呼び手が決める。 */
export function pos(value: number, min: number, max: number): number {
  if (max === min) return 50;
  return ((value - min) / (max - min)) * 100;
}

/** 相関(表示する数はすべてここから導く)。 */
export function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let cov = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < n; i++) {
    cov += (xs[i] - mx) * (ys[i] - my);
    vx += (xs[i] - mx) ** 2;
    vy += (ys[i] - my) ** 2;
  }
  const d = Math.sqrt(vx) * Math.sqrt(vy);
  return d ? cov / d : 0;
}

/** ヒアトゥス率の低い順。同値は略号で安定させる。 */
export function byHiatus(works: StyleWork[]): StyleWork[] {
  return [...works].sort((a, b) => a.hiatus - b.hiatus || a.abbr.localeCompare(b.abbr));
}

/** 後期群が下位いくつを占めているか。図の脇の文はここから導く(G-07)。 */
export function lateRanks(works: StyleWork[]): number[] {
  const sorted = byHiatus(works);
  return sorted.map((w, i) => (w.late ? i : -1)).filter((i) => i >= 0);
}
