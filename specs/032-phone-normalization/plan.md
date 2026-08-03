# Implementation Plan: Phone number normalization (P5-R6)

**Branch**: `032-phone-normalization` (solo-maintainer mode, constitution v1.3.0 — one atomic commit to
`main`) | **Date**: 2026-08-03 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/032-phone-normalization/spec.md`

## Summary

Normalize contact phone numbers to **one canonical stored form** (E.164-style, assume `+1` when no country
code) at every contact-write path, and provide a pure **`formatPhone`** helper for dashed display. An input
that isn't a clean, parseable number (wrong length, letters, extension) is **stored raw** — never rejected.
A **one-time backfill migration** (`0030`, the second Phase 5 migration) re-normalizes existing phones, leaving
unparseable ones unchanged; it is idempotent. Two pure functions live beside the feature-012 name normalizer;
`normalizePhone` is applied at the **three** contact-write sites that set `contacts.phone` (mirroring how
`deriveContactNames` is applied at each). **No schema change** — only values are normalized. `formatPhone` is
delivered and unit-tested; it has **no live display consumer today** (phone is captured but not shown
anywhere) and is the helper the P5-R7 dedup page (and future surfaces) will use.

## Technical Context

**Language/Version**: TypeScript 5.7 (strictest) · Node 24 · pnpm

**Primary Dependencies**: Next.js 16.2.10 · React 19.2 · Drizzle ORM · Zod. **No new dependency** — a small
pure normalizer (US + basic non-US) is sufficient; a full phone-number library is YAGNI for this club.

**Storage**: PostgreSQL 16 — **no schema change**. `contacts.phone` stays nullable `text`; only its values are
normalized. One **data backfill migration** `0030_normalize_contact_phones.sql` (no column change).

**Testing**: Unit (pure) — `normalizePhone` (many-format → one canonical; `+1` default; 11-digit leading `1`;
non-US `+`; unparseable → raw; idempotent) and `formatPhone` (US dashed; non-US with country code; raw
passthrough). Integration (node, real Postgres) — creating a contact with a messy phone stores canonical (at
each write site); and a **backfill parity** test: seed mixed phones, run the `0030` SQL, assert each result
equals `normalizePhone(input)` (single source of truth for expected values, mirroring 027's migration test).

**Target Platform**: Web, single tenant; the contact-directory substrate.

**Project Type**: Next.js App Router monolith; server domain services + a pure shared helper.

**Performance Goals**: Unchanged — a string transform per contact write; the backfill is a one-time UPDATE.

**Constraints**: One shared normalization applied at **all** contact-write sites (FR-007); never reject a save
(unparseable → raw, FR-003); the backfill leaves unparseable values unchanged and is idempotent (FR-006);
matching/dedup logic is unchanged (display of phone on dedup is the separate P5-R7).

**Scale/Scope**: 2 pure functions; 3 write-site call additions; 1 backfill migration; ~3 test files. No API
shape change (phone stays a plain string field on contact payloads).

## Constitution Check

*GATE: Must pass before Phase 0. Re-check after Phase 1.* Constitution v1.3.0 (principles I–IV).

| Principle | Verdict |
|---|---|
| **I. Test-First** | **PASS** — `normalizePhone`/`formatPhone` get unit tests (the rule table incl. edge cases) and the write-path + backfill get integration tests (real Postgres, incl. SQL-vs-`normalizePhone` parity), all before implementation. |
| **II. YAGNI** | **PASS** — a small pure normalizer, no phone library; one field, no schema change; no structured extension field (unparseable → raw). The backfill is a single idempotent UPDATE. |
| **III. Type Safety** | **PASS** — pure typed `(string) → string` functions; no `any`; phone stays a typed string on the contact boundary (Zod unchanged — still optional). |
| **IV. Observability** | **PASS** — no new security surface; contact writes are already audited; normalization is a value transform on an existing field. |

**Development Workflow**: solo-maintainer mode — one atomic commit to `main`, full local gate as the reviewer.
Complies.

### Post-Design Re-Check

Re-evaluated after Phase 1: **still PASS.** No schema change; the backfill is additive-safe (values only,
unparseable left raw) and idempotent; the write-path change is one shared helper applied at the existing three
insert sites — the same pattern as `deriveContactNames`.

## Project Structure

### Documentation (this feature)

```text
specs/032-phone-normalization/
├── plan.md              # This file
├── research.md          # R1..R5 (decisions)
├── data-model.md        # no schema change — the canonical phone value + the raw fallback
├── quickstart.md        # per-story validation
├── contracts/
│   └── phone-normalization.md   # normalizePhone / formatPhone rules (the pure contract)
├── checklists/requirements.md   # complete (from /speckit-specify)
└── tasks.md             # /speckit-tasks (NOT created here)
```

### Source Code (repository root)

```text
src/server/domain/contacts/
├── phone.ts (new)                  pure `normalizePhone(raw): string` (canonical E.164 / raw-when-unparseable)
│                                   + `formatPhone(stored): string` (dashed display / raw passthrough). Beside
│                                   normalize.ts (the 012 name normalizer); pure, importable server + client.
├── contactService.ts               createContact + patchContact: normalizePhone the incoming phone
src/server/domain/attendance/
└── attendanceService.ts            check-in new-contact insert: normalizePhone the phone
src/server/domain/performers/
└── performerService.ts             performer-create contact insert: normalizePhone the phone
src/server/db/migrations/
└── 0030_normalize_contact_phones.sql (new)  backfill: normalize existing contacts.phone (unparseable → raw);
                                     idempotent; mirrors normalizePhone (pinned by a parity test)
tests/
├── unit/phone.test.ts (new)                normalizePhone + formatPhone rule table (incl. edges)
├── integration/contact.phoneNormalize.test.ts (new)  create-a-contact-with-messy-phone → canonical (each
│                                           write site); + backfill parity (run 0030 SQL, assert == normalizePhone)
└── (no component test — no live phone display site today; formatPhone is unit-tested and consumed by P5-R7)
```

**Structure Decision**: Two pure functions co-located with the existing name normalizer, applied at the three
contact-write sites (the established "call the shared normalizer at each insert" pattern), plus a values-only
backfill migration. No schema change, no API-shape change, no new dependency. `formatPhone` ships tested and
ready for the P5-R7 dedup display; this feature wires no live display surface because none renders a phone
today.

## Complexity Tracking

> No constitution deviation. Two nuances recorded:
>
> 1. **Two implementations of the normalization rule** — `normalizePhone` (TS, the write path) and the `0030`
>    SQL CASE (the backfill). To prevent divergence, the rule is kept **simple enough to express identically in
>    both** (strip to `+`/digits; a 10-digit or `1`+10-digit number → `+1`+10 digits; an existing `+`-prefixed
>    E.164 stays; anything else → raw), and an **integration parity test** asserts the SQL output equals
>    `normalizePhone(input)` across a shared case set (single source of truth for expected values, per 027).
> 2. **US2 has no live consumer today** — phone is captured but displayed nowhere. `formatPhone` is delivered
>    and unit-tested; it is applied when a surface actually shows a phone (the P5-R7 dedup page). Not a gap in
>    this feature — the requirement's display clause is satisfied by the tested helper being ready.
