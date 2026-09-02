/**
 * 画面⑤(和訳)の型と、充填率の計算。
 *
 * **書いていない頁を「該当なし」に見せない**(HC-119)。
 * 充填率は必ず分子と分母を並べて出し、割合だけを出さない。
 */

export type JapaneseWork = {
  abbr: string;
  title: string;
  tetralogy: number;
  authenticity: string;
  kaidai: string;
  pages: number[];
  summaries: Record<string, string>;
  nPages: number;
  nSummaries: number;
};

/** 充填率。分母が 0 なら 0 とする(0 除算で NaN を画面に出さない)。 */
export function coverage(done: number, total: number): number {
  return total > 0 ? done / total : 0;
}

/** 要旨が一つでもある篇。 */
export function withSummaries(works: JapaneseWork[]): JapaneseWork[] {
  return works.filter((w) => w.nSummaries > 0);
}

/** 四部作ごとに束ねる(篇の並びは tlg 番号順)。 */
export function byTetralogy(works: JapaneseWork[]): { tetralogy: number; works: JapaneseWork[] }[] {
  const out: { tetralogy: number; works: JapaneseWork[] }[] = [];
  for (const w of [...works].sort((a, b) => a.tetralogy - b.tetralogy)) {
    const last = out[out.length - 1];
    if (last && last.tetralogy === w.tetralogy) last.works.push(w);
    else out.push({ tetralogy: w.tetralogy, works: [w] });
  }
  return out;
}

/** 頁を昇順に並べ、要旨のある頁だけを返す。 */
export function summarizedPages(work: JapaneseWork): { page: number; text: string }[] {
  return work.pages
    .filter((p) => work.summaries[String(p)])
    .map((p) => ({ page: p, text: work.summaries[String(p)] }));
}

/** 充填の状態を三段で言い分ける。色ではなく言葉のための区分。 */
export function fillState(work: JapaneseWork): "full" | "partial" | "none" {
  if (work.nSummaries === 0) return "none";
  return work.nSummaries >= work.nPages ? "full" : "partial";
}
