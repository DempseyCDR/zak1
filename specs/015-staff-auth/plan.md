# Implementation Plan: Staff Authentication & Session Foundation

**Branch**: `main` (project convention: atomic commits direct to `main`, no feature branches) |
**Date**: 2026-07-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/015-staff-auth/spec.md`

## Summary

Give the platform its first authenticated identity. Staff **sign in with Google** (the club runs Workspace
and issues accounts to all staff), the app binds that verified identity to an existing **volunteer**
contact, and issues a revocable server-side session. Non-public pages and APIs become default-deny; the
public site is untouched. The signed-in identity is exposed through one accessor — the seam the
authorization feature (P3-2) will read.

**Technical approach** (see [research.md](research.md)): `arctic` for the Google authorization-code flow
with PKCE, `jose` to verify the ID token against a JWKS, and a **DB-backed session table** in Drizzle
(required by FR-011 — a stateless JWT could not be revoked when volunteer access is withdrawn). Enforcement
lives in route-group layouts and a `withAuth` API wrapper rather than middleware — because Next.js 15.1.3
middleware is edge-only and `postgres` is not edge-compatible, and, independently, because an authorization
boundary belongs close to the data rather than at the request edge (research R5; the second reason survives
a Next upgrade, the first does not). This activates the dormant feature-001 substrate (`is_volunteer` /
`is_login`) instead of building a parallel user model.

## Technical Context

**Language/Version**: TypeScript 5.7 (strictest flags), Node 24 (Active LTS; `.nvmrc`, `engines`)

**Primary Dependencies**: Next.js 15.1.3 (App Router, RSC), React 19, Drizzle ORM 0.36, `postgres` 3.4,
Zod 3.24, pino 9.5. **New**: `arctic` (OAuth2/OIDC client), `jose` (JWT/JWKS verification) — two small,
focused additions to a deliberately lean 9-dependency runtime.

**Storage**: PostgreSQL 16 (`zak1_dev` / `zak1_test`). Hand-authored SQL migrations; this feature adds
**`0020_staff_auth.sql`** (latest today is `0019`). Additive only.

**Testing**: Vitest 2.1 against **real Postgres** (`zak1_test`), reusing `tests/integration/helpers/`
(`db.ts`, `factories.ts`, `http.ts`). Google is exercised at its boundary via locally-signed OIDC tokens —
never its production endpoints (constitution **v1.2.0**).

**Target Platform**: Web app on Node 24 (single-tenant, self-hosted)

**Project Type**: Web application (Next.js App Router monolith; `src/app` + `src/server`)

**Performance Goals**: Not a driver. Session lookup is one indexed query per authenticated request.
SC-001 (sign-in < 30s) is dominated by Google's redirect, not our code.

**Constraints**:

- Next.js 15.1.3 middleware is **edge-only** → session validation cannot live there. ⚠️ This constraint
  **expires on upgrade** (Node middleware stabilised ~15.5); the decision nonetheless stands on
  defence-in-depth grounds — see research R5.
- FR-011 (revoke on withdrawal) rules out stateless JWT sessions (research R2).
- `pnpm run db:seed` **TRUNCATEs `zak1_dev`** and must never be part of bootstrap (research R8) — the dev
  DB holds the user's live demo data (~1334 contacts).

**Scale/Scope**: Tens of staff accounts; 1334 contacts. Trivial data volumes; correctness and revocation
matter, throughput does not.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.* — Constitution **v1.2.0**.

| Principle | Gate | Status |
|---|---|---|
| **I. Test-First (NON-NEGOTIABLE)** | Failing tests written before implementation; Red-Green-Refactor; new behavior covered. | ✅ **PASS** — tasks will sequence integration tests (claims→contact matching, `email_verified` enforcement, exactly-one rule, `is_volunteer` gate, session expiry/revocation) ahead of implementation. The design's seam (R6) makes this practical. |
| **II. Simplicity / YAGNI** | No speculative abstraction; helper only at 3+ uses. | ✅ **PASS** — 2 tables, 2 small deps, no auth framework, no parallel user model. Rejected: Auth.js, an absolute-expiry mechanism, `hd` enforcement, a local IdP container — each in [research.md](research.md) with rationale. |
| **III. Type Safety** | Strictest flags; no undocumented escape hatches; boundaries validated with Zod → typed domain objects. | ✅ **PASS** — new env vars join the existing Zod `envSchema`; the OAuth callback's query params and the ID-token claims are Zod-validated into a typed `VerifiedClaims` before use. |
| **IV. Observability** | Structured logs + audit rows; no ad-hoc logging in production paths. | ✅ **PASS** — FR-010 requires recording sign-in success, sign-out, and refused attempts; uses the existing pino logger + `writeAudit`, reusing the `withLogging` pattern. |
| **Technology Standards → Testing (v1.2.0)** | Integration tests against real infrastructure; DB never mocked; third-party services exercised at their boundary, never via production endpoints. | ✅ **PASS** — real `zak1_test` Postgres throughout; Google via locally-signed OIDC tokens (R6). This is the exact case the constitution was amended for. |
| **Development Workflow** | Atomic, meaningful commits; Constitution Check reviewed pre-Phase-0 and re-verified post-Phase-1. | ✅ **PASS** — re-verified below. |

**Initial gate: PASS.** No violations → Complexity Tracking is empty.

**Post-Phase-1 re-check: PASS.** The design added no new abstractions beyond the two tables and the single
`verifyGoogleIdToken` seam. One deliberate note: enforcement via layouts + `withAuth` rather than
middleware is not merely a *constraint accommodation* (edge runtime): it is also the safer placement —
auth is checked close to the data rather than at the request edge (research R5, CVE-2025-29927). It reuses
the wrapper pattern the codebase already employs for `withLogging`.

## Project Structure

### Documentation (this feature)

```text
specs/015-staff-auth/
├── plan.md              # This file
├── research.md          # Phase 0 output — R1..R9, all unknowns resolved
├── data-model.md        # Phase 1 output — entities, migration 0020, state transitions
├── quickstart.md        # Phase 1 output — configure, bootstrap, run, verify
├── contracts/
│   └── auth-endpoints.md   # Phase 1 output — auth route contracts + the authz seam
├── checklists/
│   └── requirements.md  # From /speckit-specify (16/16 passing)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── (public)/            # UNPROTECTED — whats-on/ (unchanged)
│   ├── (admin)/
│   │   └── layout.tsx       # NEW — calls requireStaff()
│   ├── (door)/
│   │   └── layout.tsx       # NEW — calls requireStaff()
│   ├── login/
│   │   └── page.tsx         # NEW — "Sign in with Google"
│   ├── api/
│   │   └── auth/
│   │       ├── google/route.ts           # NEW — GET: start (state + PKCE, redirect)
│   │       ├── google/callback/route.ts  # NEW — GET: finish (exchange, verify, session)
│   │       └── signout/route.ts          # NEW — POST: destroy session
│   └── dev/routes/page.tsx  # UPDATE — repo convention: new routes must be listed here
├── server/
│   ├── auth/                # NEW
│   │   ├── claims.ts        #   verifyGoogleIdToken() → VerifiedClaims (the injectable seam)
│   │   ├── google.ts        #   arctic client + authorization-URL/callback plumbing
│   │   ├── signIn.ts        #   claims → contact resolution → staff identity (core domain rule)
│   │   ├── session.ts       #   create / read / touch / destroy; expiry + is_volunteer re-check
│   │   ├── currentStaff.ts  #   getCurrentStaff() / requireStaff() — the P3-2 seam (FR-005)
│   │   └── withAuth.ts      #   API handler wrapper (mirrors lib/withLogging.ts)
│   ├── db/
│   │   ├── schema/auth.ts   # NEW — staffIdentities, staffSessions
│   │   ├── migrations/0020_staff_auth.sql   # NEW — additive
│   │   └── bootstrapOfficer.ts              # NEW — operator CLI (FR-017); NOT db:seed
│   └── validation/
│       ├── env.ts           # UPDATE — GOOGLE_CLIENT_ID/SECRET, redirect URI, session TTL
│       └── auth.ts          # NEW — Zod for callback params + ID-token claims
tests/
├── integration/
│   ├── auth.signin.test.ts      # NEW — matching, email_verified, exactly-one, volunteer gate
│   ├── auth.session.test.ts     # NEW — persistence, idle expiry, sign-out, revocation (FR-011)
│   ├── auth.bootstrap.test.ts   # NEW — operator designation is idempotent (SC-008)
│   └── helpers/oidc.ts          # NEW — local keypair + signed-token fixture (constitution v1.2.0)
└── unit/
    └── auth.claims.test.ts      # NEW — claim validation/rejection
```

**Structure Decision**: Existing Next.js App Router monolith — no new project. Auth logic lives in
`src/server/auth/` rather than `src/server/domain/auth/` because it is cross-cutting infrastructure (like
`lib/`) consumed by every route group, not a business domain like `door` or `treasurer`. Protection
attaches at the **route-group layout** level, which maps exactly onto the existing `(admin)` / `(door)` /
`(public)` grouping — `(public)` and `/` stay open, everything else is default-deny.

⚠️ **Repo convention**: `src/app/dev/routes/page.tsx` must be updated in the same change as the new routes
(per `CLAUDE.md`).

## Complexity Tracking

> No Constitution Check violations. Table intentionally empty.
