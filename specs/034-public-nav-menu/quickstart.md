# Quickstart & Validation: Public Navigation Menu

How to prove the feature works end to end. See [contracts/public-nav.md](contracts/public-nav.md) and
[data-model.md](data-model.md) for the details these steps validate.

## Prerequisites

- Node 24 + pnpm (repo default).
- No database or migration is required for this feature.

## Automated validation (primary)

Written first, per Constitution I (Test-First):

```bash
pnpm exec vitest run tests/component/publicNav.test.tsx
```

Expected: the component test passes, covering —

- both entries render (**What's On** → `/whats-on`, **Join** → `/join`) plus the wordmark home link;
- active-state: with `usePathname` mocked to `/whats-on` and to `/whats-on/<id>`, **What's On** carries
  `aria-current="page"`; with `/join`, **Join** does; with `/gate`, no public entry is current;
- the nav landmark is present with `aria-label="Site"`.

Full gates before commit:

```bash
pnpm exec tsc --noEmit && pnpm run lint && pnpm exec vitest run
```

## Manual validation (visual)

```bash
pnpm dev   # http://localhost:3000
```

1. Open `/whats-on` — the public menu is the topmost bar (wordmark + What's On + Join); **What's On** shows
   active.
2. Open `/join` — same bar; **Join** shows active.
3. Open an event detail page from What's On (`/whats-on/<eventId>`) — the bar is present; **What's On** stays
   active (parent section).
4. Sign in and open `/checkin` or `/gate` (staff pages) — the **public** menu is still the topmost bar, with the
   **volunteer** menu rendered beneath it (second bar). No public entry is marked active.
5. Narrow the window to a phone width — all entries remain reachable (they wrap; no entry is hidden).

## Success-criteria mapping

| Criterion | How this quickstart validates it |
|-----------|----------------------------------|
| SC-001 (reach any public destination in one click from any page) | Steps 1–4: every entry is one click on every page |
| SC-002 (menu on 100% of pages, signed in or out) | Steps 1–4: public pages + staff pages, both states |
| SC-003 (add a destination in exactly one place) | Add an entry to `PUBLIC_NAV`; it appears with no other edit |
| SC-004 (all destinations reachable on mobile) | Step 5 |
| SC-005 (current page/section indicated everywhere) | Steps 1–3 active-state; component test |
