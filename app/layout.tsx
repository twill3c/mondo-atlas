import type { Metadata } from "next";
import Footer from "./Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "問答アトラス — プラトン全集をステファヌス番号で通して見る",
  description:
    "Perseus Digital Library のプラトン全 36 篇を、ステファヌス番号という一本の背骨で通して可視化する。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        {children}
        <Footer />
      </body>
    </html>
  );
}
