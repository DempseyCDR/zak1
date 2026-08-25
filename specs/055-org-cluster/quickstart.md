# Quickstart / Validation: Org cluster (P7-R12)

Assumes the dev DB is migrated (`0038`) and the dev server runs.

## 0. Setup

```bash
pnpm run db:migrate      # applies 0038_officers.sql
pnpm dev
```

## 1. Gate suite (fast, no browser)

```bash
pnpm exec vitest run \
  tests/unit/clubRoles.test.ts tests/unit/membershipYear.test.ts \
  tests/integration/officers.test.ts tests/integration/officers.authz.test.ts \
  tests/component/boardList.test.tsx tests/component/contactList.test.tsx \
  tests/component/joinPage.test.tsx tests/component/footer.test.tsx tests/component/publicNav.test.tsx
pnpm exec tsc --noEmit
pnpm run lint
```

Expected: registry integrity + alias pattern; the membership-year label; the officer service upsert/clear +
PII-gated board projection + board-role validation + audit; `content.write` refusal; the renderers.

## 2. Membership page (US1, FR-001/002/003) — browser

- `/join` shows the four tiers with amounts (Supporter $50+, Family $30, Individual $20, Student $10), the
  membership year **September 1 – August 31** (derived from `club_settings.membership_year_end`), and a benefits
  summary. The existing name/email capture → **Pay dues with PayPal** flow still works unchanged (SC-002).

## 3. Donate (US2, FR-004/SC-003) — browser

- The **footer** shows a distinct **Donate** affordance (and one on `/join`), reachable in ≤2 taps, leading to
  the club's PayPal donation destination — visibly separate from "Pay dues".

## 4. Contact directory (US3, FR-005/006/014) — browser + view-source

- `/contact` lists each club role with its `role@cdrochester.org` alias as a mailto link. **View source**
  (scripts disabled): the aliases are present in the served markup (server-rendered, SC-004), and **no**
  personal/individual email appears.
- Publish a `contact-info` page in the 051 CMS → its text renders **below** the alias list; unpublish → the
  block disappears, aliases remain.

## 5. Board / officers (US4, FR-007/013/SC-005) — browser

- As a `content.write` actor at `/officers`, assign a **contact** to each board role (e.g. Vice President).
- `/board` lists officers by **first + last name + role + role alias** (mailto). Confirm **no** contact
  email/phone/PII appears. A vacant seat shows the role + alias with no name.
- Confirm the officer list is independent of access-control grants (assigning an officer does not change app
  permissions, and vice-versa).

## 6. Site identity (US5, FR-009/010/SC-006) — browser

- Every page shows the **favicon** in the tab.
- The header shows the **logo** (icon on a narrow phone, full logotype on a wide screen), and clicking it
  navigates to the **home page `/`**. Its accessible name is "Country Dancers of Rochester".

## 7. Authorization & audit (SC-006)

- A base volunteer cannot reach `/officers` or POST an assignment (403). Each officer assignment writes an
  `audit_events` row (`officer.set`).

## Success criteria mapping

| Criterion | Validated by |
|-----------|--------------|
| SC-001 tiers/year legible | §2 |
| SC-002 dues flow unchanged | §2 |
| SC-003 donate ≤2 taps, distinct | §3 |
| SC-004 aliases server-rendered, no PII | §4 |
| SC-005 board = names+roles, indep. of grants | §5 |
| SC-006 favicon + wordmark→home; gated+audited | §6, §7, §1 |
| SC-007 year matches the setting | §2 (one source) |
