import Link from "next/link";
import { getCurrentStaff } from "@/server/auth/currentStaff";
import Nav from "@/app/Nav";

// Feature 025 US4 (FR-017): show the role-aware staff nav on the landing page when signed in (kept separate
// from the public content), so staff reach their tools — check-in included — straight from home. Anonymous
// visitors see only the public content.
export default async function Home() {
  const staff = await getCurrentStaff();
  return (
    <main style={{ padding: 24 }}>
      {staff && <Nav />}
      <h1>CDR Platform</h1>
      <p>
        <Link href="/contacts">Contacts &amp; Membership →</Link>
      </p>
    </main>
  );
}
