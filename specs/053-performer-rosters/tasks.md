# Tasks: Public performer rosters (bands & callers) (P7-R9)

**Feature dir**: `specs/053-performer-rosters/` · **Branch**: `053-performer-rosters` (off `main`)
**Input**: plan.md, research.md, data-model.md, contracts/public-performers.md, quickstart.md, spec.md

**Constitution**: Test-First (NON-NEGOTIABLE) — the test task in each area precedes its implementation task.
**Additive migration `0036`** (0035 is 052's). **No new dependency, no new capability** (`performer.write`
already gates every `/api/bands*` and `/api/performers*` write). ⚠️ The **PII + visibility gate** — a public
projection whose types carry no contact field, returning only public/non-archived entries — is the one shared
point every public read consumes (mirrors R8 `publicVenues.ts`). ⚠️ **Promo-link safety**: URL scheme
allowlisted to `http(s)` at the write boundary; links render as plain anchors (no `dangerouslySetInnerHTML`).

## Phase 1: Setup

No setup: no new dependency, no new capability, no config. (`bands`, `band_members`, `performers` are already
in the test `resetDb()` TRUNCATE list.)

## Phase 2: Foundational (blocking prerequisites — the fields, the validators, the gate)

- [X] T001 Migration `src/server/db/migrations/0036_performer_roster.sql`: `ALTER TABLE bands ADD COLUMN IF
  NOT EXISTS is_public boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS styles text[] NOT NULL
  DEFAULT '{}', ADD COLUMN IF NOT EXISTS links jsonb NOT NULL DEFAULT '[]'`; `ALTER TABLE performers ADD ...
  is_public, is_caller (boolean NOT NULL DEFAULT false), styles text[], links jsonb`; `ALTER TABLE
  band_members ADD COLUMN IF NOT EXISTS instrument text`. Additive. Snapshot `zak1_dev` first, then
  `pnpm run db:migrate`.
- [X] T002 Drizzle schema: in `src/server/db/schema/performers.ts` add `isPublic`, `isCaller`
  (boolean notNull default false), `styles` (`text('styles').array().notNull().default([])`), `links`
  (`jsonb('links').$type<PromoLink[]>().notNull().default([])`); in `src/server/db/schema/bands.ts` add
  `isPublic`, `styles`, `links` to `bands` and `instrument` (`text`, nullable) to `bandMembers`. Import the
  `PromoLink` type from `@/server/domain/public/promoLinks` for the `$type<>()` annotations.
- [X] T003 [P] Unit test `tests/unit/promoLinks.test.ts` (the security test): `promoLinkSchema` accepts
  `https://…`/`http://…`; **rejects** `javascript:alert(1)`, `data:…`, `mailto:…`, `ftp:…`, a relative URL,
  and a malformed string; `type` outside the enum is rejected; `stylesSchema` accepts `contra|english|
  community` and rejects an unknown style. (Test-first — fails until T004.)
- [X] T004 Implement `src/server/domain/public/promoLinks.ts`: export `PROMO_LINK_TYPES`, `PromoLink`,
  `promoLinkSchema` (`type` ∈ enum; `url` parses as absolute URL AND `new URL(url).protocol` ∈
  `{http:,https:}`), `promoLinksSchema` (array, default `[]`), `STYLE_TAGS` (`contra|english|community`),
  `stylesSchema` (array of `STYLE_TAGS`, default `[]`).
- [X] T005 [P] Integration test `tests/integration/publicPerformers.test.ts` (real Postgres) — **the gate**:
  seed a **public** band (styles `['contra']`, one promo link, a member with an instrument), a **non-public**
  band, an **archived** public band, a **public caller** (`is_public && is_caller`), a **non-public** caller,
  and a **public performer who is NOT a caller**. Assert `listPublicBands` returns only the public
  non-archived band (member instrument present); `listPublicCallers` returns only the public caller; the
  `style` filter narrows both; and **no contact field** appears on any result. (Test-first — fails until T006.)
- [X] T006 Implement `src/server/domain/public/publicPerformers.ts`: `PublicBand`/`PublicCaller` types (no
  contact field), `isBandPublic` (`is_public && archived_at === null`), `isCallerPublic` (`is_public &&
  is_caller`), `listPublicBands(db, style?)` and `listPublicCallers(db, style?)` — SELECT only public-safe
  columns, name-ordered, `style = ANY(styles)` when a known style is passed. Bands join `band_members` +
  `performers.display_name` for `{ name, isLead, instrument }`.

## Phase 3: User Story 1 — A visitor discovers who plays and calls (Priority: P1)

**Goal**: `/performers` lists public bands and callers with name, bio, photo, style(s), members+instruments,
and safe promotional links; no PII anywhere; reachable from the nav.
**Independent test**: seed a public band + caller with links/styles/photo; load `/performers` → both render
with working outbound links and zero contact info; a no-photo entry renders cleanly.

- [X] T007 [P] [US1] Component test `tests/component/roster.test.tsx` (jsdom): a band with a promo link
  renders it as `<a target="_blank" rel="noopener noreferrer nofollow">`; a member shows `Name — instrument`
  when set; an entry with `photoUrl=null` renders without an `<img>`; no email/phone text appears.
  (Test-first — fails until T008/T009.)
- [X] T008 [P] [US1] Create `src/app/(public)/_components/PromoLinks.tsx` (+ `PromoLinks.module.css`): render
  a `PromoLink[]` as a list of outbound anchors, each `target="_blank" rel="noopener noreferrer nofollow"`,
  labelled/iconified by `type`; render nothing for an empty array.
- [X] T009 [US1] Create `src/app/(public)/performers/page.tsx` (+ `performers.module.css`): async server page
  — `listPublicBands(db)` + `listPublicCallers(db)`; a **Bands** section and a **Callers** section, each entry
  an `<h2>` name with `id="band-<bandId>"`/`id="caller-<performerId>"`, bio, photo (omit when null), style
  chips, members (`Name — instrument`) for bands, and `<PromoLinks>`; a single `<h1>`; mobile-first, no
  horizontal scroll; empty-state when the roster is empty.
- [X] T010 [P] [US1] Add `{ href: "/performers", label: "Performers" }` to `PUBLIC_NAV` in
  `src/app/publicNavItems.ts` (reachable from the nav, FR-010).

## Phase 4: User Story 2 — A visitor filters the roster by style (Priority: P2)

**Goal**: `/performers?style=<contra|english|community>` narrows bands and callers to that style; clearing
restores the full roster.
**Independent test**: with performers across ≥2 styles, selecting one shows only that style; clearing shows all.

- [X] T011 [US2] Add `?style=` handling to `src/app/(public)/performers/page.tsx`: read `searchParams.style`,
  pass it to `listPublicBands`/`listPublicCallers` (the lister filter is already covered by T005), and render
  style filter links (all + one per `STYLE_TAGS`) with the active one marked; an unknown/absent value shows
  the full roster. Server-rendered (mirrors the 037 series filter) — no client state.

## Phase 5: User Story 3 — A visitor jumps from an event lineup to a performer (Priority: P2)

**Goal**: a confirmed band/caller in an event-detail lineup (049/R5) links to its roster entry when public;
otherwise plain text (no broken link).
**Independent test**: an event with a confirmed public band → the lineup band name links to
`/performers#band-<id>`; a lineup performer with no public entry renders as plain text.

- [X] T012 [US3] Update the lineup component test `tests/component/lineup.test.tsx`: a band block with
  `onPublicRoster:true` (+ `bandId`) renders its name as a link to `/performers#band-<id>` and shows a
  member's instrument; a block with `onPublicRoster:false` renders the name as plain text (covers both a
  non-public and a public-but-archived band). A `full_bio` performer with `onPublicRoster:false` (public but
  NOT a caller) renders plain text — **no** broken `#caller-<id>` link. (Test-first — fails until T013/T014.)
- [X] T013 [US3] Thread the **roster-inclusion** flag (NOT raw `is_public` — the anchor only exists when the
  entry is actually on the roster, so the link gate must equal the roster predicate; see data-model
  §"Lineup projection"): `src/server/domain/bands/publicDisplay.ts` `BandBlock` + `getBand` mapping → add
  `bandId`, `onPublicRoster` (= `isBandPublic` = `is_public && archived_at IS NULL`), and `instrument` on
  members; `PublicBandBlock` in `src/server/domain/public/publicSchedule.ts` gains `bandId: string`,
  `onPublicRoster: boolean`, and members gain `instrument: string | null`;
  `src/server/domain/public/performerDisplay.ts` `full_bio` variant gains `performerId: string` and
  `onPublicRoster` (= `isCallerPublic` = `is_public && is_caller`). Reuse the `isBandPublic`/`isCallerPublic`
  predicates from `publicPerformers.ts` (T006) so the flag and the roster can never disagree. Update any
  fixtures in the existing `publicEventDetail*.test.ts` that construct these shapes.
- [X] T014 [US3] Update `src/app/(public)/_components/Lineup.tsx`: render a band/caller name as a link to
  `/performers#band-<id>` / `#caller-<id>` **only when** `onPublicRoster`, else plain text (FR-005); show
  each member's `instrument` when present.

## Phase 6: User Story 4 — Staff maintain a performer's public profile (Priority: P2)

**Goal**: a `performer.write` actor sets bio/photo/styles/links/caller/public on bands & callers without
touching contact PII; a bad link scheme is rejected; non-editors are refused.
**Independent test**: as a `performer.write` actor, set a band public + add a valid link → it appears on
`/performers`; adding a `javascript:` link is rejected (422); a base actor is refused (403).

- [X] T015 [P] [US4] Unit test `tests/unit/performerRosterValidation.test.ts`: `performerPatchSchema` and
  `bandPatchSchema` accept `isPublic`/`styles`/`links` (and performers `isCaller`); an invalid-scheme link is
  rejected; a band-member `instrument` string is accepted. (Test-first — fails until T016/T017.)
- [X] T016 [US4] Extend `src/server/validation/performers.ts`: add `isPublic`, `isCaller` (`z.boolean().
  optional()`), `styles: stylesSchema.optional()`, `links: promoLinksSchema.optional()` to
  `performerCreateSchema` and `performerPatchSchema` (import from `@/server/domain/public/promoLinks`).
- [X] T017 [US4] Extend `src/server/validation/bands.ts`: add `isPublic?`, `styles?`, `links?` to the band
  create/patch schemas and `instrument?: z.string().nullable().optional()` to the band-member input schema.
- [X] T018 [P] [US4] Authz integration test `tests/integration/publicPerformers.authz.test.ts` (real
  Postgres, the FR-008 guard): a **base-only** actor is **refused (403)** on `PATCH /api/performers/[id]` and
  `PATCH /api/bands/[id]` carrying the new roster fields (`isPublic`/`isCaller`/`styles`/`links`), and a
  `performer.write` actor **succeeds (200)** and the fields persist. Mirrors feature 051's
  `content.authz.test.ts`. (Test-first — fails until T019.)
- [X] T019 [US4] Wire the services: `patchPerformer`/`createPerformer` in
  `src/server/domain/performers/performerService.ts` apply `isPublic`/`isCaller`/`styles`/`links`;
  `createBand`/`patchBand` in `src/server/domain/bands/bandService.ts` apply `isPublic`/`styles`/`links`, and
  member create/roster read carry `instrument`. (Writes ride the existing audited PATCH/POST routes — no new
  route, no new capability.)
- [X] T020 [US4] Extend the performers admin (`src/app/(admin)/manage/performers/…` — moved off `/performers`
  so the new public roster can own that URL): add an **is-public** checkbox,
  an **is-caller** checkbox, **style** multi-select (contra/english/community), and a **promotional links**
  editor (type + url rows) to the performer editor, saved via the existing `PATCH /api/performers/[id]`.
  Surface the 422 on a bad link scheme (FR-006).
- [X] T021 [US4] Extend the bands admin (`src/app/(admin)/bands/…`): add **is-public**, **style**
  multi-select, **promotional links** editor, and a per-member **instrument** field, saved via the existing
  `PATCH /api/bands/[id]`.

## Phase 7: Polish & validation

- [X] T022 Gate suite: `pnpm exec vitest run tests/unit/promoLinks.test.ts
  tests/unit/performerRosterValidation.test.ts tests/integration/publicPerformers.test.ts
  tests/integration/publicPerformers.authz.test.ts tests/component/roster.test.tsx
  tests/component/lineup.test.tsx`, then `pnpm exec tsc --noEmit`, `pnpm run lint`, and
  `pnpm exec prettier --check` on the changed files. Full `pnpm test` green (0036 applied).
- [X] T023 Browser verify (quickstart §2–5): mark a band public + add a style, a member instrument, and a
  promo link → it appears on `/performers` with a safe outbound link and zero PII (SC-001/002/003); one H1,
  375px no-scroll, reachable from the nav (SC-005); `?style=` narrows correctly (SC-004); an event lineup with
  a public band links to its roster anchor, a private one renders plain text (SC-006); a `javascript:` link is
  rejected (FR-006); a base actor can't edit (FR-008).

## Dependencies

- **Foundational blocks all stories.** T001 → T002 → (T003 [P] → T004) and (T005 [P] → T006). T002 needs the
  `PromoLink` type, so author `promoLinks.ts` (T004) before/with T002's `$type<>()` import, or use a local
  type alias then unify — treat T004 as satisfying T002's type import.
- **US1** T007/T008 need T004 (PromoLink) + T006 (listers); T009 needs T006/T008; T010 independent ([P]).
- **US2** T011 needs T009 (the page) + T006 (the `style?` param).
- **US3** T012 → T013 → T014; needs T002 (instrument column) but is otherwise independent of US1/US2.
- **US4** T015 → (T016/T017) → T018 (authz test, test-first) → T019 (services) → (T020/T021 admin UI); needs
  T004 (schemas) + T002 (columns).
- **Phase 7** last.

## Parallel opportunities

- T003 (validation unit test) and T005 (gate integration test) are independent files ([P]).
- T007 (component test) and T010 (nav) are independent files ([P]); T008 (PromoLinks) is [P] with T007.
- T015 (US4 validation unit test) and T018 (US4 authz integration test) are independent files, [P] with
  other stories' work once Foundational lands.

## Implementation strategy

**MVP** = Foundational + **US1** + **US4** — the fields + the gate + the `/performers` roster + the admin
opt-in, so staff can publish real bands/callers and visitors can read them safely (with PII gated and links
sanitized). **US2** (style filter) and **US3** (lineup links) are independent enhancements layered after.
Security-first ordering: the **gate + link validation (T003–T006)** land in Foundational before any public
surface renders a performer.
