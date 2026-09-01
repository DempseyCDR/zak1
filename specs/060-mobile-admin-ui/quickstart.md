# Quickstart / Validation: Mobile-First Admin UI Foundation (060)

Proves X-R1 + X-R2 on the `contacts` reference surface: mobile-first, shared palette, 48px targets, the
Record/Triage patterns, and no behavior regression.

## Prerequisites

- Local dev DB reachable (`DATABASE_URL`); `pnpm dev` runnable.
- Signed-in staff session (the `(admin)` group requires `requireStaff()`).

## Automated (logic / no-regression) — the source of truth for behavior

```bash
pnpm vitest run tests/component/recordView.test.tsx tests/component/triageList.test.tsx tests/component/contacts.page.test.tsx
```

Expected (per `contracts/ui-patterns.md`):

- **RecordView** — renders the entity region + actions; performs no data calls (C-A1, C-A3).
- **TriageList** — renders rows with inline action / `onOpen`; renders the empty state when `items` is
  empty (C-B1–C-B3).
- **Contacts page** — typing a query still renders the results list (C-S4 — no behavior regression).

Then the full component + typecheck gate:

```bash
pnpm vitest run tests/component && pnpm tsc --noEmit
```

## Browser-preview (layout / visual) — for the SCs jsdom can't compute

Start the dev server and open the Browser preview, then verify at a **375px** viewport:

1. `preview_start` the dev app; navigate to `/contacts`; `resize_window` to **mobile (375×812)**.
2. **No horizontal page scroll** (SC-001, C-S1): the page body does not scroll sideways; any wide block
   scrolls within its own container. Confirm via a screenshot + `javascript_tool`
   (`document.documentElement.scrollWidth <= window.innerWidth`).
3. **Shared palette** (SC-002, C-S2): computed colors resolve to the `globals.css` tokens (e.g. page
   ground is `--ground`); no bespoke inline colors remain (no `style={{}}` on the migrated page).
4. **Touch targets** (SC-005, C-A2/C-B4/C-S3): primary controls (search field, row actions, buttons)
   are ≥48×48 px — check computed `getBoundingClientRect()` for a sample.
5. **Patterns present** (SC-003): the search results read as a **Triage** list (rows → open), and opening
   one shows the **Record** view shell.
6. **Nav on mobile**: the root volunteer nav is reachable and tappable at 375px.

## Success = spec Success Criteria

- SC-001 ↔ step 2 · SC-002 ↔ step 3 · SC-003 ↔ steps 5 & the pattern tests · SC-004 ↔ the contacts
  component test · SC-005 ↔ step 4.
