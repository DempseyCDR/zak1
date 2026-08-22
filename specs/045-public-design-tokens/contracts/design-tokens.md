# Contract: Public design-token interface

The interface this feature exposes to **later Phase 7 public pages** (R2–R15). No HTTP/API surface — the
"contract" is the token vocabulary, the layout primitive, and the event-type color map that downstream
pages build on.

## 1. CSS custom properties (from `globals.css`, in effect app-wide)

Later pages MUST style from these tokens rather than hard-coded values:

- **Color**: `--ground`, `--surface`, `--band`, `--band-hover`, `--text`, `--text-muted`, `--link`,
  `--link-hover`, `--link-on-dark`, `--peach`.
- **Type**: `--font-heading`, `--font-body`, the `--fs-*` scale, `--lh-*`.
- **Space**: the `--space-*` scale.
- **Event-type accents**: `--type-contra`, `--type-english`, `--type-special`, `--type-assembly`,
  `--type-meeting`.

**Guarantees**: every text/UI pairing of these tokens meets WCAG AA (research R3). Consumers MUST honor the
usage rules: `--link` on light grounds, `--link-on-dark` on `--band`; `--type-*` as accents/badges (borders,
chips, bold/large labels), **not** as backgrounds behind normal-size text (esp. `--type-meeting`).

## 2. Layout primitive

`Container` (`(public)/_components/Container.tsx`) — the mobile-first content wrapper. Later public pages
compose their content inside it instead of inline `maxWidth`/padding. Renders a semantic landmark
(`<main>` by default) so pages keep one H1 inside it.

## 3. Event-type color map

`EVENT_TYPE_COLORS` (`src/app/tokens.ts`): `Record<EventType, string>` mapping each event-type key to its
`var(--type-*)` string. R4's schedule/cards import this to color-code events; it is the single source, so
the same type is the same color everywhere.

## 4. Accessibility contract (applies to every consumer)

- Exactly **one `<h1>` per page**; heading levels descend without skipping.
- All text/interactive elements meet **WCAG AA** contrast (guaranteed by the tokens when used per the rules).
- Layouts are legible at **375px** with no horizontal scroll; body text **≥16px**.

## 5. Scope boundary

Tokens are defined app-wide but **only the `(public)` route group is restyled** in this feature. Admin,
door, and volunteer surfaces MUST render identically to before (they may *opt into* the tokens in a later
feature; this one does not touch them).
