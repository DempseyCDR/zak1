# Phase 0 Research: Staff Authentication & Session Foundation (015)

Resolves the open items from [`spec.md`](spec.md) and the Technical Context in [`plan.md`](plan.md).

---

## R1 — Auth library choice

**Decision**: **`arctic`** (OAuth 2.0 / OIDC client, for the Google authorization-code flow with PKCE) +
**`jose`** (ID-token signature verification against a JWKS) + **our own Drizzle-backed session table**.

**Rationale**:

- **Auth.js/NextAuth would fight our data model.** Its adapter owns `users` / `accounts` / `sessions`
  tables. Our identity *is* a `contact` — the spec binds sign-in to `contacts.is_volunteer` and
  `contact_emails.is_login` (FR-013/FR-014). Adopting Auth.js means either a parallel user table
  duplicating `contacts`, or fighting the adapter to suppress it. Both violate Simplicity/YAGNI.
- **It matches the codebase's culture.** This repo deliberately hand-rolls its infrastructure:
  `withLogging`, `apiError`, `parseBody`, `audit`, `loadEnv`, a Zod env schema, and hand-authored SQL
  migrations. Runtime dependencies number **nine**. A large opinionated auth framework would be an
  outlier; two small, focused libraries are not.
- **`jose` is non-negotiable and testability-decisive.** We must never hand-roll JWT signature
  verification. `jose` also lets us point verification at a **local** JWKS in tests — which is exactly the
  "fixture reproducing the provider's verified contract (signed OIDC tokens)" that constitution **v1.2.0**
  permits. That is the whole reason the constitution was amended.
- **`arctic` covers the security-critical dance** (state, PKCE, code→token exchange) without imposing any
  schema. Small and typed.

**Alternatives considered**:

| Option | Rejected because |
|---|---|
| **Auth.js / NextAuth v5** | Brings a parallel user/account/session model that conflicts with `contacts` + `is_login`; heavy; long-running beta; poor testability under our constitution. |
| **Lucia** | No longer maintained as a library (it became a learning resource); recommending it as a dependency is a liability. |
| **`openid-client`** | Standards-certified and excellent, but heavier and discovery-driven; its internal JWKS handling is less convenient to point at a local test key set than `jose`. |
| **`google-auth-library`** (official) | One dep instead of two, but `verifyIdToken` hides JWKS handling internally, making the constitution-v1.2.0 boundary fixture awkward. Testability decided it. |
| **Hand-roll the OAuth dance** | State/PKCE correctness is security-critical; a vetted client is the right call. (We do still hand-roll sessions, which are simple and DB-backed.) |

---

## R2 — Session model: DB-backed, not a stateless JWT

**Decision**: A **server-side session row** in Postgres, referenced by an opaque token in an httpOnly,
secure, SameSite=Lax cookie. The DB stores only a **hash** of the token.

**Rationale**: **FR-011 forces this.** A person whose volunteer access is withdrawn must not be able to
*continue an existing session*. A stateless JWT cannot be revoked before its expiry — it would leave a
withdrawn officer signed in with full access until the token lapsed. A session row can be deleted, and
every request re-checks `contacts.is_volunteer` on the join, satisfying FR-011 exactly.

Secondary benefit: sessions live in real Postgres, so the whole lifecycle is integration-testable under
the constitution's unchanged database rule.

**Alternatives considered**: JWT/stateless cookie sessions (rejected: not revocable → fails FR-011);
encrypted-cookie sessions e.g. iron-session (same revocation problem).

---

## R3 — Session inactivity timeout *(resolved open question)*

**Decision**: **8 hours, rolling** (each authenticated request extends `last_seen_at`), configurable via
`SESSION_IDLE_TTL_HOURS` (default `8`). No separate absolute cap for now (YAGNI).

**Rationale**: The longest realistic working session is a dance evening — the Financial Secretary
reconciling gate money over ~4 hours, with idle gaps. 8 hours covers that comfortably while signing
everyone out overnight. Crucially, **Google SSO makes re-authentication ~one click** for someone already
signed in to Workspace, so a shortish TTL costs almost nothing in friction — which is why we don't need
the multi-week sessions typical of password apps.

**Alternatives considered**: 30-day rolling (unnecessarily long for financial data when re-auth is one
click); a fixed absolute expiry (adds a second mechanism with no demonstrated need — revisit if wanted).

---

## R4 — Workspace domain restriction *(resolved open question)*

**Decision**: **Do not enforce** Google's `hd` (hosted-domain) claim. **Do require `email_verified ===
true`** on the ID token — this one is mandatory and security-critical.

**Rationale**:

- Enforcing `hd` is **redundant**: the real gates are already (1) the verified email matching an active
  email on **exactly one** volunteer contact and (2) `contacts.is_volunteer`. A club Workspace account
  with no volunteer contact still gets nothing.
- Enforcing `hd` is **brittle**: it breaks the day a legitimate officer signs in with a non-Workspace
  Google account, producing a confusing failure for a case the volunteer gate already handles correctly.
- `email_verified` is a **different matter entirely** — without it, an ID token could assert an arbitrary
  unverified email and walk straight through the email→contact match. This check is the linchpin of the
  whole design and must be explicit (and tested).

**Alternatives considered**: enforce `hd == <club domain>` as defense-in-depth (rejected per above; can be
added later as a config if wanted — the seam is one claim check).

**Confirmed 2026-07-14 — the anticipated brittleness is the club's normal case.** The club has a *mixed*
population: **long-term** volunteers receive `cdrochester.org` Workspace accounts, while **short-term**
volunteers (e.g. staffing one event group such as a double dance) decline another mailbox and sign in with a
**personal** Google-registered email. Enforcing `hd` would lock out every short-term volunteer. This also
settles the Google console configuration:

- **OAuth consent screen User Type MUST be `External`, never `Internal`.** Internal admits only the
  Workspace org — it would be an `hd` restriction imposed by Google rather than by us, with the same
  lock-out. External is a **superset**: it admits `cdrochester.org` accounts *and* personal ones.
- **Publishing status should be `Published`, not `Testing`.** Testing admits only an explicitly maintained
  test-user list (max 100) — an operational trap that strands a short-term volunteer on the night of an
  event. Our scopes (`openid`, `email`) are non-sensitive, so the sensitive-scope verification review should
  not apply.
- Refresh-token expiry under External+Testing is **irrelevant** to us: the design never uses refresh tokens
  (we verify the ID token once and run our own session — see R2/R6).

---

## R5 — Where enforcement lives: **not** in Next.js middleware

**Decision**: Enforce with a server-side `requireStaff()` accessor used by the protected route groups'
layouts, plus a `withAuth` wrapper for API route handlers (mirroring the existing `withLogging`). Do
**not** put session validation in `middleware.ts`.

**Two independent reasons.** The first expires on upgrade; the second does not. ⚠️ **Do not read reason 1
alone and conclude that a Next upgrade makes middleware auth acceptable — it does not.**

**Reason 1 — a hard constraint on this version (expires).** Next.js **15.1.3** middleware runs on the
**edge runtime**, and the project's `postgres` driver is not edge-compatible. Session validation requires a
DB lookup (R2), so it *cannot* live in middleware here. Node.js middleware arrived later
(`experimental.nodeMiddleware` in 15.2, stabilised around 15.5, carried into 16.x), so **on a future Next
this constraint simply disappears**.

**Reason 2 — defence in depth (does not expire).** Middleware is the wrong *place* for an authorization
boundary regardless of runtime. **CVE-2025-29927** (Next.js 11.x–15.x) let a crafted
`x-middleware-subrequest` header **skip middleware execution entirely** — any app whose authorization lived
only in middleware was bypassable. The guidance since is to check auth **close to the data**, not at the
edge of the request.

That is exactly what this design does: `requireStaff()` runs inside the protected layouts and `withAuth`
runs inside each handler, both hitting the database on the request path. **It is structurally immune to
that whole class of bug.** Moving auth into middleware after an upgrade would buy nothing and reintroduce
the risk — so the decision stands on reason 2 even once reason 1 is obsolete.

Layout-level enforcement fits the existing route groups cleanly: `(admin)` and `(door)` each get a layout
that calls `requireStaff()`, covering every page in the group; `(public)` and `/` stay open.

**Note on API surface**: `/api/*` is **default-deny** — every route requires staff except `/api/auth/*`.
Public pages render via React Server Components using `domain/public/` directly and do not call the API,
so no public API exemption is needed today.

**Alternatives considered**: edge middleware doing a cookie-presence check then a DB check later (rejected
— two mechanisms, and the cookie check is not a security boundary); per-page checks without layouts
(rejected — easy to forget a page).

---

## R6 — Test strategy under constitution v1.2.0

**Decision**: Verify a **locally-signed OIDC ID token** at the boundary. Tests generate an ephemeral
keypair, sign ID tokens with `jose`, and inject a **local JWKS** into the verifier. **Google's production
endpoints are never called from the suite.** Everything behind the seam is integration-tested against real
Postgres (`zak1_test`) using the existing `tests/integration/helpers/`.

**Rationale**: This is precisely the option constitution **v1.2.0** added — "a fixture reproducing the
provider's verified contract (e.g. signed OIDC tokens)" — and it keeps the suite off Google's rate-limit
and abuse-detection radar while leaving the database rule fully intact.

The seam is deliberately narrow: `verifyGoogleIdToken(token) → VerifiedClaims`. Everything that can
actually break — `email_verified` enforcement, email→contact matching, the exactly-one rule, the
`is_volunteer` gate, `is_login` designation, session creation/expiry/revocation — is our own logic and is
covered live.

**Alternatives considered**: a local conforming OIDC provider container (also permitted by v1.2.0, but adds
container infrastructure for no additional coverage — the token contract is what we consume); calling
Google in CI (forbidden by v1.2.0, and the reason for the amendment).

---

## R7 — Enforcing "at most one login email per contact" (FR-015)

**Decision**: A **partial unique index**:

```sql
CREATE UNIQUE INDEX contact_emails_one_login_per_contact
  ON contact_emails (contact_id) WHERE is_login;
```

**Rationale**: `is_login` has existed since feature 001 with **no** constraint enforcing single
designation. A partial unique index enforces the rule in the database (where it cannot be bypassed) and
costs nothing. Consistent with the project's existing use of DB-level CHECKs (e.g.
`roles_require_volunteer`).

**Data note**: safe to add — live data has **0** login emails, so no backfill or conflict resolution is
needed.

---

## R8 — Operator bootstrap (FR-017)

**Decision**: A `tsx` script run via a new package script, e.g.
`pnpm run auth:bootstrap -- --email alice@club.org [--contact-id <uuid>] [--role administrator]`, which
(a) resolves the contact, (b) sets `is_volunteer = true`, (c) ensures the address exists as an **active**
email on that contact and marks it `is_login`, and (d) optionally grants a `volunteer_roles` value. It
writes an audit row and is **idempotent**.

**Rationale**: Nobody can sign in today — **0 of 1334 contacts are volunteers, 0 login emails** — so
without this the feature cannot be demonstrated at all (SC-008). It must be a separate script and must
**never** resemble `db:seed`, which TRUNCATEs `zak1_dev` and would destroy the user's demo data.

`--contact-id` exists because a volunteer's club Workspace address may not yet be on their contact record
(a real data gap): given both, the script attaches the email and designates it. Given only `--email`, it
requires an unambiguous single match and errors otherwise.

**Alternatives considered**: extending `db:seed` (rejected — it wipes demo data); a one-off SQL snippet
(rejected — SC-008 requires no manual database editing); a web bootstrap page (rejected — an unauthenticated
privilege-granting endpoint is a security hole, and role UI belongs to P3-2).

---

## R9 — Google `sub` as the stable identity link

**Decision**: Store Google's `sub` on the staff identity, unique. Match **by email** at first sign-in to
find the contact (FR-014), then bind to `sub` thereafter.

**Rationale**: `sub` is Google's immutable account identifier; email can change (rename, alias). Binding to
`sub` after the initial email match means a later email change doesn't orphan or, worse, silently re-point
an account. The email match remains the *enrollment* rule the spec mandates; `sub` is the durable link.

**Edge**: if a known `sub` presents an email that no longer matches its bound contact, the `sub` binding
wins and the mismatch is logged — it must not silently re-bind to a different contact.

---

## Resolved / outstanding

| Item | Status |
|---|---|
| Auth library | **Resolved** (R1: arctic + jose + own sessions) |
| Session storage | **Resolved** (R2: DB-backed; forced by FR-011) |
| Session timeout value | **Resolved** (R3: 8h rolling, configurable) |
| Workspace domain restriction | **Resolved** (R4: no `hd`; require `email_verified`) |
| Enforcement location | **Resolved** (R5: layouts + `withAuth`, not middleware) |
| IdP test strategy | **Resolved** (R6: local signed-token fixture, per constitution v1.2.0) |
| One login email per contact | **Resolved** (R7: partial unique index) |
| Bootstrap | **Resolved** (R8: `auth:bootstrap` tsx script) |

**No NEEDS CLARIFICATION remain.**
