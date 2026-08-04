"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PUBLIC_NAV } from "./publicNavItems";

/**
 * Public navigation menu (feature 034, P6-R1).
 *
 * The site's top-level menu, rendered once from the ROOT layout so it appears on EVERY page — public
 * and volunteer (admin/door) alike — as the topmost bar (spec clarification A). On staff pages the
 * volunteer <Nav/> (aria-label="Main") renders beneath this one (aria-label="Site").
 *
 * ⚠️ Presentation, not a control (FR-005): it makes no authorization decision and renders the same
 * entries whether or not a volunteer is signed in; each destination enforces its own access.
 *
 * A client component solely because active-state (FR-004) needs the current path; the entry list lives
 * in the plain module `publicNav.ts` (the single source, FR-003).
 */
export default function PublicNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    !!pathname && (pathname === href || pathname.startsWith(href + "/"));
  return (
    <nav
      aria-label="Site"
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "baseline",
        gap: 16,
        padding: "12px 24px",
        borderBottom: "1px solid #ddd",
      }}
    >
      <Link href="/whats-on" style={{ fontWeight: 600, textDecoration: "none", color: "inherit" }}>
        Country Dancers of Rochester
      </Link>
      {PUBLIC_NAV.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            style={{ textDecoration: "none", color: "inherit", fontWeight: active ? 600 : 400 }}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
