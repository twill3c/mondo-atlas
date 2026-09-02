/**
 * 画面③(語の地層)の幾何。
 *
 * 値は**千語あたりの出現数**であって素の件数ではない。篇の長さが 1,509 語から
 * 102,743 語まで 68 倍違うので、件数のまま並べると長い篇が濃く見えるだけの図になる。
 *
 * 色の段は図と同じデータから導く(G-07)。閾値を決め打ちしない。
 */

export type WordTerm = {
  key: string;
  lemma: string;
  ja: string;
  total: number;
  rate: number;
  n_forms: number;
  n_excluded_surfaces: number;
};

export type WordWork = {
  abbr: string;
  title: string;
  tetralogy: number;
  tokens: number;
  totals: Record<string, number>;
  rates: Record<string, number>;
  bins: Record<string, number[]>;
};

export type WordSort = "canonical" | "rate";

/** 色の段の数。0 を別扱いにするので、実際の色は 1..LEVELS。 */
export const LEVELS = 5;

/**
 * 段の境目。**上位の値から導く**ので、語を切り替えると段も動く。
 * 最大値そのものではなく 95 パーセンタイルを上端にする ——
 * 一つの区間だけが極端に高いと、他が全部最下段に潰れるため。
 * **切り詰めたことは凡例に書く。**
 */
export function levelBreaks(values: number[], levels = LEVELS): number[] {
  const positive = values.filter((v) => v > 0).sort((a, b) => a - b);
  if (positive.length === 0) return Array.from({ length: levels }, () => 0);
  const top = positive[Math.min(positive.length - 1, Math.floor(positive.length * 0.95))];
  const hi = top > 0 ? top : positive[positive.length - 1];
  return Array.from({ length: levels }, (_, i) => (hi * (i + 1)) / levels);
}

/** 値を 0..LEVELS の段に落とす。0 は 0 段(色を塗らない)。 */
export function levelOf(value: number, breaks: number[]): number {
  if (!(value > 0)) return 0;
  for (let i = 0; i < breaks.length; i++) {
    if (value <= breaks[i]) return i + 1;
  }
  return breaks.length;
}

/** ある見出し語について、全篇・全区間の値を平らに並べる(段の境目を出すため)。 */
export function allBinValues(works: WordWork[], key: string): number[] {
  const out: number[] = [];
  for (const w of works) {
    const b = w.bins[key];
    if (b) out.push(...b);
  }
  return out;
}

/** 並び。canonical は四部作順(tlg 番号順)、rate はその語の濃い順。 */
export function sortWorks(works: WordWork[], mode: WordSort, key: string): WordWork[] {
  const canonical = [...works].sort((a, b) =>
    a.tetralogy - b.tetralogy || a.abbr.localeCompare(b.abbr),
  );
  if (mode === "canonical") return canonical;
  const rank = new Map(canonical.map((w, i) => [w.abbr, i]));
  return [...canonical].sort(
    (a, b) => (b.rates[key] ?? 0) - (a.rates[key] ?? 0) || rank.get(a.abbr)! - rank.get(b.abbr)!,
  );
}

/** その語がいちばん濃い篇。図の脇に出す文はここから導く(G-07)。 */
export function densestWork(works: WordWork[], key: string): WordWork | null {
  let best: WordWork | null = null;
  for (const w of works) {
    if (!best || (w.rates[key] ?? 0) > (best.rates[key] ?? 0)) best = w;
  }
  return best;
}

/** 篇内でその語がいちばん濃い区間(0 始まり)と、その区間が篇のどのあたりか。 */
export function peakBin(work: WordWork, key: string): { index: number; value: number } {
  const b = work.bins[key] ?? [];
  let idx = 0;
  b.forEach((v, i) => {
    if (v > b[idx]) idx = i;
  });
  return { index: idx, value: b[idx] ?? 0 };
}
