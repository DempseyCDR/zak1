# Quickstart & Validation: Staff Authentication (015)

How to configure, bootstrap, run, and **prove** the feature works. Details live in
[data-model.md](data-model.md) and [contracts/auth-endpoints.md](contracts/auth-endpoints.md) — this file
is the run/verify guide.

> **Shell prerequisite** (this repo): every `node`/`pnpm` command must first select Node 24 —
>
> ```bash
> export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 24 >/dev/null 2>&1
> ```
>
> For direct `psql`, source the env instead: `set -a; . ./.env; set +a`

---

## 1. Prerequisites

- Postgres 16 running; `zak1_dev` (demo data) and `zak1_test` present.
- A **Google Cloud OAuth 2.0 Client ID** (type: *Web application*) in a project owned by the club, with an
  authorized redirect URI of `http://localhost:3000/api/auth/google/callback` for local dev.
- **OAuth consent screen — User Type `External`** (⚠️ **not** `Internal`) and publishing status
  **`Published`** (not `Testing`). Rationale (research R4): staff are a *mixed* population — long-term
  volunteers hold `cdrochester.org` Workspace accounts, short-term volunteers use **personal** Google
  accounts. `Internal` admits only the Workspace org and would lock out every short-term volunteer;
  `External` is a **superset** that admits both. `Testing` admits only an explicitly maintained test-user
  list (max 100) — a trap that strands a volunteer on the night of an event. Scopes are `openid` + `email`
  (non-sensitive), so no sensitive-scope verification review is expected. The app name shown on the consent
  screen is the club-facing one (**cdrochester**); `zak1` is only the internal build codename and never
  appears to users.
  - *Optional*: a Workspace admin can mark the app **trusted** in the admin console so `cdrochester.org`
    users skip the consent prompt, while personal accounts still work.
- ⚠️ **Never run `pnpm run db:seed`** here — it TRUNCATEs `zak1_dev` and destroys the demo data.

## 2. Configure

Add to `.env` (validated by the Zod `envSchema`; the app throws at startup if malformed):

```bash
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
SESSION_IDLE_TTL_HOURS=8          # optional; default 8 (research R3)
```

> The client secret is a real secret: `.env` only, never committed, never pasted into chat.

## 3. Migrate

```bash
pnpm run db:migrate     # applies 0020_staff_auth.sql — additive, safe
```

## 4. Bootstrap the first officer (FR-017)

**Required.** Nothing else works until this runs: today **0 of 1334 contacts are volunteers** and there are
**0 login emails**, so nobody can sign in.

```bash
# The address must be the person's Google/Workspace login address.
pnpm run auth:bootstrap -- --email alice@club.org

# If their Workspace address isn't on their contact record yet (common — 0 login emails exist):
pnpm run auth:bootstrap -- --contact-id <uuid> --email alice@club.org
```

Idempotent. Sets `is_volunteer`, ensures the email is active on that contact, marks it `is_login`, writes an
audit row.

## 5. Run

```bash
# Use the preview tooling, not a raw `pnpm dev`:
#   preview_start { name: "dev" }
```

---

## 6. Validation scenarios

Each maps to spec Success Criteria. ✅ = expected.

### S1 — Public stays open (SC-003)

1. Open `/whats-on` **signed out**. ✅ Loads normally, no sign-in prompt.
2. Open an event detail page. ✅ Loads.

*Regression guard: feature 007 must not break.*

### S2 — Staff areas are protected (SC-002)

1. Signed out, open `/gate` (or any `(admin)`/`(door)` page). ✅ Redirected to `/login`.
2. Signed out, `curl -i http://localhost:3000/api/events`. ✅ `401`.

### S3 — Sign in with Google (SC-001, FR-012)

1. Go to `/login`, click **Sign in with Google**, authenticate as the bootstrapped officer.
2. ✅ Redirected back signed in; a staff page loads.
3. ✅ A `staff_identities` row now exists (created automatically — no registration form, no approval):

```bash
set -a; . ./.env; set +a
psql "$DATABASE_URL" -c "SELECT contact_id, google_sub IS NOT NULL AS bound, last_sign_in_at
                         FROM staff_identities;"
psql "$DATABASE_URL" -c "SELECT count(*) FROM contact_emails WHERE is_login;"   -- expect 1
```

### S4 — Refusals are generic (SC-007, FR-009)

Sign in with a Google account that is **not** a volunteer contact.
✅ Refused, landing on `/login?error=access_denied` with a generic message.
✅ The server log records a specific reason (`no_match` / `not_volunteer` / …) — the **user** is never told
which. Verify the log shows the reason and the page does not.

### S5 — Session persists then idles out (SC-004, FR-007/FR-008)

1. Signed in, navigate across several staff pages. ✅ No re-authentication.
2. Expire the session by hand, then act again:

```bash
psql "$DATABASE_URL" -c "UPDATE staff_sessions SET expires_at = now() - interval '1 minute';"
```

✅ Next request is treated as signed out → `/login`.

### S6 — Withdrawal takes effect immediately (SC-006, FR-011)

**The scenario a stateless JWT could not satisfy** — the reason sessions are DB-backed (research R2).

1. While signed in with a live session, withdraw volunteer access:

   ```bash
   psql "$DATABASE_URL" -c "UPDATE contacts SET is_volunteer = false WHERE id = '<contact-id>';"
   ```

2. Refresh any staff page. ✅ Immediately signed out / refused — **without** deleting the session row and
   without waiting for expiry (the live `is_volunteer` join does it).
3. Restore: `UPDATE contacts SET is_volunteer = true WHERE id = '<contact-id>';`

### S7 — Sign out (FR-002)

Click sign out. ✅ Cookie cleared, `staff_sessions` row gone, staff pages redirect to `/login`.

### S8 — No passwords anywhere (SC-009)

```bash
grep -rniE "password|bcrypt|argon|scrypt|pbkdf2" src/server/auth/ src/server/db/schema/auth.ts
```

✅ No hits. The app neither stores nor prompts for a password.

### S9 — Cold start (SC-008)

On a database with no volunteers: run §4 bootstrap → sign in → reach a staff page. ✅ Achieved with **no
manual database editing**.

---

## 7. Tests

```bash
pnpm test                                   # full suite (expect 220 existing + new, all green)
pnpm exec vitest run tests/integration/auth.signin.test.ts
pnpm exec vitest run tests/integration/auth.session.test.ts
pnpm exec tsc --noEmit                      # typecheck
pnpm exec eslint src/server/auth src/app/api/auth
```

**Constitution v1.2.0 compliance** — the suite **never calls Google**. `tests/integration/helpers/oidc.ts`
mints an ephemeral keypair and signs ID tokens locally, injecting a local JWKS into the verifier: the
"fixture reproducing the provider's verified contract" the constitution permits. Everything behind that
seam — `email_verified` enforcement, email→contact matching, the exactly-one rule, the `is_volunteer` gate,
`is_login` designation, and the full session lifecycle — runs against **real Postgres** (`zak1_test`).

If a test ever needs network access to Google, that is a design smell: the seam has been bypassed.

---

## 8. Troubleshooting

| Symptom | Likely cause |
|---|---|
| `redirect_uri_mismatch` from Google | `GOOGLE_REDIRECT_URI` ≠ the URI registered in Google Cloud (exact match, incl. port). |
| Refused despite a valid Workspace login | The address isn't an **active** email on a contact with `is_volunteer` — the usual cold-start gap. Check `contact_emails`; use `--contact-id` bootstrap. |
| Refused, log says `ambiguous_match` | The email is active on **more than one** volunteer contact. By design we never guess (FR-009) — resolve the duplicate, likely via `/dedup`. |
| Refused, log says `email_unverified` | Google reported `email_verified: false`. Correct behavior — the check is deliberate (research R4). |
| Startup throws on env | A `GOOGLE_*` var is missing/malformed — the Zod `envSchema` fails fast by design. |
