# Research: Printable calendar (P7-R15)

All items resolved; no NEEDS CLARIFICATION remain. The scope decisions were locked across `/speckit-specify` and
`/speckit-clarify` (spec §Clarifications, 2026-08-26): **fit one Letter page** · route **`/printable-calendar`** ·
**footer-only prices**. This file records the mechanism choices that follow.

## R1 — Single-source, render-only (no new data)

**Decision**: A `getPrintableCalendar(db)` **view-model assembler** composes existing reads: upcoming events via
`getPublicSchedule(db, todayISO())`; each series' standing-schedule text via its `scheduleSentence` column; each
series' price via `resolveEventPricing(db, { seriesId, eventDate: today, advertisedPriceCents: null })` →
`pricingSummary`. No new table, migration, capability, or audit — the page only reads.

**Rationale**: R15's value is a *zero-maintenance* artifact that stays correct because it is the same data the
rest of the site shows (SC-002). Assembling a view model over the existing services guarantees that and keeps
the feature tiny.

**Alternatives**: a stored/generated calendar snapshot — rejected (drifts, needs maintenance, defeats the point).

## R2 — Window start: today by default, `?start` to choose

**Decision**: The list starts at **today** by default, or at an optional **`?start=YYYY-MM-DD`** query parameter
(`getPublicSchedule(db, startISO)` where `startISO` = the validated start). The start is validated with a **local** `YYYY-MM-DD` +
real-date Zod check (a `^\d{4}-\d{2}-\d{2}$` regex + valid-date guard, defined in `printableCalendar.ts` — there
is no shared `isoDate` export; same pattern as 054/057) via `safeParse`; a **missing, malformed, or non-date**
value **falls back to today** — a forgiving public GET never errors on a bad parameter. A pure
`resolveStart(raw): string` encapsulates this (`raw → valid YYYY-MM-DD or today`). A future start lets a visitor print an **upcoming month in advance** (post next month's schedule).

**Rationale**: The artifact is forward-looking (history stays on `/what-was-on`); starting at today avoids
leading with past events, and the `start` parameter adds advance-planning without new data — `getPublicSchedule`
already accepts a `from` date. Falling back to today (rather than a 422) keeps a hand-typed or stale URL usable.

## R2a — Setting the start on screen: a plain GET form (no client JS)

**Decision**: A small **screen-only** `<form method="get">` with `<input type="date" name="start">` and a submit
button sets the parameter — submitting reloads the same page with `?start=…`. No client component. It is rendered
**outside** the `[data-printable-calendar]` region, so the print-only-region CSS removes it from the sheet.

**Rationale**: A GET form is the simplest, most accessible way to set a query parameter — it degrades gracefully,
needs no JavaScript, and the native date input suits the "valued by older members" audience better than editing a
URL by hand. Keeping it outside the printable region means zero extra print-hide rules.

## R3 — One-page fit = a dynamic, weight-aware cap (+ a truncated flag)

**Decision**: Fit one Letter page with a **dynamic, weight-aware cap** over bounded-height rows. Cells and the
description sub-line are CSS-clamped to **≤2 lines** (`overflow: hidden`), so each event's line count is
predictable: 1 for the event line + 0–2 for its description. A pure `fitRows(items, budget, cost)` takes events
until a tuned `PAGE_LINE_BUDGET` of line-units is used — so a **described row costs more and fewer fit when more
carry a blurb**. When events remain, the page shows a "…and more — see the full schedule online" pointer
(FR-011). `PAGE_LINE_BUDGET` (and the description chars-per-line estimate) are tuned by **browser verification**
(print preview at Letter). Descriptions are fetched (bounded by a scan cap) **before** the cap, since the cost of
each row depends on whether it has one.

**Rationale**: A server render can't measure rendered height, and true "fit-to-page" auto-scaling is fragile. A
line-budget over predictable-height rows fits one page while honoring that a described row is taller — a fixed
row count would either overflow (when many rows carry a blurb) or waste the page (when few do). Clamping to ≤2
lines keeps each row's cost bounded and the estimate accurate. The nearest-dated events (the ones people most
need) are the ones kept.

**Alternatives**: CSS-only overflow clipping (risky — could cut a row mid-height or silently drop content with
no pointer); auto-shrink font to fit (fragile, hurts legibility — the opposite of the "valued by older members"
goal).

## R4 — Print only the calendar region (strip site chrome), `@page` Letter

**Decision**: The page wraps its content in a `[data-printable-calendar]` region. Its CSS module's `@media print`
block uses the **print-only-this-region** technique — hide everything, then reveal the region and pin it to the
page top — plus `@page { size: letter; margin: … }` and black-on-white overrides. Because the module is imported
only by this route, its print rules are active only when this page is on screen, so no other page's print is
affected.

**Rationale**: The page inherits the root layout's nav bars and the `(public)` layout's footer/announcement; a
descendant page can't style those ancestors directly, but the visibility technique reliably prints only the
chosen region regardless of ancestors — the standard, robust way to "print just this". `@page size: letter`
targets the US paper the club uses.

**Alternatives**: a separate top-level route group with no chrome — heavier (a parallel layout tree) for one
page; global print CSS gated by `body:has()` — works, but the visibility technique is simpler and
better-supported.

## R5 — Footer standing schedule + prices (series with a sentence only)

**Decision**: The footer lists, per series (in the club's series order), the **standing-schedule sentence** and
that series' **price** (`pricingSummary`). A series with **no** `scheduleSentence` is **omitted** (FR-009); a
free series reads **"Free"** (distinct from unpriced/blank), consistent with the site's single-sourced pricing.
Prices live **only** in the footer — the event table has no price column (clarified).

**Rationale**: R15 says "prices in the footer done right"; putting them once per series in the footer keeps the
table narrow (helps the one-page fit) and avoids repeating a price on every row.

## R6 — One validated input, no audit, no PII

**Decision**: The **only** input boundary is the `?start` query parameter, **Zod-validated** (`isoDate`) at the
page with a today fallback (R2). The page writes nothing, so there is **no** audit. It renders only display-safe
public data — it inherits the public schedule's **venue PII gating** (052), so no contact PII can appear.

**Rationale**: Constitution III is satisfied by validating the one input at the boundary; IV is satisfied
trivially (no state change). The security surface is a public read of already-public data with a forgiving,
validated date parameter (no injection surface — the value is a strict `YYYY-MM-DD` or today).

## R7 — Reachability + reserved slug

**Decision**: Add a **"Printable calendar"** link to the site **footer** (`Footer.tsx`), and add
`printable-calendar` to `RESERVED_SLUGS` (051) so a CMS page can't shadow the route.

**Rationale**: FR-006 (discoverable, first-class route). The reserved-slug discipline is the same one applied for
every dedicated public route (053/055/…).
