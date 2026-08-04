# Quickstart & Validation: Volunteer Navigation Menu

How to prove the feature works. See [contracts/volunteer-nav.md](contracts/volunteer-nav.md) and
[data-model.md](data-model.md) for the details these steps validate.

## Prerequisites

- Node 24 + pnpm. A signed-in staff session for manual checks (the dev harness seeds one; see the auth notes).
- No database migration for this feature.

## Automated validation (primary)

Written first, per Constitution I:

```bash
# Completeness guard — RED first (five orphans), GREEN after the NAV entries are added:
pnpm exec vitest run tests/integration/auth.navCompleteness.test.ts

# Client presenter — items, active-state, distinct landmark:
pnpm exec vitest run tests/component/volunteerNav.test.tsx
```

Expected:

- **Completeness** — every static `(admin)`/`(door)` page route is an `NAV` href and vice-versa; dynamic
  `[param]` routes are in the documented exclusion set. Initially fails naming `/payments`, `/bookings-report`,
  `/door-parameters`, `/venue-rents`; passes once those entries are added.
- **Presenter** — renders one link per item in order; the current section carries `aria-current="page"`; the
  landmark is `aria-label="Main"`; renders nothing meaningful for empty `items`.

Full gate before commit:

```bash
pnpm exec tsc --noEmit && pnpm run lint && pnpm exec vitest run
```

## Manual validation (visual)

```bash
pnpm dev   # http://localhost:3000
```

1. **Anonymous** — open `/whats-on`: only the public menu (Site) shows; **no** "Main" volunteer bar.
2. **Signed in** — sign in, then open `/whats-on` (a public page): the volunteer "Main" bar now appears
   **beneath** the public bar (placement B — every page when signed in).
3. Open `/payments` — it is present in the volunteer bar (D1 closed) and marked active; also confirm
   `/bookings-report`, `/door-parameters`, `/venue-rents` appear.
4. Confirm role-filtering: a narrow role sees only its entries; a broad role sees more (courtesy, not control —
   requesting a hidden page's URL is still refused by the page).
5. Open the home page `/` — the volunteer bar comes from the root layout (no double nav; the old 025 home-page
   nav is gone).

## Success-criteria mapping

| Criterion | How validated |
|-----------|---------------|
| SC-001 (reach every role page in one click, any page) | Steps 2–4 |
| SC-002 (zero orphaned pages; /payments reachable) | Completeness test + step 3 |
| SC-003 (new orphan caught automatically) | Completeness test (add a bare page → it fails) |
| SC-004 (present when signed in, absent when anonymous) | Steps 1–2 |
| SC-005 (only entries for the role's capabilities) | Step 4 + existing `navItemsFor` coverage |
