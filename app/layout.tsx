import type { Metadata } from "next";
import { EB_Garamond } from "next/font/google";
import Footer from "./Footer";
import Nav from "./Nav";
import "./globals.css";

/*
 * ギリシャ語の本文だけは**同梱の書体で組む**。
 *
 * この機で実測したところ、Georgia / Palatino Linotype / Times New Roman /
 * Segoe UI / 既定の serif はいずれも多アクセント(polytonic)の合成済み符号
 * —— たとえば U+1F76 ἰῶτα+ヴァリア —— を持たず、代替書体に落ちて
 * **アクセントを次の字の後ろに独立した点として描いた**(「πολυ`」)。
 * データは正しく合成済みなので、これは字形の問題であって本文の問題ではない。
 * 読み手の機械に何が入っているかは当てにできないので、書体を持って行く。
 *
 * next/font はビルド時に取得して自分の配信元から出す(実行時に外へ取りに行かない)。
 */
const greek = EB_Garamond({
  subsets: ["greek", "greek-ext", "latin"],
  display: "swap",
  variable: "--font-greek",
});

export const metadata: Metadata = {
  title: "問答アトラス — プラトン全集をステファヌス番号で通して見る",
  description:
    "Perseus Digital Library のプラトン全 36 篇を、ステファヌス番号という一本の背骨で通して可視化する。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={greek.variable}>
      <body>
        <Nav />
        {children}
        <Footer />
      </body>
    </html>
  );
}
