/**
 * 画面①(全集の俯瞰)の幾何と並び。
 *
 * 図に添えるラベル・軸・凡例は、図を生成したのと同じデータから導く(G-07)。
 * そのために、目盛りも帯の長さもこのモジュールの純関数だけで決める。
 * 座標を決め打ちしたり、目盛りを定数で書いたりしない。
 */

export type Work = {
  id: string;
  abbr: string;
  title_ja: string;
  title_grc: string;
  tetralogy: number;
  authenticity: "真作" | "疑作" | "偽作";
  narration: "dramatic" | "narrated" | "mixed" | "monologue" | "epistolary";
  n_sections: number;
  n_pages: number;
  words_grc: number;
  words_eng: number;
  n_sigla: number;
  books: string[] | null;
  epistles: string[] | null;
  n_eng_missing: number;
};

export type SortMode = "canonical" | "length";

export type Measure = "n_pages" | "words_grc" | "n_sections";

export const MEASURES: { key: Measure; label: string; unit: string }[] = [
  { key: "n_pages", label: "ステファヌス頁", unit: "頁" },
  { key: "n_sections", label: "ステファヌス節", unit: "節" },
  { key: "words_grc", label: "ギリシャ語本文", unit: "語" },
];

export const AUTHENTICITIES = ["真作", "疑作", "偽作"] as const;

/** 四部作の並びは tlg 番号順と一致する(検査 test_tetralogy_structure)。 */
export function tetralogyOf(work: Work): number {
  return work.tetralogy;
}

/**
 * 表示順。
 * canonical = 四部作の順(トラシュロスの配列)。同じ四部作の中は tlg 番号順。
 * length    = 指標の降順。同値は canonical 順で安定させる。
 */
export function sortWorks(works: Work[], mode: SortMode, measure: Measure): Work[] {
  const canonical = [...works].sort((a, b) => a.id.localeCompare(b.id));
  if (mode === "canonical") return canonical;
  const rank = new Map(canonical.map((w, i) => [w.id, i]));
  return [...canonical].sort(
    (a, b) => b[measure] - a[measure] || rank.get(a.id)! - rank.get(b.id)!,
  );
}

/** 四部作ごとに束ねる(canonical 順のときだけ見出しを出す)。 */
export function groupByTetralogy(works: Work[]): { tetralogy: number; works: Work[] }[] {
  const out: { tetralogy: number; works: Work[] }[] = [];
  for (const w of works) {
    const last = out[out.length - 1];
    if (last && last.tetralogy === w.tetralogy) last.works.push(w);
    else out.push({ tetralogy: w.tetralogy, works: [w] });
  }
  return out;
}

/**
 * 「切りのよい」目盛りの間隔。1・2・5 × 10^n から、目標本数に最も近いものを選ぶ。
 * 軸ラベルと格子は同じ配列から描くので、両者がずれることがない(G-07)。
 *
 * この軸が数えるのは頁・節・語という**整数**なので、刻みも 1 以上の整数に限る。
 * 1 未満を許すと、max が小さいときに Math.round で目盛りが潰れて重複する
 * (`axisTicks(1)` が 0,0,0,1,1 を返した — テストが捕まえた)。
 */
export function niceStep(max: number, targetTicks = 5): number {
  if (!(max > 0)) return 1;
  const rough = max / targetTicks;
  const mag = Math.max(1, Math.pow(10, Math.floor(Math.log10(rough))));
  const candidates = [1, 2, 5, 10].map((m) => m * mag);
  let best = candidates[0];
  let bestErr = Infinity;
  for (const c of candidates) {
    const err = Math.abs(max / c - targetTicks);
    if (err < bestErr) {
      bestErr = err;
      best = c;
    }
  }
  return best;
}

/** 0 から max を覆う目盛り値。max ちょうどでは終わらず、必ず max 以上まで伸ばす。 */
export function axisTicks(max: number, targetTicks = 5): number[] {
  const step = niceStep(max, targetTicks);
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 1e-9; v += step) ticks.push(Math.round(v));
  if (ticks[ticks.length - 1] < max) ticks.push(Math.round(ticks.length * step));
  return ticks;
}

/** 軸の上限は最後の目盛り。帯の長さはこの上限に対する割合で決める。 */
export function axisMax(max: number, targetTicks = 5): number {
  const ticks = axisTicks(max, targetTicks);
  return ticks[ticks.length - 1];
}

/** 帯の長さ(トラックに対する百分率)。0 は 0% になる。 */
export function barPercent(value: number, max: number, targetTicks = 5): number {
  const top = axisMax(max, targetTicks);
  if (!(top > 0)) return 0;
  return (value / top) * 100;
}

/** 凡例に出す区分と件数。図に出ている作品だけから数える(G-07)。 */
export function legendCounts(works: Work[]): { key: string; count: number }[] {
  return AUTHENTICITIES.map((key) => ({
    key,
    count: works.filter((w) => w.authenticity === key).length,
  })).filter((e) => e.count > 0);
}

export function fmt(n: number): string {
  return n.toLocaleString("ja-JP");
}
