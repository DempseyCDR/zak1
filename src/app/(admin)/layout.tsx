import { requireStaff } from "@/server/auth/currentStaff";
import Nav from "@/app/Nav";

/**
 * Protects every admin page in one place (feature 015, FR-004) and offers role-aware nav (016, FR-039).
 *
 * Attached at the route-GROUP level deliberately: a per-page check is easy to forget when someone
 * adds the next page. Anything under `(admin)` is staff-only by construction.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireStaff();
  return (
    <>
      <Nav />
      {children}
    </>
  );
}
