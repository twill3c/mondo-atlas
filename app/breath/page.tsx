import type { Metadata } from "next";
import breathData from "@/data/breath.json";
import type { BreathWork } from "@/lib/breath";
import BreathView from "./BreathView";

export const metadata: Metadata = {
  title: "問答の呼吸 — 問答アトラス",
  description:
    "プラトンの対話篇で、どこで問答が濃くなり、どこで独白に変わるのかを、ステファヌス番号の順に見る。",
};

const works = breathData.works as unknown as BreathWork[];

export default function BreathPage() {
  return (
    <main>
      <h1>
        問答の呼吸
        <span className="sub">対話が独白に変わる場所を探す</span>
      </h1>

      <p className="lede">
        プラトンの著作は「対話篇」と呼ばれるが、最初から最後まで問答が続く篇はむしろ少ない。
        誰かが長い演説を始めれば、そこで交替は途絶える。
        全 36 篇に同じ物差しを当てて、その途切れ方を見ていく。
      </p>

      <BreathView works={works} />

      <div className="note">
        <p>
          <strong>この図の数はどこから来たのか。</strong>
          Perseus の話者マークアップ(<code>&lt;said&gt;</code>)は、36 篇中 29 篇で
          印刷面の話者記号と件数が厳密に一致する。つまり紙に印刷された記号の写しであって、
          <strong>記号を印刷しない篇では使えない</strong>。
          そこで交替の検出を本文だけから自前で行い、話者記号は
          <strong>書き終えたあとの答え合わせにだけ</strong>使った。
        </p>
        <p>
          <strong>当てられることと、当てられないこと。</strong>
          上演型 27 篇を半分に割り、14 篇で調整して 13 篇で報告した結果、
          <strong>交替の「位置」は当てられなかった</strong>
          —— 手がかりを使った検出は「文の切れ目をすべて交替とみなす」素通しに負けている
          (F1 0.567 対 0.569)。
          いっぽう<strong>節ごとの「濃さ」は当てられる</strong>
          —— 相関 0.756 で、節の語数という交絡には 13 篇すべてで勝った(語数だけの相関は −0.021)。
          だからこの図が出すのは濃さであって、位置ではない。
        </p>
        <p>
          <strong>通説がひとつ、データに出なかった。</strong>
          「『国家』は第 1 巻だけが問答で、以降は独白に化ける」とよく言われる。
          しかし巻ごとに測ると第 1 巻は 24.5 回/千語で、第 7 巻の 29.6 回/千語より低い。
          <strong>交替の回数では第 1 巻は突出しない。</strong>
          第 1 巻が違うとすれば、それは交替の回数ではなく応答の中身であり、
          この図が測っているものではない。
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
