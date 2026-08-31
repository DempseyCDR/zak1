# Phase 0 Research: Mailing-List Manager Authority

The spec carried **no `[NEEDS CLARIFICATION]` markers**. This file records the load-bearing decisions and
the code facts they rest on (verified against the current tree).

## Decision 1 — Both capabilities are conferred at `global` scope

- **Decision**: `mailing_list_manager` gains `contact.write: "global"`, and its `contact.mailing.write`
  changes from `"scoped"` to `"global"`.
- **Rationale**: A **contact is not series-scoped** — a person does not belong to a dance series — so a
  `scoped` contact capability has nothing to filter on and is meaningless for this role. The role already
  holds its other contact-facing capabilities globally (`contact.pii.read: "global"`, `export.read:
  "global"`), so `global` is the consistent, correct choice (this is also the substance of M-R2).
- **Alternatives considered**:
  - *Keep `contact.mailing.write` scoped* — rejected: it blocks Mel's real, club-wide work and models a
    series relationship contacts don't have.
  - *Add `contact.write` as `scoped`* — rejected for the same reason (nothing to scope on).

## Decision 2 — Change lives in code (the catalog), not the database

- **Decision**: Edit `src/server/auth/capabilities.ts`; no migration, no data.
- **Rationale**: Feature 016 deliberately keeps authority in code: "a capability means something only
  because a handler checks it; a DB-driven catalog would let an officer grant a capability no code
  implements." The catalog is `Record<Role, Partial<Record<Capability, ScopeMode>>>` and is exhaustively
  type-checked, so the edit is safe by construction.
- **Verified**: `src/server/auth/can.ts` L25–27 — `const mode = CAPABILITIES[grant.role][capability]; if
  (mode === "global") return true;`. Setting the mode to `"global"` confers the capability everywhere,
  regardless of the grant's own series/group scope. This is exactly the lever the feature needs.

## Decision 3 — No superset or other-role change

- **Decision**: Touch only the `mailing_list_manager` map.
- **Rationale/Verified**: `super_user` already lists `contact.write` and `contact.mailing.write` as
  `global`; the three supersets (Treasurer ⊇ FS, VP ⊇ President, Super-user ⊇ all) are flattened in the
  catalog, so no runtime hierarchy needs updating. `contact.write` is already held by `door_attendant`
  (global) and the FS/Treasurer bundle (global) — those are unchanged. The change is purely additive to
  one role (FR-005).

## Decision 4 — Governance boundary is preserved by omission

- **Decision**: Do **not** add `role.assign`, contact delete/archive, `membership.write`, or any other
  capability to the role.
- **Rationale**: `is_volunteer` designation and role assignment stay governance-only (`role.assign`,
  held by President/VP/super_user) — this is the M-R7-adjacent decision from the requirements. The
  boundary is enforced simply by **not listing** those capabilities in the role's map; `can()` returns
  false for any capability absent from the map (FR-004).

## Verified code facts (for the plan/tests)

- Current catalog state (`capabilities.ts`): `mailing_list_manager` = `{ mailing_list.write: scoped,
  export.read: global, contact.mailing.write: scoped, dedup.write: global, contact.pii.read: global }` —
  **no `contact.write`**, and `contact.mailing.write` is **scoped**. This is exactly what M-R1/M-R2 change.
- Gated endpoints already in place: `POST /api/contacts` and `PATCH /api/contacts/[id]` require
  `contact.write`; `POST/PATCH /api/contacts/[id]/emails…` require `contact.mailing.write`. Granting the
  capabilities makes these admit an MLM with no route changes.
- Test homes: `tests/unit/authz.can.test.ts` (pure `can()` matrix), `tests/integration/authz.boundaries.test.ts`
  and `tests/integration/authz.scope.test.ts` (role behavior + scope).
