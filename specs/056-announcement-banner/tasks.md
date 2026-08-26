# Tasks: Site-wide announcement banner (P7-R13)

**Feature dir**: `specs/056-announcement-banner/` · **Branch**: `056-announcement-banner` (off `main`)
**Input**: plan.md, research.md, data-model.md, contracts/announcement.md, quickstart.md, spec.md

**Constitution**: Test-First (NON-NEGOTIABLE) — the test task in each area precedes its implementation task.
**Additive migration `0039`** (0038 is 055's). **No new capability** (`content.write` gates the admin). ⚠️
**Active is derived on read** (`now < posted_at + duration_hours` AND `cleared_at IS NULL`) via a pure
`isAnnouncementActive` — no scheduler; the duration boundary is unit-tested. ⚠️ Banner **text is
server-rendered** (no-JS visitors see it); dismissal is a client progressive enhancement keyed to the
announcement **id**. Independent of event status (feature 018).

## Phase 1: Setup

- [x] T001 [P] Add `announcements` to the `resetDb()` TRUNCATE list in `tests/integration/helpers/db.ts`.
- [x] T002 [P] Add `announcement.posted` and `announcement.cleared` to the `AuditEvent` `kind` union in
  `src/server/lib/audit.ts`.

## Phase 2: Foundational (table + service — blocks US1 render and US2 writes)

- [x] T003 Migration `src/server/db/migrations/0039_announcements.sql`: `CREATE TABLE IF NOT EXISTS announcements
  (id uuid pk default gen_random_uuid(), text text NOT NULL, link_label text, link_url text, level text NOT NULL
  DEFAULT 'info', duration_hours integer NOT NULL DEFAULT 24, posted_at timestamptz NOT NULL DEFAULT now(),
  cleared_at timestamptz, created_at timestamptz NOT NULL DEFAULT now())` + index on `(posted_at DESC)`.
  Snapshot `zak1_dev` first, then `pnpm run db:migrate`.
- [x] T004 Drizzle schema `src/server/db/schema/announcements.ts` (mirror the table; export `announcements` +
  `AnnouncementRow`) and export it from the schema index.
- [x] T005 [P] Zod `src/server/validation/announcement.ts`: `announcementPostSchema` — `text` non-empty; `level`
  `z.enum(["info","urgent"]).default("info")`; `durationHours` int `1..720` default `24`; `link`
  `{ label: non-empty, url: httpUrl }` nullable default null (`httpUrl` = absolute URL whose protocol ∈
  `{http:,https:}`, same refine as `promoLinks`).
- [x] T006 [P] Unit test `tests/unit/announcementActive.test.ts`: `isAnnouncementActive` — active just **before**
  `posted_at + duration_hours`, inactive just **after** (SC-008 boundary), inactive when `clearedAt` is set; and
  `announcementPostSchema` — text required, `link.url` rejects `javascript:`/`data:`/relative and accepts
  `https:`, `level` enum, `durationHours` bounds + default. (Test-first — fails until T008/T005.)
- [x] T007 [P] Integration test `tests/integration/announcement.test.ts` (real Postgres): `postAnnouncement`
  inserts and `getActiveAnnouncement` returns the display projection (text/level/link, no internal columns); a
  **second post supersedes** (latest wins); `clearAnnouncement` makes it inactive (`null`); a row past its
  duration resolves to `null`; each write emits an `audit_events` row. (Test-first — fails until T008.)
- [x] T008 Implement `src/server/domain/announcements/announcementService.ts`: `AnnouncementLevel`,
  `PublicAnnouncement`, pure `isAnnouncementActive(row, now)`, `getActiveAnnouncement(db)` (latest row →
  projection iff active, else null), `getCurrentForAdmin(db)` (latest row for prefill), `postAnnouncement(db,
  input, actorContactId)` (insert + `recordAudit("announcement.posted")`), `clearAnnouncement(db, actorContactId)`
  (set `cleared_at=now()` on the latest row + `recordAudit("announcement.cleared")`).

## Phase 3: User Story 1 — A visitor sees the current announcement (Priority: P1)

**Goal**: the active announcement renders as a banner above the content on **every** public page (never staff),
server-rendered, with urgency styling and an optional safe link; nothing when none is active.
**Independent test**: post an active announcement → it shows on home, `/whats-on`, a landing; the text is in the
served HTML (scripts off); clear/expire it → no banner anywhere, no layout shift.

- [x] T009 [P] [US1] Component test `tests/component/announcementBanner.test.tsx` (jsdom): given a
  `PublicAnnouncement`, the banner renders the text; `level:"urgent"` → `role="alert"`, else `role="status"`
  + `aria-live="polite"`; a link renders as `<a target="_blank" rel="noopener noreferrer">`; no personal data.
  (Test-first — fails until T010.)
- [x] T010 [P] [US1] Create `src/app/(public)/_components/AnnouncementBanner.tsx` (+ `AnnouncementBanner.module.css`):
  a client component taking `{ announcement: PublicAnnouncement }` — render the text, optional link, and the
  role/`aria-live` by `level`; mobile-first, wraps, no horizontal scroll. (Dismiss comes in US3.)
- [x] T011 [US1] Modify `src/app/(public)/layout.tsx` into an **async** server component: `const a = await
  getActiveAnnouncement(db)`, render `{a ? <AnnouncementBanner announcement={a} /> : null}` **above**
  `{children}` (the layout wraps every public page and never admin/door).

## Phase 4: User Story 2 — A Webmaster posts / edits / clears (Priority: P1)

**Goal**: a `content.write` editor posts an announcement (text, level, duration, optional link), it shows
without a deploy and **auto-expires** after its duration; they can clear it early; non-editors are refused.
**Independent test**: post → shows publicly; clear → gone; a `javascript:` link → 422; a base actor → 403;
a duration-1h post no longer shows after the window.

- [x] T012 [US2] Integration authz test `tests/integration/announcement.authz.test.ts`: `POST` and `DELETE`
  `/api/announcement` **refuse a base-only actor (403)** naming `content.write`, and **allow** a `content.write`
  actor. (Test-first — fails until T013.)
- [x] T013 [US2] API `src/app/api/announcement/route.ts` (all `withAuth({ requires: "content.write" })`):
  `GET` → `getCurrentForAdmin` (+ an `active` flag); `POST` → `postAnnouncement` (validate `announcementPostSchema`;
  422 on bad scheme/empty); `DELETE` → `clearAnnouncement`.
- [x] T014 [US2] Admin `src/app/(admin)/announcement/page.tsx` + `NAV` entry in `src/server/auth/nav.ts`
  (`capability: "content.write"`): show the current announcement (and whether active), a **post** form (text,
  `level` radio info/urgent, `durationHours` number default 24, optional link label+url), and a **Clear** button
  → `POST`/`DELETE /api/announcement`; surface the 422.

## Phase 5: User Story 3 — A visitor dismisses the banner (Priority: P2)

**Goal**: a visitor can dismiss the banner; it stays hidden across public navigation but a **new/changed**
announcement reappears.
**Independent test**: dismiss → stays hidden while browsing; post a new announcement → it reappears.

- [x] T015 [P] [US3] Extend `tests/component/announcementBanner.test.tsx`: a keyboard-operable **Dismiss** button
  hides the banner and writes the announcement **id** to `localStorage`; a pre-seeded `localStorage` dismissal
  matching the current id **hides on mount**; a dismissal for a *different* id does **not** hide. (Test-first —
  fails until T016.)
- [x] T016 [US3] Extend `src/app/(public)/_components/AnnouncementBanner.tsx`: add the Dismiss button + on-mount
  `localStorage` check keyed to `announcement.id` (`cdr.announcement.dismissed`); wrap reads/writes in try/catch;
  text stays server-rendered (dismiss is a post-hydration enhancement).

## Phase 6: Polish & validation

- [x] T017 Gate suite: `pnpm exec vitest run tests/unit/announcementActive.test.ts
  tests/integration/announcement.test.ts tests/integration/announcement.authz.test.ts
  tests/component/announcementBanner.test.tsx`, then `pnpm exec tsc --noEmit`, `pnpm run lint`,
  `pnpm exec prettier --check` on changed files. Full `pnpm test` green (0039 applied).
- [x] T018 Browser verify (quickstart §2–7): post an urgent announcement → shows above content on home/`/whats-on`/
  a landing, text present with scripts off, one region/`role`, 375px no-scroll (SC-001/007); a `javascript:` link
  rejected (SC-004); dismiss persists across pages and a new post reappears (SC-006); duration-1h expires with no
  action (SC-008); clear → gone, no layout shift (SC-003); a base actor can't reach `/announcement` (SC-005).

## Dependencies

- **Setup** (T001/T002) [P] independent. **Foundational**: T003→T004→(T005,T006,T007 [P])→T008. T008 blocks US1
  (T011 render) and US2 (T013 API).
- **US1**: T009→T010; T011 needs T008 (getActiveAnnouncement) + T010.
- **US2**: T012→T013 (needs T005 + T008)→T014.
- **US3**: T015→T016 (extends the US1 banner + its test).
- **Phase 6** last.

## Parallel opportunities

- Setup T001 ∥ T002. Foundational T005/T006/T007 are independent files ([P]). US1 T009 (test) ∥ T010 (component).

## Implementation strategy

**MVP** = Foundational + **US1** + **US2** — the table + service + the site-wide server-rendered banner + the
`content.write` admin to post/clear, with duration auto-expiry. That delivers "is the dance on?" end to end.
**US3** (dismiss) is an independent P2 enhancement. Security-first within US2: the **authz test + `content.write`
gate (T012/T013)** land before the admin UI. The banner's **server-rendered text** (T010/T011) satisfies the
no-JS requirement before any client dismissal is added.
