"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PAGES = [
  { href: "/", label: "全集の俯瞰" },
  { href: "/breath/", label: "問答の呼吸" },
  { href: "/words/", label: "語の地層" },
  { href: "/style/", label: "文体の指紋" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="画面">
      {PAGES.map((p) => {
        const here = path === p.href || (p.href !== "/" && path.startsWith(p.href));
        return (
          <Link
            key={p.href}
            href={p.href}
            className="nav__item"
            aria-current={here ? "page" : undefined}
          >
            {p.label}
          </Link>
        );
      })}
    </nav>
  );
}
