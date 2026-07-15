import { safeNextPath } from "@/server/auth/redirect";

/**
 * Staff sign-in (feature 015). Public — this is how one becomes authenticated.
 *
 * There is no registration step and no password: a designated volunteer's first successful Google
 * sign-in provisions their staff identity automatically (FR-012).
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const href = next === "/" ? "/api/auth/google" : `/api/auth/google?next=${encodeURIComponent(next)}`;

  return (
    <main style={{ padding: 24, maxWidth: 480 }}>
      <h1>Staff sign-in</h1>

      {params.error ? (
        <p
          role="alert"
          style={{
            background: "#f8d7da",
            border: "1px solid #f5c2c7",
            padding: 12,
            borderRadius: 6,
          }}
        >
          {/* Deliberately generic: naming the reason would let anyone probe club membership. */}
          We couldn&apos;t sign you in with that account. If you volunteer for CDR and think this is
          wrong, ask an officer to check your contact record.
        </p>
      ) : null}

      <p>Staff areas require a CDR volunteer account.</p>

      <a
        href={href}
        style={{
          display: "inline-block",
          padding: "10px 16px",
          borderRadius: 6,
          border: "1px solid #747775",
          background: "#fff",
          color: "#1f1f1f",
          fontWeight: 500,
          textDecoration: "none",
        }}
      >
        Sign in with Google
      </a>

      <p style={{ marginTop: 24, fontSize: "0.875rem", color: "#555" }}>
        Use your <strong>cdrochester.org</strong> account if you have one, or the personal Google
        account whose address the club already has on file.
      </p>
    </main>
  );
}
