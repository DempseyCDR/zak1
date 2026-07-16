import Link from "next/link";
import { requireActor } from "@/server/auth/currentStaff";
import { navItemsFor } from "@/server/auth/nav";

/**
 * Role-aware navigation (feature 016, US5; FR-039).
 *
 * A server component: it loads the signed-in actor's grants and offers only the destinations their
 * capabilities permit. Rendered by the protected route-group layouts, so every staff page carries it.
 *
 * ⚠️ Presentation, not a control — the routes enforce authorization regardless. Omitting a link never
 * grants or denies anything; it just declines to invite someone somewhere they would be refused.
 */
export default async function Nav() {
  const actor = await requireActor();
  const items = navItemsFor(actor);
  return (
    <nav aria-label="Main" style={{ display: "flex", flexWrap: "wrap", gap: 12, padding: 12 }}>
      {items.map((item) => (
        <Link key={item.href} href={item.href}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
