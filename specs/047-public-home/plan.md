# Implementation Plan: Public home page (P7-R3)

**Branch**: `047-public-home` | **Date**: 2026-08-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/047-public-home/spec.md`

## Summary

Make `/` a real public home for the growth funnel: an orientation-first hero (tagline + a single optimized
image slot), a "new here?" orientation section (what the dancing is, all welcome, no partner, cost) that
leads onward, the next upcoming dances (reusing the existing schedule), and a **site-wide public footer**
with org info + a support affordance. `/` moves into the `(public)` route group so it inherits the P7-R1
tokens and the P7-R2 nav; the old staff stub at `/` is removed. No video, no carousel — one hero image at
most. **No DB, API, or migration** (the next-dances strip reuses `getPublicSchedule`). Stacked on the
(unmerged) 045 (tokens) + 046 (nav).

## Technical Context

**Language/Version**: TypeScript 5.7 (strict), React 19, Next.js 16 App Router.

**Primary Dependencies**: Next.js built-ins — CSS Modules, `next/image` (built in) for the optimized hero
slot, `next/link`. Reuses `getPublicSchedule` (`src/server/domain/public/publicSchedule.ts`) and the
shared `ScheduleList`. **No new dependency.**

**Storage**: None. Reuses the existing public schedule read; the hero image + tagline, orientation copy,
and footer content are static (not stored).

**Testing**: Vitest jsdom component tests (RTL) for the pure presentational pieces (`Footer`, the hero/
orientation blocks); a source-parse unit test for the home's single-H1 and the removed stub. The home
page itself is an async server component (reads the DB) → not jsdom-renderable, so full-page behavior
(hero, next-dances, footer, empty state) is browser-verified (quickstart).

**Target Platform**: Public website, mobile-first, shared chrome.

**Performance Goals**: Drop the old slider entirely — at most one optimized hero image via `next/image`
(responsive sizes, lazy where appropriate); no video/YouTube. Home image payload a small fraction of the
old multi-MB slider.

**Constraints**: WCAG AA (R1 tokens); one H1; no horizontal scroll at 375px; orientation content precedes
the listing; footer on every public page but not admin/door; hero degrades to legible text if the image is
absent/fails.

**Scale/Scope**: One new home page (moved into `(public)`), a `Footer` component + module (wired into the
public layout), hero/orientation presentational blocks + a home stylesheet, deletion of the root stub,
and ~2 component tests + a source-parse test. Reuses the schedule read and `ScheduleList`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment |
|-----------|------------|
| **I. Test-First (NON-NEGOTIABLE)** | PASS (planned). Component tests first for the pure pieces: `Footer` renders a `contentinfo` landmark with org identity, links, and the support affordance; the orientation block renders the "new here?" copy + onward link. A source-parse unit test asserts the home has exactly one `<h1>` and the old root stub (`app/page.tsx` "CDR Platform" + Contacts link) is gone. Full-page hero/next-dances/empty-state/AA/no-scroll are browser-verified (async RSC reads the DB). |
| **II. Simplicity / YAGNI** | PASS. Reuse `getPublicSchedule` + `ScheduleList` (no new schedule logic); no video; no image-storage model (hero is a single static/optimized asset); R13/R14 wholly deferred (no dead placeholders); text-first hero so no fake-photo dependency blocks the feature. |
| **III. Type Safety** | PASS. Strict TS; typed presentational components; reused schedule types. No `any`. |
| **IV. Observability** | N/A (honest). Presentation; the one data read reuses the existing (already-logged) schedule path — no new request cycle, write, or external call. |

**Development Workflow**: Multi-contributor mode — developed on `047-public-home` (stacked on 046 → 045),
lands via a **reviewed PR** (no self-merge) after its gate suite passes; rebases/targets `main` once the
stack merges. No Complexity Tracking entries.

## Project Structure

### Documentation (this feature)

```text
specs/047-public-home/
├── plan.md
├── research.md          # Phase 0 (route move, hero-image approach, next-dances reuse, footer placement, testing)
├── data-model.md        # Phase 1 (no schema; reused schedule + static content)
├── quickstart.md        # Phase 1 (verify home sections, empty state, footer site-wide, 375px)
├── contracts/
│   └── public-home.md   # UI contract: home sections + site-wide footer + a11y
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
src/app/
├── page.tsx                              # DELETE — root stub moves into the (public) group
├── (public)/
│   ├── layout.tsx                        # add <Footer/> below children (site-wide public footer)
│   ├── page.tsx                          # NEW home at /: hero (tagline + optimized image slot),
│   │                                     #   "new here?" orientation, next-dances (getPublicSchedule
│   │                                     #   sliced + ScheduleList), link to /whats-on; one <h1>
│   ├── home.module.css                   # NEW: hero band + home sections (from R1 tokens)
│   └── _components/
│       ├── Footer.tsx + Footer.module.css   # NEW: site-wide public footer (org info + support affordance)
│       └── (optional) Hero.tsx / NewHere.tsx  # pure presentational blocks (for jsdom tests)
public/
└── hero.webp                              # NEW (content): the single optimized hero image; rendered
                                          #   object-fit:cover, height clamp(200px,34vh,460px),
                                          #   object-position center 30% (--hero-focus), + text scrim (R2)

tests/
├── component/footer.test.tsx             # NEW: footer landmark + org info + links + support affordance
├── component/home.orientation.test.tsx   # NEW: the "new here?" block renders orientation copy + onward link
└── unit/publicHome.test.ts               # NEW: (public)/page.tsx has one <h1>; root app/page.tsx removed
```

**Structure Decision**: Move `/` into the `(public)` group (`app/(public)/page.tsx`) — a route group does
not change the URL, so this keeps `/` while inheriting R1's public styling wrapper, the R2 nav, and the new
footer; the old `app/page.tsx` is deleted (two pages for `/` would conflict). The footer is a component
rendered by `(public)/layout.tsx`, so it is site-wide across public pages and never on admin/door. All
persistence is the reused schedule read; no server/domain/db code is added.

## Complexity Tracking

> No Constitution Check violations — table intentionally empty.
