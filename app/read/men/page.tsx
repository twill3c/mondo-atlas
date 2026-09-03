import type { Metadata } from "next";
import work from "@/data/reader/Men.json";
import type { ReaderWork } from "@/lib/reader";
import WorkPage from "../WorkPage";

// **この頁は自分の篇の本文だけを読む**(N-03)。
// 篇を足すときは data/reader/<略号>.json と、この形の頁を 1 枚足す。
export const metadata: Metadata = {
  title: "メノン — 読む — 問答アトラス",
  description: "メノンをギリシャ語・英訳・和訳の三段で読む。節番号がそのまま住所になる。",
};

export default function Page() {
  return <WorkPage work={work as unknown as ReaderWork} />;
}
