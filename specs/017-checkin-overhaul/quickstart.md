# Quickstart / Validation Guide: Check-in Overhaul

End-to-end validation that P3-3 works. Assumes the feature-016 auth model is live and you can act as a Door
Attendant and as an FS. See [data-model.md](data-model.md) and [contracts/](contracts) for field-level
detail — this guide is the run/verify path, not an implementation spec.

## Prerequisites

```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 24 >/dev/null 2>&1   # ALWAYS first
pnpm run db:migrate            # applies 0022_checkin_overhaul.sql (additive)
pnpm test                      # full suite green (new tests included)
pnpm exec tsc --noEmit         # typecheck
pnpm run lint                  # eslint + markdownlint
```

Roles needed (grant via `/access` as President/VP, or `auth:bootstrap`):

- a **Door Attendant** (`door_attendant`) — works `/checkin`, must NOT reach `/gate`.
- a **Financial Secretary** (`financial_secretary`) scoped to the test series — confirms counts on `/gate`.

Dev server for manual checks: `preview_start {name:"dev"}` (port 3000; `GOOGLE_REDIRECT_URI` must match).

## Automated validation (the primary proof — constitution: test-first)

Run the feature's integration/unit tests:

```bash
pnpm test -- checkin           # or the paths added under tests/integration + tests/unit
```

The suite must cover, at minimum:

1. **B34** — new contact at check-in persists `first_name`, `last_name`, and `display_name` = `"first last"`
   when no override; = the override when supplied; and is checked in for the event.
2. **B33** — `listEventAttendance` returns structured `firstName`/`lastName`; `?sort=first` and `?sort=last`
   order correctly with a deterministic tiebreak and nulls last.
3. **B35** — checking in a parent with `childrenCount: N` raises `events.attendance_count` by `1 + N`, and
   the organizer report's paying dancers rise by `1 + N` (children counted as paying, not comped).
4. **B29** — a check-in with `isComp: true` / `redeemedGiftCard: true` (per-check-in booleans on
   `POST /api/events/[id]/attendance`) **increments** `comp_count` / `gift_card_redemption_count` on the door
   record (counts-only, not stored on the row; allowed on `unmatched` too); the FS then sees them on `/gate`
   and can override them (`gate.write`); paying dancers drop by the comp count exactly as feature 014 did.
5. **B29 boundary** — a Door Attendant calling any `gate.write` path (`PATCH /api/door-records/[id]`,
   `PUT …/gate-sales`) is refused (`403`), and the refusal is audited. `/checkin` never exposes money.
6. **B36** — an open-band check-in at a `community_dance` event: `is_open_band = true` on the row,
   `attendance_count +1`, `open_band_count +1`; the report's `effectiveComps = comp_count + open_band_count`
   so the musician counts as attending but not paying. The same flag on a non-`community_dance` event is
   rejected (FR-022).

## Manual walkthrough (optional, via the browser preview)

As the **Door Attendant** on `/checkin`:

1. Pick an event. Under "No match", add a new person with **first + last name**; confirm the display-name
   field pre-fills "First Last" and is editable; save → they appear in the **roster** below.
2. Toggle the roster sort **first ↔ last**; confirm re-ordering.
3. Check in an existing contact with a **children count**; confirm the roster shows the family (e.g.
   "Jane Smith (+3)").
4. On a **community dance** event, check in an attendee with the **open-band** flag; confirm it is recorded
   and the flag does not appear/take effect on a non-community event.
5. Tick the **comp** and/or **gift-card redeemed** checkbox on a check-in. Confirm no money field is anywhere on `/checkin`
   and that navigating to `/gate` is refused for this role.

As the **FS** on `/gate` for the same event:

1. Confirm the comp and gift-card counts captured at check-in are shown; adjust one and save (allowed).
2. Confirm `open_band_count` is shown (read-only) and that paying dancers reflect
   `comp_count + open_band_count`.

## Expected outcomes (maps to Success Criteria)

- SC-001: no first-name-only door contacts — last name + display name captured.
- SC-002: roster re-sorts by first vs. last correctly.
- SC-003: family of parent + N children raises attendance and paying dancers by `1 + N`.
- SC-004: comp/gift counts captured at check-in appear unchanged on `/gate`; paying dancers identical to
  capturing the same comp count at `/gate` pre-feature.
- SC-005: open-band musician counts as attending, nets non-paying via the group's per-event comp; group
  totals stay correct with no cross-event counter.
- SC-006: Door Attendant completes check-in without ever reaching `/gate` or a money figure.

## Rollback

The migration is additive (three `NOT NULL DEFAULT` columns). No destructive change; a snapshot of
`zak1_dev` before applying is optional (`pg_dump -Fc "$DATABASE_URL" -f ~/zak1_pre_0022.dump`).
