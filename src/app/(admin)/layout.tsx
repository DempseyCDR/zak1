import { requireStaff } from "@/server/auth/currentStaff";

/**
 * Protects every admin page in one place (feature 015, FR-004).
 *
 * Attached at the route-GROUP level deliberately: a per-page check is easy to forget when someone
 * adds the next page. Anything under `(admin)` is staff-only by construction.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireStaff();
  return <>{children}</>;
}
