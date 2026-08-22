# Phase 0 Research: Contact Load

All Technical Context unknowns are resolved below. Format per decision: **Decision / Rationale /
Alternatives**.

## R1. Input file format — how to read the iContact export and the membership workbook

**Decision**: Consume **CSV for every source**. The iContact export is already CSV. The workbook's two
authoritative sheets (**Member**, **Payer**) are exported to CSV by the operator (LibreOffice/Excel
"Save As → CSV", one file per sheet) before running the load. The tool takes three file paths:
`--icontact`, `--members`, `--payers`. Parse with **`csv-parse`** (`csv-parse/sync`), `columns: true`,
`bom: true`, `trim: true`.

**Rationale**: Avoids adding a spreadsheet-parsing runtime dependency (SheetJS/`xlsx`) for a one-time
tool — YAGNI (constitution §II). A uniform CSV pipeline means one parser, one validation strategy, and
trivially fixture-able unit tests. The `Button Report` and `iContact Report` sheets are derived views
and are never read, so only two sheet exports are asked of the operator. `csv-parse` is the de-facto
Node CSV library and correctly handles the quoted commas present in the real data (`"140 Fernboro Rd"`,
`"Hilary & Ed"`, `"Van de Mortel"`).

**Alternatives considered**:

- **SheetJS (`xlsx`) reading `.ods` directly** — removes the operator's export step, but adds a large
  read-only dependency with a weaker npm security story, for a tool that runs a handful of times.
  Rejected on YAGNI; revisit only if per-run CSV export proves burdensome.
- **Hand-rolled CSV split** — rejected: the real data has quoted fields containing commas and `&`;
  naive splitting corrupts addresses and combined names.

## R2. Column mapping (locked from the real header row)

**Decision**: iContact header is
`email, fname, lname, prefix, suffix, fax, phone, business, address1, address2, city, state, zip,
setdate, contra, english, eventregistration, janeaustenball, memberthrough, openband, performer,
specialevents, userid, ic:lastopendate, ic:lastclickdate`.

Consume: `email → contact_emails.email`; `fname/lname → first_name/last_name`; `phone → contacts.phone`
(via `normalizePhone`); `setdate → provider_set_date`; `ic:lastopendate/ic:lastclickdate →
provider_last_open/provider_last_click`; list flags `contra/english/openband/specialevents` and
`janeaustenball → consent_topics`. Discard `prefix, suffix, fax, business, address1/2, city, state, zip,
eventregistration, memberthrough, performer, userid`.

Member sheet header: `ID, First Name, Last Name, Button Name, Pronouns, Volunteer, Payer, Email, Phone,
Nametag, iContact`. Consume `First/Last Name, Pronouns, Volunteer, Payer (group key), Email, Phone`.
Payer sheet header: `ID, Payer Name, Date, Expires, Level, Amount, Method`. Consume `ID (group key),
Payer Name, Expires, Level`. Discard `Date, Amount, Method`.

**Rationale**: Matches the operator's stated policy ("consume only what maps to our schema; ignore the
rest"). `provider_*` fields already exist on `contact_emails`, so engagement data is retained for free.

**Alternatives**: Storing address/`memberthrough` — rejected (no schema home; `memberthrough` is
superseded by the Payer sheet as the authoritative membership source).

## R3. Consent flag semantics

**Decision**: For `contra/english/openband/specialevents`: value `1` → topic present; **blank and `-1`
are identical → topic absent** (per operator correction). `janeaustenball` non-empty (a year, possibly
with a stray thousands comma) → `jane_austen_ball` topic present. **Every** loaded email additionally
gets `contact_tracing` unconditionally. No `do_not_contact` is produced (no source column). Imported
emails default to `status = active` (the export carries no per-email active/bounce column).

**Rationale**: Direct from clarified FR-005/006/007. `contact_tracing` is also the schema default, so the
mapping only ever *adds* topics. `email_consent_topic` enum already contains every needed value.

**Alternatives**: Treating `-1` as an unsubscribe / `status=inactive` — rejected per operator: `-1` == blank.

## R4. Identity resolution & dedup

**Decision**: Join iContact ↔ Member by **email** (citext, case-insensitive). When a person appears on
multiple iContact rows under different emails, collapse rows sharing the **`dedup_normalized`** key
(from `deriveContactNames`) into one contact with multiple `contact_emails`. When a person is in both
files, **Member sheet wins** for `first_name/last_name/pronouns/phone`; iContact contributes emails +
consent. Compute `display_name/name_normalized/dedup_normalized` via the existing
`deriveContactNames`; Member `Button Name` seeds `display_name_override` when it differs from
"First Last".

**Rationale**: Reuses the app's canonical name-normalization and dedup key (constitution §II — no new
matching abstraction), keeping load-time merging consistent with the in-app dedup/merge behavior
(`domain/dedup`). Email as the primary join is unambiguous; the name key is the fallback only for the
multi-email-same-person case.

**Alternatives**: name+phone dedup (rejected in clarify Q2 — misses phone-less rows); no auto-merge
(rejected — produces duplicate contacts for one person).

## R5. Retention & hard reset (atomicity + FK blast radius)

**Decision**: Retained set = `SELECT DISTINCT contact_id FROM role_grants` (explicit grants only, per
FR-018) **∪** contacts referenced by `merge_audit.canonical_id`/`merged_id` (FR-021 — those refs are NOT
NULL and RESTRICT, so their targets cannot be deleted or nulled and must be protected). In one
transaction: (1) reconcile — role-holders that also appear in the files are **updated in place** (matched
by email), never duplicated; (2) **null the nullable RESTRICT refs** that would otherwise block the
delete — `UPDATE audit_events SET actor_contact_id = NULL` and `UPDATE role_grants SET granted_by = NULL`
for the deletion-target contacts (FR-021); (3) `DELETE` all non-retained contacts. Existing FK behavior
does the rest: `contact_emails` + `memberships` CASCADE-delete (both re-supplied);
`attendance/door/payers/membership_captures/performers.contact_id` SET NULL (accepted anonymization);
`staff_identities/staff_sessions` CASCADE (accepted per FR-018). Then insert the rebuilt roster,
memberships, and volunteer flags; propose performer links. Wrap everything in a single
`db.transaction(...)`; any throw rolls back to the pre-run state (FR-015).

**Why null vs retain differs by column**: `audit_events.actor_contact_id` and `role_grants.granted_by`
are nullable, so nulling them satisfies RESTRICT while purging the contact (attribution anonymized,
matching the attendance/door SET-NULL treatment; `granted_by = NULL` already denotes "operator CLI").
`merge_audit.canonical_id`/`merged_id` are NOT NULL, so nulling is impossible — the only options are
deleting merge history (unacceptable) or retaining the referenced contacts; we retain them.

**Rationale**: The schema's existing `onDelete` rules already encode the intended blast radius; the plan
leans on them rather than re-implementing cascade logic. A single Drizzle transaction gives all-or-nothing
for free.

**Alternatives**: `TRUNCATE` — rejected (can't exclude role-holders, and fires no row-level FK actions).
Soft-delete/deactivate non-role contacts — rejected: the operator chose a hard reset.

## R6. Backup before a destructive run

**Decision**: In a real (non-dry-run) run, shell out to **`pg_dump`** (custom format) to a
timestamped file under a git-ignored `tmp/` path **before** opening the write transaction; abort the run
if the dump fails. The connection string comes from the same env the app/`db:migrate` use (`loadEnv`).
Dry-run performs no backup and no writes.

**Rationale**: `pg_dump` is the standard, already implied by the demo-DB snapshot recipe in project
memory. Backing up before the transaction (not inside it) means a recoverable snapshot exists even if
the process is killed mid-run.

**Alternatives**: In-DB `CREATE TABLE … AS` snapshots of affected tables — rejected: partial, and no
protection if the DB itself is lost. Relying only on transaction rollback — rejected: rollback protects
against in-run errors, not operator mistake discovered after commit.

## R7. Memberships, level, and payer→contact link

**Decision**: Add migration `0033`: `membership_level` pgEnum `(individual, family, supporter, student)`
plus a `memberships.level` column (NOT NULL once backfilled; the loader always supplies it). Each Payer row →
`createPayer`; each Member with a `Payer` group key → `createMembership` carrying the payer's `Expires`
date and `Level`. `Expires` parsed as `M/D/YY` → `date`. Payer→contact link: link the payer to the
**paying member** of its group (FR-020) — the Member row whose `dedup_normalized` matches the Payer sheet
`Payer Name`; leave null when no member, or more than one, matches. After load, `refreshAllStatuses` recomputes
`membership_status` for all contacts.

**Rationale**: Reuses `membershipService` (`createPayer`/`createMembership`/`refreshAllStatuses`) so the
status-recompute and payer semantics stay identical to in-app flows. `level` is a small additive enum;
placing it on `memberships` (per-person) matches how status is read per contact.

**Alternatives**: `level` on `payers` — rejected: status/level is read per member, and a family payer's
members should each carry the level on their own membership row. Capturing Amount/Method — rejected
(operator dropped them; no reader).

## R8. Volunteer eligibility

**Decision**: `Member.Volunteer` affirmative (`Yes`) → `contacts.is_volunteer = true` on the loaded
contact. No role grants are created. Members with no email still get the flag but remain unable to sign
in (no matching login email) — expected, not an error.

**Rationale**: Direct from the operator's decision. `is_volunteer` is necessary-but-not-sufficient for
login (feature 015): sign-in also requires a Google-verified email matching an active address, so the
flag alone grants no access until the person signs in.

**Alternatives**: Also setting `volunteer_approved_at` — rejected: that is the annual Presidential-review
field (advisory, off the session path); a bulk load must not fabricate a governance approval.

## R9. Performer matching

**Decision**: After the roster exists, for each `performers` row with a null `contact_id`, match by
**exact email** then exact **`dedup_normalized`** name. Exactly one match → propose as an auto-link
(applied within the run). Zero or multiple matches → leave unlinked and list in the audit summary for
human resolution. No fuzzy matching.

**Rationale**: Exact-only auto-linking avoids mis-attributing bookings/payments on common names (FR-012).
Reuses the same dedup name key as R4.

**Alternatives**: Fuzzy/similarity auto-linking — rejected (clarify/spec: ambiguous matches must be
human-confirmed).

## R10. Edge-case handling (parsers)

**Decision**: Nameless iContact row → derive `first_name` from the email local-part and set
`needs_review = true`. Combined row (`"Hilary & Ed"`) → single contact, `needs_review = true`, no split.
Two date formats parsed explicitly: `setdate` = `YYYY-MM-DD HH:MM:SS`; `ic:last*` = `M-D-YYYY H:MM:SS`;
Payer `Expires` = `M/D/YY`. Year fields strip thousands commas before `parseInt`. Member with empty
Email → contact with zero `contact_emails`.

**Rationale**: Encodes the spec's Edge Cases as deterministic parser rules with unit-test coverage;
`needs_review` is the existing signal for "a human should look at this".

**Alternatives**: Auto-splitting combined records — rejected (guessing two people from one row is unsafe;
flag instead).
