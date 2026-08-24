# Quickstart / Validation: Public performer rosters (P7-R9)

Prove the feature end-to-end. Assumes the dev DB is migrated (`0036` applied) and the dev server runs.

## 0. Setup

```bash
pnpm run db:migrate           # applies 0036_performer_roster.sql
pnpm dev                      # Next.js dev server
```

## 1. Gate suite (fast, no browser)

```bash
pnpm exec vitest run \
  tests/unit/promoLinks.test.ts \
  tests/integration/publicPerformers.test.ts \
  tests/component/roster.test.tsx
pnpm exec tsc --noEmit
pnpm run lint
```

Expected: the projection returns only public, non-archived bands and public callers; the style filter
narrows correctly; no contact field appears on any projected result; the promo-link schema rejects every
non-`http(s)` scheme.

## 2. Public read (US1, US2) — browser

1. As a `performer.write` actor, mark a band public, tag it `contra`, add a member with an instrument, and
   add a promotional website link (`https://…`).
2. Visit `/performers` (also reachable from the public nav → "Performers"):
   - the band shows name, bio, photo (if set), style, members with instruments, and a clickable outbound
     link; the link element has `target="_blank"` and `rel="noopener noreferrer nofollow"`.
   - **no** email or phone appears anywhere on the page (SC-002).
3. Visit `/performers?style=english`: the contra-only band is absent; a public English band/caller shows.
   Clear the filter → full roster returns (SC-004).
4. At 375px width: a single `<h1>`, no horizontal scroll (SC-005).

## 3. Privacy (FR-004, FR-009) — browser

- A non-public band/caller does **not** appear on `/performers`.
- An archived (feature 008) but public band does **not** appear.
- A performer whose contact holds an email/phone: none of it is exposed on the roster.

## 4. Write-boundary safety (US4, FR-006)

- In the performer/band admin, add a link with `javascript:alert(1)` (or `data:…`): the save is **rejected**
  (422) with a clear validation message; nothing is stored.
- A base-role volunteer without `performer.write` cannot edit these fields (403).

## 5. Lineup link (US3) — browser

- Open an event (feature 049 detail page) whose confirmed band has a public roster entry: the band name in
  the Lineup links to `/performers#band-<id>` and scrolls to that entry.
- A lineup performer with no public roster entry renders as plain text (no broken link) (SC-006).

## Success criteria mapping

| Criterion | Validated by |
|-----------|--------------|
| SC-001 nav + find in <30s | §2 step 2 |
| SC-002 zero PII exposed | §2 step 2, §3 |
| SC-003 only http(s) links | §1 (unit), §4 |
| SC-004 filter accuracy | §2 step 3 |
| SC-005 one H1, no h-scroll @375px | §2 step 4 |
| SC-006 lineup links / graceful degrade | §5 |
