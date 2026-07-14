# Phase 1 Data Model: Staff Authentication & Session Foundation (015)

Derived from [spec.md](spec.md) Key Entities + [research.md](research.md). Migration
**`0020_staff_auth.sql`** (latest existing is `0019`). **Additive only** — no existing column changes, no
backfill.

---

## 1. Existing tables this feature *activates* (no shape change)

These exist since feature 001 but are **dormant** — no UI writes them; live data has **0 of 1334 contacts
as volunteers and 0 login emails**.

| Table.column | Role in this feature |
|---|---|
| `contacts.is_volunteer` (bool, default false) | **The eligibility gate.** Only a volunteer may sign in (FR-013) or hold a login email. Re-checked on **every** request so withdrawal takes effect immediately (FR-011). |
| `contacts.volunteer_roles` (enum[]) | Not used by this feature. Read by P3-2 (authorization). Existing CHECK `roles_require_volunteer` stays. |
| `contact_emails.is_login` (bool, default false) | **The login identifier** (FR-014). Already restricted to volunteers in code (`isLoginAllowed` → `errors.loginNotPermitted()`). |
| `contact_emails.email` (citext), `.status` | Matching is case-insensitive (already `citext`) and requires `status = 'active'`. |

**One constraint added to existing data** (FR-015):

```sql
CREATE UNIQUE INDEX contact_emails_one_login_per_contact
  ON contact_emails (contact_id) WHERE is_login;
```

Safe: 0 login emails exist, so no conflicts or backfill.

---

## 2. New entity — `staff_identities`

A volunteer contact's ability to authenticate via Google. **Holds no password** (FR-016).

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `contact_id` | uuid NOT NULL **UNIQUE** → `contacts(id)` ON DELETE CASCADE | One identity per person (FR-006). |
| `google_sub` | text NOT NULL **UNIQUE** | Google's immutable account id — the durable link (research R9). |
| `created_at` | timestamptz NOT NULL DEFAULT now() | Provisioned on first successful sign-in (FR-012). |
| `last_sign_in_at` | timestamptz NULL | Updated each successful sign-in. |

**Rules**

- Created automatically on the first sign-in satisfying FR-009 — there is no registration form and no
  approval step.
- `contact_id` UNIQUE prevents two Google accounts binding to one person; `google_sub` UNIQUE prevents one
  Google account binding to two contacts.
- **No `is_volunteer` copy here.** Eligibility is read live from `contacts` so withdrawal is immediate
  (FR-011). Duplicating it would create a staleness bug.

---

## 3. New entity — `staff_sessions`

A revocable authenticated period. DB-backed because FR-011 requires revocation (research R2).

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `staff_identity_id` | uuid NOT NULL → `staff_identities(id)` ON DELETE CASCADE | Deleting an identity kills its sessions. |
| `token_hash` | text NOT NULL **UNIQUE** | **Hash only.** The raw token lives solely in the client cookie; a DB leak must not yield usable sessions. |
| `created_at` | timestamptz NOT NULL DEFAULT now() | |
| `last_seen_at` | timestamptz NOT NULL DEFAULT now() | Rolling idle window (FR-007/FR-008). |
| `expires_at` | timestamptz NOT NULL | `last_seen_at + SESSION_IDLE_TTL_HOURS` (default 8; research R3). |

Index: `staff_sessions_identity_idx ON staff_sessions (staff_identity_id)`.

**Cookie**: opaque random token, `httpOnly`, `secure`, `SameSite=Lax`, path `/`. The cookie carries the
raw token; the DB stores its hash.

---

## 4. State transitions

### Sign-in (per request to the callback)

```text
Google ID token
  └─ verify signature via JWKS ....................... invalid → REFUSE (log)
  └─ require email_verified === true ................. false   → REFUSE (log)   [research R4 — critical]
        │
        ├─ known google_sub?
        │     yes → load bound identity
        │            └─ contact still is_volunteer? .. no → REFUSE (FR-011)
        │            └─ email no longer matches bound contact → keep binding, LOG mismatch (R9)
        │
        └─ unknown google_sub → enrol by email (FR-014):
              find contact_emails WHERE email = claims.email AND status='active'
                                    AND contact.is_volunteer
                ├─ 0 matches ...... REFUSE (generic message, FR-009)
                ├─ >1 matches ..... REFUSE as ambiguous — never guess (FR-009)
                └─ exactly 1 ...... contact already has an identity (different sub)?
                                     yes → REFUSE `identity_exists` — check BEFORE insert
                                           so it is a clean refusal, not a UNIQUE violation
                                     no  → create staff_identity(contact_id, google_sub)
                                           set that email's is_login = true
                                           (partial unique index enforces one per contact)
  └─ create staff_session (+ set cookie), write audit
```

All refusals return the **same generic message** (FR-009) — never disclose which condition failed.

### Session lifecycle

```text
create ──▶ active ──(request within idle window)──▶ active   [last_seen_at/expires_at extended]
             │
             ├──(now > expires_at)──────────────▶ expired      → treated as unauthenticated (FR-008)
             ├──(sign-out)──────────────────────▶ destroyed    → row deleted (FR-002)
             └──(contact.is_volunteer cleared)──▶ not honored  → refused on next request (FR-011)
```

**FR-011 is enforced by a live join**, not by a stored flag: every session read joins
`staff_sessions → staff_identities → contacts` and requires `contacts.is_volunteer`. A withdrawn volunteer
is locked out on their **next request**, with no revocation sweep needed.

---

## 5. Migration `0020_staff_auth.sql` (shape)

```sql
CREATE TABLE IF NOT EXISTS staff_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL UNIQUE REFERENCES contacts(id) ON DELETE CASCADE,
  google_sub text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_sign_in_at timestamptz
);

CREATE TABLE IF NOT EXISTS staff_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_identity_id uuid NOT NULL REFERENCES staff_identities(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS staff_sessions_identity_idx
  ON staff_sessions (staff_identity_id);

-- FR-015: at most one login email per contact (0 rows affected today).
CREATE UNIQUE INDEX IF NOT EXISTS contact_emails_one_login_per_contact
  ON contact_emails (contact_id) WHERE is_login;
```

Drizzle schema: `src/server/db/schema/auth.ts`, exported from `schema/index.ts`.

---

## 6. Validation rules (Zod boundaries — Constitution III)

| Boundary | Validated shape |
|---|---|
| Environment (`validation/env.ts`) | `GOOGLE_CLIENT_ID` (non-empty), `GOOGLE_CLIENT_SECRET` (non-empty), `GOOGLE_REDIRECT_URI` (url), `SESSION_IDLE_TTL_HOURS` (int positive, default 8). Joins the existing cached `envSchema`. |
| OAuth callback query (`validation/auth.ts`) | `code` (non-empty), `state` (non-empty); mismatch/absence → refuse. |
| ID-token claims (`validation/auth.ts`) | `sub` (non-empty), `email` (email), `email_verified` (**must be `true`**) → typed `VerifiedClaims`. Extra claims ignored. |

---

## 7. Audit / observability (FR-010, Constitution IV)

`writeAudit` rows plus structured pino logs for: `auth.signin.succeeded`, `auth.signin.refused` (with a
**reason code** server-side, even though the user sees a generic message), `auth.signout`,
`auth.identity.created`, `auth.bootstrap.designated`.

Refusal reason codes (server-side only): `email_unverified`, `no_match`, `ambiguous_match`,
`not_volunteer`, `sub_email_mismatch`, `identity_exists`, `token_invalid`.

`identity_exists` = the matched contact already has a staff identity bound to a **different** `google_sub`
(one Google account per person). This must be detected and refused **before** the insert, so it surfaces as
a normal refusal rather than a `contact_id` UNIQUE violation. Expect it in practice: long-term volunteers
commonly hold both a `cdrochester.org` and a personal Google account (backlog **B38** adds self-service
re-binding).
