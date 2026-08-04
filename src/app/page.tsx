import Link from "next/link";

// The landing page's own content. The role-aware staff nav that feature 025 (US4/FR-017) rendered here
// moved to the ROOT layout in feature 035 (P6-R2) — it now shows on every page when signed in, so the
// home page no longer renders it itself.
export default function Home() {
  return (
    <main style={{ padding: 24 }}>
      <h1>CDR Platform</h1>
      <p>
        <Link href="/contacts">Contacts &amp; Membership →</Link>
      </p>
    </main>
  );
}
