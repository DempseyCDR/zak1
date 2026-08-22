# Phase 0 Research: Public home page

Format per decision: **Decision / Rationale / Alternatives**. The four scope/UX choices (routing, video,
footer scope, R13/R14) were settled in `/speckit-clarify` and are recorded in the spec; this file resolves
the implementation unknowns.

## R1. Route move — `/` into the `(public)` group

**Decision**: Delete `src/app/page.tsx` (the staff stub) and create `src/app/(public)/page.tsx` as the
home. A route group `(public)` does not affect the URL, so `app/(public)/page.tsx` is still `/`, and it now
renders inside `(public)/layout.tsx` — inheriting R1's public styling wrapper, the R2 nav (root layout),
and the new footer.

**Rationale**: `/` must be a styled public page (FR-001); the only way to give it the `(public)` layout is
to place it in the group. Two pages resolving to `/` (`app/page.tsx` + `app/(public)/page.tsx`) is a Next
routing conflict, so the old stub is removed — which FR-009 requires anyway.

**Alternatives**: Keep `app/page.tsx` and import the public wrapper/footer manually (rejected — duplicates
the `(public)` layout and leaves `/` outside the group's shared chrome); redirect `/`→`/whats-on`
(rejected in clarify Q1).

## R2. Hero image — image-ready band, text-first, single optimized asset

**Decision**: The hero is a **tokenized band** carrying the tagline + a primary "new here?" / see-the-
schedule call-to-action as **text** (always legible), with a slot for **one optimized image** rendered via
`next/image` from a static asset. There is no `public/` dir today, so this feature introduces it; the hero
image lives at **`public/hero.webp`** (a club-supplied dancers photo for now — see R2a for the future
"next-band" hero). If the image is absent or fails to load, the text band stands alone (spec edge case).
No carousel, no video.

**Rendering spec (locked with Rich, 2026-08-22):**

- **Source ratio**: **16:9**, ≥1600px wide, subject centered with safe edge margins.
- **Fit**: full-bleed band using **`object-fit: cover`** (via `next/image` `fill` + a sized container).
- **Height**: responsive clamp — **`clamp(200px, 34vh, 460px)`** — so the band reads as a hero on a phone
  (~16:9) and stays a *band* on desktop (short/wide) instead of ballooning to a full-screen image.
- **Focal point**: **`object-position: center 30%`** (upper-third bias) so faces/eyes are not cropped when
  the band is short on desktop. Exposed as a CSS variable **`--hero-focus`** so swapping the photo (e.g. to
  a band photo later) is a one-line focal tune, no code change.
- **Text legibility (AA)**: a **scrim** behind the tagline — a soft dark→transparent gradient overlay (or
  the token band placed beside the image) — so WCAG AA holds regardless of the photo where the text sits.

**Rationale**: Honors FR-002 (one optimized image + tagline) while keeping the welcome image-independent
(FR edge case: "the hero is not the only way the welcome is conveyed") and mobile-light (the whole point of
R3 vs the old multi-MB slider). `next/image` gives responsive sizing/lazy-loading for free. Text-first
means the feature is not blocked on sourcing a photograph — the real photo is a swap, not code.

**⚠️ Content dependency**: the actual hero photograph is a club-supplied asset. Confirm the image (or ship
text-only band + add the photo when provided) at implementation time.

**Alternatives**: A multi-image slider (rejected — the exact anti-pattern being removed); a committed fake
placeholder photo shipped as the real hero (rejected — misleading); a raw `<img>` (rejected — loses
`next/image` optimization/responsiveness).

## R2a. Future — dynamic "next-band" hero (deferred to backlog)

**Decision**: R3 ships a **static** `public/hero.webp`. The ideal — the hero showing the **next event's
booked band/performers** — is deferred to the backlog (**B47**). It makes the hero dynamic (next upcoming
event → its confirmed band → that band's photo) and depends on public performer/band imagery, which is
R9's domain. The `--hero-focus` knob and the `object-position` treatment above are chosen partly so that a
later band photo swaps in cleanly.

**Rationale**: Keeps R3 scoped to a static, fast home (YAGNI) while recording the direction; the dynamic
hero is a real feature (schedule join + image handling), not a tweak.

## R3. Next-dances strip — reuse the schedule read + `ScheduleList`

**Decision**: Call `getPublicSchedule(db)` (upcoming, ascending) and render the next few (e.g. up to 4)
with the shared `ScheduleList` (already tokenized by R1, already tested), plus a "see the full schedule"
link to `/whats-on`. Empty state uses `ScheduleList`'s `emptyMessage`.

**Rationale**: The data + presentation already exist and are public-safe; reuse avoids new schedule logic
(YAGNI) and inherits R1 styling. Slicing to a few keeps the home focused (the full list lives at
`/whats-on`).

**Alternatives**: A new bespoke "home schedule" query/component (rejected — duplicates `/whats-on`); embed
the whole list (rejected — the home orients, `/whats-on` lists).

## R4. Footer — site-wide, in the `(public)` layout

**Decision**: A `Footer` component (`(public)/_components/Footer.tsx` + module) rendered by
`(public)/layout.tsx` **below** `{children}`, so it appears on every public page (home, whats-on,
what-was-on, event detail, join) and never on admin/door. Semantic `<footer>` (contentinfo landmark) with
club identity, a few key links (e.g. What's On, Join), and a support/donate affordance (link to `/join` /
the club's giving path). Styled from R1 tokens.

**Rationale**: Clarify Q3 chose site-wide; the `(public)` layout is the shared surface (mirrors how the nav
is shared chrome). One contentinfo landmark per page, AA via tokens.

**Alternatives**: Home-only footer (rejected in clarify Q3); footer in the root layout (rejected — that
would put it on admin/door too).

## R5. "New here?" orientation — inline, links to the schedule

**Decision**: An orientation block on the home conveying what contra/English country dancing is, that all
are welcome and no partner is needed, and roughly the cost, with an onward link. Because a dedicated
orientation page is a **later** requirement (R6), the CTA links to `/whats-on` (and the orientation copy is
inline on the home) rather than to an unbuilt page.

**Rationale**: Satisfies FR-003 now without depending on R6; the inline copy delivers the orientation, and
`/whats-on` is the natural "so, when can I come?" next step.

**Alternatives**: Link to a not-yet-built `/about`/orientation page (rejected — dead link); no CTA
(rejected — FR-003).

## R6. Testing approach

**Decision**: jsdom component tests for the pure pieces — `Footer` (landmark + org identity + links +
support affordance) and the orientation block (copy + onward link). A source-parse unit test asserts the
home (`(public)/page.tsx`) declares exactly one `<h1>` and that the old root stub (`app/page.tsx`) is
removed. The full home (async RSC reading the schedule), the empty next-dances state, footer-on-every-
public-page, AA, and no-scroll at 375px are **browser-preview** checks (quickstart).

**Rationale**: Tests what jsdom can prove; the DB-backed page and layout facts are browser-verified — the
same split used in 045/046.

**Alternatives**: Rendering the async home in jsdom (rejected — server component reads the DB, not jsdom-
renderable).
