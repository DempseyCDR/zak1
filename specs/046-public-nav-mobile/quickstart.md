# Quickstart: Public nav, small-screen pattern

Validation/run guide. Implementation lives in `tasks.md` + code; this proves the feature end-to-end.

## Prerequisites

- On `046-public-nav-mobile` (stacked on `045-public-design-tokens`, so the R1 tokens are present).
- Dependencies installed (`pnpm install`); no new dependency is added.

## 1. Automated checks (write tests first — constitution Test-First)

```bash
pnpm test -- publicNav           # 034 test stays green + new mobile disclosure test
pnpm typecheck && pnpm lint
```

**Expected**: `publicNav.mobile.test.tsx` — the toggle starts `aria-expanded="false"`, opens on click
(`true`), Escape closes it and returns focus to the toggle, and a changed `usePathname` collapses it; the
feature-034 `publicNav.test.tsx` still passes (all links present, active-state, single-source).

## 2. Visual + interaction verification (browser preview)

Open any public page and exercise the nav at both widths.

**At 375px:**

- **SC-001**: the nav is a compact bar (wordmark + toggle), not a wrapped multi-row list; no horizontal
  scroll.
- **SC-002**: the toggle and every revealed link are ≥44×44px (comfortable thumb targets).
- **SC-003**: with the keyboard only — Tab to the toggle, Enter/Space opens it, Tab through the links,
  Escape closes it and focus returns to the toggle; a visible focus ring throughout.
- **SC-004**: nav text/controls meet WCAG AA (contrast check).
- **SC-005**: temporarily extend `PUBLIC_NAV` to ~10 entries and confirm the open panel stays tidy (no
  overflow/scroll); revert.

**At ≥768px:**

- **SC-008**: the nav renders as the inline bar (wordmark + destinations), toggle hidden — no regression.

## 3. Two-bar stack (SC-006)

Signed in, at 375px: confirm both the public bar and the volunteer bar render, are distinguishable, and
every destination in each is reachable without overlap or horizontal scroll.

## 4. Scope check (SC-007)

- Confirm `PUBLIC_NAV` (destinations) is unchanged (git diff shows no edit to `publicNavItems.ts`).
- The shared bar now also appears tokenized atop admin/door pages — expected (FR-009). Confirm page
  **bodies** on those surfaces are otherwise unchanged.

## Success criteria mapping

| Check | Criterion |
|-------|-----------|
| Compact bar, no h-scroll @375px | SC-001 |
| ≥44px targets | SC-002 |
| Keyboard open/traverse/Escape/focus-return | SC-003 |
| WCAG AA | SC-004 |
| Tidy at ~10 destinations | SC-005 |
| Both bars reachable @375px | SC-006 |
| Destinations unchanged | SC-007 |
| Inline bar @≥768px | SC-008 |
