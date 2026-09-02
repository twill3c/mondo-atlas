/**
 * 画面②(問答の呼吸)の幾何。
 *
 * 縦軸は「千語あたりの交替数」であって、交替の**位置**ではない。
 * 較正で分かったのは「位置は当てられない・濃さは当てられる」なので、
 * 出せるのは濃さだけである(SPEC G-11)。
 *
 * 図に添えるラベル・軸・巻の境目は、図を生成したのと同じ配列から導く(G-07)。
 */

export type BreathWork = {
  abbr: string;
  title: string;
  tetralogy: number;
  register: "dramatic" | "narrated" | "mixed" | "none";
  validation: string;
  f1: number | null;
  p: number | null;
  n_turns: number;
  n_dramatic: number;
  n_narrated: number;
  pages: number[];
  letters: string;
  turns: number[];
  tokens: number[];
  books: (string | null)[] | null;
};

/** 節ごとの千語あたり交替数。語数 0 の節は 0 とする。 */
export function density(work: BreathWork): number[] {
  return work.turns.map((t, i) => {
    const k = work.tokens[i];
    return k > 0 ? (t * 1000) / k : 0;
  });
}

/**
 * 移動平均。節ごとの値は跳ねるので、形を見るときは均す。
 * **窓は奇数**にして中央を揃える。端は縮めた窓で埋める(欠測にしない)。
 */
export function smooth(values: number[], window: number): number[] {
  if (window <= 1) return [...values];
  const half = Math.floor(window / 2);
  return values.map((_, i) => {
    const lo = Math.max(0, i - half);
    const hi = Math.min(values.length - 1, i + half);
    let sum = 0;
    for (let j = lo; j <= hi; j++) sum += values[j];
    return sum / (hi - lo + 1);
  });
}

/** 節 ID(表示用)。書簡集は手紙番号を持つが、ここでは頁と欄だけ出す。 */
export function sectionLabel(work: BreathWork, i: number): string {
  return `${work.pages[i]}${work.letters[i]}`;
}

/** 巻(または手紙)の切れ目の位置。同じ配列から導くので図とずれない。 */
export function bookBoundaries(work: BreathWork): { at: number; label: string }[] {
  if (!work.books) return [];
  const out: { at: number; label: string }[] = [];
  let prev: string | null = null;
  work.books.forEach((b, i) => {
    if (b && b !== prev) {
      out.push({ at: i, label: b });
      prev = b;
    }
  });
  return out;
}

/** 縦軸の上限。**全篇で共通**にすると篇どうしを見比べられる(F-05b)。 */
export function sharedMax(works: BreathWork[], window: number): number {
  let m = 0;
  for (const w of works) {
    for (const v of smooth(density(w), window)) m = Math.max(m, v);
  }
  return m;
}

/** 折れ線を面グラフの経路にする。x は 0..1 に正規化して幅に依らせない。 */
export function areaPath(values: number[], max: number, height: number): string {
  const n = values.length;
  if (n === 0 || max <= 0) return "";
  const x = (i: number) => (n === 1 ? 0 : (i / (n - 1)) * 100);
  const y = (v: number) => height - Math.min(1, v / max) * height;
  let d = `M 0 ${height}`;
  values.forEach((v, i) => {
    d += ` L ${x(i).toFixed(3)} ${y(v).toFixed(2)}`;
  });
  d += ` L 100 ${height} Z`;
  return d;
}

/** 折れ線だけの経路(面の上辺)。 */
export function linePath(values: number[], max: number, height: number): string {
  const n = values.length;
  if (n === 0 || max <= 0) return "";
  const x = (i: number) => (n === 1 ? 0 : (i / (n - 1)) * 100);
  const y = (v: number) => height - Math.min(1, v / max) * height;
  return values
    .map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(3)} ${y(v).toFixed(2)}`)
    .join(" ");
}

/** 篇の要約。図の脇に出す数はすべてここから導く(G-07)。 */
export function summary(work: BreathWork) {
  const d = density(work);
  const totalTokens = work.tokens.reduce((a, b) => a + b, 0);
  const per1k = totalTokens > 0 ? (work.n_turns * 1000) / totalTokens : 0;
  const sm = smooth(d, 9);
  let maxI = 0;
  let minI = 0;
  sm.forEach((v, i) => {
    if (v > sm[maxI]) maxI = i;
    if (v < sm[minI]) minI = i;
  });
  return {
    sections: work.turns.length,
    tokens: totalTokens,
    turns: work.n_turns,
    per1k,
    densestAt: sectionLabel(work, maxI),
    densest: sm[maxI],
    sparsestAt: sectionLabel(work, minI),
    sparsest: sm[minI],
  };
}

/** 検証の状態を、色ではなく言葉で言い分けるための区分。 */
export function trustLevel(validation: string): "high" | "mid" | "low" {
  if (validation.startsWith("照合済み")) return "high";
  if (validation === "内部整合のみ") return "mid";
  return "low";
}
