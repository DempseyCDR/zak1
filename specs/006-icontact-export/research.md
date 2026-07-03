# Phase 0 Research: Email List Export (iContact)

Stack fixed by build 1 (TS/Next.js + Postgres). `/speckit-clarify` resolved delivery mechanism,
trigger mechanism, audit persistence, and common CSV columns (see spec.md `## Clarifications`).
The items below resolve the remaining technical unknowns needed before data-model/contracts.

## Decision 1 — CSV serialization: hand-rolled, no new dependency

- **Decision**: Write a small pure `toCsvField`/`rowsToCsv` helper (RFC 4180-style: quote a field
  containing a comma, quote, or newline; double internal quotes). No CSV library dependency.
- **Rationale**: Simplicity/YAGNI — at most ~5 columns per list, escaping is ~10 lines. Matches this
  project's existing pattern of hand-rolled domain helpers (e.g. `money.ts`) over pulling in
  dependencies for small, stable logic.
- **Alternatives considered**: `csv-stringify` or similar — unnecessary weight for this scope.

## Decision 2 — List qualification, by list kind

- **Decision**: Two query shapes, not seven bespoke ones:
  - **Topic lists** (contra, english, openband, specialevents, janeaustenball): one row per
    `contact_emails` row where `status = 'active'` and the list's consent topic is present in
    `consent_topics`.
  - **Derived lists** (member, performer): one row per `contact_emails` row where `status = 'active'`,
    joined to the qualifying condition (`contacts.list_member = true` for member;
    `EXISTS (SELECT 1 FROM performers WHERE performers.contact_id = contacts.id)` for performer), with
    an explicit `NOT ('do_not_contact' = ANY(consent_topics))` filter.
- **Rationale**: `effectiveConsentTopics` (feature 001, `emailService.ts`) already collapses an email's
  `consent_topics` to exactly `['do_not_contact']` when DNC is set, so topic-list queries exclude DNC
  emails "for free" (they can't match a content topic once collapsed). Derived lists don't filter by
  topic at all, so they need the DNC exclusion spelled out explicitly (FR-002a). This asymmetry is real
  and must be covered by an integration test per list kind, not assumed away.
- **Alternatives considered**: One generic query parameterized by topic-or-derived-flag — rejected;
  the derived-list DNC check is easy to silently omit if hidden inside one over-generalized function.

## Decision 3 — "Member" qualification reuses the existing `listMember` flag

- **Decision**: A contact qualifies for member.csv iff `contacts.list_member = true`. No new
  qualification logic.
- **Rationale**: Feature 001 (`membership/classify.ts`) already computes and persists exactly this:
  `isListMember(status) = status !== 'never'` (i.e. current, lapsed, and long_lapsed all qualify),
  recomputed on every membership change and by the nightly job. Reusing it means member.csv segments
  identically to how membership status already works everywhere else in the app (Constitution:
  simplicity, single source of truth) — this also directly satisfies SC-004.
- **Alternatives considered**: Recompute membership status inline at export time — redundant with the
  already-materialized field; risks drift between the export and the rest of the app.

## Decision 4 — "Performer" qualification: any contact linked to a performer row

- **Decision**: A contact qualifies for performer.csv iff at least one `performers` row references it
  (`performers.contact_id = contacts.id`), regardless of performer type or how the contact was created
  (`source` is irrelevant here — a performer's contact may have been created via feature 003's
  auto-create, or reused from an existing contact).
- **Rationale**: Simplest reading of "performer-role qualification" (FR-001a); no other role/type
  distinction is mentioned in the spec.

## Decision 5 — Multiple emails: one row per qualifying email, no primary-email selection

- **Decision**: All 7 lists export one row per qualifying `contact_emails` row, never one row per
  contact. A contact with two qualifying emails produces two rows.
- **Rationale**: The spec's edge case ("a contact with multiple emails carrying differing consent
  topics must export per-email, not via a single contact-level flag") is written against topic lists,
  but the same reasoning applies uniformly: this build has no primary-email concept yet
  (BACKLOG B3, deferred), so there is no principled way to pick "the one" email for derived lists
  either. Exporting per-email is consistent and requires no new concept.
- **Alternatives considered**: Pick the most-recently-created email as "primary" — invents an ordering
  rule the product hasn't asked for; defer to B3 instead.

## Decision 6 — Jane Austen Ball "year" is informational, not a filter or column

- **Decision**: FR-005 ("scope the Jane Austen Ball list to the year of the most recent JAB") is
  satisfied by deriving a display label only — the year of the most recent `events` row whose
  `group_id` points to an `event_groups` row with `kind = 'jane_austen_ball'` — shown next to the
  download link on the admin export page (e.g. "Jane Austen Ball (most recent: 2026)"). It does not
  filter which contacts qualify (qualification is the ordinary opt-in `jane_austen_ball` consent topic,
  per FR-001a) and is not an extra CSV column (FR-004 reserves `membership_status` specifically for
  member.csv; no other list gets an extra column per the spec).
- **Rationale**: `event_groups.kind` already has a `jane_austen_ball` value (feature 002); this is the
  only per-year signal for JAB in the data model, and content-list qualification is explicitly topic-
  based, not attendance/date-based (FR-001a). Treating "year" as a label avoids inventing new filtering
  or storage the spec doesn't otherwise ask for.
- **Alternatives considered**: Filter janeaustenball.csv to only contacts who attended/registered for
  the most recent JAB event — contradicts FR-001a's explicit classification of this list as opt-in-
  topic-driven, not attendance-driven.

## Decision 7 — Contact tracing is a separate, event-scoped export, not a column on the 7 lists

- **Decision** (supersedes an earlier, incorrect draft of this decision): Contact tracing is its own
  export, distinct from the seven fixed mailing lists (FR-001) and not a column added to them
  (corrected per user feedback during plan review). The admin selects one event (by date) from a
  dropdown (reusing the existing `GET /api/events`, feature 002); the system generates a CSV of that
  event's recorded attendees (`attendance` table / `listEventAttendance`, feature 002, FR-001b) who
  have an active email carrying the `contact_tracing` consent topic. Every row carries `email,
  first_name, last_name` (same derivation as the 7 lists) plus a `date` column set to that event's
  `event_date` (constant across the export, since it's scoped to one event). Nothing is persisted
  except the audit record (FR-006/FR-006a).
- **Rationale**: `contact_tracing` is a real, first-class value in `email_consent_topic` — and notably
  the *default* topic assigned to a new email when none is explicitly chosen (both the `contact_emails`
  schema default and the Contacts/Check-in UI default are `['contact_tracing']`), reflecting a
  deliberate default-in-for-safety design already built into feature 001. Feature 002 already computes
  the exact underlying data (`listEventAttendance`, FR-001b) but exposes it only as a bare JSON endpoint
  with no email, CSV, or UI — 006 is where this gets a real admin-facing export. Scoping by event (not
  "everyone who's ever consented to contact_tracing, unscoped") matches the actual use case: notify
  people physically present on a specific date, not the whole consenting population.
- **Qualification detail**: same DNC-safe-for-free property as the other topic lists (Decision 2) —
  `effectiveConsentTopics` collapses an email's `consent_topics` to exactly `['do_not_contact']` when
  DNC is set, so a DNC'd attendee's email can never match `contact_tracing` either. `email_status`
  must be `'active'` (FR-003, same as every other list). An attendee with no email at all (allowed since
  email became optional this build) or an "unmatched" attendance placeholder produces no row.
- **Filename**: not one of FR-001's 7 fixed names; parameterized as `contact_tracing_<event_date>.csv`
  (e.g. `contact_tracing_2026-06-18.csv`).
- **Audit**: reuses the same `mailing_list_exports` table (Decision 8) rather than a second table —
  add a nullable `event_id` column, populated only for the contact-tracing row.
- **Alternatives considered** (from the corrected earlier draft): a universal per-row boolean column
  across all 7 lists — wrong, doesn't match "attendees of a particular dance." An 8th list scoped to
  the whole consenting population like the other 5 topic lists — wrong, ignores the event-scoping the
  actual use case requires.

## Decision 8 — Audit persistence: one row per (list, run), not one row per multi-list batch

- **Decision**: `mailing_list_exports` gets one row per individual list download (matches FR-010's
  per-list, on-demand download model from clarify) — not one row summarizing "all 7 lists at once".
- **Rationale**: Each list is downloaded independently (clarify Q1); a per-list audit row is the natural
  granularity and directly supports an admin-visible "last exported" per list (clarify Q3).

## Decision 9 — Contact-tracing dropdown excludes purged events; zero-attendee events short-circuit

- **Decision** (from user feedback during plan review): The event dropdown for the contact-tracing
  export is populated via the existing `GET /api/events?from=<today − 90 days>` (feature 002's
  `listEvents(db, from, to)` already supports the `from` filter — no new endpoint) so an event whose
  attendance would have been purged is never offered for selection. Separately, when a *selectable*
  (not-purged) event has zero recorded attendees, the export endpoint MUST NOT generate a CSV; it
  returns the attendee count instead, and the UI shows a message rather than downloading a file.
- **Rationale**: These are two different situations that must not be conflated. "Purged" (feature 002,
  `retentionService.ts`, `RETENTION_DAYS = 90`, keyed off `attendance.created_at`) means the data used
  to *ever* exist and is now gone by design — offering that event would produce a silently-empty,
  misleading result. "Zero recorded attendees" on a recent, selectable event is a normal state (event
  hasn't happened yet, or check-in wasn't used) and deserves an explicit, honest message with the
  count rather than a pointless empty-file download. The 90-day cutoff is a date-based proxy
  (`events.event_date >= today − 90 days`), not an attendance-row-existence check — an existence check
  would incorrectly hide *both* kinds of zero-attendee events from the dropdown, which is exactly the
  distinction being drawn here.
- **Consequence for audit**: since no CSV is produced in the zero-count case, no `MailingListExport`
  row is written either — there is nothing to audit (Decision 8's "one row per list-or-event download"
  only applies when a download actually happens).
- **Alternatives considered**: Filtering the dropdown by "does this event currently have any attendance
  rows" — rejected, conflates "purged" with "genuinely zero attendees," which the product explicitly
  wants distinguished. Always generating an (possibly empty) CSV — rejected per explicit correction;
  the admin should see a count-message instead of a header-only file.

**Output**: research complete; no NEEDS CLARIFICATION remain. Ready for data-model and contracts.
