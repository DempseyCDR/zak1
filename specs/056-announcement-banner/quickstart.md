# Quickstart / Validation: Announcement banner (P7-R13)

Assumes the dev DB is migrated (`0039`) and the dev server runs.

## 0. Setup

```bash
pnpm run db:migrate      # applies 0039_announcements.sql
pnpm dev
```

## 1. Gate suite (fast, no browser)

```bash
pnpm exec vitest run \
  tests/unit/announcementActive.test.ts \
  tests/integration/announcement.test.ts \
  tests/integration/announcement.authz.test.ts \
  tests/component/announcementBanner.test.tsx
pnpm exec tsc --noEmit
pnpm run lint
```

Expected: the duration boundary + validation; post/get/clear/supersede + audit; `content.write` refusal; the
banner renders/dismisses.

## 2. Post & see the banner (US1/US2) — browser

1. As a `content.write` actor at `/announcement`, post: text "Tonight's dance is CANCELLED — icy roads",
   level **urgent**, duration **24**, no link.
2. Load `/`, `/whats-on`, and a `/dances/*` landing → the banner shows above the content on **each** (site-wide,
   SC-001). It never appears on an `(admin)`/`(door)` page.
3. **View source** (scripts disabled): the announcement text is present in the served HTML (FR-009).

## 3. Urgency + link (FR-003/006/007)

- Post an `info` announcement with a link (`https://…`) → the banner shows a distinct (non-urgent) style and a
  clickable outbound link (`target=_blank rel=noopener`). Try a `javascript:` URL → rejected on save (422).
- Screen reader: an `urgent` banner is `role="alert"`; an `info` banner is `role="status"`/`aria-live=polite`.

## 4. Dismiss (US3/FR-008)

- Dismiss the banner → it stays hidden as you navigate public pages. Post a **new** announcement → it reappears
  (dismissal was scoped to the previous id).

## 5. Auto-expiry (FR-013/SC-008)

- Post with duration **1** hour (or seed a row whose `posted_at` is >24h ago with default duration) → after the
  window it no longer shows, with **no** staff action. Unit test covers the just-before/just-after boundary.

## 6. Clear early + empty state (FR-002/004/SC-003)

- Clear the announcement at `/announcement` → the banner disappears everywhere; pages render with **no** banner
  and no layout shift.

## 7. Authorization & audit (SC-005)

- A base volunteer cannot reach `/announcement` or POST/DELETE (403). Every post and clear writes an
  `audit_events` row (`announcement.posted` / `announcement.cleared`).

## Success criteria mapping

| Criterion | Validated by |
|-----------|--------------|
| SC-001 above-the-fold, site-wide | §2 |
| SC-002 post/clear no deploy | §2, §6 |
| SC-003 empty → no banner/shift | §6 |
| SC-004 only http(s) links | §3, §1 |
| SC-005 gated + audited | §7 |
| SC-006 dismiss persists, new re-shows | §4 |
| SC-007 live region + no h-scroll @375px | §3, §2 |
| SC-008 auto-expiry boundary | §5, §1 |
