# Phase 1 Data Model: Public design tokens & mobile-first foundation

**No database schema changes.** This feature adds no tables, columns, enums, or migrations. The "model"
here is the design-token vocabulary (CSS + one typed constant) that later public pages consume.

## Token vocabulary (`src/app/globals.css` `:root`) — single source of hex values

| Group | Tokens (names illustrative) | Notes / AA rule (research R3) |
|-------|-----------------------------|-------------------------------|
| Ground / surface | `--ground` (cream `#f6efe4`), `--surface`, `--band` (steel `#2d728f`), `--band-hover` (`#22566c`) | body text on `--ground`, on-dark text on `--band` |
| Text | `--text` (charcoal `#3d3b3d`), `--text-muted` | charcoal on cream = 9.72:1 |
| Link | `--link` (**darker terracotta `#954e27`**, 5.41:1 — *not* `#b96131`), `--link-hover`, `--link-on-dark` (cream/white for steel bands) | resting link on cream MUST be ≥4.5:1 |
| Accent | `--peach` (`#e5b79e`) | accent/background only (charcoal on peach 6.13:1); never a link on `--band` |
| Type scale | `--font-heading`, `--font-body` (set by `next/font`), `--fs-…` steps, `--lh-…` | body ≥16px |
| Spacing | `--space-1 … --space-n` | mobile-first rhythm |
| Event-type colors | `--type-contra #82c2d6`, `--type-english #ffb472`, `--type-special #f28780`, `--type-assembly #b3ce84`, `--type-meeting #9b84ce` | **accent/badge use only** (3:1 UI); `--type-meeting` with charcoal is 3.48:1 → never behind normal text |

Base element styles in the same file: `body` (ground + body font + `margin:0`), heading font/scale, `a`
(link tokens + visible `:focus-visible`), sensible defaults. These are in effect app-wide (imported by the
root layout) but only the `(public)` pages are restyled to rely on them in this feature.

## Typed constant (`src/app/tokens.ts`)

- **`EventType`** — the union of event-type keys (`"contra" | "english" | "special" | "assembly" |
  "meeting"`).
- **`EVENT_TYPE_COLORS: Record<EventType, string>`** — each key → the corresponding `var(--type-*)` string.
  The single, typed source later listing pages (R4) read to color-code events. No hex values here (they
  live in `globals.css`); references only, so there is nothing to drift.

## Layout primitive (`src/app/(public)/_components/Container.tsx` + `.module.css`)

- A mobile-first page/content wrapper (padding + `max-width` + centered) that replaces today's inline
  `<main style={{ padding: 24, maxWidth: 720 }}>`. Props: `children`, optional `as`/`width` if needed.
  This is the composition primitive public pages use instead of ad-hoc inline sizing (FR-003/FR-009).

## Validation rules (enforced by tests, not the DB)

- Every text/UI token pair meets WCAG AA (research R3), asserted by parsing the shipped `:root` values.
- `EVENT_TYPE_COLORS` covers all five `EventType` keys and references only defined `--type-*` variables.
- Each public page renders exactly one `<h1>`; restyled components carry CSS-Module class names, not inline
  `maxWidth`/sizing.
