"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PUBLIC_NAV } from "./publicNavItems";
import styles from "./PublicNav.module.css";

/**
 * Public navigation menu (feature 034, P6-R1; mobile pattern feature 046, P7-R2).
 *
 * The site's top-level menu, rendered once from the ROOT layout so it appears on EVERY page — public and
 * volunteer (admin/door) alike — as the topmost bar. On staff pages the volunteer <Nav/> (aria-label
 * "Main") renders beneath this one (aria-label "Site").
 *
 * Feature 046: below 768px it presents as a compact bar (wordmark + a labeled disclosure toggle) whose
 * panel reveals the flat destination list; at ≥768px the CSS shows the inline bar and hides the toggle.
 * The list is ALWAYS in the DOM (a <noscript> rule reveals it without JS), so navigation never depends
 * solely on the toggle (FR-005).
 *
 * ⚠️ Presentation, not a control (FR-005): it makes no authorization decision and renders the same entries
 * whether or not a volunteer is signed in; each destination enforces its own access. The entry list lives
 * in `publicNavItems.ts` (the single source, FR-003) — unchanged by feature 046.
 */
const PANEL_ID = "public-nav-panel";

export default function PublicNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const isActive = (href: string) =>
    !!pathname && (pathname === href || pathname.startsWith(href + "/"));

  // Close the mobile panel whenever the route changes (client navigation).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Escape closes an open panel and returns focus to the toggle (FR-004).
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape" && open) {
      setOpen(false);
      toggleRef.current?.focus();
    }
  }

  return (
    <nav aria-label="Site" className={styles.bar} onKeyDown={onKeyDown}>
      <Link href="/whats-on" className={styles.wordmark}>
        Country Dancers of Rochester
      </Link>
      <button
        ref={toggleRef}
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={PANEL_ID}
        onClick={() => setOpen((o) => !o)}
      >
        Menu
      </button>
      <ul id={PANEL_ID} className={open ? `${styles.panel} ${styles.open}` : styles.panel}>
        {PUBLIC_NAV.map((item) => {
          const active = isActive(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={active ? `${styles.link} ${styles.active}` : styles.link}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
      {/* No-JS fallback: reveal the panel so destinations are reachable without the toggle (FR-005). */}
      <noscript>
        <style>{`#${PANEL_ID}{display:flex !important}`}</style>
      </noscript>
    </nav>
  );
}
