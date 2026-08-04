# Phase 1 Data Model: Public Navigation Menu

This feature introduces **no persisted data** — no database table, no migration. The only "model" is a static,
hand-maintained configuration list rendered by the UI.

## Entity: Public menu entry

A single navigable item in the public menu.

| Field | Type | Notes |
|-------|------|-------|
| `href` | `string` | Destination path (an app route, e.g. `/whats-on`). Must be an existing public route. |
| `label` | `string` | Human-readable menu text (e.g. `What's On`). |

- **Collection**: `PUBLIC_NAV` — a `readonly` **ordered** array of entries in `src/app/publicNavItems.ts`. Order is
  display order. Hand-maintained (FR-003); generation deferred to backlog B44.
- **Identity / uniqueness**: `href` is the natural key; no duplicate hrefs. Not enforced by a database — it is a
  code-reviewed constant.
- **Lifecycle / state**: none. Editing the array is the only mutation; it is a source change, not runtime data.
- **Validation**: none at runtime (static config, no external boundary → no Zod, per Constitution III). Type
  correctness (`{ href: string; label: string }`) is enforced by the compiler.

### Initial contents (Clarifications 2026-08-04)

| Order | `label` | `href` |
|-------|---------|--------|
| 1 | What's On | `/whats-on` |
| 2 | Join | `/join` |

The **home/wordmark** affordance (club name → `/whats-on`, FR-006) is rendered separately by the component and is
**not** a `PUBLIC_NAV` entry (it is site identity, not a listed destination). Detail routes such as
`/whats-on/[eventId]` are **not** entries (FR-007).

## Derived / computed

- **Active entry** (FR-004): computed at render from the current path — an entry is active when
  `pathname === href` or `pathname.startsWith(href + "/")` (see research R3). Reflected as `aria-current="page"`.
  Not stored.

## Relationships

None. The list is standalone static config with no relationship to any stored entity. It is intentionally
**decoupled** from the volunteer nav (`src/server/auth/nav.ts` `NAV`), which is capability-tagged and
server-evaluated — a different concern (P6-R2).
