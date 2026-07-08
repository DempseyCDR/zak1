# Phase 0 Research: Event Label, Start Time, Description

No open **NEEDS CLARIFICATION** — P2-4's questions were settled before specify (label = free text;
start time = venue-local wall-clock, no time zones; end time out of scope; description = plain long
text). This records the small design decisions.

## Decision 1 — Three nullable columns on `events`; additive migration, no backfill

**Decision**: Add `label text NULL`, `start_time time NULL` (time *without* time zone), `description
text NULL` to `events` in migration `0018`. No backfill — existing rows get `NULL` and display exactly
as today.

**Rationale**: All three are optional, display-only attributes of an event, so they belong on the events
row; there is no new entity. Nullable + additive means zero regression (FR-008/SC-004) and a trivial,
safe migration.

**Alternatives considered**: A separate `event_details` table (rejected — YAGNI; three columns don't
warrant a join); a NOT NULL default for label/description (rejected — "no label"/"no description" must be
representable and render nothing).

## Decision 2 — Start time is a zoneless SQL `time`, formatted by a pure helper

**Decision**: Store start time as PostgreSQL `time` (without time zone) — a bare wall-clock value. Render
it via a new pure `formatWallClock("19:30:00") → "7:30 PM"` helper that operates on the string only, with
**no `Date` construction and no UTC/offset math**.

**Rationale**: The club treats all times as local, and the requirement is "shown exactly as entered,
independent of the viewer" (FR-004/SC-002). A zoneless `time` is precisely a wall-clock value; formatting
from the raw `HH:MM(:SS)` string avoids the classic bug where `new Date("19:30")` reintroduces the
viewer's/server's time zone. One helper = one tested place for the rule.

**Alternatives considered**: `timestamptz`/`Date` (rejected — carries a zone, forces conversion, and
would shift for the viewer — the exact thing to avoid); adding a venue time-zone field (rejected —
explicitly out of scope; single-club local time).

## Decision 3 — Input shape: start time as an `HH:MM` string at the boundary

**Decision**: Validate start time as an optional `HH:MM` (24-hour) string in the create/patch schemas
(matching an HTML `<input type="time">`), stored into the `time` column. Label and description are
optional trimmed text.

**Rationale**: `<input type="time">` yields `HH:MM`; a simple regex-validated string maps cleanly to the
`time` column and back out for formatting. Keeps the contract a plain string, no client-side date object.

**Alternatives considered**: Free-form time text (rejected — ambiguous to store/format); seconds
precision (unnecessary; minutes suffice).

## Decision 4 — Edits ride the existing event PATCH; surfacing reuses the public read model

**Decision**: Add label/start_time/description to `eventCreateSchema` (create) and to the event PATCH
schema (edit), applied by `eventService`/the `PATCH /api/events/[id]` handler alongside the existing
venue/rent fields. Expose the fields through the existing `domain/public/publicSchedule.ts` read model
(schedule item + event detail) and render them in the feature-007 pages, the events admin, and the door
event picker.

**Rationale**: Reuses established seams (one event-patch endpoint, one public read model) rather than
adding parallel surfaces — least churn, consistent with 007/011 which already extended the same PATCH.

## Non-functional posture

Performance/scale/security/observability inherited and unaffected — additive columns, no new queries of
note. Integration tests run against real Postgres; the formatter has a zone-independent unit test (assert
identical output under different `TZ`).
