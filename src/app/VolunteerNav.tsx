"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/server/auth/nav";

/**
 * Volunteer navigation menu — the client presenter (feature 035, P6-R2).
 *
 * Rendered by the server component `Nav`, which resolves the role-filtered `items` (authorization stays
 * on the server). A client component only because active-state (FR-008) needs the current path. Landmark
 * `aria-label="Main"` is distinct from the public menu's `aria-label="Site"` (FR-009).
 *
 * ⚠️ Presentation, not a control (FR-004): it renders whatever items it is given; each destination
 * enforces its own authorization.
 */
export default function VolunteerNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    !!pathname && (pathname === href || pathname.startsWith(href + "/"));
  return (
    <nav
      aria-label="Main"
      style={{ display: "flex", flexWrap: "wrap", gap: 12, padding: "8px 24px", borderBottom: "1px solid #eee" }}
    >
      {items.map((item) => {
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
