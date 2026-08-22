# Phase 1 Data Model: Public home page

**No database schema changes.** No tables, columns, enums, or migrations. The home reuses one existing
read and otherwise renders static content.

## Reused data (unchanged)

- **Public schedule** — `getPublicSchedule(db)` (`src/server/domain/public/publicSchedule.ts`) returns
  upcoming `PublicScheduleItem[]` (ascending). The home slices the next few (e.g. ≤4) for the next-dances
  strip and renders them with the shared `ScheduleList`. No new query, no change to the schedule domain.

## Static content (not stored)

| Content | Where | Notes |
|---------|-------|-------|
| Hero tagline | home page | club-voice line(s); always rendered as text |
| Hero image | `public/` asset via `next/image` | ONE optimized image (club-supplied); optional — text band stands alone if absent (edge case) |
| "New here?" orientation copy | home page / orientation block | what the dancing is · all welcome · no partner · cost; + onward link to `/whats-on` |
| Footer content | `Footer` component | club identity, key links (e.g. What's On, Join), support/donate affordance |

## Presentation structure

- **Home** (`(public)/page.tsx`, server component): one `<h1>`; sections = hero → orientation →
  next-dances (with empty state) → "see full schedule" link. Inherits the `(public)` styling wrapper +
  R2 nav; footer comes from the layout.
- **Footer** (`(public)/_components/Footer.tsx`): a semantic `<footer>` (contentinfo landmark) rendered by
  `(public)/layout.tsx` on every public page.

## Validation rules (enforced by tests)

- The home declares exactly one `<h1>`; the old root stub (`app/page.tsx`) no longer exists.
- The footer renders a contentinfo landmark with the club identity, working links, and a support
  affordance.
- The next-dances strip shows the empty-state message when the schedule read returns nothing.
