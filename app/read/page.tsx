import type { Metadata } from "next";
import readerData from "@/data/reader.json";
import { fmt } from "@/lib/chart";
import type { ReaderWork } from "@/lib/reader";
import ReaderView from "./ReaderView";

export const metadata: Metadata = {
  title: "読む — 問答アトラス",
  description:
    "ギリシャ語・英訳・和訳をステファヌス節で揃えて読む。節番号がそのまま住所になる。",
};

const works = readerData.works as unknown as ReaderWork[];

export default function ReadPage() {
  return (
    <main>
      <h1>
        読む
        <span className="sub">希語・英訳・和訳を節で揃える</span>
      </h1>

      <p className="lede">
        ステファヌス節を行送りの単位にして、原文と英訳と和訳を並べる。
        節番号はそのまま住所になるので、<code>?loc=Crit.43a</code> のように書けば
        その一節を直接開ける。<strong>この住所は十六世紀から変わっていない</strong>ので、
        手元のどの版を持っていても同じ場所を指せる。
      </p>

      <ul className="kpis">
        <li className="kpi">
          <span className="kpi__value">
            {fmt(readerData.translated)} / {fmt(readerData.readerSections)}
          </span>
          <span className="kpi__label">この三篇の和訳(節)</span>
        </li>
        <li className="kpi">
          <span className="kpi__value">
            {fmt(readerData.translated)} / {fmt(readerData.corpusSections)}
          </span>
          <span className="kpi__label">全集に対して(節)</span>
        </li>
        <li className="kpi">
          <span className="kpi__value">
            {(readerData.coverageOfCorpus * 100).toFixed(2)}%
          </span>
          <span className="kpi__label">全集に対する充填率</span>
        </li>
        <li className="kpi">
          <span className="kpi__value">
            {fmt(works.filter((w) => w.complete).length)}
          </span>
          <span className="kpi__label">完訳した篇</span>
        </li>
      </ul>

      <ReaderView works={works} />

      <div className="note">
        <p>
          <strong>未訳は原文の側から数えている。</strong>
          訳文に何が入っているかを見ても、原文の何が落ちたかは分からない。
          だから原文の節をすべて並べたうえで、訳の付いていない節を数えている。
          この数え方でないと、<strong>原文から落ちた節は永遠に見えない</strong>。
        </p>
        <p>
          <strong>節は文の途中で切れることがある。</strong>
          ステファヌス版の組版の都合であって、意味の切れ目ではない。
          原文がそこで切れている以上、和訳も同じところで切ってある ——
          読みやすさのために原文の切れ目を動かすと、住所が住所でなくなる。
        </p>
        <p>
          <strong>載せているのは裁判三部だけで、これは全集の三十六分の三である。</strong>
          本文をこの頁に直に埋め込んでいるので、篇を足すほど重くなる ——
          三篇で配信 <strong>153 キロバイト</strong>(圧縮前 544 キロバイト)。
          四篇目を足すとおよそ倍になるので、そのときは篇ごとに頁を分ける。
          全 36 篇を一枚に載せることはしない。
        </p>
      </div>

      <p className="source">
        希語: John Burnet (ed.), <em>Platonis Opera</em>, Oxford: Clarendon Press, 1900–1907.
        {" / "}英訳: Harold North Fowler, <em>Plato in Twelve Volumes</em>, Vol. 1,
        Loeb Classical Library, 1914.
        {" / "}データ:{" "}
        <a
          href="https://github.com/PerseusDL/canonical-greekLit"
          target="_blank"
          rel="noreferrer noopener"
        >
          Perseus Digital Library
        </a>
        (Tufts University, CC BY-SA 4.0)。
        <strong>和訳もこの条件を継承する。</strong>
      </p>
    </main>
  );
}
