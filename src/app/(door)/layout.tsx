import { requireStaff } from "@/server/auth/currentStaff";
import Nav from "@/app/Nav";

/**
 * Protects /checkin and /gate (feature 015, FR-004) and offers role-aware nav (016, FR-039).
 *
 * The layout establishes only that someone is signed in. The Door Attendant vs Financial Secretary
 * boundary — Door Attendant must NOT write /gate — is enforced by the routes and the gate service
 * (feature 016), not here; the nav merely declines to invite them where they would be refused.
 */
export default async function DoorLayout({ children }: { children: React.ReactNode }) {
  await requireStaff();
  return (
    <>
      <Nav />
      {children}
    </>
  );
}
