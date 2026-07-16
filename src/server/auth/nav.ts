import type { Actor } from "@/server/auth/actor";
import type { Capability } from "@/server/auth/capabilities";
import { actorCan } from "@/server/auth/can";

/**
 * Role-aware navigation (feature 016, US5; FR-039).
 *
 * ⚠️ Navigation is a COURTESY, not a control. Hiding a link is presentation — the routes enforce
 * authorization regardless, so a destination absent from someone's nav is still refused if they request
 * it directly (US5 scenario 3). Do not let anything here be mistaken for a security boundary.
 *
 * Each item is shown when the actor holds the capability that page is FOR — the primary job of the
 * page, not merely read access. A base volunteer can *read* the gate figures (money is open, FR-015),
 * but the gate page is for entering money, so it appears only for `gate.write` holders. That keeps nav
 * about "what is your job" rather than "what could you look at".
 */

export type NavItem = { href: string; label: string };

/** Destination → the capability that makes it appear. `null` = every authenticated volunteer (base). */
const NAV: { href: string; label: string; capability: Capability | null }[] = [
  { href: "/organizer/tnc", label: "Organizer report", capability: null }, // oversight — the base
  { href: "/contacts", label: "Contacts", capability: null }, // directory (PII-projected)
  { href: "/checkin", label: "Check-in", capability: "attendance.write" },
  { href: "/gate", label: "Gate money", capability: "gate.write" },
  { href: "/events", label: "Events", capability: "event.public.write" }, // Booker + Webmaster
  { href: "/bookings", label: "Bookings", capability: "booking.write" },
  { href: "/performers", label: "Performers", capability: "performer.write" },
  { href: "/bands", label: "Bands", capability: "performer.write" },
  { href: "/venues", label: "Venues", capability: "venue.write" },
  { href: "/rate-parameters", label: "Rate parameters", capability: "parameter.write" },
  { href: "/expense-parameters", label: "Expense parameters", capability: "parameter.write" },
  { href: "/treasurer/latest", label: "Treasurer report", capability: "treasurer_report.write" },
  { href: "/qbo-mapping", label: "QBO mapping", capability: "treasurer_report.write" },
  { href: "/exports", label: "Mailing-list exports", capability: "export.read" },
  { href: "/dedup", label: "Duplicate review", capability: "dedup.write" },
  { href: "/access", label: "Access control", capability: "role.assign" },
  { href: "/dev/routes", label: "Route index (dev)", capability: "dev.routes.read" },
];

/**
 * The nav destinations this actor should be offered.
 *
 * A pure function of the actor's capabilities, so it is trivially testable without rendering React —
 * which is the whole reason the derivation lives here and not inline in a layout.
 */
export function navItemsFor(actor: Actor): NavItem[] {
  return NAV.filter((item) => item.capability === null || actorCan(actor, item.capability)).map(
    ({ href, label }) => ({ href, label }),
  );
}
