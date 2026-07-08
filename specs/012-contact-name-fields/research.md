# Phase 0 Research: Contact Name Fields

No open **NEEDS CLARIFICATION** — the spec (with its two 2026-07-08 clarifications) settles behavior.
This records the design decisions the retrofit requires.

## Decision 1 — Keep `display_name` as a maintained, materialized effective display name

**Decision**: Do **not** drop `display_name`. Repurpose it to always hold the **effective display name**
= `display_name_override` (when non-blank) else trimmed `first_name + " " + last_name`. It is recomputed
on every contact create/edit. `display_name_override` is a separate nullable column holding the raw
override.

**Rationale**: Many readers already consume `contacts.display_name` (organizer/treasurer reports,
bookings, exports, check-in member buttons, search results, dedup output). Materializing the effective
value into the existing column leaves all of them untouched (FR-008/FR-010) and mirrors how the codebase
already stores a derived `name_normalized`. Computing the effective name at every read site would be far
more churn for no benefit at single-club scale.

**Alternatives considered**: Drop `display_name`, store only the override, compute effective everywhere
(rejected — touches every reader); a DB generated column (rejected — the override precedence + trim is
easy to maintain in the one write helper, and generated columns can't reference a nullable override
cleanly across all readers/tests).

## Decision 2 — Separate dedup key (`dedup_normalized`) from the search key (`name_normalized`)

**Decision**: Add `dedup_normalized` = `normalizeName(trim(first + " " + last))` (the first name alone
when last is blank), with its own `gin_trgm_ops` index. **Dedup** (`suggestionService`) runs pg_trgm
similarity on `dedup_normalized`. **Search** (`searchContacts`) keeps running on `name_normalized`
(= `normalizeName(effective display name)`), unchanged.

**Rationale**: The clarification requires dedup to be override-immune (match true first+last) while
search stays "find by what's shown." These are two different normalized strings, so they need two keys.
A stored column + GIN index matches the existing `name_normalized` pattern and keeps the similarity query
index-backed.

**Alternatives considered**: One shared key (rejected — can't be both override-immune and display-based);
an expression index on `normalize(first||' '||last)` (rejected — a stored column is consistent with the
existing design and simpler for the service to maintain).

## Decision 3 — `first_name` required, `last_name` nullable; effective display trims

**Decision**: `first_name` is `NOT NULL`; `last_name` is nullable. The effective display name is
`trim(first_name || ' ' || coalesce(last_name,''))` (so a blank last name yields just the first name,
no trailing space). Validation requires `firstName`, treats `lastName`/`displayNameOverride`/`pronouns`
as optional.

**Rationale**: Directly encodes FR-001 (some dancers decline a last name). Trimming keeps the display
clean for single-name contacts, mononyms, and organizational contacts (which enter their name as the
first name with a blank last).

## Decision 4 — Migration preserves existing dev/seed rows (no production backfill)

**Decision**: In `0017`, add the columns nullable, then backfill existing rows with
`first_name = display_name`, `last_name = NULL`, `dedup_normalized = name_normalized`; then set
`first_name` and `dedup_normalized` `NOT NULL` and create the trigram GIN index on `dedup_normalized`.

**Rationale**: Production loads fresh at go-live, so this only touches seed/dev rows. Putting the whole
existing display name into `first_name` (last blank) makes the effective display name, search, and dedup
outcomes **byte-identical** to before (effective = trim(display_name); dedup key = the same normalized
string), satisfying "no regression" without a fragile name-splitting heuristic. The seed is rewritten to
set proper first/last (Polish task).

**Alternatives considered**: Split `display_name` into first/last during migration (rejected — a
heuristic that's wrong for mononyms/multi-word last names, and unnecessary since prod is fresh).

## Decision 5 — Mailing-list export reads the real first/last columns

**Decision**: The export selects `contacts.first_name` / `contacts.last_name` and emits them as the
First/Last columns directly; delete `splitDisplayName`.

**Rationale**: FR-009 — the current export *derives* first/last by splitting the display name, which is
unreliable (mononyms, multi-word last names, overrides). Structured columns make it correct. Blank last
name → blank Last Name cell.

## Decision 6 — Check-in inline new-contact takes the entered name as the first name

**Decision**: The door "add unmatched attendee" flow (`attendanceService`) currently creates a contact
from a single entered name; it now stores that as `first_name` (last blank), and the derive helper fills
`display_name`/normalized keys. The check-in roster query gains `ORDER BY last_name, first_name` for the
sort-by-name requirement.

**Rationale**: The door flow captures a name quickly; treating it as the first name (last optional)
matches FR-001 and needs no new door UI. Full first/last capture at the door is out of scope.

## Non-functional posture

Performance/scale/security/observability inherited and unaffected. Two trigram GIN indexes
(`name_normalized`, `dedup_normalized`) at single-club scale. Integration tests run against real Postgres
per the no-mock rule.
