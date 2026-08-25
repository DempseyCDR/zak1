# Tasks: Org cluster — membership, donate, contact & board (P7-R12)

**Feature dir**: `specs/055-org-cluster/` · **Branch**: `055-org-cluster` (off `main`)
**Input**: plan.md, research.md, data-model.md, contracts/org-cluster.md, quickstart.md, spec.md

**Constitution**: Test-First (NON-NEGOTIABLE) — the test task in each area precedes its implementation task.
**Additive migration `0038`** (0037 is 054's; only US4 needs it). **No new capability** (`content.write` gates
the officer admin). ⚠️ **PII gate**: the board projection exposes only name + role + alias — never contact
email/phone (053-style, carried in the type). ⚠️ **Shared calc fix**: the 2-month early-renewal grace goes
**into `nextMembershipYearEnd`**, correcting door + online enrollment too — re-check their expiry assertions.
The favicons + both SVGs are already committed on this branch.

> **Post-implementation revisions (2026-08-25)** — the tasks below record the original plan; the shipped code
> diverges as follows (see spec §Clarifications):
> - **Contact + Board merged into one `/contact-us` page.** T017–T019 built `/contact-us` (route hyphenated;
>   `ContactList` now shows role · officer-name · alias via `listContactRoles`). T027–T029 (`/board`, `BoardList`,
>   `boardList.test.tsx`, `listBoardOfficers`) were **removed** after review. The officer admin (T030) still
>   supplies the names.
> - **Footer**: a single **"Contact Us"** link (no About group, no Board link).
> - **Reserved slugs**: `contact-us` only (`board` dropped — route gone).
> - **Registry**: no "Membership" role (the club has none).
> - **Membership calc**: implemented as a new grace-aware `grantedMembershipExpiry` layered on the (unchanged,
>   still-pure) `nextMembershipYearEnd`, with the two enrollment callers repointed — instead of mutating
>   `nextMembershipYearEnd` in place (T008). Same behavior; the pure-math tests stayed green.
> - The `/content` admin shows a hint about the embedded `contact-info` slug.

## Phase 1: Setup

- [X] T001 [P] Add `officers` to the `resetDb()` TRUNCATE list in `tests/integration/helpers/db.ts`.
- [X] T002 [P] Add `officer.set` to the `AuditEvent` `kind` union in `src/server/lib/audit.ts`.
- [X] T003 [P] Add `"contact"` and `"board"` to `RESERVED_SLUGS` in `src/server/validation/content.ts` (protect
  the dedicated routes from a 051 CMS-page collision).

## Phase 2: Foundational (shared registry + shared donate — blocks US1/US2/US3/US4)

- [X] T004 [P] Unit test `tests/unit/clubRoles.test.ts`: registry integrity — unique `key`s and `order`s; every
  `emailAlias` matches `^[a-z0-9._-]+@cdrochester\.org$`; `BOARD_ROLES` is the `isBoardSeat` subset in `order`;
  `isRoleKey`/`isBoardRoleKey`. (Test-first — fails until T005.)
- [X] T005 Create `src/server/domain/org/clubRoles.ts`: `ClubRole` type + `CLUB_ROLES` (key, roleName,
  emailAlias, isBoardSeat, `order` — the full list from audit §data-6: president, vice_president, treasurer,
  secretary, contra_booking, english_booking, membership, webmaster, …), `BOARD_ROLES` (isBoardSeat subset by
  `order`), `isRoleKey`, `isBoardRoleKey`. **`order` is the role's board display order** (registry-owned).
- [X] T006 [P] Create `src/app/(public)/_components/DonateButton.tsx` (shared by US1 `/join` and US2 footer):
  a PayPal **donation** affordance — a single `PAYPAL_DONATE_URL` constant (pre-rollout config), rendered as an
  outbound link/button labelled "Donate", `target="_blank" rel="noopener noreferrer"`.

## Phase 3: User Story 1 — Prospective member understands & joins (Priority: P1)

**Goal**: `/join` shows the tiers, the Sep 1–Aug 31 year, the coverage-through date a joiner gets today, and
benefits — keeping the 019 capture→PayPal flow; the shared expiry calc grants the **2-month early-renewal
grace** (used by door + online enrollment + `/join`).
**Independent test**: `/join` shows the four tiers + amounts, the year, and the coverage-through date; the
existing capture→PayPal path still works; `nextMembershipYearEnd` grants the grace.

- [X] T007 [P] [US1] Update `tests/unit/membershipTerm.test.ts` for the 2-month grace: `nextMembershipYearEnd(
  "2026-07-01","08-31") === "2027-08-31"` and `("2026-06-30","08-31") === "2026-08-31"` (window edge); the
  outside-window cases (Mar→this year, Sep→next year, on-boundary, 02-29 clamp) still hold. (Test-first — fails
  until T008.)
- [X] T008 [US1] Modify `src/server/domain/membership/membershipTerm.ts`: add `EARLY_RENEWAL_GRACE_MONTHS = 2`
  and an `addMonths(dateISO, n)` (day-clamped) helper; `nextMembershipYearEnd` returns the next boundary on/after
  `addMonths(paymentDate, 2)`. Update the doc comment to describe the grace.
- [X] T009 [US1] Re-check the enrollment integration tests that assert a membership **expiry** for a payment/
  event dated in **Jul 1 – Aug 31** and update the expected dates to the granted next-year boundary:
  `tests/integration/gate.membership.test.ts`, `exports.throughYear.test.ts`, `exports.member.test.ts`,
  `door.attendance-match.test.ts` (leave untouched any case outside that window).
- [X] T010 [P] [US1] Unit test `tests/unit/membershipYear.test.ts`: `membershipYearLabel("08-31") ===
  "September 1 – August 31"` (+ one other boundary). (Test-first — fails until T011.)
- [X] T011 [US1] Create `src/server/domain/org/membershipYear.ts`: pure `membershipYearLabel(monthDay)` →
  "<Month D> – <Month D>" window (start = the day after the `MM-DD` end).
- [X] T012 [US1] Remove the "PLACEHOLDER" caveat comment on `membershipYearEnd` in
  `src/server/db/schema/clubSettings.ts` (FR-003 — confirmed correct).
- [X] T013 [P] [US1] Component test `tests/component/joinPage.test.tsx` (jsdom) — target the **presentational
  pieces**, not the async server page: render `<MembershipTiers>` (the four tiers + amounts, the year label, and
  a **coverage-through date passed as a prop**) and confirm `<JoinForm>` renders the name/email capture + "Pay
  dues with PayPal" button. (Test-first — fails until T014.)
- [X] T014 [US1] Extract + restructure `/join`: create `src/app/(public)/_components/MembershipTiers.tsx`
  (presentational — tiers/amounts, `yearLabel`, `coverageThrough` as props) and
  `src/app/(public)/join/JoinForm.tsx` (client — the existing capture + PayPal hosted button, behavior
  unchanged, FR-002); make `src/app/(public)/join/page.tsx` a **server** page that reads `club_settings`,
  computes `membershipYearLabel(...)` + the coverage-through date via `nextMembershipYearEnd(today,
  membershipYearEnd)`, and renders `<MembershipTiers>` + a benefits summary + `<DonateButton>` (T006) +
  `<JoinForm>`. One `<h1>`.

## Phase 4: User Story 2 — A supporter donates (Priority: P1)

**Goal**: a clearly labelled Donate affordance (footer + `/join`) leads to the club's PayPal donation
destination, distinct from paying dues.
**Independent test**: the footer shows Donate reachable in ≤2 taps, leading to the donation destination.

- [X] T015 [P] [US2] Update `tests/component/footer.test.tsx`: the footer has an **"About"** group linking
  `/contact` and `/board`, and a **Donate** affordance (distinct from Join). (Test-first — fails until T016.)
- [X] T016 [US2] Update `src/app/(public)/_components/Footer.tsx`: add an **"About"** link group (`/contact`,
  `/board`) and replace the "Support the club" link with `<DonateButton>` (T006). Membership (Join) stays.

## Phase 5: User Story 3 — A visitor finds who to contact (Priority: P2)

**Goal**: `/contact` lists role→alias (server-rendered mailto, no PII) + a curated 051 CMS block below.
**Independent test**: `/contact` shows the aliases in the served markup (scripts off), no personal email; a
published `contact-info` CMS page renders below; unpublished → omitted.

- [X] T017 [P] [US3] Component test `tests/component/contactList.test.tsx`: each role renders with its
  `role@cdrochester.org` alias as a `mailto:` link; no personal/individual email text. (Test-first — fails
  until T018.)
- [X] T018 [P] [US3] Create `src/app/(public)/_components/ContactList.tsx`: render `CLUB_ROLES` as a
  `roleName → emailAlias` mailto list (server-rendered).
- [X] T019 [US3] Create `src/app/(public)/contact/page.tsx` (+ `contact.module.css`): one `<h1>`; `<ContactList>`
  then, below, `getContentPageBySlug(db, "contact-info")` → `renderMarkdown(publishedBody)` in a prose block
  (omitted when null). Mobile-first, no h-scroll.

## Phase 6: User Story 4 — A visitor learns who runs the club (Priority: P2)

**Goal**: `/board` lists officers by first+last name + role + role alias (PII-gated); staff assign contacts to
board roles.
**Independent test**: assign a contact to a role → `/board` shows name + role + alias, no PII; a vacant seat
shows role + alias with no name; a base actor can't assign.

- [X] T020 [US4] Migration `src/server/db/migrations/0038_officers.sql`: `CREATE TABLE IF NOT EXISTS officers
  (id uuid pk default gen_random_uuid(), role_key text NOT NULL UNIQUE, contact_id uuid NOT NULL REFERENCES
  contacts(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT
  NULL DEFAULT now())`. (No `order` column — order is the registry's.) Snapshot `zak1_dev`, then `db:migrate`.
- [X] T021 [US4] Drizzle schema `src/server/db/schema/officers.ts` (mirror; export `officers` + `OfficerRow`)
  and export from the schema index.
- [X] T022 [P] [US4] Zod `src/server/validation/officers.ts`: `officerSetSchema` (`roleKey` non-empty string,
  `contactId` uuid or null).
- [X] T023 [P] [US4] Integration test `tests/integration/officers.test.ts` (real Postgres): `setOfficer` inserts
  then reassigns (upsert on `role_key`), and clears with `contactId=null`; a **non-board** `roleKey` is rejected;
  `listBoardOfficers` returns board seats in registry order, each with name+role+alias, `name:null` for a vacant
  seat, and **no contact-PII field** on the result; an `audit_events` row is written. (Test-first — fails until
  T024.)
- [X] T024 [US4] Implement `src/server/domain/org/officerService.ts`: `listBoardOfficers(db)` (join `BOARD_ROLES`
  → `officers` → `contacts`; project `{ roleName, emailAlias, name }` — SELECT only `first_name`/`last_name`),
  `listOfficerAssignments(db)`, `setOfficer(db, roleKey, contactId, actorContactId)` (reject non-board key;
  upsert/delete; `recordAudit` `officer.set`).
- [X] T025 [P] [US4] Integration authz test `tests/integration/officers.authz.test.ts`: `POST /api/officers`
  refuses a base-only actor (403, names `content.write`) and allows a `content.write` actor. (Test-first —
  fails until T026.)
- [X] T026 [US4] API `src/app/api/officers/route.ts` (both `withAuth({ requires: "content.write" })`):
  `GET` → `listOfficerAssignments` + the board-role list; `POST` → `setOfficer` (validate `officerSetSchema`;
  422 on invalid).
- [X] T027 [P] [US4] Component test `tests/component/boardList.test.tsx` (jsdom): renders role + name + alias
  (mailto); a vacant seat shows role + alias with no name; no personal email/phone text. (Test-first — fails
  until T028.)
- [X] T028 [P] [US4] Create `src/app/(public)/_components/BoardList.tsx`: render `PublicOfficer[]` (role name,
  name when present, alias mailto).
- [X] T029 [US4] Create `src/app/(public)/board/page.tsx` (+ `board.module.css`): one `<h1>`;
  `listBoardOfficers(db)` → `<BoardList>`. Mobile-first, no h-scroll.
- [X] T030 [US4] Admin `src/app/(admin)/officers/page.tsx` + `NAV` entry in `src/server/auth/nav.ts`
  (`capability: "content.write"`): list the board roles with their current holder, assign/clear each via the
  existing `ContactPicker` → `POST /api/officers`.

## Phase 7: User Story 5 — Site identity polish (Priority: P3)

**Goal**: the favicon shows in the browser tab; the header shows the responsive logo linking home.
**Independent test**: any page shows the favicon; the header shows the icon (narrow) / logotype (wide) and
clicking it goes to `/`; its accessible name is "Country Dancers of Rochester".

- [X] T031 [P] [US5] Update `tests/component/publicNav.test.tsx`: the brand is an image with
  `alt="Country Dancers of Rochester"` whose link `href` is `/` (no visible wordmark text). (Test-first — fails
  until T032.)
- [X] T032 [US5] Update `src/app/PublicNav.tsx` (+ `PublicNav.module.css`): replace the text wordmark with the
  responsive brand logo — `/CDR_Icon.svg` on narrow viewports and `/CDR_Logotype_4Color.svg` on wide (CSS
  show/hide by width), **image-only**, `alt="Country Dancers of Rochester"`, link → `/`, ≥44px tap target.
- [X] T033 [US5] Update `src/app/layout.tsx`: `metadata.icons` → `/favicon.ico` (default) + `/favicon.png`,
  `/favicon-96x96.png`.

## Phase 8: Polish & validation

- [X] T034 Gate suite: `pnpm exec vitest run` the new/updated tests (clubRoles, membershipTerm, membershipYear,
  joinPage, footer, contactList, officers, officers.authz, boardList, publicNav), then `pnpm exec tsc --noEmit`,
  `pnpm run lint`, `pnpm exec prettier --check` on changed files. **Full `pnpm test` green (0038 applied)** —
  pay attention to the enrollment tests touched by the grace fix (T009).
- [X] T035 Browser verify (quickstart §2–7): `/join` (tiers, year, coverage-through, capture→PayPal, donate);
  footer About group + Donate; `/contact` (aliases server-rendered, no PII, CMS block below); assign an officer
  at `/officers` → `/board` shows name+role+alias, vacant seat name-less, base actor refused; favicon in the tab;
  responsive logo → `/`.

## Dependencies

- **Setup** (T001–T003) [P] independent. **Foundational**: registry (T004→T005) blocks US3 (T018/T019) and US4
  (T024); `DonateButton` (T006) blocks US1 (T014) and US2 (T016).
- **US1**: T007→T008→T009 (calc + enrollment re-check); T010→T011; T012; T013→T014 (T014 needs T006 + T011).
- **US2**: T015→T016 (T016 needs T006).
- **US3**: T017→T018; T019 needs T005 (registry) + T018 + 051 `getContentPageBySlug`/`renderMarkdown`.
- **US4**: T020→T021→(T022,T023)→T024→(T025→T026)→(T027,T028)→T029→T030. T024 needs T005 (BOARD_ROLES).
- **US5**: T031→T032; T033 independent.
- **Phase 8** last.

## Parallel opportunities

- All of Setup (T001/T002/T003). Foundational: T004 [P] and T006 [P] are independent files. US1 tests T007/T010
  are independent ([P]); US4 tests T022/T023/T025/T027 ([P]); US5 test T031 ([P]).

## Implementation strategy

**MVP** = Foundational + **US1** + **US2** — the content-complete membership page with the correct early-renewal
calc + a real donate affordance (the two P1 stories, plus the load-bearing calc fix that also corrects
door/online enrollment). **US3** (contact) and **US4** (board) are the P2 org pages; **US5** is polish.
Security-first within US4: the **PII-gated projection + authz (T023–T026)** land before the public board page
renders anyone.
