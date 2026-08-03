---
description: "Task list for feature 033 — dedup review shows phone + email (P5-R7)"
---

# Tasks: Dedup review shows phone + email alongside display name (P5-R7)

**Input**: Design documents from `specs/033-dedup-phone-email/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/
**Tests**: INCLUDED — the constitution (v1.3.0, Principle I) mandates test-first.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no dependency on an incomplete task)
- **[Story]**: US1 (the only story — from spec.md)
- Exact file paths included.

## Notes

A **display-only** feature: `getMergeSuggestions` gains `phone` + **active** `emails` per candidate (phone is a
plain `contacts.phone` column — canonical since 032; active emails via one `ARRAY(SELECT … status='active')`
subquery), and the `/dedup` page renders them via **`formatPhone`** (feature 032, its first live consumer).
**No schema, no migration, no new endpoint, no dependency** — the suggestions route already returns the service
result. The pairs query's JOIN/WHERE/ORDER stay **untouched** (matching identical, FR-004); only SELECT columns
are added.

⚠️ The service (`suggestionService.ts`) and the page (`dedup/page.tsx`) are **distinct files**; each test file
is distinct → work is `[P]` across them, sequential within a file (test before its impl).

⚠️ **MVP = US1** — the whole feature (phone + email on the review queue).

---

## Phase 1: Setup

- [X] T001 Confirm grounding: `getMergeSuggestions` (`src/server/domain/dedup/suggestionService.ts`) is a raw pg_trgm query returning `{a,b:{id,displayName,membershipStatus}, similarity}`; the suggestions route (`src/app/api/dedup/suggestions/route.ts`) returns `{ pairs }` verbatim (no change needed); `contacts.phone` is canonical (032), `contact_emails.status ∈ {active,transition,inactive}`; the page is `src/app/(admin)/dedup/page.tsx`; `formatPhone` is in `src/server/domain/contacts/phone.ts` (pure, client-importable). No schema/migration.

---

## Phase 2: User Story 1 — See phone and email for each proposed duplicate (P1) 🥇 MVP

**Goal**: Each candidate on the `/dedup` queue shows its phone (dashed) and active email(s), so the reviewer
can disambiguate same-name matches; matching is unchanged.

**Independent Test**: Open the queue with a proposed pair → each candidate shows display name, phone, and
email; two same-name contacts with different phone/email are distinguishable.

- [X] T002 [P] [US1] Write `tests/integration/dedup.phoneEmail.test.ts` (node, real Postgres): `getMergeSuggestions` returns, per candidate of a proposed pair, its `phone` and its **active** `emails` (an inactive/transition email is **excluded**; a candidate with no active email → `emails: []`). Also assert the proposed **pair set/order is unchanged** by the added columns (two same-name contacts still propose exactly one pair).
- [X] T003 [US1] In `src/server/domain/dedup/suggestionService.ts`, add `a.phone`/`b.phone` to the SELECT and `a_emails`/`b_emails` via `ARRAY(SELECT ce.email::text FROM contact_emails ce WHERE ce.contact_id = a.id AND ce.status = 'active' ORDER BY ce.is_login DESC, ce.created_at)` (mirrored for `b`); extend the `MergeSuggestion` type so each candidate carries `phone: string | null` + `emails: string[]`. **Do not change** the JOIN/WHERE/ORDER/LIMIT (matching identical).
- [X] T004 [P] [US1] Write `tests/component/dedup.phoneEmail.test.tsx` (jsdom, stubbed `/api/dedup/suggestions`): a candidate with a canonical phone shows it **dashed** (e.g. `585-555-1234`); active email(s) render; a candidate with `phone: null` shows "no phone" and `emails: []` shows "no email"; the merge controls and empty state are unaffected.
- [X] T005 [US1] In `src/app/(admin)/dedup/page.tsx`, extend the `Pair` type to include per-candidate `phone` + `emails`, and render each candidate's phone via `formatPhone` (import from `src/server/domain/contacts/phone.ts`) and the active email list; show a muted "no phone" / "no email" when absent. Leave the merge buttons, similarity, and empty state unchanged.

**Checkpoint**: the queue shows phone + email per candidate; T002/T004 green.

---

## Phase 3: Polish + cross-cutting

- [X] T006 Full gate (solo-maintainer mode): `pnpm exec tsc --noEmit`; `pnpm exec eslint <changed>`; `pnpm exec prettier --check <changed>`; `pnpm test` (full suite green — existing dedup tests unregressed, matching unchanged); `pnpm build`. All green.
- [X] T007 [P] Update `zak1_Phase5_Requirements.md`: mark **P5-R7 SHIPPED as feature 033** (dedup queue shows phone + active email per candidate; display-only, matching unchanged; consumes 032's `formatPhone`). Note **all Phase 5 R-items (R1–R7) are now shipped**; remaining Phase 5 = defect **D1** (`/payments` nav link) + backlog.

---

## Dependencies & execution order

- **Setup (T001)** → the story.
- **US1**: T002 (integration test) → T003 (service query + type); T004 (component test) → T005 (page render).
  The service pair (T002/T003) and the page pair (T004/T005) touch **distinct files** → the two pairs are
  independent and may proceed in parallel; within each pair the test precedes its implementation.
- **Polish (T006/T007)** last.

### Parallelizable

- **T002** and **T004** [P] (distinct test files). The service work (T002/T003) and the page work (T004/T005)
  are independent (distinct files). Docs **T007** [P].
- **Not `[P]`**: T003 after T002 (same file/behavior); T005 after T004.

## Implementation strategy

Ship as **one atomic commit** once T006 is green. Build order: integration-test + extend the suggestion query
(phone + active emails, matching untouched); component-test + render on the page via `formatPhone`; full gate;
doc. No schema/migration/endpoint change; the only risk — altering the matching — is guarded by the
integration assertion that the pair set/order is unchanged.

## Summary

- **Total tasks**: 7 (Setup 1 · US1 4 · Polish 2)
- **Per user story**: US1 = 4 (T002–T005)
- **Test tasks**: T002 (integration — payload + matching-unchanged), T004 (component — display)
- **Parallel opportunities**: T002/T004; the service vs. page work; docs T007
- **MVP scope**: **US1** — the entire feature (phone + email on the duplicate-review queue).
