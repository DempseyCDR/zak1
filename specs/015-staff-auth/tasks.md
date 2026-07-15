---

description: "Task list for feature 015 — Staff Authentication & Session Foundation"
---

# Tasks: Staff Authentication & Session Foundation

**Input**: Design documents from `/specs/015-staff-auth/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/auth-endpoints.md](contracts/auth-endpoints.md),
[quickstart.md](quickstart.md)

**Tests**: **REQUIRED — not optional.** Constitution **Principle I (Test-First)** is NON-NEGOTIABLE:
tests are written first and MUST be confirmed failing for the right reason before implementation.

**Organization**: Grouped by user story (US1/US2/US3 from spec.md) so each is an independently testable
increment.

**Traceability**: each task names the FR/SC keys it satisfies. **FR-018 is intentionally unmapped** — it is
an out-of-scope declaration (volunteer designation + role assignment belong to P3-2), not buildable work.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 / US2 / US3 (user-story phases only)
- Exact file paths included

## Path Conventions

Existing Next.js App Router monolith: `src/app/` (routes), `src/server/` (auth, db, validation, lib),
`tests/integration/` + `tests/unit/`. Per [plan.md](plan.md).

> **Shell**: every `node`/`pnpm` command must first run
> `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 24 >/dev/null 2>&1`
>
> ⚠️ **Never run `pnpm run db:seed`** — it TRUNCATEs `zak1_dev` and destroys the ~1334-contact demo data.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencies and configuration

- [X] T001 Add `arctic` and `jose` runtime dependencies via `pnpm add` in `package.json` (research R1; FR-001)
- [X] T002 Extend the Zod env schema with `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, and `SESSION_IDLE_TTL_HOURS` (int, default 8) in `src/server/validation/env.ts` (FR-001, FR-008)
- [X] T003 [P] Add an `auth:bootstrap` script entry (tsx runner) to `package.json` (FR-017)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, test seam, and bootstrap — required before any user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 [P] Write **failing** integration test for the one-login-email rule in `tests/integration/auth.loginEmail.test.ts`: a contact may hold one `is_login` email; inserting a **second** `is_login` email for the same contact is rejected. Confirm it FAILS before T005 adds the constraint — `contact_emails.is_login` exists since feature 001 with no constraint, so a second currently succeeds (FR-015)
- [X] T005 Write migration `src/server/db/migrations/0020_staff_auth.sql` creating `staff_identities`, `staff_sessions`, index `staff_sessions_identity_idx`, and the partial unique index `contact_emails_one_login_per_contact` per [data-model.md](data-model.md) §5 — additive only (FR-015; tables for FR-001/FR-006/FR-007)
- [X] T006 Add Drizzle schema `src/server/db/schema/auth.ts` (`staffIdentities`, `staffSessions`) and export it from `src/server/db/schema/index.ts` (FR-006, FR-012)
- [X] T007 [P] Add Zod boundary schemas in `src/server/validation/auth.ts`: OAuth callback query (`code`, `state`) and ID-token claims → typed `VerifiedClaims`, with **`email_verified` required `true`** (research R4; FR-009, Constitution III)
- [X] T008 [P] Create the OIDC boundary fixture in `tests/integration/helpers/oidc.ts`: ephemeral keypair, locally-signed ID tokens, injectable local JWKS — **the constitution v1.2.0 seam; the suite must never call Google** (research R6)
- [X] T009 [P] Extend `tests/integration/helpers/factories.ts` with a volunteer-contact factory (contact + active email + `is_volunteer`)
- [X] T010 Apply the migration with `pnpm run db:migrate` and confirm both tables and the partial unique index exist in `zak1_test` and `zak1_dev`; T004 must now pass (FR-015)
- [X] T011 [P] Write failing integration test for the bootstrap CLI in `tests/integration/auth.bootstrap.test.ts`: designates a volunteer, marks `is_login`, is idempotent, errors on zero/ambiguous `--email` (FR-017, SC-008)
- [X] T012 Implement the operator bootstrap CLI in `src/server/db/bootstrapOfficer.ts` (`--email`, `--contact-id`, `--role`; sets `is_volunteer`, ensures the active email, marks `is_login`, writes audit; idempotent; **must not resemble `db:seed`**) per [contracts/auth-endpoints.md](contracts/auth-endpoints.md) §7 (FR-017, SC-008)

**Checkpoint**: Schema, test seam, and a designatable first officer exist — user stories can begin

---

## Phase 3: User Story 1 - Staff member signs in with Google and out (Priority: P1) 🎯 MVP

**Goal**: A designated volunteer signs in with Google, gets a staff identity provisioned automatically on
first sign-in, and can sign out.

**Independent Test**: With a bootstrapped officer, sign in with Google → a staff page loads and a
`staff_identities` row exists; sign out → session gone.

### Tests for User Story 1 ⚠️ Write FIRST, confirm they FAIL for the right reason

- [X] T013 [P] [US1] Unit test claim validation in `tests/unit/auth.claims.test.ts`: `email_verified: false` rejected, malformed/missing claims rejected (FR-009)
- [X] T014 [P] [US1] Integration test sign-in resolution in `tests/integration/auth.signin.test.ts`: exactly-one active volunteer email → success; **zero matches**, **multiple matches**, **non-volunteer contact**, and **unverified email** each refused (FR-009, FR-013, SC-007)
- [X] T015 [P] [US1] Integration test identity provisioning in `tests/integration/auth.identity.test.ts`: first sign-in creates `staff_identities` with `google_sub` and sets that email's `is_login`; second sign-in reuses it; a known `sub` with a changed email keeps its binding and logs a mismatch (FR-006, FR-012, FR-014; research R9)
- [X] T016 [P] [US1] Integration test sign-out in `tests/integration/auth.signout.test.ts`: deletes the `staff_sessions` row and clears the cookie (FR-002)
- [X] T017 [P] [US1] Integration test OAuth `state` mismatch in `tests/integration/auth.callback.test.ts`: a callback whose `state` does not match the stored cookie is refused, **no session is created**, and the refusal is logged (contracts §2 — CSRF defence)
- [X] T018 [P] [US1] Integration test the `next` open-redirect guard in `tests/integration/auth.redirect.test.ts`: absolute URLs, scheme-relative values (`//evil.com`), and any non-relative `next` are rejected; only a leading-`/` relative path is honored (contracts §1)
- [X] T019 [P] [US1] Integration test the **dual-account collision** in `tests/integration/auth.identity.test.ts`: a contact that already has a staff identity, signed in from a **different** Google account whose verified email also matches that contact (the long-term volunteer with both a `cdrochester.org` and a personal account), is **refused** with reason `identity_exists` — a clean refusal, **not** a `contact_id` UNIQUE violation (FR-006, FR-009)

### Implementation for User Story 1

- [X] T020 [P] [US1] Implement the verification seam `verifyGoogleIdToken(token) → VerifiedClaims` in `src/server/auth/claims.ts` using `jose` with an **injectable JWKS** (remote in prod, local in tests) (FR-001, FR-009)
- [X] T021 [P] [US1] Implement the arctic Google client, authorization-URL construction, PKCE + state generation, and code→token exchange in `src/server/auth/google.ts` (FR-001)
- [X] T022 [US1] Implement sign-in resolution in `src/server/auth/signIn.ts`: claims → active email match → exactly-one volunteer contact → upsert identity → set `is_login`; return typed refusal reason codes (`email_unverified`, `no_match`, `ambiguous_match`, `not_volunteer`, `sub_email_mismatch`, `identity_exists`, `token_invalid`) per [data-model.md](data-model.md) §4; the `identity_exists` check MUST happen **before** the insert so a dual-account attempt is a clean refusal, not a UNIQUE violation (FR-006, FR-009, FR-012, FR-013, FR-014) (depends on T020; satisfies T019)
- [X] T023 [US1] Implement session create + destroy in `src/server/auth/session.ts`: random opaque token, **store only its hash**, set `expires_at` from `SESSION_IDLE_TTL_HOURS`, httpOnly/secure/SameSite=Lax cookie (FR-001, FR-002, FR-007) (depends on T006)
- [X] T024 [US1] Implement `GET /api/auth/google` in `src/app/api/auth/google/route.ts`: store state + PKCE verifier in short-lived cookies, redirect to Google; **validate `?next=` is a relative path** (open-redirect guard) per contracts §1 (FR-001) (satisfies T018)
- [X] T025 [US1] Implement `GET /api/auth/google/callback` in `src/app/api/auth/google/callback/route.ts`: verify `state`, exchange code, verify ID token, resolve identity, create session, redirect; **all refusals return the same generic `/login?error=access_denied`** (FR-001, FR-009) (depends on T021, T022, T023; satisfies T017)
- [X] T026 [US1] Implement `POST /api/auth/signout` in `src/app/api/auth/signout/route.ts` (**POST only** — a GET sign-out is CSRF-triggerable) (FR-002) (depends on T023)
- [X] T027 [P] [US1] Create the `/login` page in `src/app/login/page.tsx` with a "Sign in with Google" action and generic `?error=access_denied` rendering (FR-001)
- [X] T028 [US1] Add `writeAudit` rows + pino structured logs for `auth.signin.succeeded`, `auth.signin.refused` (with server-side reason code), `auth.signout`, `auth.identity.created` across `src/server/auth/` (FR-010, SC-005, Constitution IV)
- [X] T029 [US1] Update `src/app/dev/routes/page.tsx` to list `/login` and the three `/api/auth/*` endpoints — **repo convention requires this in the same change** (`CLAUDE.md`)

**Checkpoint**: US1 fully functional — a bootstrapped officer can sign in and out

---

## Phase 4: User Story 2 - Public stays open, staff areas are protected (Priority: P2)

**Goal**: Non-public pages and APIs are default-deny; the public site is unchanged; withdrawal of volunteer
access takes effect immediately.

**Independent Test**: Signed out, `/whats-on` loads but `/gate` redirects to `/login` and
`GET /api/events` returns 401.

### Tests for User Story 2 ⚠️ Write FIRST, confirm they FAIL

- [X] T030 [P] [US2] Integration test API default-deny in `tests/integration/auth.protection.test.ts`: unauthenticated `/api/*` returns 401; `/api/auth/*` remains reachable (FR-004, SC-002)
- [X] T031 [P] [US2] Integration test **revocation** in `tests/integration/auth.revocation.test.ts`: with a live session, clearing `contacts.is_volunteer` causes the very next request to be refused — **without deleting the session row or waiting for expiry** (FR-011, SC-006)
- [X] T032 [P] [US2] Integration test public-route regression guard in `tests/integration/auth.public.test.ts`: public schedule/event pages remain reachable with no session (FR-003, SC-003 — feature 007 must not regress)
- [X] T033 [P] [US2] Integration **route-inventory** test in `tests/integration/auth.routeInventory.test.ts`: enumerate every `route.ts` under `src/app/api/` and assert each one **except** `/api/auth/*` rejects an unauthenticated request. Self-maintaining — a newly added unprotected route fails the suite automatically (FR-004, SC-002)

### Implementation for User Story 2

- [X] T034 [US2] Implement `getCurrentStaff()` / `requireStaff()` in `src/server/auth/currentStaff.ts`: read the session cookie, hash-match the row, enforce `expires_at`, and **join through to `contacts.is_volunteer` live** so withdrawal bites immediately; return the `CurrentStaff` shape from contracts §4 — **identity only, no roles** (FR-005, FR-011) (depends on T023)
- [X] T035 [US2] Implement the `withAuth` API wrapper in `src/server/auth/withAuth.ts` mirroring `src/server/lib/withLogging.ts`: 401 when unauthenticated, inject `staff` when authenticated (FR-004) (depends on T034)
- [X] T036 [P] [US2] Add `src/app/(admin)/layout.tsx` calling `requireStaff()` to protect every admin page in one place (FR-004)
- [X] T037 [P] [US2] Add `src/app/(door)/layout.tsx` calling `requireStaff()` to protect `/checkin` and `/gate` (FR-004)
- [X] T038 [US2] Apply `withAuth` to every route under `src/app/api/` **except** `src/app/api/auth/*` (default-deny per contracts §5); T033 is the acceptance gate — iterate until the route-inventory test is green (FR-004, SC-002) (depends on T035)
- [X] T039 [US2] Record the public-route allowlist in `src/app/dev/routes/page.tsx` and decide `/` and `/dev/routes` classification (`(public)/*` + `/api/auth/*` are public; `/dev/routes` exposes app structure — protect unless deliberately left open) (FR-003)

**Checkpoint**: US1 + US2 both work — sign-in works and everything non-public is closed

---

## Phase 5: User Story 3 - Staying signed in across a working session (Priority: P3)

**Goal**: Staff stay signed in across pages for a working evening; sessions idle out.

**Independent Test**: Navigate several staff pages without re-authenticating; force `expires_at` into the
past and confirm the next request is unauthenticated.

### Tests for User Story 3 ⚠️ Write FIRST, confirm they FAIL

- [X] T040 [P] [US3] Integration test rolling extension in `tests/integration/auth.session.test.ts`: each authenticated request advances `last_seen_at`/`expires_at`; no re-authentication across pages (FR-007, SC-004)
- [X] T041 [P] [US3] Integration test idle expiry in `tests/integration/auth.session.test.ts`: a session past `expires_at` is treated as unauthenticated (FR-008)

### Implementation for User Story 3

- [X] T042 [US3] Implement rolling session extension (advance `last_seen_at` and `expires_at` on authenticated reads) in `src/server/auth/session.ts` (FR-007) (depends on T034)
- [X] T043 [US3] Honor `SESSION_IDLE_TTL_HOURS` (default 8) when creating and extending sessions in `src/server/auth/session.ts` and `src/server/validation/env.ts` (FR-008; research R3)

**Checkpoint**: All three user stories independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T044 [P] Confirm the suite **never contacts Google** — grep `tests/` for outbound Google/network use; all IdP interaction must go through `tests/integration/helpers/oidc.ts` (constitution v1.2.0)
- [X] T045 [P] Verify no password surface exists: `grep -rniE "password|bcrypt|argon|scrypt|pbkdf2" src/server/auth/ src/server/db/schema/auth.ts` returns nothing (FR-016, SC-009)
- [ ] T046 Run the full suite green (`pnpm test`, expect 220 existing + new), `pnpm exec tsc --noEmit`, and `pnpm exec eslint src/server/auth src/app/api/auth src/app/login` (Constitution I, III)
- [ ] T047 Execute the S1–S9 validation scenarios in `specs/015-staff-auth/quickstart.md`, including the cold-start bootstrap and live revocation (SC-001, SC-003, SC-006, SC-008)
- [ ] T048 Browser-verify sign-in end-to-end using the preview tooling (`preview_start { name: "dev" }`) — never a raw `pnpm dev` (SC-001)
- [ ] T049 [P] Update `docs/zak1_Help_Glossary.md` with auth terms (staff identity, session, login email, bootstrap) and their file index entries
- [ ] T050 [P] Re-sync `specs/DATA_MODEL.md` with `staff_identities` / `staff_sessions` and the `is_login` constraint
- [ ] T051 [P] Close **B32** in `specs/BACKLOG.md` (mark Done → feature 015) and note in `specs/PHASE3_REQUIREMENTS.md` that P3-1 has shipped
- [ ] T052 [P] Refresh auto-memory (`zak1-implementation-status`, `zak1-phase3-roles`) with feature 015's outcome per project convention

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS all user stories**
- **US1 (Phase 3)**: Depends on Foundational. **The MVP.**
- **US2 (Phase 4)**: Depends on Foundational; consumes US1's `session.ts` (T023). Testable independently
  via a factory-created session, but ships naturally after US1.
- **US3 (Phase 5)**: Depends on Foundational; extends US2's `currentStaff` read path (T034).
- **Polish (Phase 6)**: After the desired stories are complete

### Story Dependencies — honest note

This feature is more cohesive than a typical multi-story feature: US2 and US3 refine the session
established by US1 rather than standing entirely apart. Each is still *independently testable* (US2 via a
factory-created session; US3 by manipulating `expires_at`), but the natural delivery order is
**US1 → US2 → US3**. Attempting to build US2 or US3 first would mean stubbing US1's session creation for
no benefit.

### Within Each Story

- Tests written and **failing for the right reason** before implementation (Constitution I)
- Seam (`claims.ts`) before consumers (`signIn.ts`) · services before routes · routes before UI

### Parallel Opportunities

- T003 in Setup
- T004, T007, T008, T009, T011 in Foundational (different files)
- All tests within a story (T013–T018; T030–T033; T040–T041)
- T020/T021 (different files) and T027 within US1
- T036/T037 (different layouts) within US2
- Most of Phase 6

---

## Parallel Example: User Story 1

```bash
# Write all US1 tests together first (they must fail):
Task: "Unit test claim validation in tests/unit/auth.claims.test.ts"
Task: "Integration test sign-in resolution in tests/integration/auth.signin.test.ts"
Task: "Integration test identity provisioning in tests/integration/auth.identity.test.ts"
Task: "Integration test sign-out in tests/integration/auth.signout.test.ts"
Task: "Integration test OAuth state mismatch in tests/integration/auth.callback.test.ts"
Task: "Integration test next open-redirect guard in tests/integration/auth.redirect.test.ts"

# Then the independent implementation files:
Task: "Implement verifyGoogleIdToken seam in src/server/auth/claims.ts"
Task: "Implement arctic Google client in src/server/auth/google.ts"
Task: "Create /login page in src/app/login/page.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup → 2. Phase 2 Foundational (**critical — blocks everything**) → 3. Phase 3 US1
4. **STOP and VALIDATE**: bootstrap an officer, sign in with Google, sign out
5. At this point the app has its first authenticated identity — the thing all of Phase 3 depends on

> ⚠️ **MVP caveat**: US1 alone gives sign-in but **does not yet close the doors** — staff pages stay open
> until US2. US1 is a valid demo checkpoint, not a deployable security posture. Ship US1+US2 together.

### Incremental Delivery

1. Setup + Foundational → foundation ready (officer designatable)
2. + US1 → sign-in/out works → demo
3. + US2 → non-public surface closed, revocation live → **first genuinely deployable state**
4. + US3 → session ergonomics (rolling window, idle expiry)
5. Polish → validation, docs, backlog/memory sync

### Notes

- `[P]` = different files, no dependencies
- Verify tests fail before implementing (Constitution I, non-negotiable)
- Commit per task or logical group; project convention is atomic commits direct to `main`
- **Authorization stays out of scope** — `CurrentStaff` carries identity only. P3-2 layers
  `role × capability × scope` on top (see `docs/use-cases.md`)
- **Offboarding note** (spec Edge Cases): suspending someone's Workspace account stops *new* sign-ins but
  leaves an active session alive for up to one idle window. Clearing `is_volunteer` is the immediate
  kill-switch (FR-011) — T031 is the test that proves it.
