# Phase 0 Research: Mobile-First Admin UI Foundation

Grounded in the current tree. The spec's three clarifications (scope = foundation + `contacts`; touch
target = 48px) are settled; this file records the design-system facts and the theme correction.

## Decision 1 — Adopt the existing token vocabulary + CSS-Module convention

- **Decision**: Admin surfaces use `src/app/globals.css` tokens and the `(public)/_components/` pattern
  (CSS Modules per component), replacing bespoke inline `style={{}}`.
- **Rationale**: The design system already exists and is proven on the public site: `globals.css`
  defines colors (`--ground/surface/text/text-muted/hairline/band/band-hover/link/link-hover/
  link-on-dark/peach`), spacing (`--space-1..7`), type (`--fs-h1/h2/h3/body/sm`, `--lh-*`, `--font-*`),
  and `--container-max`. The public group uses CSS Modules + a `Container` component. Reusing this is
  YAGNI-correct and guarantees visual consistency (SC-002).
- **Verified**: 24 `(admin)` `.tsx` files use inline `style={{}}` today (the "raw dev-scaffold" state);
  only `content/content.module.css` exists under admin. The gap is real and mechanical to close.
- **Alternatives**: a parallel admin design system (rejected — duplication, drift); a CSS-in-JS lib
  (rejected — not in the stack).

## Decision 2 — There is NO light/dark theming; match the single fixed palette (spec correction)

- **Decision**: Admin matches the public site's **single fixed warm-light palette**. FR-003/SC-002 were
  corrected: "theme-aware light/dark" → "same shared palette/tokens." **No theming is built.**
- **Rationale/Verified**: `globals.css` has a single `:root` palette (`--ground:#f6efe4`,
  `--band:#2d728f`, `--text:#3d3b3d`) and **zero `@media (prefers-color-scheme)` blocks**; there is **no
  `data-theme`, no dark-mode class, no theme toggle anywhere** in `src/`. `--link-on-dark`/`--band` are
  for dark-colored *bands* (headers/footers) inside the fixed light design, not a dark *mode*. The spec's
  original "light/dark" premise was false; building theming would violate YAGNI and diverge from public.
- **Consequence**: the clarify-deferred "admin theme toggle vs inherit" question is moot — there is no
  theme to toggle.

## Decision 3 — Record & Triage are reusable COMPONENTS in `(admin)/_components/`

- **Decision**: Ship `RecordView` (single-entity view/editor shell) and `TriageList` (worklist: rows with
  an inline action or an "open" affordance, plus an empty state) as reusable components, mirroring the
  `(public)/_components/` convention. A thin `AdminPage` shell provides the mobile-first container.
- **Rationale**: X-R2 wants *consistent, reusable* paradigms; components (not per-page conventions) are
  how the public site achieves consistency, and they give the Mel/Meg/Booker features a real seam to
  build on. Presentation-only (FR-009) — they render structure/slots, not data logic.
- **Alternatives**: documented conventions only (rejected — no enforcement, drift); a full generic
  data-grid/form library (rejected — YAGNI for one reference surface).

## Decision 4 — 48×48px touch targets via a shared utility

- **Decision**: Add one shared touch-target rule/utility (min-width/height 48px, adequate hit area) in
  `globals.css`, applied to primary interactive controls on migrated admin surfaces.
- **Rationale**: Clarified floor is 48×48px (Material). One shared utility keeps it consistent and
  testable-by-inspection, rather than per-component ad-hoc sizing.

## Decision 5 — Nav is already global; verify, don't rebuild

- **Decision**: Do not add an admin nav. Verify the existing ROOT-layout volunteer nav (feature 035) is
  usable at 375px; enhance only if it fails.
- **Verified**: `(admin)/layout.tsx` only calls `requireStaff()` and renders `children` — its comment
  states the role-aware nav moved to the ROOT layout in feature 035, rendering on every signed-in page.
  So the nav is shared; this feature's nav concern is mobile usability of that existing nav, checked in
  the Browser preview.

## Decision 6 — Testing strategy for a UI feature

- **Decision**: jsdom component tests (Vitest) for logic/structure (`RecordView`, `TriageList`, contacts
  search behavior); Browser-preview verification for layout-dependent SCs (no h-scroll @375px, 48px
  targets, palette consistency), scripted in `quickstart.md`.
- **Rationale**: jsdom cannot compute layout, so responsive/touch/palette are demonstrated in a real
  render at a 375px viewport. Test-First still governs the component logic and the no-regression contract
  on contacts (Constitution I). Precedent: `tests/component/footer.test.tsx` renders a public component
  under jsdom with `next/link` mocked.
