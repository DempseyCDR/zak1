# Tasks: Fix Contact Search (searchContacts)

**Feature**: 061-fix-contact-search | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Scope**: rewrite the matching in one domain function (`searchContacts`), adapt its 2 API callers to the
new `{ items, truncated }` shape, add a truncation indicator on the door + contacts surfaces. **No schema
/ migration.** **Test-First** (real-Postgres integration). The stories grow one shared query — so their
impl tasks touch the same function and run sequentially.

⚠️ **Email is PREFIX-only** (index-backed); infix email is out of scope. **Keep the 300ms-p95-@-1,300
perf test green.**

---

## Phase 1: Setup

- [X] T001 Establish a green baseline: `pnpm vitest run tests/integration/contacts.search.test.ts tests/integration/door.checkin-search.test.ts tests/integration/authz.pii.test.ts && pnpm tsc --noEmit` — all pass before any change ("cat"→Catherine failing is the target, not yet asserted).

## Phase 2: Foundational

None — the change is one function; no shared prerequisite beyond Setup. Proceed to the stories.

## Phase 3: User Story 1 — Predictable incremental search (Priority: P1) 🎯 MVP

**Goal**: substring/prefix matching on the name, monotonic narrowing, and the `{ items, truncated }` shape.

**Independent test**: "cat" → "Catherine …"; `cath` ⊇ `cathe` ⊇ `cather`; `truncated` true past the cap.

- [X] T002 [US1] In `tests/integration/contacts.search.test.ts`, migrate existing assertions to the new `{ items, truncated }` shape and add failing cases: "cat" returns "Catherine …" (C1); the `cath`→`cathe`→`cather` results are each a subset of the previous (C2); `truncated` is `true` when matches exceed `limit` (C7). Run; watch fail.
- [X] T003 [US1] Rewrite `searchContacts` in `src/server/domain/contacts/contactService.ts`: primary match `name_normalized ILIKE '%'||needle||'%'` (non-merged), prefix-first ordering, query `limit + 1` → return `{ items, truncated }`. Keep the empty-`q` browse, now in the same shape. Make T002's C1/C2/C7 pass. (depends: T002)
- [X] T004 [US1] Update the callers to the new shape: `src/app/api/contacts/route.ts` GET → `{ items, truncated }`; `src/app/api/attendance/search/route.ts` → include `truncated`, **preserving** PII gating + `recordPiiDisclosure` over `items`. Confirm `door.checkin-search.test.ts` stays green (additive). (depends: T003)

**Checkpoint**: US1 MVP — the headline "cat"/monotonic defect is fixed; results are truncation-aware.

## Phase 4: User Story 2 — Find by name or email (Priority: P2)

**Goal**: match `name_normalized` ∪ `dedup_normalized` ∪ active-email prefix.

**Independent test**: a display-overridden contact is found by real first/last; any contact by an email prefix.

- [X] T005 [US2] In `tests/integration/contacts.search.test.ts`, add failing cases: a contact with a display-name override is found by real first name and by last name (via `dedup_normalized`, C3); a contact is found by a prefix of one of its active emails (C4). Run; watch fail.
- [X] T006 [US2] Extend `searchContacts` (`contactService.ts`) primary WHERE with `OR dedup_normalized ILIKE '%'||needle||'%'` and `OR EXISTS (active/transition email WHERE lower(trim(email)) LIKE needle||'%')`. Make T005 pass; monotonicity (C2) still holds (union of substring subsets). (depends: T003, T005)

**Checkpoint**: US2 — search finds people by real name and email, not just the display name.

## Phase 5: User Story 3 — Typo fallback & truncation indicator (Priority: P3)

**Goal**: thin-results fuzzy fallback (secondary), and the visible truncation indicator.

**Independent test**: with sparse exact matches a close spelling variant appears **last**; a capped list shows "more matches — refine".

- [X] T007 [US3] In `tests/integration/contacts.search.test.ts`, add a failing case: with few exact matches for "Catherine", "Katherine" appears in `items` ranked **below** the exact match (C5); and it does **not** appear when exact matches are plentiful. Run; watch fail.
- [X] T008 [US3] In `searchContacts` (`contactService.ts`), when the primary result count is `< FUZZY_FLOOR` (small, e.g. 5), append trigram matches (`name_normalized % needle`) not already in the primary set, ranked after it. Make T007 pass; primary monotonicity unaffected. (depends: T006, T007)
- [X] T009 [P] [US3] Add the truncation indicator UI: `src/app/(admin)/contacts/page.tsx` (on the `TriageList`) and the door check-in results (`src/app/(door)/checkin/…`) read `truncated` and render "more matches — refine". Presentation only. (depends: T004)

**Checkpoint**: US3 — typo tolerance without the wobble, and no silently-incomplete lists.

## Phase 6: Polish & Cross-Cutting

- [X] T010 Regression + perf gate: `pnpm vitest run tests/integration/contacts.search.test.ts tests/integration/door.checkin-search.test.ts tests/integration/authz.pii.test.ts && pnpm tsc --noEmit` — all green, including the **300ms-p95-@-1,300** perf test (C10) and unchanged door PII gating (C9). (depends: T006, T008, T009)
- [X] T011 [P] Prettier/ESLint on changed files only (`contactService.ts`, the two route files, the two surface files, `contacts.search.test.ts`).
- [~] T012 Browser (auth-gated, manual) — **PENDING**: signed in, confirm the "more matches — refine" indicator at `/checkin` and `/contacts` past the cap. `/contacts` is `requireStaff`-gated (no dev bypass) → manual pass with a session. The indicator wiring is implemented and covered by the integration `truncated` flag (SC-004); only the live visual confirmation remains.

_Note: as the tasks header anticipated ("stories grow one shared query"), the test cases (T002/T005/T007) were authored together in one file pass and the matching (T003/T006/T008) landed as a single `searchContacts` rewrite — each still verified test-first (9 behavioral tests red before impl, green after)._

---

## Dependencies

- **Setup (T001)** → stories.
- **US1**: T002 (test) → T003 (rewrite) → T004 (routes).
- **US2**: T005 (test) → T006 (extend the WHERE; needs T003's function).
- **US3**: T007 (test) → T008 (fuzzy; needs T006) ; T009 (UI; needs T004's shape).
- **Same-file sequential**: `contacts.search.test.ts` (T002 → T005 → T007) and `contactService.ts` (T003 → T006 → T008) are edited in sequence — never parallel.
- **Polish**: T010 after all impl; T011 after the edits it formats; T012 manual last.
- **Story independence**: US1 is a viable MVP (substring + monotonic + shape). US2 and US3 extend the same function and add value, each independently testable.

## Parallel execution examples

- **T009** (UI indicator) is `[P]` — separate surface files from the domain/test work, and only needs the route shape (T004).
- **T011** (lint) is `[P]`.
- Everything else is sequential (one function, one test file).

## Implementation strategy

MVP = **US1** (substring-primary + monotonic + `{ items, truncated }`): fixes the headline "cat"/wobble
defect across all surfaces. **US2** adds real-name + email matching; **US3** adds the typo fallback and the
truncation indicator. Keep the perf test and door PII gating green throughout.
