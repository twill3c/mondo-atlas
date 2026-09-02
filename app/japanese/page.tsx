import type { Metadata } from "next";
import ja from "@/data/japanese.json";
import { fmt } from "@/lib/chart";
import type { JapaneseWork } from "@/lib/japanese";
import JapaneseView from "./JapaneseView";

export const metadata: Metadata = {
  title: "和訳 — 問答アトラス",
  description:
    "プラトン全 36 篇の解題と、ステファヌス一頁ごとの一行要旨。書けたぶんだけを出し、充填率を隠さない。",
};

const works = ja.works as unknown as JapaneseWork[];
const done = works.filter((w) => w.nSummaries > 0);

export default function JapanesePage() {
  return (
    <main>
      <h1>
        和訳
        <span className="sub">全集を日本語で通覧できるようにする</span>
      </h1>

      <p className="lede">
        ギリシャ語本文は {fmt(559618)} 語ある。全訳は現実的ではないので、三層に分けた。
        第一層は<strong>三十六篇の解題</strong>、第二層は<strong>ステファヌス一頁ごとの一行要旨</strong>、
        第三層が完訳である。この画面は第一層と第二層を出す。
      </p>

      <ul className="kpis">
        <li className="kpi">
          <span className="kpi__value">
            {fmt(works.filter((w) => w.kaidai).length)} / {fmt(works.length)}
          </span>
          <span className="kpi__label">解題(第一層)</span>
        </li>
        <li className="kpi">
          <span className="kpi__value">
            {fmt(ja.totalSummaries)} / {fmt(ja.totalPages)}
          </span>
          <span className="kpi__label">頁ごとの要旨(第二層)</span>
        </li>
        <li className="kpi">
          <span className="kpi__value">{(ja.coverage * 100).toFixed(1)}%</span>
          <span className="kpi__label">第二層の充填率</span>
        </li>
        <li className="kpi">
          <span className="kpi__value">{fmt(done.length)}</span>
          <span className="kpi__label">要旨が始まっている篇</span>
        </li>
      </ul>

      <div className="meter" aria-hidden="true">
        <span className="meter__fill" style={{ width: `${ja.coverage * 100}%` }} />
      </div>
      <p className="row__class">
        第二層の進み具合。埋まっているのは
        {done.map((w) => w.title).join("・")}
        の三篇 ——「ソクラテスの裁判」としてひとまとまりになる範囲から始めた。
      </p>

      <JapaneseView works={works} />

      <div className="note">
        <p>
          <strong>要旨は本文を読んで書いている。</strong>
          記憶や概説からではない —— そう書いたものは「たぶんこう書いてある」であって、
          要旨ではない。ステファヌス一頁ぶんの英訳(おおむね五百語)を実際に読み、
          その頁で<strong>起きること</strong>を四十字前後で書く。評価や解釈は足さない。
        </p>
        <p>
          <strong>書いていない頁は空欄にしてある。</strong>
          埋まっていない箇所をゼロや空白で埋めると、読む人はそれを
          「そこには何も無い」と読む。だから充填率を分子と分母のまま出し、
          篇ごとにも「何頁中の何頁か」を出している。
        </p>
        <p>
          <strong>解題の本文には算用数字を書いていない。</strong>
          数はすべて画面がデータから出す。そうすれば、測り直して数が動いたときに
          文章だけが古いまま残るということが起きない。
        </p>
      </div>

      <p className="source">
        底本: John Burnet (ed.), <em>Platonis Opera</em>, Oxford: Clarendon Press, 1900–1907.
        {" / "}要旨の下敷きにした英訳: Fowler, Lamb ほか, <em>Plato in Twelve Volumes</em>,
        Loeb Classical Library, 1914–.
        {" / "}データ:{" "}
        <a
          href="https://github.com/PerseusDL/canonical-greekLit"
          target="_blank"
          rel="noreferrer noopener"
        >
          Perseus Digital Library
        </a>
        (Tufts University, CC BY-SA 4.0)。
        <strong>本サイトの和訳もこの条件を継承する。</strong>
      </p>
    </main>
  );
}
