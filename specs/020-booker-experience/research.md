# Phase 0 Research: Feature 020 — Booker Experience

**Date**: 2026-07-25 · **Plan**: [plan.md](plan.md) · **Spec**: [spec.md](spec.md)

Eight decisions. Most are "this already exists, reuse it" — the value here is naming exactly what is new
versus what is a UI layer over working code, so the implementer doesn't rebuild the substrate.

---

## R1 — Tentative status ⚠️ *the one enum/logic change*

**Decision**: Add `tentative` to the `booking_status` enum and weave it into the existing `ALLOWED`
transition map ([`bookingStatus.ts`](../../src/server/domain/bookings/bookingStatus.ts)):

```text
proposed  → requested, declined
requested → tentative, confirmed, declined   (confirmed still reachable directly — skippable)
tentative → confirmed, declined
confirmed → declined
declined  → proposed                          (revive)
```

**Rationale**: The lifecycle machinery already validates transitions via `isAllowedBookingTransition`; this
is a one-value enum add plus two lines in the map. `requested → confirmed` stays, so tentative is genuinely
optional. Re-point already forces `proposed` in `patchBooking` and is untouched.

**Public display is unaffected — verified**: `bands/publicDisplay.ts` filters `status === "confirmed"`, so a
`tentative` booking is excluded with no code change (FR-015). The confirmed-only report/public paths need no
edit.

**Migration note**: `ALTER TYPE ... ADD VALUE 'tentative'` runs inside the migration-runner transaction on
PG16, but the value can't be *used* in that same transaction — the migration doesn't use it (no data write
references it), so this is fine, exactly as feature 019's enum additions were.

**Alternatives considered**: A separate "maybe" boolean beside status — rejected, it splits one concept
across two columns and the report letter would need to reconcile them. The enum is the natural home.

---

## R2 — Venue short name

**Decision**: Add `venues.short_name text` (nullable). A pure `venueShortNameDefault(name)` derives the
initials (uppercased first letter of each whitespace-separated word: "German House" → "GH"). Applied at
venue **create** (as the default the Booker can edit), **backfilled** for existing venues in the migration,
and used as the report's display value — with a runtime fallback to the derived initials if `short_name` is
ever null.

**Rationale**: Display-only, non-unique (FR-024), so a plain nullable column + a pure derivation is all that
is needed. The runtime fallback means the feature is robust even if a venue is created by a path that skips
the default.

**Alternatives considered**: NOT NULL with a DB default — rejected, the initials logic is app-side (word
splitting/uppercasing) and a SQL default can't express it cleanly; a nullable column + app default + backfill
is simpler and keeps the derivation in one testable function.

---

## R3 — Performer search (typeahead)

**Decision**: `searchPerformers(db, q, limit)` filtering `performers.display_name` with `ILIKE %q%`, ordered
by `display_name`; exposed by extending `GET /api/performers` with an optional `?q=` (returns the same
performer summary shape). Empty `q` returns the list ordered by display name (the browse case).

**Rationale**: ~30 performers — ILIKE is instant and needs no `pg_trgm` index or a normalized column (unlike
`searchContacts`, which ranks 1,340 contacts by trigram similarity). Keeping it simple avoids a migration and
matches the data size. Returns a `performer_id`, which is what a booking needs.

**Alternatives considered**: Reuse the contact trigram search — rejected, wrong table (bookings need
performers) and overkill for 30 rows. A new normalized column on performers — rejected as YAGNI at this
scale.

---

## R4 — Bookings report: sort direction + venue

**Decision**: Add a `sort: "asc" | "desc"` option to `assembleBookingsReport` (today it is hard-coded
`asc(events.eventDate)`), and add the event's **venue short name** to the report row (join
`events.venue_id → venues`). Also add **`hasSoundTech`** (the series flag) to the row so the UI can render
**empty role slots**: the row carries caller / soundTech / musicians, and the UI derives empty slots from
"expected roles minus filled", suppressing the sound-tech slot when `hasSoundTech` is false.

**`hasSoundTech` MUST be on the row** — the `/api/series` list the report page loads returns only
`{id, key, name}` (verified: `listSeries`), so the page cannot read the flag from there (analyze G1).

**Rationale**: The report is the one server piece US1 needs to change; the additions are small and
non-breaking. Empty slots are a **presentation** concern (which roles are expected vs filled), so they live
in the UI over data the row provides plus `hasSoundTech`.

**Alternatives considered**: Compute empty slots server-side — rejected, "expected role set" is a UI layout
decision (how many musician slots to show, "+add"), not domain data.

---

## R5 — Prior-event defaults for event create

**Decision**: `priorEventDefaults(db, seriesId, beforeDate)` returns the `venue_id` and `start_time` of the
**latest event in that series with `event_date < beforeDate`** (or nulls if none). The single-event create
modal pre-fills from it; both are overridable. Recurrence generation (`generateRecurringEvents`) is **not**
changed — it takes explicit venue/start time.

**Rationale**: A small, isolated resolver so the "prior" rule (spec Assumptions: open to revision) can be
swapped in one place. Recurrence is deliberately exempt because it sets start time explicitly (the ecd
seasonal winter/summer split relies on that).

**Alternatives considered**: "Most recent event in the series regardless of the new date" — rejected per the
user's choice (relative to the new event's date); kept as a single function so the alternative is a one-line
change if revisited.

---

## R6 — Rent: show the resolved default, store dynamically (Option A)

**Decision**: The event modal displays the resolved rent from the existing chain
([`rentService.resolveEventRentCents`](../../src/server/domain/parameters/rentService.ts)): per-event override →
series-at-venue → venue default → 0. It needs a read to resolve rent for a **(series, venue, date)** so the
value can be shown and re-computed when the venue changes. On save, **Option A**: if the entered value equals
the currently-resolved default, store `events.rent_cents = null` (no override, stays dynamic); if it differs,
store the typed value as the per-event override.

**Rationale**: FR-019 verbatim. The resolution chain and `events.rent_cents` override already exist (feature
011); the only new surface is a read that resolves rent for a hypothetical venue (so the modal can show the
new default the instant Sean changes the venue, before saving).

**Alternatives considered**: Always freeze (Option B) — rejected by the user; A keeps the event tracking the
venue/series default unless deliberately overridden.

---

## R7 — Add-performer hand-off is UI-only

**Decision**: No new performer-creation logic. `createPerformer` **already** links an existing contact when
given `input.contactId` (only auto-creating a contact when none is supplied). The add-performer step is: a
**contact search** (existing `GET /api/contacts?q=`) → `POST /api/performers` with the chosen `contactId`,
`displayName` (defaulted from the contact), and `performerType` (from the slot) → return to the booking modal
with the new performer selected. The booking is not saved until Sean saves it.

**Rationale**: Reading `performerService.createPerformer` shows the existing-contact path is already there —
so the requirement "link an existing contact" costs zero backend change. This is the cheapest possible
implementation of FR-013.

**Alternatives considered**: A dedicated "promote contact to performer" endpoint — rejected, the existing
create with `contactId` is exactly that.

---

## R8 — Modal UI and the testing posture

**Decision**: Two client modal components (booking, event) on the existing admin pages, each with three
shells (create / edit with one Save + Cancel / read-only Close for non-holders). The read-only shell is
driven by the caller's capability, surfaced to the page the way the existing admin pages already gate write
controls. **Testing**: the domain and API changes (R1–R7) are unit/integration tested against real Postgres;
the modal *interactions* (open, edit, Save/Cancel, typeahead, hand-off, mailto composition) are **manually
verified in the browser**, the same posture features 017–019 used for their pages.

**Rationale**: This stack tests domain logic and API routes, not React components (no component harness).
The behavior that can break — transitions, search, defaults, rent semantics — is all in the tested layer;
the modal is glue over it. Constitution I is satisfied by testing the logic, not the glue.

**mailto composition** is a pure client string build: pick the first active email whose `purposes` include,
in order, `booking` → `personal` → `public_profile` (excluding `other`); `mailto:<addr>?subject=Rochester
Dance <friendly date>`. Worth a tiny pure unit test for the email-precedence pick, since that rule is the
one part with branching logic.
