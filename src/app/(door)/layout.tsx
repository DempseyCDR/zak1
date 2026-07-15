import { requireStaff } from "@/server/auth/currentStaff";

/**
 * Protects /checkin and /gate (feature 015, FR-004).
 *
 * Note this only establishes that SOMEONE is signed in. The Door Attendant vs Financial Secretary
 * boundary — Door Attendant must NOT reach /gate (docs/use-cases.md) — is authorization, and lands
 * with P3-2.
 */
export default async function DoorLayout({ children }: { children: React.ReactNode }) {
  await requireStaff();
  return <>{children}</>;
}
