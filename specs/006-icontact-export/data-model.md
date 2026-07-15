# Phase 1 Data Model: Email List Export (iContact)

Storage: PostgreSQL 16. Builds on feature 001 (`contacts`, `contact_emails`, membership status/
`list_member`) and feature 003 (`performers`). Only one new table is added; everything else is a
computed read at export time.

## Enum

- `mailing_list_id`: `contra | english | openband | specialevents | janeaustenball | performer |
  member | contact_tracing` — the first 7 are the fixed FR-001 lists; `contact_tracing` identifies the
  separate, event-scoped export (FR-006) for audit purposes only (it has no entry in the static list
  registry below, since it isn't one of "the seven").

## Static registry (code, not a table): MailingListDef

Not persisted — a fixed TS constant, one entry per `mailing_list_id`, mirroring the existing
`PERFORMER_RULES` static-matrix pattern (feature 003, `performerRules.ts`):

| List ID | Kind | Consent topic (topic lists only) | Extra column |
|---|---|---|---|
| contra | topic | `contra` | — |
| english | topic | `english` | — |
| openband | topic | `openband` | — |
| specialevents | topic | `special_events` | — |
| janeaustenball | topic | `jane_austen_ball` | — (year shown as UI label only, Decision 6) |
| performer | derived | — | — |
| member | derived | — | `membership_status` (FR-004), `membership_through_year` (FR-007) |

Every row of every one of the 7 lists also gets `email`, `first_name`, `last_name` (FR-011, derived
from `displayName`). The separate contact-tracing export (below) uses the same three columns plus its
own `date` column — it is not one of these 7 registry entries.

## Entity: MailingListExport (audit; append-only)

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| list_id | mailing_list_id NOT NULL | one of the 7 fixed lists, or `contact_tracing` |
| event_id | uuid FK→events NULL | set only when `list_id = 'contact_tracing'` — which event was exported |
| row_count | integer NOT NULL | rows in the generated CSV |
| actor | text NULL | who triggered it (matches existing `actor: string \| null` convention; no auth in this build) |
| created_at | timestamptz NOT NULL default now() | |

- **Index**: (list_id, created_at DESC) — supports "last exported" per list on the admin page.
- One row per individual list (or event, for contact tracing) download (Decision 8), not per
  multi-list batch.
- Written alongside the existing pino `writeAudit` call (`kind: "mailing_list.exported"`), matching
  this project's dual-audit precedent (e.g. `rate_parameter_audit`).

## Computed view: MailingListRow (not persisted)

Assembled per list at request time; never stored.

| Field | Source |
|---|---|
| email | `contact_emails.email` |
| first_name, last_name | split from `contacts.display_name` at the last whitespace boundary (FR-011; heuristic) |
| membership_status | `contacts.membership_status` — **member.csv only** (FR-004) |
| membership_through_year | year portion of `max(memberships.expiry_date)` for the contact — **member.csv only** (FR-007); same query shape as `recomputeContactStatus`'s expiry lookup (feature 001, `membershipService.ts`); never stored |

### Qualification per list kind

- **Topic lists** (contra, english, openband, specialevents, janeaustenball): `contact_emails.status =
  'active'` AND the list's consent topic ∈ `consent_topics`. DNC is excluded implicitly — feature 001's
  `effectiveConsentTopics` collapses `consent_topics` to exactly `['do_not_contact']` on write whenever
  DNC is set, so a DNC'd email can never match a content topic (Decision 2).
- **member**: `contact_emails.status = 'active'` AND `contacts.list_member = true` (Decision 3) AND
  NOT (`'do_not_contact' = ANY(consent_topics)`) (FR-002a, explicit — not implicit here).
- **performer**: `contact_emails.status = 'active'` AND `EXISTS (SELECT 1 FROM performers WHERE
  performers.contact_id = contacts.id)` (Decision 4) AND NOT (`'do_not_contact' = ANY(consent_topics)`).
- All 7 lists: one row per qualifying `contact_emails` row, never collapsed to one row per contact
  (Decision 5) — a contact with 2 qualifying emails on the same list produces 2 rows.
- `email_status = 'transition' | 'inactive'` rows are excluded from every list and the contact-tracing
  export (FR-003).

## Computed view: ContactTracingExportRow (not persisted, separate from the 7 lists)

Parameterized by `event_id` (admin-selected from the event dropdown, `GET /api/events`).

| Field | Source |
|---|---|
| email | `contact_emails.email` |
| first_name, last_name | split from `contacts.display_name`, same as the 7 lists (FR-011) |
| date | the selected event's `events.event_date` — constant across every row (FR-006a) |

**Qualification**: join `attendance` (feature 002) → `contacts` → `contact_emails` for the given
`event_id`, where `contact_emails.status = 'active'` AND `'contact_tracing' = ANY(consent_topics)`.
DNC is excluded implicitly (same mechanism as Decision 2 — DNC collapses `consent_topics` so it can
never contain `contact_tracing`). Unmatched attendance rows (`attendance.contact_id IS NULL`) and
attendees with no email on file produce no row.

**Event selectability and zero-attendee handling (Decision 9)**:

- The event dropdown (`GET /api/events?from=<today − 90 days>`) excludes any event whose attendance
  would already be purged (feature 002, `RETENTION_DAYS = 90`) — such events are never offered.
- For a selectable event, the export endpoint first checks the *raw* attendance count for that event
  (via `listEventAttendance`, feature 002). If that count is 0, no CSV is generated and no
  `MailingListExport` row is written — the response carries only the count for the UI to display as a
  message. If the raw count is > 0, the CSV is generated as above (its row count, after consent
  filtering, may still legitimately be less than the raw attendance count — that is not the same
  "zero" case and does not block generation).

## Relationships

- Contact 1—N ContactEmail (feature 001, existing)
- Contact 1—N Performer via `performers.contact_id` (feature 003, existing)
- Event 1—N Attendance (feature 002, existing) — the source for the contact-tracing export
- MailingListExport → Event (nullable FK, `contact_tracing` rows only)

## Derived / non-persisted

- The CSV body itself (rows, columns) is fully derived at export time; `MailingListExport` persists
  only the audit metadata (who/when/list-or-event/count), never the row contents
  (FR-006/FR-006a/FR-007/SC-003).
- The Jane Austen Ball "most recent year" label is derived live from `event_groups`/`events`
  (`kind = 'jane_austen_ball'`, latest `event_date`'s year) — not stored (Decision 6).
