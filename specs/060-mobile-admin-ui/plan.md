# Implementation Plan: Mobile-First Admin UI Foundation

**Branch**: `060-mobile-admin-ui` | **Date**: 2026-08-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/060-mobile-admin-ui/spec.md`

## Summary

Bring the `(admin)` surfaces onto the Phase-7 public design system and establish two reusable
interaction patterns — **Record** (single-entity view/editor) and **Triage** (worklist) — proven on the
**`contacts`** reference surface (presentation only). Concretely: replace bespoke inline `style={{}}`
(24 admin files use it today) with CSS Modules driven by the existing `globals.css` tokens, make the
surfaces mobile-first responsive (≤375px, no horizontal page scroll) with 48×48px touch targets, and
consume the app's single fixed palette (no theming to build). Role-specific data logic stays out (that's
the Mel/Meg/Booker features).

## Technical Context

**Language/Version**: TypeScript 5.7 (strict), React 19, Next.js 16 (App Router, RSC).

**Primary Dependencies**: The existing design system — `src/app/globals.css` token vocabulary
(`--ground/surface/text/text-muted/hairline/band/link…`, `--space-1..7`, `--fs-*`, `--font-*`) and the
`(public)/_components/` pattern (CSS Modules + `Container`). No new libraries.

**Storage**: None. **No database entities, schema, or migration** (FR-009).

**Testing**: Vitest — **jsdom component tests** (`tests/component/*.test.tsx`, as used for the public
`Footer`) for the new pattern components' structure/roles/empty-state and the migrated contacts page's
preserved behavior. Layout-dependent criteria (no h-scroll at 375px, 48px targets, palette) are verified
in the **Browser preview** per `quickstart.md` (jsdom does not compute layout).

**Target Platform**: Mobile-first web (design floor ~375px), enhancing to larger screens.

**Project Type**: Web application (single Next.js project; the `(admin)` route group).

**Performance Goals**: N/A beyond normal page render; this is presentation.

**Constraints**: Mobile-first ≤375px with **no horizontal page body scroll** (wide content scrolls in its
own container); **48×48px** minimum touch targets; **single fixed palette** via shared tokens (no
light/dark theming — none exists); **no behavior regression** on the migrated contacts surface.

**Scale/Scope**: One reference surface (`contacts`) + two reusable pattern components + admin shell
styling. Other admin surfaces migrate later, per the clarified incremental scope.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First (NON-NEGOTIABLE)** — PASS (planned). Write jsdom component tests first for `RecordView`
  and `TriageList` (render the expected landmarks/roles, row actions, empty state) and for the migrated
  contacts page (search still renders results — no behavior regression). Visual/responsive criteria
  (h-scroll, 48px, palette) are verified via the Browser preview (`quickstart.md`) since they are not
  unit-testable — the logic is tested; the pixels are demonstrated.
- **II. Simplicity / YAGNI** — PASS. Only what the reference needs: two pattern components + a page
  shell + the contacts migration. No speculative component library, no theming system, no migration of
  other admin pages. Reuse the public `Container`/token vocabulary rather than inventing a parallel one.
- **III. Type Safety** — PASS. Typed React component props; no new boundary inputs (no Zod needed — the
  contacts page's existing `apiFetch` calls and their shapes are unchanged).
- **IV. Observability** — N/A (PASS). Presentation only: no server events, no audit rows, no new
  handlers. Existing behavior (and its logging) is preserved, not extended.

**Result: PASS — no violations, no complexity to justify.**

## Project Structure

### Documentation (this feature)

```text
specs/060-mobile-admin-ui/
├── plan.md              # This file
├── research.md          # Phase 0 output (design-system + theme findings, decisions)
├── data-model.md        # Phase 1 output (no DB entities — UI artifacts inventory)
├── quickstart.md        # Phase 1 output (component tests + Browser-preview verification)
├── contracts/
│   └── ui-patterns.md   # Phase 1 output (Record/Triage component contract + UI invariants)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/app/
├── globals.css                      # ADD: a shared touch-target utility/token (48×48px min)
├── (admin)/
│   ├── _components/                 # NEW — the reusable admin patterns
│   │   ├── RecordView.tsx + .module.css     # Record mode: single-entity view/editor shell
│   │   ├── TriageList.tsx + .module.css      # Triage mode: worklist rows (inline action / open) + empty state
│   │   └── AdminPage.tsx + .module.css       # page shell/container (mobile-first, token-driven)
│   └── contacts/
│       ├── page.tsx                 # MIGRATE: use the shell + TriageList (search results) + RecordView shell;
│       │                            #          replace inline styles; PRESERVE search behavior
│       └── contacts.module.css      # NEW — token-based styles (no inline style={{}})

tests/component/
├── recordView.test.tsx              # NEW — structure/roles
├── triageList.test.tsx              # NEW — rows, inline action vs open, empty state
└── contacts.page.test.tsx           # NEW/EXTEND — search still renders results (no regression)
```

**Structure Decision**: Single web-app project; work is confined to the `(admin)` route group plus one
shared token in `globals.css`. The role-aware volunteer **nav already lives in the ROOT layout**
(feature 035), so this feature does **not** add an admin nav — it verifies the existing nav is
mobile-usable and focuses on the page shell, the two pattern components, and the contacts migration. New
components mirror the `(public)/_components/` convention (CSS Modules + tokens).

## Complexity Tracking

> No Constitution violations — section intentionally empty.
