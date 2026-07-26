# Quickstart: Validating Feature 020 — Booker Experience

**Date**: 2026-07-25 · **Plan**: [plan.md](plan.md) · **Contracts**: [contracts/](contracts/)

How to run and prove the feature. Details live in [data-model.md](data-model.md) and the contracts.

---

## Prerequisites

```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 24 >/dev/null 2>&1   # ALWAYS first
pnpm run db:migrate      # applies 0025_booker_experience.sql (tentative enum + venues.short_name + backfill)
```

⚠️ **Never run `pnpm run db:seed`** — it TRUNCATEs `zak1_dev`. Migration 0025's only non-additive act is the
one-time `short_name` backfill (idempotent).

---

## Automated suite

```bash
pnpm test                      # baseline 510 must stay green, plus this feature's
pnpm exec tsc --noEmit
pnpm run lint
pnpm exec prettier --check .
pnpm build
```

### Tests (test-first)

Unit:

| Test | Asserts |
|---|---|
| `bookingStatus` (extend existing) | `requested→tentative`, `tentative→confirmed`, `tentative→declined` allowed; `requested→confirmed` still allowed (skip); `proposed→tentative` and `confirmed→tentative` refused |
| `venueShortNameDefault` | "German House"→"GH", "First Unitarian Church"→"FUC", "The Harmony"→"TH", ""→"" |
| `mailtoEmailFor` | precedence booking > personal > public_profile; excludes `other` and inactive; null when none |

Integration (real Postgres):

| Test | Asserts |
|---|---|
| `searchPerformers` | ILIKE match on display name, ordered by display name; empty q browses |
| bookings report | `sort=desc` reverses; `venueShortName` present (and falls back to initials) |
| tentative end-to-end | a booking driven requested→tentative→confirmed; a tentative booking is **absent** from the public display |
| prior-event defaults | returns venue + start time of the latest prior event in the series; nulls when none |
| rent Option A | no-op rent edit leaves `events.rent_cents` NULL; a changed value stores the override |
| venue short name | create defaults from initials; PATCH edits it; backfill populated existing venues |

---

## Manual validation (browser)

```bash
pnpm dev      # port 3000
```

Sign in as `rcd@cdrochester.org` (Super-user) for full write access; to test the read-only shells, use a
base volunteer (no Booker grant).

### US1 — bookings report

1. `/bookings-report` → one row per event, **venue short name** shown, musicians stacked, a **status letter**
   beside each performer.
2. Toggle **sort** asc/desc; filter by a performer.
3. Confirm **empty role slots** appear (caller/sound-tech/musicians + "add musician"), and **no** sound-tech
   slot on a `community_dance` event.

### US2 — booking modal

1. Click an empty musician slot → **create** modal, role pre-filled → **type** a performer name (typeahead)
   → set pay/status → **Save** → it appears on the row.
2. Click a filled booking → change pay/notes/status → **Save**; reopen → **Cancel** discards.
3. Search a name that isn't a performer → **add performer** → search an existing **contact** → returns with
   the new performer selected → finish and Save the booking.
4. Confirm the **mailto** link opens the mail app with subject "Rochester Dance <date>".
5. As a **non-Booker**: the modal shows **Close only**.

### US3 — tentative

1. Take a requested booking → **tentative** (report shows **T**) → **confirmed**.
2. Take another requested → **confirmed** directly (skip).
3. Confirm the tentative booking never shows on public `/whats-on`.

### US4 — event modal

1. Click an event date → modal shows date/start/venue/rent/label/description.
2. Create a new event in a series → venue + start time **pre-filled from the prior event**.
3. Rent field shows a **real number** (resolved default); change the **venue** → rent **re-defaults**; leave
   it → no override stored; type a value → override stored.
4. As a non-Booker: **Close only**.

### US5 — venue short name

1. A venue with no short name shows its **initials** in the report; edit the short name → report reflects it.

---

## Success criteria mapping

| SC | Validated by |
|---|---|
| SC-001 | US1 steps 1–3 |
| SC-002 | US2 steps 1–2 |
| SC-003 | US2 step 3 + searchPerformers test |
| SC-004 | US3 steps 1–3 + tentative/public test |
| SC-005 | US4 steps 2–3 + prior-event/rent tests |
| SC-006 | US2 step 5, US4 step 4 |
| SC-007 | public/treasurer/organizer unchanged — existing suites stay green |

---

## Before rollout — none code-blocking

- Decide whether to later enforce "every performer has a contact" (a few nulls today) — separate item, not
  part of this feature.
