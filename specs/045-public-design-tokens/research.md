# Phase 0 Research: Public design tokens & mobile-first foundation

Format per decision: **Decision / Rationale / Alternatives**.

## R1. Delivery mechanism (settled in Clarifications, recorded here)

**Decision**: Hand-rolled **CSS custom properties** (design tokens) in a single global stylesheet
(`src/app/globals.css`) imported by the root layout, plus **CSS Modules** for component styles, plus
**`next/font/google`** for the brand fonts. No Tailwind, no PostCSS.

**Rationale**: The app has no CSS layer today (styling is inline `style={{}}`); this introduces the first
one. Next.js 16 App Router supports global CSS and CSS Modules with zero config, so the token layer costs
no new dependency and no build tooling — aligning with the project's deliberate no-framework posture and
the constitution's YAGNI principle. Tokens defined app-wide are framework-agnostic and shared with the
known-future admin styling; Tailwind (whose v4 is itself CSS-variable-based) can be layered on the same
tokens later if admin density warrants it, without reworking the values.

**Alternatives**: Tailwind now (rejected — a framework + config for a public-only phase, before the admin
work that would justify it); CSS-vars через inline styles only, no Modules (rejected — leaves inline-style
sprawl and no component-scoped styling for the reusable pieces).

## R2. Series / event-type color storage (D-2)

**Decision**: Store the event-type color coding as a **typed code constant** — `EVENT_TYPE_COLORS` in
`src/app/tokens.ts`, keyed by the event-type union, each value referencing a CSS variable
(`var(--type-contra)` …). The actual hex values live once in `globals.css` `:root`. **No `series` table
column, no migration.**

**Rationale**: The palette is a fixed brand constant, not user data — nothing in Phase 7 asks for
per-series admin-editable colors. R1 does not render events at all (that's R4), so persisting a color per
series now would be speculative schema (YAGNI). A code constant is the single source R4 consumes, and it is
trivially unit-testable for completeness.

**Alternatives**: A `series.color` column (rejected as premature — revisit only if R4/later introduces a
requirement to edit series colors from the admin UI); a color baked into each component (rejected — not
single-source, invites per-page divergence, violates FR-007).

## R3. Accessibility floor — the brand palette measured against WCAG AA

**Decision**: Bake AA into the token values. Measured ratios of the audit palette (cream `#f6efe4`, steel
`#2d728f`, terracotta `#b96131`/hover `#954e27`, peach `#e5b79e`, charcoal `#3d3b3d`):

| Pair | Ratio | AA (normal ≥4.5 / large·UI ≥3) |
|------|-------|--------------------------------|
| charcoal text on cream | 9.72 | ✅ |
| steel heading/text on cream | 4.70 | ✅ |
| **terracotta link `#b96131` on cream** | **3.82** | ❌ normal — **must darken** |
| terracotta-hover `#954e27` on cream | 5.41 | ✅ |
| **peach on steel (the audit "footer" defect)** | **2.96** | ❌ — never use |
| cream on steel / white on steel | 4.70 / 5.36 | ✅ — on-dark link/text |
| charcoal on peach | 6.13 | ✅ |
| charcoal on type colors: contra 5.62 · english 6.36 · special 4.52 · assembly 6.39 | ✅ | |
| **charcoal on meeting `#9b84ce`** | **3.48** | ❌ normal — large/UI only |

Concrete token rules that follow:

1. **Link on light** resting color is the darker terracotta (`#954e27`, 5.41:1) — **not** `#b96131`
   (3.82:1). A distinct darker hover is chosen below that. This *is* the correction of the audit
   contrast defect at the token level.
2. **Link/text on the steel-blue band** uses cream/white (≥4.5:1); **peach is never a link/text color on
   steel** — that pairing is designed out.
3. **Event-type colors are accent/badge tokens** (borders, chips, bold/large labels — the 3:1 UI
   threshold), not backgrounds for normal-size body text. Specifically `meeting #9b84ce` with charcoal is
   3.48:1, so it must not sit behind normal text; as an accent/border or with large/bold text it passes.

**Rationale**: Encoding these as the shipped token values (and unit-testing the ratios) means later pages
that consume the tokens cannot reintroduce the WordPress defects. The "fix the footer" requirement (FR-005)
is satisfied structurally — the losing pairings are never expressible through the tokens.

**Alternatives**: Keep `#b96131` as the link and rely on per-page vigilance (rejected — the defect
reappears the moment someone uses the token on cream); recolor the whole palette (rejected — the audit says
keep the identity; only the failing pairings are adjusted).

## R4. Scope clarification — the "double H1" and "footer" defects are WordPress, not zak1

**Decision**: Treat FR-005 (footer) and FR-006 (one H1) as **discipline enforced by the foundation**, not
fixes to existing zak1 code. zak1's public pages already have exactly one `<h1>` each (`whats-on`,
`what-was-on`, `whats-on/[eventId]`, `join`), and `PublicNav` is a `<nav>` (no heading), so there is no
double-H1 to fix — the requirement is to keep it that way (a component test guards it). zak1 has **no
footer** today; a real footer with org info is **R3**, not R1. R1's obligation is that the link/background
tokens are AA on every surface a future footer would use (R3), which R3 satisfies.

**Rationale**: The spec's parentheticals ("the current site uses H1 twice per page", "peach-on-blue footer
links") describe the site being replaced. Building a footer here would violate FR-009 (no new
content/pages) and YAGNI. Reading these as token/discipline requirements keeps R1 correctly scoped.

**Alternatives**: Build a footer in R1 (rejected — new content, R3's job); ignore heading discipline
(rejected — cheap to guard now, expensive to retrofit).

## R5. Fonts

**Decision**: Load **Raleway** (headings) and **Open Sans** (body) via `next/font/google` in the root
layout, exposed as CSS variables (`--font-heading`, `--font-body`) with real fallback stacks
(`Raleway, system-ui, sans-serif` / `"Open Sans", system-ui, sans-serif`). Replaces the current inline
`<body style={{fontFamily:"system-ui"}}>`.

**Rationale**: `next/font` self-hosts the fonts at build time (no external request, no layout shift,
CSP-safe), and the variable form composes with the token stylesheet. Built into Next — no dependency.

**Alternatives**: `<link>` to Google Fonts (rejected — external request, CSP/perf cost); `@fontsource`
packages (rejected — a dependency for what `next/font` does natively). Note: the build fetches the font
files once at build time.

## R6. Single source of truth + drift protection

**Decision**: `globals.css` `:root` is the **single source** of the token hex values. Tests **parse
`globals.css`** to extract `--name: #hex` pairs and assert WCAG AA on the text/UI pairs (R3), so the
assertions run against the *shipped* values. `tokens.ts` holds only typed helpers (the event-type→`var()`
map, the event-type union) — **no hex duplication**. A pure `contrast.ts` (relative-luminance ratio) backs
the test.

**Rationale**: Parsing the real stylesheet kills the classic token-drift bug (a TS copy diverging from the
CSS) and makes the accessibility guarantee test-enforced against what actually ships.

**Alternatives**: Duplicate hexes in TS as the tested source (rejected — drift risk); generate CSS from a
TS object at runtime (rejected — over-engineered for a static token file).
