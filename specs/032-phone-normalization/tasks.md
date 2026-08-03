---
description: "Task list for feature 032 — phone number normalization (P5-R6)"
---

# Tasks: Phone number normalization (P5-R6)

**Input**: Design documents from `specs/032-phone-normalization/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/
**Tests**: INCLUDED — the constitution (v1.3.0, Principle I) mandates test-first.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no dependency on an incomplete task)
- **[Story]**: US1..US3 (from spec.md)
- Exact file paths included.

## Notes

Two pure helpers in `src/server/domain/contacts/phone.ts` (beside the 012 name normalizer): `normalizePhone`
(US1 — canonical E.164, `+1` default, unparseable → raw, idempotent) and `formatPhone` (US2 — dashed display).
`normalizePhone` is applied at the **three** sites that write `contacts.phone` (contactService create+patch,
attendanceService check-in new-contact, performerService), mirroring `deriveContactNames`. **No schema
change** — a values-only backfill migration `0030` (US3), pinned to `normalizePhone` by a parity test.

⚠️ **Shared files**: `phone.ts` is created in US1 (normalizePhone) and extended in US2 (formatPhone) →
sequential; `tests/unit/phone.test.ts` likewise (US1 then US2). The three write-site edits are distinct files
→ `[P]`.

⚠️ **US2 has no live display consumer today** (phone is captured but shown nowhere) — the deliverable is the
tested `formatPhone`; the P5-R7 dedup page is its first consumer. No page is wired here.

⚠️ **MVP = US1** — canonical storage at every write path (the root-cause fix). US2 adds the display helper;
US3 cleans up existing data.

---

## Phase 1: Setup

- [X] T001 Confirm grounding: `contacts.phone` is nullable `text`, written at **three** sites — `createContact`/`patchContact` (`src/server/domain/contacts/contactService.ts`), the check-in new-contact insert (`src/server/domain/attendance/attendanceService.ts`), and the performer-create insert (`src/server/domain/performers/performerService.ts`); the 012 name normalizer lives in `src/server/domain/contacts/normalize.ts` (pattern to mirror); next migration is `0030` (latest `0029`); no schema change; Zod phone stays optional (never rejects). No live surface displays a phone today (US2 → helper only).

---

## Phase 2: User Story 1 — Canonical storage at every write path (P1) 🥇 MVP

**Goal**: Any input format stores as one canonical value (`+1` default; unparseable → raw), at every
contact-write site.

**Independent Test**: Save the same number in three punctuations → identical stored value; save via the
directory, check-in, and performer paths → each stores canonical.

- [X] T002 [P] [US1] Write `tests/unit/phone.test.ts` for **`normalizePhone`**: `(585) 555-1234` / `585.555.1234` / `5855551234` → `+15855551234`; `1-585-555-1234` → `+15855551234`; `+1 585 555 1234` → `+15855551234`; `+15855551234` → itself (**idempotent**); `+44 20 7946 0958` → `+442079460958`; `555-1234` / `585-555-1234 x89` / `call Mary` → **unchanged (raw)**; empty/whitespace → empty.
- [X] T003 [US1] Create `src/server/domain/contacts/phone.ts` and implement `normalizePhone(raw: string): string` per the rule (trim; keep leading `+` and digits; 10-digit or `+?1`+10 → `+1`+10; existing `+` with ≥ 11 digits → keep; else → original raw). Never throws.
- [X] T004 [US1] In `src/server/domain/contacts/contactService.ts`, apply `normalizePhone` to the phone in **`createContact`** and **`patchContact`** before it is stored.
- [X] T005 [P] [US1] In `src/server/domain/attendance/attendanceService.ts`, apply `normalizePhone` to `input.newContact.phone` before the check-in new-contact insert.
- [X] T006 [P] [US1] In `src/server/domain/performers/performerService.ts`, apply `normalizePhone` to the phone before the performer-create contact insert.
- [X] T007 [US1] Write `tests/integration/contact.phoneNormalize.test.ts` (node, real Postgres): creating a contact with a messy phone via `createContact`, the check-in path, and the performer path each stores the **canonical** value; `patchContact` re-normalizes; an unparseable phone is stored raw.

**Checkpoint**: every write path stores canonical; T002/T007 green.

---

## Phase 3: User Story 2 — Dashed display helper (P1)

**Goal**: A `formatPhone` helper renders canonical phones in a standard dashed form (US), keeps non-US country
codes, and passes raw values through.

**Independent Test**: `formatPhone("+15855551234")` → `585-555-1234`; non-US shows its country code; a raw
value passes through unchanged.

- [X] T008 [US2] Extend `tests/unit/phone.test.ts` with **`formatPhone`** cases: `+15855551234` → `585-555-1234`; `+442079460958` → shown with `+44`; a raw/unparseable stored value → returned as-is; empty → empty. (Same file as T002 → sequential.)
- [X] T009 [US2] In `src/server/domain/contacts/phone.ts`, implement `formatPhone(stored: string): string` (US `NPA-NXX-XXXX`; non-US `+<cc> <national>`; raw/empty passthrough). Never throws. (Same file as T003 → sequential.) **No page is wired** — no surface displays a phone today; `formatPhone` is delivered for P5-R7.

**Checkpoint**: `formatPhone` is delivered and unit-tested; T008 green.

---

## Phase 4: User Story 3 — Clean up existing phones once (P2)

**Goal**: A one-time backfill normalizes existing stored phones (unparseable unchanged), idempotently.

**Independent Test**: Seed mixed-format phones, run the `0030` SQL → every parseable phone canonical, no value
lost, re-running changes nothing.

- [X] T010 [US3] Write `tests/integration/contact.phoneBackfill.test.ts` (node, real Postgres): seed contacts with mixed-format phones inserted **raw**, read + execute `src/server/db/migrations/0030_normalize_contact_phones.sql`, then assert each stored `phone` equals `normalizePhone(input)` (**parity**), unparseable values are **unchanged**, and re-executing the SQL changes nothing (**idempotent**). (Mirrors 027's migration test; fails until the SQL file exists.)
- [X] T011 [US3] Create `src/server/db/migrations/0030_normalize_contact_phones.sql`: a single idempotent `UPDATE contacts SET phone = <CASE …>` mirroring `normalizePhone` (10-digit or `1`+10 → `+1`+10; existing `+…` kept; `ELSE phone` for unparseable); `WHERE phone IS NOT NULL`. No column change.

**Checkpoint**: the directory is consistent; T010 green.

---

## Phase 5: Polish + cross-cutting

- [X] T012 Full gate (solo-maintainer mode): `pnpm run db:migrate` (apply 0030 to dev; snapshot `~/zak1_pre_0030.dump` first); `pnpm exec tsc --noEmit`; `pnpm exec eslint <changed>`; `pnpm exec prettier --check <changed>`; `pnpm test` (full suite green — `resetDb`/`ensureSchema` applies 0030 to the test DB; no schema/API-shape change to regress); `pnpm build`. All green.
- [X] T013 [P] Update `zak1_Phase5_Requirements.md`: mark **P5-R6 SHIPPED as feature 032** (normalize contact phones to canonical E.164 at every write path; `formatPhone` helper ready for R7; backfill migration `0030` → latest migration now `0030`).

---

## Dependencies & execution order

- **Setup (T001)** → the story phases.
- **US1**: T002 (test) → T003 (`normalizePhone`) → T004/T005/T006 (apply at the three write sites) → T007
  (integration). T005/T006 are `[P]` (distinct files); T004 too, but all three are independent of each other.
- **US2**: T008 (test) → T009 (`formatPhone`); both after T003 (same `phone.ts` / same unit-test file).
- **US3**: T010 (test) → T011 (migration SQL); T010 references `normalizePhone` (T003) and the `0030` file.
- **Polish (T012/T013)** last; T012 runs the migration + full gate.
- **Shared files**: `phone.ts` (T003 → T009) and `tests/unit/phone.test.ts` (T002 → T008) sequential.

### Parallelizable

- **T002** [P] (first). **T005/T006** [P] (distinct write-site files). Docs **T013** [P].
- **Not `[P]`**: `phone.ts` (T003/T009) and `phone.test.ts` (T002/T008); the US3 test → migration order.

## Implementation strategy

Ship as **one atomic commit** once T012 is green. Build order: unit-test + implement `normalizePhone`, apply
at the three write sites, integration-test the write paths (US1 = MVP) → unit-test + implement `formatPhone`
(US2) → backfill parity test + the `0030` SQL (US3) → full gate → doc. No schema change, no new dependency;
the only risk is TS/SQL rule divergence, pinned by the parity test.

## Summary

- **Total tasks**: 13 (Setup 1 · US1 6 · US2 2 · US3 2 · Polish 2)
- **Per user story**: US1 = 6 (T002–T007) · US2 = 2 (T008–T009) · US3 = 2 (T010–T011)
- **Test tasks**: T002 (unit normalizePhone), T007 (integration write paths), T008 (unit formatPhone), T010
  (integration backfill parity/idempotency)
- **Parallel opportunities**: T002; T005/T006; docs T013
- **MVP scope**: **US1** — canonical storage at every write path (the root-cause fix). US2 adds the display
  helper (for P5-R7); US3 cleans existing data.
