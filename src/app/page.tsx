import Link from "next/link";

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
