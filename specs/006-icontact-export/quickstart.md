# Quickstart & Validation: Email List Export (iContact)

End-to-end validation guide. Implementation details live in `tasks.md`. Builds on features 001
(contacts/emails/membership) and 003 (performers).

## Prerequisites

- Features 001–005 applied; Postgres running
- `pnpm install`; `.env` with `DATABASE_URL` / `TEST_DATABASE_URL`

## Setup

```bash
pnpm db:migrate     # applies 0011_icontact_export.sql (mailing_list_exports + mailing_list_id enum)
pnpm db:seed        # optional; seeds sample contacts/emails/consent topics for manual testing
```

## Run

```bash
pnpm dev
# /exports                 — admin page: 7 lists + last-exported info + per-list download link,
#                            plus a separate contact-tracing section (event dropdown + download)
```

## Validation scenarios

Map to acceptance scenarios in [spec.md](spec.md); contracts in [contracts/api.md](contracts/api.md).

1. **Seven exact filenames** (US1): `GET /api/exports/contra` (and the other 6) returns
   `Content-Disposition: attachment; filename="contra.csv"` etc., matching FR-001/SC-002 exactly.
2. **Consent gates inclusion** (US1): an email without the matching consent topic is absent from that
   list's CSV; an email with "Do Not Contact" is absent from every list, including member/performer
   (FR-002/FR-002a).
3. **Inactive/transition excluded** (US1): emails with `status = 'transition'` or `'inactive'` never
   appear in any export (FR-003).
4. **member.csv segmentation** (US1): `membership_status` column present and matches the Contacts
   feature's classification 1:1 for every row (FR-004/SC-004); qualification reuses `contacts.
   list_member` (current/lapsed/long_lapsed all qualify, `never` excluded).
5. **Multiple emails per contact** (edge case): a contact with two qualifying emails on the same list
   produces two rows, not one (Decision 5).
6. **Membership "through" year never stored** (US2): the membership "through" year appears in
   member.csv but nowhere in the database — confirm no such column exists outside the response
   (FR-007/SC-003).
7. **Export audit** (FR-009): after a download, `GET /api/exports` shows an updated `lastExport`
   (actor, rowCount, createdAt) for that list; a row exists in `mailing_list_exports`.
8. **On-demand only** (Assumptions): no scheduled job exists; a CSV only regenerates when
   `GET /api/exports/:listId` (or the contact-tracing endpoint) is called.
9. **Unknown list** (edge): `GET /api/exports/not-a-list` → 404 `MAILING_LIST_NOT_FOUND`.
10. **Contact-tracing export scoped to one event** (US3): record attendance for an event, including
    one attendee with a `contact_tracing`-consented email and one with "Do Not Contact"; `GET
    /api/exports/contact-tracing?eventId=<id>` returns only the consented attendee, with a `date`
    column equal to that event's `event_date` (FR-006/FR-006a/SC-005).
11. **Purged events excluded from the dropdown** (US3, edge case): for an event older than 90 days
    (attendance purged per feature 002), confirm it does not appear in `GET
    /api/events?from=<today−90d>` and so is never offered for selection (FR-006b).
12. **Zero-attendee event produces a message, not a file** (US3, edge case): for a selectable event
    with no recorded attendance, `GET /api/exports/contact-tracing?eventId=<id>` returns `{ count: 0 }`
    (not a CSV), and no row is added to `mailing_list_exports` (FR-006c).
13. **Unknown event** (edge): `GET /api/exports/contact-tracing?eventId=<bad-id>` → 404
    `EVENT_NOT_FOUND`.

## Test commands

```bash
pnpm test:unit          # CSV escaping (toCsvField/rowsToCsv), displayName → first/last split (pure)
pnpm test:integration   # per-list + contact-tracing qualification queries, export audit — real Postgres
pnpm typecheck && pnpm lint
```

Expected: all green; every list's filename matches FR-001 exactly; DNC and inactive/transition emails
never appear in any export (including contact tracing); computed-only fields never persisted; purged
events never appear in the contact-tracing dropdown; a selectable zero-attendee event yields a count
message, not a file.
