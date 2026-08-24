/**
 * Public navigation menu entries (feature 034, P6-R1).
 *
 * Hand-maintained SINGLE SOURCE (FR-003): adding, removing, renaming, or reordering a public
 * destination is a one-line edit here, reflected everywhere <PublicNav/> renders. Generating this list
 * (from the source tree or published CMS content) is deliberately deferred — backlog B44.
 *
 * Presentation only (FR-005): the menu is never an access control. The home/wordmark affordance is
 * rendered by the component, not listed here (it is site identity, not a destination); detail routes
 * (e.g. /whats-on/[eventId]) are not entries (FR-007).
 *
 * ⚠️ Named `publicNavItems` (not `publicNav`) on purpose: the component is `PublicNav.tsx`, and a
 * case-only filename difference collides on a case-insensitive filesystem (macOS APFS).
 */
export const PUBLIC_NAV: readonly { href: string; label: string }[] = [
  { href: "/whats-on", label: "What's On" },
  { href: "/what-was-on", label: "What was on" }, // feature 037 (P6-R4) — dance history
  { href: "/directions", label: "Directions" }, // feature 052 (P7-R8) — public venues & directions
  { href: "/performers", label: "Performers" }, // feature 053 (P7-R9) — public bands & callers roster
  // Feature 050 (P7-R6) — the newcomer "what is this dance?" landing pages, one per style.
  { href: "/dances/contra", label: "Contra" },
  { href: "/dances/english", label: "English" },
  { href: "/dances/community", label: "Community" },
  { href: "/join", label: "Join" },
];
