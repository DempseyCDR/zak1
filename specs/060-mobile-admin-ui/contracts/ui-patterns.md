# Contract: Admin UI Patterns (feature 060)

The "interface" this feature exposes is a **UI contract** — the behavior of the two reusable patterns and
the visual/interaction invariants every migrated admin surface must satisfy. These drive the component
tests and the Browser-preview checks.

## Pattern A — Record mode (`RecordView`)

A focused single-entity view/editor.

- **C-A1**: Renders a single labeled region (a landmark/heading naming the entity) with its
  fields/sections **stacked vertically**; at ≤375px nothing forces horizontal scroll.
- **C-A2**: Exposes an actions area; action controls meet the 48×48px target.
- **C-A3**: Presentation only — it renders whatever fields/actions the consumer passes; it performs no
  fetch, mutation, or authorization of its own.

## Pattern B — Triage mode (`TriageList`)

A worklist of pending items.

- **C-B1**: Renders `items` as rows; each row shows its primary content and offers **either** an inline
  action **or** an "open" affordance (the Triage→Record bridge).
- **C-B2**: Selecting a row's "open" affordance invokes `onOpen(item)` (the consumer routes to the
  Record/detail view) — the pattern does not itself mutate anything (C-B, FR-007, FR-009).
- **C-B3**: With `items` empty, renders the provided **empty state** (not a blank region).
- **C-B4**: Row action controls meet the 48×48px target; the list does not cause horizontal page scroll.

## Surface invariants (every migrated admin surface)

- **C-S1 — No horizontal page-body scroll** at a 375px viewport; wide content (tables) scrolls inside its
  own `overflow-x` container.
- **C-S2 — Shared palette**: uses `globals.css` tokens only; no bespoke inline colors. Visual parity with
  public pages.
- **C-S3 — Touch targets**: primary interactive controls are ≥48×48 CSS px.
- **C-S4 — No behavior regression** (reference surface): the migrated `contacts` search returns and
  renders results exactly as before; only presentation changes.

## Verification mapping

| Contract | Verified by |
|---|---|
| C-A1, C-A3 | `tests/component/recordView.test.tsx` (structure/roles; no data calls) |
| C-B1, C-B2, C-B3 | `tests/component/triageList.test.tsx` (rows, `onOpen`, empty state) |
| C-S4 | `tests/component/contacts.page.test.tsx` (search still renders results) |
| C-A2, C-B4, C-S1, C-S2, C-S3 | Browser preview @375px per `quickstart.md` (layout-dependent) |
