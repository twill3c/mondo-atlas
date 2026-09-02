import type { Metadata } from "next";
import styleData from "@/data/style.json";
import type { StyleWork } from "@/lib/style";
import StyleView from "./StyleView";

export const metadata: Metadata = {
  title: "文体の指紋 — 問答アトラス",
  description:
    "プラトンの後期とされる作品が、本文から数えられる文体の量でも分かれるのか。測る前に予測を宣言してから測った。",
};

const works = styleData.works as unknown as StyleWork[];

export default function StylePage() {
  return (
    <main>
      <h1>
        文体の指紋
        <span className="sub">測る前に予測を書いてから測った</span>
      </h1>

      <p className="lede">
        プラトンの著作には「前期・中期・後期」という通説の並びがある。作品に日付は無いので、
        これは主題や文体からの推定である。では<strong>本文から数えられる量</strong>だけを見たとき、
        後期とされる作品はほんとうに分かれるのか。
      </p>

      <div className="note">
        <p>
          <strong>この画面は、順序を守って作った。</strong>
          先に予測を 4 つ書いて記録し、それから測った。
          通説の後期群は<strong>当てはめには一度も使っていない</strong> ——
          使ったのは、測り終えたあとの照合だけである。
        </p>
      </div>

      <h2>測る前に宣言した予測と、その結果</h2>
      <ol className="predictions">
        {styleData.predictions.map((p) => (
          <li key={p.id} className="prediction">
            <span className={`prediction__badge prediction__badge--${p.result === "成立" ? "ok" : "ng"}`}>
              {p.result}
            </span>
            <span className="prediction__text">
              {p.text}
              <span className="prediction__detail">{p.detail}</span>
            </span>
          </li>
        ))}
      </ol>

      <StyleView
        works={works}
        corr={styleData.corr}
        minParticles={styleData.minParticles}
      />

      <div className="note">
        <p>
          <strong>ヒアトゥスとは何か。</strong>
          母音で終わる語のあとに母音で始まる語が続く並びのこと。ギリシャ語の散文では
          耳障りとされ、語順を変えたりエリジョン(母音を落とすこと)で避けられる。
          <strong>プラトンの後期の作品はこれを避ける</strong>というのが 19 世紀以来の観察で、
          年代推定の根拠のひとつになってきた。
        </p>
        <p>
          <strong>ただし数え方は独自である。</strong>
          文の切れ目をまたぐ組は数えない(声が切れるので衝突しない)。
          分母は「母音で終わった組」だけにしてある ——
          そうしないと「母音で終わる語が多い篇ほど衝突が多い」だけの数になってしまう。
          <strong>公刊されている数値と直接くらべることはしない。</strong>
          くらべているのは篇どうしで、同じ物差しで測った相対の話に限る。
        </p>
      </div>

      <div className="note">
        <p>
          <strong>意外だったこと。</strong>
          ヒアトゥス率の低い順に並べると、2 位に入るのは通説の後期群ではなく
          <strong>『エピノミス』</strong>だった。この篇は真作かどうか議論があり、
          『法律』の続編としてピロポスのフィリッポスが書いたとも言われる。
          今回の測定はそれを判定しないが、<strong>『法律』のすぐ隣に落ちた</strong>ことは記録しておく。
          『書簡集』と『クレイトポン』も後期群の直後に続く。
        </p>
        <p>
          <strong>エリジョンでは説明できない。</strong>
          後期群がヒアトゥスを避けているなら、その手段はエリジョンだろうと考えたくなる。
          けれどエリジョン率は後期 26.8 回/千語・その他 23.3 回/千語でほとんど差が無く、
          後期群の中でもピレボス 34.4 とクリティアス 21.8 で開く。
          <strong>避け方はエリジョンではなく、別のところにある。</strong>
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
