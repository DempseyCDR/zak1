# Research: Phone number normalization (P5-R6)

No open `NEEDS CLARIFICATION` — P5-R6 pre-resolved Q12/Q13 (canonical E.164, assume `+1`, dashed display,
normalize-on-write + one-time backfill). The "firm at spec" items (extensions, non-US, unparseable) are
resolved below with the decisions the spec records.

## R1 — The normalization rule (kept simple enough for TS and SQL to agree)

**Decision**: `normalizePhone(raw)`:

1. Trim; if empty → empty/null (no phone).
2. Keep only a leading `+` and digits (strip all other characters). Call the result `s`.
3. If `s` (or `s` without a leading `+`) is exactly **10 digits** → `+1` + those 10 digits.
4. Else if it is **11 digits starting with `1`** (optionally a leading `+`) → `+1` + the last 10 digits.
5. Else if `s` starts with `+` and has ≥ 11 total digits → **keep `s`** (already-canonical non-US E.164).
6. Else → **return the ORIGINAL raw input unchanged** (unparseable: wrong length, letters, or an extension).

**Rationale**: Covers the club's real cases (US numbers, the odd non-US) with a rule that is trivially
identical in TS and SQL, so the write path and the backfill can't diverge. Idempotent: a value already of the
form `+1XXXXXXXXXX` or `+<cc>…` re-normalizes to itself (FR-006/SC-004).

**Alternatives considered**: A full phone library (libphonenumber) — rejected (YAGNI; heavyweight for a
single-club US-centric directory). Rejecting bad input — rejected (FR-003: never lose data / never block a
save; keep raw).

## R2 — `formatPhone` (dashed display)

**Decision**: `formatPhone(stored)`:

- `+1` + 10 digits → `NPA-NXX-XXXX` (e.g. `585-555-1234`).
- `+<cc>` + national digits (non-US) → `+<cc> <national digits>` (country code preserved; national part shown
  best-effort, no per-country grouping).
- Anything else (raw/unparseable, or empty) → returned **as-is**.

**Rationale**: FR-005 — readable US dashed form; non-US keeps its country code; raw values pass through
untouched. Per-country grouping is out of scope (best-effort).

**Alternatives considered**: Locale-aware grouping per country — rejected (YAGNI; a country-code prefix is
enough).

## R3 — Where normalization applies (three write sites, one shared function)

**Decision**: Apply `normalizePhone` at the **three** places that write `contacts.phone`:
`contactService.createContact` + `patchContact`, `attendanceService` (check-in new-contact insert), and
`performerService` (performer-create contact insert). This mirrors the existing pattern where
`deriveContactNames` is called at each contact-insert site rather than funneled through one function.

**Rationale**: FR-007 — no route may store a raw phone for a parseable number. The three sites insert contacts
directly (each in its own transaction/shape); calling the shared helper at each is lower-risk than refactoring
all through `createContact`, and matches the name-normalization precedent.

**Alternatives considered**: Refactor all inserts through `createContact` — rejected (riskier; the inserts
carry site-specific fields/transactions). A DB trigger — rejected (logic belongs in the typed domain, testable
and shared with the backfill's expected values).

## R4 — Backfill as SQL, pinned to `normalizePhone` by a parity test

**Decision**: `0030_normalize_contact_phones.sql` is a single idempotent `UPDATE contacts SET phone = <CASE>`
implementing R1's rule; unparseable values are left unchanged (the `ELSE phone`). An **integration test** seeds
a set of mixed-format phones, runs the `0030` SQL, and asserts each stored result equals `normalizePhone(input)`
— pinning the SQL to the TS function (single source of truth for the expected canonical values), the same
discipline feature 027 used for its `0028` migration test.

**Rationale**: Reuses the migration framework (SQL files via `db:migrate`), keeps the write path and backfill
in agreement, and proves idempotency (re-running the UPDATE changes nothing).

**Alternatives considered**: A `tsx` backfill script calling `normalizePhone` directly (one implementation) —
attractive, but the project's one-time data changes are SQL migrations (021/027); staying consistent, with a
parity test guarding divergence, is preferred. Snapshot `~/zak1_pre_0030.dump` before running (project
practice for data migrations).

## R5 — No schema change; matching unchanged

**Decision**: `contacts.phone` stays nullable `text`; only values change. Zod keeps phone optional (never
rejects). Dedup **matching** (`dedup_normalized`, name-based) is untouched; phone **display** on the dedup page
is the separate P5-R7 feature, which will consume `formatPhone`.

**Rationale**: FR-001..007 are about storage + display, not schema or matching. Keeps the blast radius to a
value transform + a helper.

**Alternatives considered**: Add a normalized-phone column for matching — rejected (Q14 deferred matching to
backlog; YAGNI here).
