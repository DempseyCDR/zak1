# Implementation Plan: Site-wide announcement banner (P7-R13)

**Branch**: `056-announcement-banner` | **Date**: 2026-08-25 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/056-announcement-banner/spec.md`

## Summary

A single site-wide announcement banner for "is the dance on?" notices (cancellations, weather, news). One
`announcements` record (latest row = current), **active while `now < posted_at + duration_hours`** (default 24)
and `cleared_at IS NULL` — so it **auto-expires** with no staff action; a Webmaster can clear/replace it early.
The `(public)` layout (which wraps every public page and never admin/door) becomes an async server component
that fetches the active announcement and renders a **server-rendered** banner above the content; a small client
child handles **dismiss** (per-browser, keyed to the announcement id). Editing is a `content.write` admin +
API; every post/clear is audited. Additive migration `0039`. No new capability. Independent of per-event
cancellation (feature 018).

## Technical Context

**Language/Version**: TypeScript 5.7 (strict), Node 24
**Primary Dependencies**: Next.js 16 (App Router / RSC), Drizzle ORM + hand-authored SQL migrations, Zod
**Storage**: PostgreSQL 16 — additive migration `0039` (`announcements` table)
**Testing**: Vitest — real-Postgres integration, unit, jsdom component
**Target Platform**: Server-rendered web; mobile-first public pages
**Performance Goals**: Standard web; one indexed `SELECT … ORDER BY posted_at DESC LIMIT 1` per public render
**Constraints**: Banner text **server-rendered** (present without JS; dismissal is progressive enhancement);
`http(s)`-only link (validated at the write boundary); accessible (live region/role by level); mobile-first
(no h-scroll at 375px); **never** on `(admin)`/`(door)` screens; **no** read/write of event status
**Scale/Scope**: One club, one banner. One migration, one small service + pure active-check, one API, one admin
page, one banner component mounted in the public layout.

## Constitution Check

Constitution v1.3.0. Gates:

- **I. Test-First (NON-NEGOTIABLE)** — PASS (planned). Per area: a **unit** test for `isAnnouncementActive`
  (the duration boundary — just-before active, just-after expired, cleared → inactive) and the Zod validation
  (text required; `http(s)`-only link; level enum; positive duration); an **integration** test for
  `getActiveAnnouncement`/`postAnnouncement`/`clearAnnouncement` + supersede + audit + `content.write` refusal;
  a **component** test for the banner (renders text/link/level, dismiss hides + persists, none when null).
- **II. YAGNI** — PASS. One record (latest-wins), duration-based expiry computed on read (no scheduler/cron),
  reuse of `content.write`, `audit_events`, the `(public)` layout mount point, and the http(s) link check
  pattern (055/053). No blog, no per-event coupling, no multi-banner, no server-side per-user dismissal.
- **III. Type Safety (Zod at boundaries)** — PASS. The post payload is Zod-validated (text non-empty; link
  `{label,url}` optional with `url` http(s); `level ∈ {info,urgent}`; `durationHours` int in a sane range).
  The public projection type carries only display-safe fields (id, text, level, link) — no internal columns.
- **IV. Observability** — PASS. `postAnnouncement` and `clearAnnouncement` write an `audit_events` row via
  `recordAudit` (new `announcement.posted` / `announcement.cleared` kinds). Public read is read-only.

No violations. Complexity Tracking: none.

## Project Structure

### Documentation (this feature)

```
specs/056-announcement-banner/
├── spec.md · plan.md · research.md · data-model.md · quickstart.md
├── contracts/announcement.md
└── checklists/requirements.md
```

### Source Code (repository root)

```
src/server/db/migrations/0039_announcements.sql        # NEW — announcements table
src/server/db/schema/announcements.ts                   # NEW — table; export from index
src/server/validation/announcement.ts                   # NEW — Zod: post payload (text, link http(s), level, hours)
src/server/domain/announcements/announcementService.ts  # NEW — isAnnouncementActive (pure), getActiveAnnouncement,
                                                        #        getCurrentForAdmin, postAnnouncement, clearAnnouncement
src/server/lib/audit.ts                                 # + announcement.posted / announcement.cleared kinds

src/app/(public)/layout.tsx                             # MODIFY — async: fetch active announcement, render banner
src/app/(public)/_components/AnnouncementBanner.tsx     # NEW — client: role by level + dismiss (localStorage by id)
src/app/(public)/_components/AnnouncementBanner.module.css # NEW

src/app/api/announcement/route.ts                       # NEW — GET current (admin) · POST post · DELETE clear (content.write)
src/app/(admin)/announcement/page.tsx                   # NEW — post/clear form; + NAV entry (content.write)

tests/unit/announcementActive.test.ts                   # isAnnouncementActive boundary + validation
tests/integration/announcement.test.ts                  # post/get/clear/supersede/audit (real Postgres)
tests/integration/announcement.authz.test.ts            # content.write refusal
tests/component/announcementBanner.test.tsx             # render + dismiss + none
```

**Structure Decision**: Single web app. Load-bearing choices: (1) the **`(public)` layout** is the single
site-wide mount point (guarantees "all public pages, never staff"); (2) the banner is **server-rendered** (text
in SSR HTML, FR-009) with dismissal as a **client** progressive enhancement keyed to the announcement **id**;
(3) **active is derived on read** (`now < posted_at + duration_hours`, `cleared_at IS NULL`) via a **pure**
`isAnnouncementActive` — no scheduler, and the duration boundary is unit-testable off-DB.

## Complexity Tracking

No constitution violations; no entries.

## Phase 0 — Research

See [research.md](research.md): the one-record latest-wins model, duration-derived-on-read expiry, the
server-render + client-dismiss split, the http(s) link check, capability/audit reuse, and the layout mount.

## Phase 1 — Design & Contracts

- [data-model.md](data-model.md) — migration `0039`, the `announcements` table, the active predicate.
- [contracts/announcement.md](contracts/announcement.md) — the service, the public projection, the admin API,
  the banner/layout contract, and the test contracts.
- [quickstart.md](quickstart.md) — end-to-end validation mapped to SC-001…008.
- Agent context: `CLAUDE.md` SpecKit plan reference updated to this plan.
