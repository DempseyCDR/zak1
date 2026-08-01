# Research: Structured name capture when creating a performer

Decisions resolving the plan's unknowns. No open `NEEDS CLARIFICATION` — the requirement + its Phase 5
resolution (P5-R5 / Q11) are settled, and the code shape is confirmed by reading `createPerformer`,
`performerCreateSchema`, `deriveContactNames`, `contacts`/`performers` schema, and the two create surfaces.

## R1 — The create input becomes structured; reuse `deriveContactNames` (012)

**Decision**: Replace the single required `displayName` on `performerCreateSchema` with **`firstName`**
(string), **`lastName?`** (optional), and **`displayNameOverride?`** (optional) — the exact shape 012's
`deriveContactNames` consumes. Keep `contactId?` (link an existing contact), plus the existing `email?`,
`emailPurpose?`, `phone?`, `bio?`, `photoUrl?`. On the create path, `createPerformer` builds the contact with
`deriveContactNames({ firstName, lastName, displayNameOverride })`, storing `first_name`, `last_name`,
`display_name_override`, and the derived `display_name`/`name_normalized`/`dedup_normalized`.

**Rationale**: FR-001/FR-002. The contacts directory (012) and check-in (017) already use exactly this shape;
reusing the helper makes a performer-created contact **byte-for-byte** the same quality, with no new logic and
no migration (`contacts` already has every column). The old `firstName: input.displayName` line — the bug —
disappears.

**Alternatives**: Keep a `displayName` input and split it server-side — rejected (re-introduces lossy
heuristic splitting, and the spec wants explicit first/last **capture** at the UI, not a server guess).

## R2 — The performer's display name is derived, never free-typed

**Decision**: `performers.display_name` is no longer an input. On the **create** path it is the
`deriveContactNames` result (override, else "first last", else first). On the **link** path (`contactId`
given) it is read from the **linked contact's** current `display_name`. A performer therefore never carries a
name that disagrees with its contact.

**Rationale**: FR-003/FR-005 + US2-AC2. Today `performers.display_name = input.displayName` even when linking,
which lets a performer's shown name drift from its contact. Deriving it keeps the two consistent and removes
the only reason to still accept a free-typed name. Stage names are handled by the contact's
`display_name_override` (create) or the contact's own override (link).

**Alternatives**: A separate performer-only display field — rejected (YAGNI; the contact's override already
covers stage names, and a second name source is exactly the drift this feature removes).

## R3 — Validation: link a contact XOR create with a first name

**Decision**: `performerCreateSchema` gets a **refinement**: either `contactId` is present (link) **or**
`firstName` is present (create) — not neither. `lastName` stays optional (mononym). This replaces the old
"`displayName` required" rule.

**Rationale**: FR-005/FR-006 + edge cases. It makes the two paths explicit and testable, and it permits a
one-word performer (first only). Zod refinement at the boundary satisfies Principle III.

**Alternatives**: Require `firstName` always (even when linking) — rejected (redundant on the link path, and
the linked contact already owns the name).

## R4 — The two create surfaces capture structured names

**Decision**: Update the two staff surfaces that create a **brand-new** performer to present first / last /
optional display fields and post the structured input: the **performers directory** create form
(`(admin)/performers/page.tsx`) and the **add-performer "create brand-new" step** inside the booking flow
(`_modals/BookingModal.tsx`, whose `createNewPerformer` posts `{ displayName: q }` today). The
**link-an-existing-contact** path in the modal keeps posting just `contactId` (drop the now-unused
`displayName`). No other surface creates a performer.

**Rationale**: FR-004. Grounding confirmed these are the only create surfaces (other pages use the performer
**search**, not create). Both must present the same fields or the inconsistency just moves.

**Alternatives**: Fix only the performers page — rejected (the booking add-performer path is the one Sean uses
most; leaving it single-name defeats the purpose).

## R5 — No migration; the test factory adapts (keeps the suite green + upgrades its data)

**Decision**: **No migration** (capture-only; `contacts` columns exist; no existing record touched). The
`makePerformer(displayName)` test factory keeps its convenient single-string signature but **splits** it into
`{ firstName, lastName }` (on the last space) when calling `createPerformer`, so every existing test that does
`makePerformer("Cal Caller")` keeps passing **and** now produces a structured contact. Any test that calls
`createPerformer` directly with `{ displayName }` is updated to the structured input.

**Rationale**: The input-contract change ripples to the factory used across the suite; adapting the factory
(rather than rewriting hundreds of call sites) is the minimal, correct move — and it means the test data
becomes structured too. The heuristic split is **test-only** (test names are "First Last"); production capture
is explicit per R1, never heuristic.

**Alternatives**: Overload `createPerformer` to accept the legacy `displayName` for tests — rejected (keeps a
lossy path alive in production code just for tests).
