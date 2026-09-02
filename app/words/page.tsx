import type { Metadata } from "next";
import wordsData from "@/data/words.json";
import { fmt } from "@/lib/chart";
import type { WordTerm, WordWork } from "@/lib/words";
import WordsView from "./WordsView";

export const metadata: Metadata = {
  title: "語の地層 — 問答アトラス",
  description:
    "プラトンの主要語が、どの篇のどのあたりに濃く現れるのかを、屈折語の語形を全数判定したうえで見る。",
};

const terms = wordsData.terms as unknown as WordTerm[];
const works = wordsData.works as unknown as WordWork[];

const eidos = terms.find((t) => t.key === "eidos")!;
const idea = terms.find((t) => t.key === "idea")!;

export default function WordsPage() {
  return (
    <main>
      <h1>
        語の地層
        <span className="sub">どの語が、どの篇のどこに積もっているか</span>
      </h1>

      <p className="lede">
        プラトンを読む人は「徳」「魂」「イデア」といった語を手がかりにする。
        では実際に、どの語がどの篇のどのあたりに現れるのか。
        {fmt(terms.length)} の見出し語について、全 36 篇を同じ物差しで並べた。
      </p>

      <WordsView terms={terms} works={works} bins={wordsData.bins} />

      <div className="note">
        <p>
          <strong>屈折語は、語幹で数えられない。</strong>
          ギリシャ語の名詞は格と数で形が変わる。かといって語幹の前方一致で拾うと、
          まったく別の語が混ざる。実測してみると、これは<strong>両方向に壊れる</strong>。
        </p>
        <p>
          語幹 <code>ειδ</code> は、目当ての <span className="grc">εἶδος</span>(形相)より
          <span className="grc">εἰδέναι</span>(知ること・244 件)や
          <span className="grc">εἰδώς</span>(87 件)を多く拾う ——
          <strong>拾いすぎ</strong>である。逆に語幹 <code>πολι</code> は
          <span className="grc">πόλις</span> の斜格 <span className="grc">πόλεως</span>
          (281 件)を<strong>取りこぼす</strong>。片側だけ直すと、二つの誤りが
          打ち消し合って総数がそれらしく見えてしまう。
        </p>
        <p>
          そこで語形を一つずつ書き出し、
          <strong>アクセントを外すと同じになる別語</strong>を表層で落とした。
          <span className="grc">νόμος</span>(法)と <span className="grc">νομός</span>(牧草地)、
          <span className="grc">ἀγαθῶν</span>(善の)と{" "}
          <span className="grc">Ἀγάθων</span>(『饗宴』の登場人物アガトン)、
          <span className="grc">ἐπιστημῶν</span>(知識の)と{" "}
          <span className="grc">ἐπιστήμων</span>(知っている)。
          採否はすべて台帳に書いてある。
        </p>
      </div>

      <div className="note">
        <p>
          <strong>「イデア論」の語は ἰδέα ではない。</strong>
          プラトンの形相説は日本語で「イデア論」と呼ばれるが、本文で数えると
          <span className="grc">εἶδος</span> が {fmt(eidos.total)} 件に対して{" "}
          <span className="grc">ἰδέα</span> は {fmt(idea.total)} 件しかない
          —— <strong>{(eidos.total / idea.total).toFixed(1)} 倍の差</strong>がある。
          <span className="grc">εἶδος</span> が最も濃いのは『パルメニデス』、
          つまり形相説そのものが批判にかけられる篇である。
        </p>
        <p>
          <strong>ただし後知恵である。</strong>
          各語が最も濃い篇 —— 徳→メノン、快→ピレボス、法→ミノス、魂→パイドン ——
          はいずれも伝統的にその主題で知られる篇と一致した。
          台帳は語形だけから作っており「どの篇が何の話か」は一度も見ていないので、
          これは独立な突き合わせになっている。
          <strong>けれども測る前に宣言したわけではないので、予測の的中ではない。</strong>
        </p>
      </div>

      <p className="source">
        底本: John Burnet (ed.), <em>Platonis Opera</em>, Oxford: Clarendon Press, 1900–1907.
        {" / "}データ:{" "}
        <a
          href="https://github.com/PerseusDL/canonical-greekLit"
          target="_blank"
          rel="noreferrer noopener"
        >
          Perseus Digital Library
        </a>
        (Tufts University, CC BY-SA 4.0)。本サイトの派生データもこれを継承する。
      </p>
    </main>
  );
}
