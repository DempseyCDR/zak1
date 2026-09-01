# Feature Specification: Mobile-First Admin UI Foundation

**Feature Branch**: `060-mobile-admin-ui`

**Created**: 2026-08-31

**Status**: Draft

**Input**: User description: "cross-cutting X-R1 and X-R2"

Source requirements: `specs/phase-8-requirements/mel-contact-maintenance.md` §2 — **X-R1** (mobile-first
admin, reusing the Phase-7 public design system) and **X-R2** (the two interaction paradigms — Record
mode and Triage mode). This is the **shared UI foundation** the Phase-8 maintenance features (Mel, Meg,
Booker) build on; it does not implement any role-specific data operation.

## Clarifications

### Session 2026-08-31

- Q: Scope breadth — big-bang migration of all admin pages vs. foundation + one reference surface? → A:
  Foundation + **one** reference surface now; other admin pages migrate incrementally as their own
  features are built.
- Q: Which reference surface proves the foundation? → A: The **`contacts`** admin surface
  (`src/app/(admin)/contacts/page.tsx`) — restyled presentation only (search + list + Record shell);
  functional record/emails/triage actions are left to Mel's feature.
- Q: Minimum touch-target size for mobile controls? → A: **48 × 48 CSS px** (Material Design).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Use admin on a phone (Priority: P1)

A volunteer opens an admin/volunteer surface on their phone. Today those surfaces are raw dev-scaffold
pages (bespoke inline styles, desktop-assuming layouts, e.g. the contacts page) — cramped and awkward on
a phone — while the public site is a clean, mobile-first, theme-aware experience. This story brings the
admin surfaces onto the **same Phase-7 design system**: mobile-first, responsive, theme-aware, with a
navigation that works with a thumb.

**Why this priority**: Phase 8's goal is making it easy for volunteers to maintain data, and much of that
work happens on a phone (at the door, on the go). An admin surface that isn't usable on a phone blocks the
whole phase. This foundation is what every later maintenance screen inherits.

**Independent Test**: Open a migrated admin surface at a phone viewport (~375px wide): it renders without
horizontal page scrolling, matches the public site's visual system, works in both light and dark themes,
and its navigation is reachable and tappable. Fully testable on the reference surface without any
role-specific feature built.

**Acceptance Scenarios**:

1. **Given** a migrated admin surface at a 375px-wide viewport, **When** a volunteer views it, **Then**
   there is no horizontal scrolling of the page body (wide content such as tables scrolls within its own
   container).
2. **Given** the viewer's theme is dark (or light), **When** they open a migrated admin surface, **Then**
   it renders in that theme, consistent with the public site.
3. **Given** a phone, **When** a volunteer needs to navigate between admin surfaces, **Then** the
   navigation is reachable and its targets are comfortably tappable.

---

### User Story 2 - Two consistent interaction paradigms (Priority: P2)

Across the maintenance features, a volunteer's work is always one of two shapes: **editing one thing**
(Record mode) or **working through a list of pending tasks** (Triage mode). This story establishes those
two paradigms as consistent, reusable patterns so that every maintenance screen feels familiar — a
single-record editor looks and behaves like every other single-record editor, and a worklist like every
other worklist. The two connect: a triage row can open the corresponding record/detail to resolve it.

**Why this priority**: Consistency is what makes the tools learnable — a volunteer who learns one
maintenance screen can use them all. It also lets the role-specific features (Mel, Meg, Booker) focus on
their content instead of reinventing layout and navigation. P2 because it depends on the P1 design
foundation being in place.

**Independent Test**: On the reference surface, a volunteer sees a **Record mode** (a focused
single-entity view/editor) and a **Triage mode** (a worklist with per-row actions); selecting a triage
row opens the record/detail view. The patterns are consistent and reusable, demonstrated without
role-specific data logic.

**Acceptance Scenarios**:

1. **Given** a single entity, **When** a volunteer opens it, **Then** they get a focused Record-mode
   view/editor (one entity, its fields, its actions).
2. **Given** a list of pending tasks, **When** a volunteer works it, **Then** they get a Triage-mode
   worklist where each row offers its action inline or opens the record to resolve.
3. **Given** a triage row that needs full attention, **When** the volunteer selects it, **Then** it opens
   the corresponding Record/detail view rather than resolving in place.

---

### Edge Cases

- **Wide content on a narrow screen**: a table or wide block scrolls inside its own container; the page
  body never scrolls horizontally.
- **Palette consistency**: an admin surface uses the same shared tokens as the public site, so a shared
  component reused in admin renders identically to its public use (no admin-only palette).
- **Empty triage list**: a worklist with no pending items shows a clear empty state, not a blank screen.
- **Record with many fields on a small screen**: fields stack vertically and remain reachable without
  horizontal scrolling.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Admin/volunteer surfaces MUST use the shared Phase-7 design system (the common design
  tokens and component patterns), not bespoke per-page styling.
- **FR-002**: Admin surfaces MUST be mobile-first responsive — usable at a phone viewport (~375px) with
  **no horizontal scrolling of the page body**; wide content scrolls within its own container.
- **FR-003**: Admin surfaces MUST use the **same shared palette and tokens** as the public site — the
  application has a **single fixed (warm-light) palette and no light/dark theme switching** — so admin
  renders visually consistent with public pages, with no admin-specific palette drift.
- **FR-004**: Admin navigation MUST be usable on a phone: reachable and with comfortably tappable targets.
- **FR-005**: The foundation MUST provide a reusable **Record mode** pattern — a focused single-entity
  view/editor.
- **FR-006**: The foundation MUST provide a reusable **Triage mode** pattern — a worklist of pending
  tasks, each row offering an inline action or a way to open the record.
- **FR-007**: The two paradigms MUST connect — a Triage-mode row can open the corresponding Record/detail
  view to resolve the item.
- **FR-008**: Primary interactive targets on admin surfaces MUST be at least **48 × 48 CSS px** on mobile
  (Material Design touch-target floor).
- **FR-009**: This feature MUST NOT change authorization, data models, or role-specific data operations —
  it is presentation/interaction foundation only; role-specific content is supplied by consuming features.
- **FR-010**: The **`contacts`** admin surface (`src/app/(admin)/contacts/page.tsx`) MUST be migrated onto
  this foundation as the working reference — its search + list plus a Record shell, **presentation only**
  and **without regressing its current behavior**. Functional record/emails/triage actions remain out of
  scope (Mel's feature).

### Key Entities *(include if feature involves data)*

None. This is a presentation/interaction foundation — **no database entities, schema, or migration**. The
"artifacts" are shared UI tokens, layout, and the two interaction-pattern components.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A volunteer can complete a representative admin task on a 375px-wide phone screen with **no
  horizontal page scrolling**.
- **SC-002**: Migrated admin surfaces render in the **same shared palette/tokens** as the public site
  (visually consistent with public pages; no bespoke per-page colors).
- **SC-003**: A volunteer encounters the **same two interaction patterns** (single-record editor;
  worklist) consistently across the migrated/reference surfaces.
- **SC-004**: The migrated reference surface **preserves its prior behavior** (no functional regression)
  while adopting the new look and layout.
- **SC-005**: Primary tap targets on migrated admin surfaces are at least **48 × 48 CSS px** on mobile.

## Assumptions

- **Scope is "foundation + reference now, incremental migration later."** X-R1 says *almost all* admin
  surfaces should get this treatment, but migrating every admin page at once is not assumed here — this
  feature establishes the shell, the design-system adoption, and the two reusable patterns, and migrates
  **one representative surface** to prove them. Remaining surfaces migrate as their own features are built
  (matching how the public site was built incrementally). A big-bang migration of all admin pages is
  explicitly out of scope for this feature.
- The **Phase-7 public design system** (`src/app/tokens.ts`, `src/app/globals.css`, and the public
  component patterns) is the source of truth for tokens and styling; admin adopts it rather than inventing
  a parallel system.
- The surfaces in scope are the `(admin)` and `(door)` route groups; `(public)` is already on the system.
- **Record mode** and **Triage mode** are delivered as reusable patterns/components, demonstrated on the
  **`contacts`** reference surface (clarified) at the presentation level — the functional record/emails/
  triage actions belong to Mel's feature, which consumes these patterns.
- Mobile-first design floor is ~375px wide (small modern phone); larger screens enhance from there.
- No dependency on features 059 or the Mel/Meg/Booker features — this is their shared foundation.
