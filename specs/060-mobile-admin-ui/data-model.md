# Phase 1 Data Model: Mobile-First Admin UI Foundation

**No database entities, schema, or migration** (FR-009). This is a presentation/interaction foundation.
The "model" is the inventory of UI artifacts and their contracts.

## UI artifacts

| Artifact | Kind | Responsibility |
|---|---|---|
| `globals.css` tokens | existing (reused) | colors / spacing / type / container — the single fixed palette |
| touch-target utility | new (in `globals.css`) | enforce 48×48px min hit area on primary controls |
| `AdminPage` | new component | mobile-first page shell/container (token-driven, ≤375px safe) |
| `RecordView` | new component | **Record mode** — single-entity view/editor shell (header, stacked fields/sections, actions) |
| `TriageList` | new component | **Triage mode** — worklist (rows with inline action or "open", empty state) |
| `contacts/page.tsx` | migrated | reference surface: search + list via `TriageList`, a `RecordView` shell; presentation only |

## Component "shapes" (props, not data)

- **`AdminPage`**: `{ title, children }` → renders a mobile-first container using `--container-max` and
  `--space-*`; no horizontal overflow.
- **`RecordView`**: `{ title, actions?, children }` → a focused single-entity layout; fields/sections
  stack vertically on narrow screens. Content (the actual fields) is supplied by the consumer.
- **`TriageList`**: `{ items, renderRow, onOpen?, emptyState }` → a worklist; each row exposes its inline
  action and/or an "open" affordance (the Triage→Record bridge, FR-007); shows `emptyState` when empty.

## Invariants (validation rules from requirements)

- **No horizontal page-body scroll** at ≤375px; wide content scrolls within its own container (FR-002,
  edge case).
- **48×48px** minimum for primary interactive targets (FR-008, SC-005).
- **Shared tokens only** — no bespoke per-page colors; visual parity with public (FR-003, SC-002).
- **No behavior change** on the migrated contacts surface (FR-010, SC-004) — search input → results list
  works exactly as before; only presentation changes.
- **Presentation only** — components render structure/slots; they perform **no** data mutation,
  authorization, or role-specific logic (FR-009).

## State transitions

None persisted. The only "state" is client UI (e.g., which record is open, search query) — transient and
already handled by the existing contacts page; this feature restyles it without changing the flow.
