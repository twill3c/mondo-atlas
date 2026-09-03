import index from "@/data/reader/index.json";
import type { ReaderWork, WorkLink } from "@/lib/reader";
import ReaderView from "./ReaderView";

/**
 * 篇の頁の共通部分。**本文は渡された篇のぶんだけ**を受け取る(N-03)。
 * 目次(本文を持たない)は他の篇へのリンクにだけ使う。
 */
export default function WorkPage({ work }: { work: ReaderWork }) {
  const others = index.works as unknown as WorkLink[];
  return (
    <main>
      <h1>
        読む
        <span className="sub">{work.title} — 希語・英訳・和訳を節で揃える</span>
      </h1>

      <p className="lede">
        <a href="/read/">読む(目次)</a> に戻る。
        節番号を押すとその節への直リンクが URL に入る ——
        <code>?loc={work.sections[0].id}</code> の形で、
        <strong>この住所は十六世紀から変わっていない</strong>。
      </p>

      <ReaderView work={work} others={others} />

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
