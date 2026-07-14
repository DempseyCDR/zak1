# Phase 1 Contracts: Auth Endpoints & the Authorization Seam (015)

Interfaces this feature exposes. Two audiences: **the browser** (auth routes) and **the next feature**
(P3-2 authorization reads the seam in §4).

Existing conventions reused: `withLogging` (structured request logs), `parseBody` + Zod at boundaries,
`errors.*` from `lib/apiError.ts`.

---

## 1. `GET /api/auth/google` — start sign-in

Begins the Google authorization-code flow.

| | |
|---|---|
| **Auth** | None (public) |
| **Input** | Optional `?next=<path>` — where to return after success. **MUST** be validated as a relative path (leading `/`, no scheme/host) to prevent open redirect. |
| **Effect** | Generates `state` + PKCE `code_verifier`; stores both in short-lived httpOnly cookies; builds the Google authorization URL (scope `openid email`). |
| **Response** | `302` to Google. |

---

## 2. `GET /api/auth/google/callback` — finish sign-in

The only route that talks to Google's token endpoint.

| | |
|---|---|
| **Auth** | None (public) |
| **Input (query)** | `code` (non-empty), `state` (non-empty). Google may instead return `error` — treat as refusal. |
| **Validation** | `state` MUST equal the cookie value (CSRF); PKCE verifier sent on exchange; ID token signature verified via JWKS; **`email_verified` MUST be `true`**. |
| **Effect** | Resolves claims → contact (see [data-model.md](../data-model.md) §4); provisions `staff_identities` on first sign-in; sets `is_login`; creates `staff_sessions` + session cookie; writes audit. |
| **Response — success** | `302` to `next` (default `/`), `Set-Cookie: <session>` (httpOnly, secure, SameSite=Lax). |
| **Response — refused** | `302` to `/login?error=access_denied`. **One generic outcome** for every failure (FR-009): unverified email, no match, multiple matches, non-volunteer, invalid token. The specific reason is logged server-side only. |

> **Security note**: the generic refusal is deliberate — distinguishing "not a volunteer" from "no such
> contact" would let any Google user probe club membership.

---

## 3. `POST /api/auth/signout` — end session

| | |
|---|---|
| **Auth** | Session cookie (no-op if absent) |
| **Effect** | Deletes the `staff_sessions` row; clears the cookie; writes audit. |
| **Response** | `302` to `/` (or `204` for fetch callers). |
| **Method** | **POST only** — never GET (a GET sign-out is CSRF-triggerable and prefetchable). |

---

## 4. The authorization seam *(what P3-2 consumes — FR-005)*

The contract that matters most beyond this feature. **This feature answers only "who is signed in?" — it
never answers "may they do this?"**

```ts
// src/server/auth/currentStaff.ts

/** The authenticated staff member, or null. Reads the session cookie; validates
 *  expiry and re-checks contacts.is_volunteer live (FR-011). */
export function getCurrentStaff(): Promise<CurrentStaff | null>;

/** Same, but redirects to /login when absent. For protected layouts. */
export function requireStaff(next?: string): Promise<CurrentStaff>;

export type CurrentStaff = {
  identityId: string;
  contactId: string;
  displayName: string;
  email: string;          // the login email
  // Deliberately NOT here: roles, scopes, permissions.
  // P3-2 adds grant resolution on top of this identity.
};
```

**Stability promise to P3-2**: `CurrentStaff` is additive-only. P3-2 will layer role/scope grants
(`role × capability × scope`, per `docs/use-cases.md`) *around* this type — it must not need to change how
identity is established.

---

## 5. `withAuth` — API handler wrapper

Mirrors the existing `withLogging` so protection is applied uniformly rather than remembered per route.

```ts
// src/server/auth/withAuth.ts
export function withAuth<P>(
  handler: (req: Request, ctx: Ctx<P> & { staff: CurrentStaff }) => Promise<Response>
): (req: Request, ctx: Ctx<P>) => Promise<Response>;
// 401 when unauthenticated; injects `staff` when authenticated.
```

**Policy: `/api/*` is default-deny.** Every API route requires staff **except** `/api/auth/*`. Public pages
render via React Server Components using `domain/public/` directly and do not call the API, so no public
API exemption is needed today. Adding a public API route in future is an explicit, reviewable act.

---

## 6. Page routes

| Route | Auth | Notes |
|---|---|---|
| `/login` | Public | "Sign in with Google" button → `/api/auth/google`. Renders `?error=access_denied` generically. |
| `/whats-on`, `/whats-on/[eventId]`, `/` | **Public — unchanged** | Must not regress (SC-003). |
| `(admin)/*`, `(door)/*` | **Staff** | Enforced once per group in `layout.tsx` via `requireStaff()`, covering every page in the group. |

⚠️ **Repo convention** (`CLAUDE.md`): `src/app/dev/routes/page.tsx` must be updated in the same change to
list `/login` and the three `/api/auth/*` endpoints.

---

## 7. Operator bootstrap CLI (FR-017)

Not an HTTP interface — deliberately (an unauthenticated privilege-granting endpoint would be a hole).

```bash
pnpm run auth:bootstrap -- --email alice@club.org
pnpm run auth:bootstrap -- --contact-id <uuid> --email alice@club.org   # attach a missing Workspace email
pnpm run auth:bootstrap -- --email alice@club.org --role administrator
```

| | |
|---|---|
| **Effect** | Resolves the contact; sets `is_volunteer = true`; ensures the address exists as an **active** email on that contact and marks it `is_login`; optionally grants a `volunteer_roles` value; writes audit. |
| **Idempotent** | Re-running makes no further change. |
| **Errors** | `--email` matching zero or multiple contacts → refuse with guidance (use `--contact-id`). |
| **⚠️ Not `db:seed`** | `db:seed` TRUNCATEs `zak1_dev` and would destroy the demo data. This script only ever updates the named contact. |
