# Tasks: Campaign / promotional slot (P7-R14)

**Feature dir**: `specs/057-campaign-slot/` · **Branch**: `057-campaign-slot` (off `main`, rebased over 056)
**Input**: plan.md, research.md, data-model.md, contracts/campaigns.md, quickstart.md, spec.md

**Constitution**: Test-First (NON-NEGOTIABLE) — the test task in each area precedes its implementation task.
**Additive migration `0040`** (0039 is 056's). **No new capability** (`content.write` gates the admin). ⚠️
**Shown = derived on read**: among rows whose window includes today, the one that **expires first**
(`end_date`, ties `start_date` then `created_at`) via a **pure `selectShownCampaign`** — no scheduler; the queue
and handoff are unit-tested. ⚠️ Slot **text is server-rendered** and the slot has **no client behavior** (no
dismiss). Image is an **external `http(s)` URL** rendered with a plain lazy `<img>` (not `next/image`). CTA is an
**internal path or `http(s)`**. **Remove = delete** (no soft-delete column). Independent of R13 and event status
(018).

## Phase 1: Setup

- [x] T001 [P] Add `campaigns` to the `resetDb()` TRUNCATE list in `tests/integration/helpers/db.ts`.
- [x] T002 [P] Add `campaign.created`, `campaign.updated`, and `campaign.deleted` to the `AuditEvent` `kind`
  union in `src/server/lib/audit.ts`.

## Phase 2: Foundational (table + service — blocks US1 render and US2 writes)

- [x] T003 Migration `src/server/db/migrations/0040_campaigns.sql`: `CREATE TABLE IF NOT EXISTS campaigns
  (id uuid pk default gen_random_uuid(), heading text NOT NULL, blurb text NOT NULL, image_url text,
  image_alt text, cta_label text NOT NULL, cta_url text NOT NULL, start_date date NOT NULL, end_date date NOT
  NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaigns_window_ck CHECK (end_date >= start_date))` + index on `(end_date, start_date, created_at)`.
  Snapshot `zak1_dev` first, then `pnpm run db:migrate`.
- [x] T004 Drizzle schema `src/server/db/schema/campaigns.ts` (mirror the table; export `campaigns` +
  `CampaignRow`; `date` columns surface as `YYYY-MM-DD` strings) and export it from the schema index.
- [x] T005 [P] Zod `src/server/validation/campaign.ts`: `campaignSchema` — `heading`/`blurb` non-empty;
  `image` `{ url: httpUrl, alt: non-empty }` nullable default null; `cta` `{ label: non-empty, url: ctaUrl }`;
  `startDate`/`endDate` `isoDate` (`YYYY-MM-DD`) with a refine `endDate >= startDate`. `httpUrl` = absolute
  `http(s)` (same refine as `promoLinks`); `ctaUrl` = an internal path (`^/(?!/)`) **or** `httpUrl`; `isoDate` =
  `YYYY-MM-DD` regex + real-date check. Export `CampaignInput`.
- [x] T006 [P] Unit test `tests/unit/campaignSelect.test.ts`: `isCampaignActive` — inside window with **start &
  end inclusive** true, day-before-start / day-after-end false; `selectShownCampaign` — a single active row is
  returned, `null` when none active, **and the core queue ordering** (Constitution I test-first for the full
  selector, before T008): among **multiple active** rows the one with the **earliest `endDate`** wins, ties
  broken by earliest `startDate` then `createdAt`, rows outside their window are excluded, and the **handoff** —
  advancing `today` past the shown row's `endDate` returns the next-soonest-expiring active row; and
  `campaignSchema` — heading/blurb required, `image.url` rejects `javascript:`/`data:`/relative and requires
  `alt`, `cta.url` accepts an internal path (`/x`) and `https:` but rejects `javascript:`, `endDate >= startDate`
  enforced. (Test-first — fails until T008/T005. The nested-window edge case is US3/T015.)
- [x] T007 [P] Integration test `tests/integration/campaign.test.ts` (real Postgres): `createCampaign` inserts
  and `getShownCampaign` returns the display projection (heading/blurb/image/cta, **no** date/created columns) for
  a single active campaign; `updateCampaign` edits; `deleteCampaign` removes; a campaign whose window is in the
  future or past is **not** shown (`null`); each write emits an `audit_events` row. (Test-first — fails until
  T008. Multi-campaign queue is US3/T016.)
- [x] T008 Implement `src/server/domain/campaigns/campaignService.ts`: `PublicCampaign`; pure
  `isCampaignActive(row, today)`; pure `selectShownCampaign(rows, today)` (filter active → order by
  `endDate, startDate, createdAt` → first, else null); `getShownCampaign(db)` (fetch active rows → apply the
  selector → projection, else null); `listCampaigns(db)` (every row + `status` `upcoming|active|ended` + `shown`
  flag for the selected id); `createCampaign` / `updateCampaign` / `deleteCampaign` (each `recordAudit` with the
  matching kind; `today` via the app's `new Date().toISOString().slice(0,10)` UTC-date convention).

## Phase 3: User Story 1 — A visitor sees the current campaign (Priority: P1)

**Goal**: the shown campaign renders as a promotional slot at the top of the **home page** (above the hero,
never other public pages, never admin/door), server-rendered, with heading/blurb/optional image/CTA; nothing when
none is active.
**Independent test**: create an active campaign → the slot shows on `/` with heading/blurb/image/CTA and the text
is in the served HTML (scripts off); it does **not** appear on `/whats-on`; remove it → no slot, no layout shift.

- [x] T009 [P] [US1] Component test `tests/component/campaignSlot.test.tsx` (jsdom): given a `PublicCampaign`, the
  slot renders heading, blurb, and the CTA; an image renders `<img>` with the **alt text**; no image → text-only
  (no `<img>`); an **internal-path** CTA (`/x`) is a same-tab link; an **external** `http(s)` CTA is
  `<a target="_blank" rel="noopener noreferrer">`; no personal data. (Test-first — fails until T010.)
- [x] T010 [P] [US1] Create `src/app/(public)/_components/CampaignSlot.tsx` (+ `CampaignSlot.module.css`): a
  **server** component (no `"use client"`) taking `{ campaign: PublicCampaign }` — render heading, blurb, the
  optional image (`<img loading="lazy" alt={image.alt}>`), and the CTA (internal path → same-tab link; external
  `http(s)` → `target="_blank" rel="noopener noreferrer"`, detected by leading `/`); mobile-first, wraps, no
  horizontal scroll; degrades to text-only when `image` is null.
- [x] T011 [US1] Modify `src/app/(public)/page.tsx`: `const campaign = await getShownCampaign(db);` render
  `{campaign ? <CampaignSlot campaign={campaign} /> : null}` at the **top of the home page, above the `<section
  className={styles.hero}>`** (home page only — not the `(public)` layout, so it never appears elsewhere).

## Phase 4: User Story 2 — A Webmaster creates / edits / removes (Priority: P1)

**Goal**: a `content.write` editor creates a campaign (heading, blurb, optional image URL + alt, CTA, dates), it
shows without a deploy; they can edit or remove it and manage several independently; non-editors are refused.
**Independent test**: create → shows on the home page; edit → change shows on reload; delete → gone; a
`javascript:` CTA/image → 422; a base actor → 403.

- [x] T012 [US2] Integration authz test `tests/integration/campaign.authz.test.ts`: `POST /api/campaigns`,
  `PATCH` and `DELETE /api/campaigns/[id]` **refuse a base-only actor (403)** naming `content.write`, and
  **allow** a `content.write` actor; a `javascript:` CTA URL → **422**. (Test-first — fails until T013.)
- [x] T013 [US2] API `src/app/api/campaigns/route.ts` (`GET` list, `POST` create) and
  `src/app/api/campaigns/[id]/route.ts` (`PATCH` edit, `DELETE` remove) — all
  `withAuth({ requires: "content.write" })`: `GET` → `listCampaigns`; `POST`/`PATCH` → validate `campaignSchema`
  (422 on bad scheme/empty/date order), `createCampaign`/`updateCampaign`; `DELETE` → `deleteCampaign`; `PATCH`
  404 on unknown id.
- [x] T014 [US2] Admin `src/app/(admin)/campaigns/page.tsx` + `NAV` entry in `src/server/auth/nav.ts`
  (`capability: "content.write"`): a **list** of campaigns showing each one's **status** (upcoming/active/ended)
  and marking **which is currently shown**; a **create/edit** form (heading, blurb, image URL + alt, CTA label +
  url, start date, end date) and a **remove** button → `POST`/`PATCH`/`DELETE`; surface the 422.

## Phase 5: User Story 3 — The schedule runs itself: windows & the queue (Priority: P2)

**Goal**: campaigns auto-appear/auto-retire by date, and when several are active only the one that **expires
first** shows, handing off to the next when it ends — all with no staff action.
**Independent test**: two active campaigns with different end dates → only the sooner-expiring shows; advance past
its end date → the later-ending one shows; a future/past campaign → not shown — all with no staff action.

- [x] T015 [P] [US3] Extend `tests/unit/campaignSelect.test.ts` with the **nested-window** edge case (the core
  earliest-end/ties/handoff ordering is already covered test-first in T006): a short window entirely inside a
  longer one — `selectShownCampaign` shows the **short** campaign while it is active (it expires first) and the
  **longer** one on the days before/after the short window; no active campaign is starved.
- [x] T016 [US3] Extend `tests/integration/campaign.test.ts`: with **two active** campaigns (different end dates)
  `getShownCampaign` returns the sooner-expiring; deleting the shown one makes `getShownCampaign` return the next
  (the handoff); `listCampaigns` marks the per-row `status` and exactly one `shown`. (Uses T008.)

## Phase 6: Polish & validation

- [x] T017 Gate suite: `pnpm exec vitest run tests/unit/campaignSelect.test.ts
  tests/integration/campaign.test.ts tests/integration/campaign.authz.test.ts
  tests/component/campaignSlot.test.tsx`, then `pnpm exec tsc --noEmit`, `pnpm run lint`,
  `pnpm exec prettier --check` on changed files. Full `pnpm test` green (0040 applied).
- [x] T018 Browser verify (quickstart §2–7): create a campaign → the slot shows **above the hero** on `/`, text
  present with scripts off, **absent** on `/whats-on` (SC-001/007/FR-011); text-only when no image (SC-008);
  internal CTA same-tab, external CTA new-tab, `javascript:` rejected (SC-006); **two active** → only the
  sooner-expiring shows and the handoff works on delete/expiry (SC-009); future/past window not shown (SC-004);
  remove all → no slot, no layout shift (SC-003); a base actor can't reach `/campaigns` (SC-005); 375px no-scroll.

## Dependencies

- **Setup** (T001/T002) [P] independent. **Foundational**: T003→T004→(T005,T006,T007 [P])→T008. T008 blocks US1
  (T011 render), US2 (T013 API), and US3 (T015/T016).
- **US1**: T009→T010; T011 needs T008 (getShownCampaign) + T010.
- **US2**: T012→T013 (needs T005 + T008)→T014.
- **US3**: T015 (extends T006's file; needs T008) ∥ T016 (extends T007's file; needs T008).
- **Phase 6** last.

## Parallel opportunities

- Setup T001 ∥ T002. Foundational T005/T006/T007 are independent files ([P]). US1 T009 (test) ∥ T010 (component).
  US3 T015 ∥ T016 (different files).

## Implementation strategy

**MVP** = Foundational + **US1** + **US2** — the table + service + the home-page slot + the `content.write` admin
CRUD. The **full queue selector is test-first in T006** (earliest-end, ties, handoff) and implemented in T008, so
the MVP already shows the correct campaign when several are active. **US3** hardens it with the **nested-window**
edge case (T015) and **DB-level** queue + admin `status`/`shown` verification (T016) — an independent P2 slice.
Security-first within US2: the **authz test + `content.write` gate (T012/T013)** land before the admin UI. The
slot's **server-rendered text** (T010/T011) satisfies FR-011 before anything else.
