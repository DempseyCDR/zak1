# Phase 1 Data Model: Contact Load

This feature adds **one** schema change (migration `0033`) and otherwise writes to existing tables via
existing services. The rest of the "model" is the in-memory **load plan** produced from the input files.

## Schema change (migration 0033)

### New enum: `membership_level`

Values: `individual`, `family`, `supporter`, `student` (the levels present in the source workbook).
Mirrored in TS as `membershipLevelEnum` in `src/server/db/schema/enums.ts` and exported as
`MembershipLevel`.

### `memberships.level` (new column)

| Column | Type | Null? | Notes |
|--------|------|-------|-------|
| `level` | `membership_level` | NOT NULL | Supplied by the loader for every row. Existing rows (if any) backfilled to `individual` in the migration, then the column is set `NOT NULL`. |

No other columns change. `memberships` keeps `contact_id (NOT NULL, CASCADE)`, `payer_id (NOT NULL)`,
`expiry_date`, `source_gate_sale_id`, `source_notification_id`.

## Existing tables written (no shape change)

| Table | Operation | Key rules |
|-------|-----------|-----------|
| `contacts` | delete non-retained; insert rebuilt; update retained role-holders in place | `first_name` NOT NULL (derive from email if source nameless); `is_volunteer` from Member `Volunteer`; `needs_review` for ambiguous rows; names via `deriveContactNames`; `pronouns`, `phone` from Member sheet |
| `contact_emails` | insert per loaded email | `email` citext; `consent_topics` from list flags + always `contact_tracing`; `status = active`; `provider_set_date/last_open/last_click` from iContact |
| `role_grants` | read `contact_id` (retention); `UPDATE granted_by = NULL` for deletion targets (FR-021) | retained set = `DISTINCT contact_id` ∪ `merge_audit` parties (FR-018/FR-021) |
| `audit_events` | `UPDATE actor_contact_id = NULL` for deletion targets (FR-021) | nullable RESTRICT ref — nulled so the delete doesn't fail |
| `merge_audit` | **read-only** | `canonical_id`/`merged_id` (NOT NULL) — referenced contacts are retained (FR-021) |
| `payers` | insert per Payer row | `name` = Payer Name; `contact_id` = member whose `dedup_normalized` matches `Payer Name`, else null on no/multiple match (FR-020) |
| `memberships` | insert per member with a payer | `expiry_date` from `Expires`; `level` from `Level`; `contact_id` = member |
| `performers` | update `contact_id` on unambiguous match | exact email or `dedup_normalized`; ambiguous/absent left null |
| `audit` | one row | actor = operator; counts payload (see contract) |

## Retention & cascade (relied upon, not modified)

Deleting a non-retained `contacts` row fires existing FK actions: `contact_emails`, `memberships`
CASCADE (re-supplied); `attendance`, `door` records, `payers.contact_id`, `membership_captures`,
`performers.contact_id` SET NULL (accepted anonymization); `staff_identities`, `staff_sessions` CASCADE
(accepted per FR-018).

**RESTRICT references (would block the delete — handled per FR-021):**

- **Nulled before delete** (nullable): `audit_events.actor_contact_id`, `role_grants.granted_by` — the
  loader runs `UPDATE … SET NULL` on these for every deletion-target contact before the delete, so the
  RESTRICT constraint is satisfied. (`granted_by = NULL` already means "operator CLI".)
- **Retained** (non-nullable, cannot be nulled): `merge_audit.canonical_id`, `merge_audit.merged_id` —
  contacts referenced here are added to the retained set, preserving merge history.

Retained set = `SELECT DISTINCT contact_id FROM role_grants` **∪** `SELECT canonical_id ∪ merged_id
FROM merge_audit`.

## In-memory load plan (transient, not persisted)

Produced by the parse/build stage; consumed by the executor and by dry-run reporting.

```text
IcontactRow      { email, firstName?, lastName?, phone?, providerSetDate?,
                   lastOpen?, lastClick?, flags: { contra, english, openband,
                   specialevents: 1|0; janeAustenBall?: year } }        // zod-validated
MemberRow        { firstName, lastName?, buttonName?, pronouns?, volunteer: bool,
                   payerKey?, email?, phone? }                          // zod-validated
PayerRow         { key, payerName, expires: Date, level: MembershipLevel }// zod-validated

PlannedContact   { dedupKey, names, pronouns?, phone?, isVolunteer, needsReview,
                   emails: PlannedEmail[], membership?: PlannedMembership }
PlannedEmail     { email, consentTopics[], providerDates }
PlannedMembership{ payerKey, expiry, level }

LoadPlan         { retainedContactIds: Set, deletions: count,
                   contacts: PlannedContact[], payers: PlannedPayer[],
                   performerLinks: { auto: [], ambiguous: [], unmatched: [] } }
LoadCounts       { retained, removed, contactsCreated, emailsCreated,
                   membershipsCreated, volunteersSet, needsReview,
                   performerAuto, performerAmbiguous, performerUnmatched }
```

## Validation rules (boundary, via zod)

- `email`: required on iContact rows; valid email shape; lowercased for the citext compare.
- `Expires`: parseable `M/D/YY`; a member whose payer has an unparseable/blank expiry is loaded as a
  contact **without** a membership (reported), not failed.
- `Level`: must be one of the four enum values; unknown value fails validation (surfaced pre-write so the
  operator can fix the file — consistent with the dry-run-first contract).
- Year fields: strip `,` then `parseInt`; non-numeric → JAB topic absent.
- Dates: parse against the explicit per-field format (R10); unparseable provider dates → null (non-fatal).
