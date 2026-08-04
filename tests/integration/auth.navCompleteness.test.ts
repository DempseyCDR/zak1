import { describe, it, expect } from "vitest";
import { staffPageRoutes } from "@/server/lib/routeInventory";
import { NAV } from "@/server/auth/nav";

// Feature 035 (P6-R2): the volunteer nav must stay COMPLETE — every static staff page has a NAV entry,
// so no page can be orphaned (the defect-D1 class). Mirrors auth.routeInventory's source-tree-walker
// guard. Two documented exception sets:
//   - dynamic [param] routes: cannot map to one static href (represented by a concrete NAV href);
//   - outside-the-groups allowlist: NAV entries whose page lives outside (admin)/(door).
const DYNAMIC_EXCLUSIONS = ["/organizer/[seriesKey]"]; // represented by the /organizer/tnc entry
const OUTSIDE_GROUP_ALLOWLIST = ["/dev/routes"]; // src/app/dev/routes/page.tsx — super-user dev index

describe("volunteer nav completeness (D1-class guard)", () => {
  const routes = staffPageRoutes();
  const navHrefs = NAV.map((e) => e.href);
  const navHrefSet = new Set(navHrefs);
  const staticRoutes = routes.filter((r) => !r.dynamic).map((r) => r.path);
  const dynamicRoutes = routes.filter((r) => r.dynamic).map((r) => r.path);

  it("has no orphaned static staff page (every one is a NAV href)", () => {
    const orphans = staticRoutes.filter((p) => !navHrefSet.has(p));
    expect(orphans).toEqual([]);
  });

  it("the dynamic staff routes are exactly the documented excluded set", () => {
    // If a new dynamic staff page appears, this fails — forcing a deliberate decision about its nav.
    expect([...dynamicRoutes].sort()).toEqual([...DYNAMIC_EXCLUSIONS].sort());
  });

  it("has no dead NAV entry (each href is a real staff page, a dynamic representative, or allowlisted)", () => {
    const staticSet = new Set(staticRoutes);
    const dynamicPrefixes = dynamicRoutes.map((p) => p.replace(/\/\[[^\]]+\].*$/, ""));
    const dead = navHrefs.filter((href) => {
      if (staticSet.has(href)) return false;
      if (OUTSIDE_GROUP_ALLOWLIST.includes(href)) return false;
      // a concrete href represents a dynamic route if it sits under that route's static prefix
      if (dynamicPrefixes.some((pre) => href === pre || href.startsWith(pre + "/"))) return false;
      return true;
    });
    expect(dead).toEqual([]);
  });
});
