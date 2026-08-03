# Implementation Plan: Dedup review shows phone + email alongside display name (P5-R7)

**Branch**: `033-dedup-phone-email` (solo-maintainer mode, constitution v1.3.0 — one atomic commit to `main`)
| **Date**: 2026-08-03 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/033-dedup-phone-email/spec.md`

## Summary

Add **phone** and **active email(s)** to each candidate on the `/dedup` review queue so the reviewer can tell a
real duplicate from a coincidental same-name match. **Display-only** — the dedup **matching is unchanged**
(still `dedup_normalized` name similarity; matching on phone/email stays deferred). The merge suggestion
payload (`getMergeSuggestions`) gains `phone` + `emails` per candidate — phone straight from `contacts.phone`
(already canonical, feature 032) and active emails from `contact_emails` (status `active`) via an `ARRAY(...)`
subquery in the existing pg_trgm query. The `/dedup` page renders phone through **`formatPhone`** (its first
consumer, feature 032) and the email list, with a clear "no phone" / "no email" indication. **No schema
change, no migration, no new endpoint** (the suggestions route already returns the service result).

## Technical Context

**Language/Version**: TypeScript 5.7 (strictest) · Node 24 · pnpm

**Primary Dependencies**: Next.js 16.2.10 · React 19.2 · Drizzle ORM (raw SQL for the pg_trgm query). **No new
dependency.**

**Storage**: PostgreSQL 16 — **untouched**. Reads `contacts.phone` and `contact_emails` (existing). No schema
change, no migration.

**Testing**: Integration (node, real Postgres) — `getMergeSuggestions` returns `phone` + **active** emails per
candidate (inactive/transition emails excluded; empty array when none); matching set/order unchanged.
Component (jsdom) — the `/dedup` page renders each candidate's dashed phone (via `formatPhone`) and email(s),
and shows a clear "no phone" / "no email" indication when absent.

**Target Platform**: Web, single tenant; the duplicate-review admin surface (`/dedup`).

**Project Type**: Next.js App Router monolith; a domain service + a client page.

**Performance Goals**: Unchanged — the pairs query is already `LIMIT 50`; the `ARRAY(...)` email subqueries add
a bounded per-row lookup. Trivial at directory scale.

**Constraints**: Matching (which pairs, and their order) MUST be byte-for-byte unchanged (FR-004) — only added
SELECT columns, no change to the JOIN/WHERE/ORDER. Phone display reuses feature 032's `formatPhone` (the R7
consumer). Active emails only (FR-003). The merge flow, empty state, and access rule are unchanged (FR-006).

**Scale/Scope**: 1 service query + type extension; 1 client page render addition; ~2 test files. No route
change, no schema change, no new dependency.

## Constitution Check

*GATE: Must pass before Phase 0. Re-check after Phase 1.* Constitution v1.3.0 (principles I–IV).

| Principle | Verdict |
|---|---|
| **I. Test-First** | **PASS** — the service change gets an integration test (phone + active-emails per candidate; inactive excluded; matching unchanged) and the page gets a jsdom component test (dashed phone + emails + no-phone/no-email), both before implementation. |
| **II. YAGNI** | **PASS** — display-only; reuses `formatPhone`; emails via one `ARRAY(...)` subquery; no schema/migration/endpoint. Matching on phone/email stays deferred. |
| **III. Type Safety** | **PASS** — `MergeSuggestion` candidate gains typed `phone: string \| null` + `emails: string[]`; the page's `Pair` type mirrors it; no `any`. |
| **IV. Observability** | **PASS** — a read-only display addition; no new mutation or security surface (the route stays `base`-gated). |

**Development Workflow**: solo-maintainer mode — one atomic commit to `main`, full local gate as the reviewer.
Complies.

### Post-Design Re-Check

Re-evaluated after Phase 1: **still PASS.** No schema/migration; the pairs query's JOIN/WHERE/ORDER are
untouched (only SELECT columns added), so the matching set and order are provably unchanged; the only new
behavior is rendering already-stored contact details.

## Project Structure

### Documentation (this feature)

```text
specs/033-dedup-phone-email/
├── plan.md              # This file
├── research.md          # R1..R3 (decisions)
├── data-model.md        # no schema change — the MergeSuggestion payload gains phone + active emails
├── quickstart.md        # per-story validation
├── contracts/
│   └── merge-suggestion.md   # the extended suggestion payload (phone + active emails per candidate)
├── checklists/requirements.md   # complete (from /speckit-specify)
└── tasks.md             # /speckit-tasks (NOT created here)
```

### Source Code (repository root)

```text
src/server/domain/dedup/
└── suggestionService.ts            + a.phone/b.phone in the SELECT and a_emails/b_emails via
                                    `ARRAY(SELECT email FROM contact_emails WHERE contact_id=… AND
                                    status='active')`; `MergeSuggestion` candidate gains phone + emails.
                                    JOIN/WHERE/ORDER unchanged (matching identical).
src/app/(admin)/dedup/
└── page.tsx                        render each candidate's phone (via formatPhone from
                                    src/server/domain/contacts/phone.ts) and active email(s); "no phone" /
                                    "no email" when absent. Pair type mirrors MergeSuggestion.
tests/
├── integration/dedup.phoneEmail.test.ts (new)   getMergeSuggestions returns phone + active emails per
│                                    candidate (inactive excluded); the pair set/order is unchanged
└── component/dedup.phoneEmail.test.tsx (new)     the page shows dashed phone + emails + no-phone/no-email
```

**Structure Decision**: A read-only display feature: extend one domain query + its return type, and render the
new fields on the existing page. Phone display reuses the shipped `formatPhone` (feature 032 — this is its
first live consumer). No route, schema, migration, or dependency change; the suggestions route already returns
the service result verbatim.

## Complexity Tracking

> No constitution deviation, no schema/migration/endpoint change. The one care point: the pairs query's
> matching (JOIN/WHERE/ORDER on `dedup_normalized` similarity) must stay **exactly** as-is (FR-004) — only
> additive SELECT columns (`a.phone`, `b.phone`, and the two email `ARRAY(...)` subqueries) are added. The
> integration test asserts the pair set/order is unchanged to guard this.
