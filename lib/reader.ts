/**
 * 三段リーダー(F-08)と節への直リンク(F-09)。
 *
 * 節 ID(`Crit.43a`)がそのまま住所になる。`?loc=Crit.43a` で開くとその節へ飛ぶ。
 * 位置の単位は十六世紀から変わっていないので、**この住所は他の版にも通じる**。
 */

export type ReaderSection = {
  id: string;
  page: number;
  letter: string;
  grc: string;
  eng: string;
  ja: string;
};

/** 目次に載る 1 件。**本文を持たない** —— 篇の頁だけが本文を読む(N-03)。 */
export type WorkLink = {
  abbr: string;
  slug: string;
  title: string;
  nSections: number;
  nTranslated: number;
  complete: boolean;
  pages: number[];
  bytes: number;
};

export type ReaderWork = {
  abbr: string;
  title: string;
  sections: ReaderSection[];
  nSections: number;
  nTranslated: number;
  untranslated: string[];
  complete: boolean;
};

/** 節 ID の形。書簡集だけは手紙番号が入る。 */
const SECTION_ID = /^[A-Za-z0-9]+\.(?:\d+\.)?\d+[a-e]$/;

export function isSectionId(s: string): boolean {
  return SECTION_ID.test(s);
}

/**
 * 節 ID から篇の頁の道筋を作る(`Crit.51c` → `/read/crit/?loc=Crit.51c`)。
 * **既に配ってしまった `?loc=` を壊さない**ために、目次はこれで送り直す。
 * 形の検査を通らないもの、載せていない篇は null。
 */
export function readerHref(sectionId: string, known: readonly string[]): string | null {
  const abbr = workOf(sectionId);
  if (!abbr || !known.includes(abbr)) return null;
  return `/read/${abbr.toLowerCase()}/?loc=${encodeURIComponent(sectionId)}`;
}

/** 節 ID から略号を取り出す。形が違えば null。 */
export function workOf(sectionId: string): string | null {
  if (!isSectionId(sectionId)) return null;
  return sectionId.split(".")[0];
}

/**
 * `?loc=` を読む。**形の検査を通ったものだけ**を返す ——
 * URL から来た文字列をそのまま要素 ID に使わない。
 */
export function parseLoc(search: string): string | null {
  const m = /(?:^|[?&])loc=([^&#]+)/.exec(search);
  if (!m) return null;
  const raw = decodeURIComponent(m[1]);
  return isSectionId(raw) ? raw : null;
}

/** 節を頁ごとに束ねる(リーダーは頁見出しで区切る)。 */
export function byPage(work: ReaderWork): { page: number; sections: ReaderSection[] }[] {
  const out: { page: number; sections: ReaderSection[] }[] = [];
  for (const s of work.sections) {
    const last = out[out.length - 1];
    if (last && last.page === s.page) last.sections.push(s);
    else out.push({ page: s.page, sections: [s] });
  }
  return out;
}

/**
 * その節が何頁目の束にあるか。見つからなければ -1。
 * 直リンクで開いたとき、**その節を含む頁を開く**ために使う。
 */
export function pageIndexOf(work: ReaderWork, sectionId: string): number {
  return byPage(work).findIndex((g) => g.sections.some((s) => s.id === sectionId));
}

/** その篇の充填率。分子と分母を並べて出すために両方返す。 */
export function progress(work: ReaderWork): { done: number; total: number; ratio: number } {
  const total = work.nSections;
  const done = work.nTranslated;
  return { done, total, ratio: total > 0 ? done / total : 0 };
}

/** 未訳かどうか。**原文の節を基準に**判定する(訳の側から数えない)。 */
export function isUntranslated(s: ReaderSection): boolean {
  return !s.ja;
}
