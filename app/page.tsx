import index from "@/data/index.json";
import type { Work } from "@/lib/chart";
import { fmt } from "@/lib/chart";
import CorpusOverview from "./CorpusOverview";

const works = index.works as unknown as Work[];

// 見出しの数字は作品データから毎回導く。定数で書かない(G-07)
const totals = {
  works: works.length,
  sections: works.reduce((a, w) => a + w.n_sections, 0),
  pages: works.reduce((a, w) => a + w.n_pages, 0),
  wordsGrc: works.reduce((a, w) => a + w.words_grc, 0),
};

export default function Home() {
  return (
    <main>
      <h1>
        問答アトラス
        <span className="sub">プラトン全集をステファヌス番号で通して見る</span>
      </h1>

      <p className="lede">
        プラトンの著作は「対話篇」と呼ばれる。けれど対話の濃さは篇によって桁違いに違う。
        全 {totals.works} 篇に同じ物差しを当てて、どの篇がどれだけの長さを持ち、
        どこで問答が起き、どこで独白に変わるのかを見ていく。
        底本は Burnet の校訂本(OCT)、位置の単位は 16 世紀から使われているステファヌス番号である。
      </p>

      <ul className="kpis">
        <li className="kpi">
          <span className="kpi__value">{fmt(totals.works)}</span>
          <span className="kpi__label">篇</span>
        </li>
        <li className="kpi">
          <span className="kpi__value">{fmt(totals.pages)}</span>
          <span className="kpi__label">ステファヌス頁</span>
        </li>
        <li className="kpi">
          <span className="kpi__value">{fmt(totals.sections)}</span>
          <span className="kpi__label">ステファヌス節</span>
        </li>
        <li className="kpi">
          <span className="kpi__value">{fmt(totals.wordsGrc)}</span>
          <span className="kpi__label">ギリシャ語本文(語)</span>
        </li>
      </ul>

      <CorpusOverview works={works} />

      <div className="note">
        <p>
          <strong>四部作という並び。</strong>
          この 36 篇は、1 世紀の文法家トラシュロスが 9 群 × 4 篇に整理した配列で伝わってきた。
          Perseus の作品番号もその順に振られている。長さで並べ替えると
          『法律』と『国家』の 2 篇だけが突出し、残り 34 篇がその陰に沈むことがわかる。
        </p>
        <p>
          <strong>真贋の区分は通説であって、測定値ではない。</strong>
          とくに『アルキビアデス I』『ヒッピアス(大)』『エピノミス』『書簡集』は
          今も議論が続いている。本アプリはこの区分を主張しないし、
          今後の文体計量でもこれを正解として使わない。
        </p>
      </div>

      <p className="source">
        底本: John Burnet (ed.), <em>Platonis Opera</em>, Oxford: Clarendon Press, 1900–1907.
        {" / "}英訳: Fowler, Lamb ほか, <em>Plato in Twelve Volumes</em>, Loeb Classical
        Library, 1914–.
        {" / "}データ:{" "}
        <a href="https://github.com/PerseusDL/canonical-greekLit" target="_blank" rel="noreferrer noopener">
          Perseus Digital Library
        </a>
        (Tufts University, CC BY-SA 4.0)。本サイトの派生データもこれを継承する。
      </p>
    </main>
  );
}
