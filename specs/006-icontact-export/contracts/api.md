# API Contracts: Email List Export (iContact)

Internal HTTP API (Next.js route handlers). Uniform error shape `{ error: { code, message } }`
(matches existing `apiError.ts` convention). No authentication in this build (`actor` is currently
always `null`, same as every other feature).

## List metadata + export history

### GET /api/exports

Returns the 7 configured lists plus each one's most recent export (for the admin page).

- 200 → `{
    items: {
      listId: "contra"|"english"|"openband"|"specialevents"|"janeaustenball"|"performer"|"member",
      filename: string,          // "<listId>.csv"
      kind: "topic" | "derived",
      note: string | null,       // e.g. "Most recent JAB: 2026" for janeaustenball only; else null
      lastExport: { actor: string | null, rowCount: number, createdAt: string } | null
    }[]
  }`

## Generate + download a list

### GET /api/exports/:listId

Generates the CSV for one of the 7 fixed lists on demand and returns it as a file download. Also
inserts one `MailingListExport` audit row and writes the structured (pino) audit log entry.

- 200 → CSV body. `Content-Type: text/csv; charset=utf-8`.
  `Content-Disposition: attachment; filename="<listId>.csv"` (FR-001/SC-002 exact filename match).
  Columns: `email, first_name, last_name` + `membership_status, membership_through_year` (member.csv
  only, FR-004/FR-007).
- 404 `MAILING_LIST_NOT_FOUND` — `:listId` is not one of the 7 configured IDs. (`contact_tracing` is a
  valid `MailingListId` enum value for audit purposes only — it is never passed to this route in
  practice, since the static `contact-tracing` route below takes Next.js routing precedence over the
  `[listId]` dynamic segment for that exact path.)

## Generate a contact-tracing export (separate from the 7 lists)

### GET /api/exports/contact-tracing?eventId=

Generates a CSV of one event's recorded attendees (feature 002) who have an active,
`contact_tracing`-consented email. On success, inserts one `MailingListExport` audit row (`list_id =
'contact_tracing'`, `event_id` set) and writes the structured audit log entry.

- 200 → CSV body, when the event has ≥1 raw recorded attendee. `Content-Type: text/csv;
  charset=utf-8`. `Content-Disposition: attachment; filename="contact_tracing_<event_date>.csv"`.
  Columns: `email, first_name, last_name, date` (FR-006/FR-006a). `date` is the selected event's
  `event_date`, constant across every row.
- 200 → `{ count: 0 }` (JSON, not a file), when the event has zero raw recorded attendees (FR-006c).
  No audit row is written in this case — nothing was exported.
- 404 `EVENT_NOT_FOUND` — `eventId` missing or unknown (reuses the existing error code from feature 002).

The event dropdown is populated from the existing `GET /api/events?from=<today − 90 days>` (feature
002's `listEvents(db, from, to)` already supports the `from` filter) so events whose attendance has
been purged are never offered (FR-006b) — no new endpoint needed for that.

## Enums

- `MailingListId`: `contra | english | openband | specialevents | janeaustenball | performer | member |
  contact_tracing` (the last value is audit-only, per above)

## Error codes

`MAILING_LIST_NOT_FOUND` (404) · `EVENT_NOT_FOUND` (404)

## Notes

- No POST/body endpoints in this feature — all three routes are GET (metadata read, generate-and-
  download for the 7 lists, generate-and-download for contact tracing). Nothing is client-configurable
  beyond which list or event to export.
- Export generation is on-demand only; no scheduled job (spec `Assumptions`, clarify Q2).
- `email`, `first_name`, `last_name`, `membership_status`, and the contact-tracing export's `date` are
  all computed at request time and never stored; only the audit metadata (`MailingListExport`)
  persists (FR-006/FR-006a/FR-007/SC-003).
