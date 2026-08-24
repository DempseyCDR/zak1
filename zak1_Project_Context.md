# zak1 — Project Context for Session Transfer

> Single living doc — no versioned copies. Update in place each session.

**Snapshot:** 2026-08-22 · **Repo:** `/Users/rcd/Repositories/zak1` · **Remote:**
`github.com/DempseyCDR/zak1` · **Head:** local `main` == `origin/main` at **`51cecea`** (PR #7 `backlog-tidy`
merge). **Working now on branch `048-whats-on-cards`** (P7-R4 spec+plan+tasks done, **not yet implemented**;
uncommitted). **Phases 3, 4, 5, 6 COMPLETE.** ⭐ **NOW IN PHASE 7 — the public website rewrite** (requirements
in `zak1_Phase7_Requirements.md`, keyed `P7-Rn`).
**Shipped & merged since 043:** **044** contact load — replace roster from iContact + membership import
(operator CLI `pnpm contacts:load`; migration **`0033`** `membership_level`) · **045** public design tokens
(P7-R1) · **046** public nav mobile pattern (P7-R2) · **047** public home page (P7-R3). 045–047 are frontend,
**no migration**. **048** `/whats-on` mobile-first event cards (P7-R4) is **specced/planned/tasked, implementing
next** (a small +2-field projection change, no migration).
⭐ **MAJOR GOVERNANCE CHANGE — MULTI-CONTRIBUTOR MODE IS NOW ACTIVE.** Zak became a second contributor at
feature 044, so per constitution v1.3.0 the workflow is permanently: **feature branches + reviewed PRs, no
self-merge to `main`** (the solo-maintainer one-atomic-commit-to-main habit is retired — see §4).
Suite **765 tests / 234 files green** through 047; `tsc`/eslint/markdownlint/prettier/build all clean. Node 24,
pnpm. Purpose: seed a fresh session to continue work on zak1 (CDR).

---

## 1. What this is

**zak1** = "Build 1" of a single-tenant management platform for **CDR** (Country Dancers of Rochester, a
contra/English dance club): contacts & membership, door attendance & gate money, performer bookings,
treasurer & organizer reports, mailing-list exports, a public website, staff auth, authorization, check-in,
booking & event management, membership acquisition (door + online), the Booker's booking-report/modal UX, and
the Financial-Secretary payment substrate.
**47 features shipped (001–047); Phases 1–6 COMPLETE; Phase 7 (public website rewrite) UNDERWAY** (044 contact
load + P7-R1..R3 shipped; P7-R4 in progress as 048). Money is always **integer cents**.
Single tenant (multi-tenant deferred).

> **Naming:** `zak1` is the internal codename; the club-facing name is **cdrochester** (what Google's
> consent screen shows). No rename wanted.

## 2. Tech stack & runtime

| Area | Choice |
|---|---|
| Language | TypeScript 5.7 (strictest flags) |
| Framework | **Next.js 16.2.10** (App Router, RSC, Turbopack) · React 19.2 |
| DB | PostgreSQL 16 (local Homebrew, LaunchAgent auto-start) |
| ORM | Drizzle (`src/server/db/schema/`) · hand-authored SQL migrations |
| Validation | Zod at every API boundary |
| Auth | `arctic` (Google OAuth2/OIDC) + `jose` (ID-token verify) — feature 015 |
| Tests | Vitest against **real Postgres** (node env) **+ React component tests** (jsdom, RTL) — see §4 |
| Runtime | **Node 24** (`.nvmrc`, `engines`) · package manager **pnpm** (NOT npm) |

**✅ Shell (was a gotcha, now RESOLVED):** the Bash tool inits from the user profile, whose **nvm default is
Node 24** — `node`/`pnpm` run on 24 with **no prefix needed** (the old "defaults to Node 18" note is obsolete;
the stale `/usr/local/bin` Node 16 was purged). For `psql`/`pg_dump`, still source env: `set -a; . ./.env;
set +a`.

**⚠️ CLI env (016 fix):** `db:migrate`, `db:seed`, `auth:bootstrap` use `tsx --env-file-if-exists=.env` —
`client.ts` reads env at module scope. Don't revert.

**⚠️ PayPal env (019, for online membership rollout):** `PAYPAL_WEBHOOK_ID`, `PAYPAL_CLIENT_ID`,
`PAYPAL_CLIENT_SECRET`, optional `PAYPAL_API_BASE` (default `https://api-m.paypal.com`) — read only inside
`verifyPaypalWebhook` (never by tests). Absent in dev; the webhook returns 401 (unverifiable) until set.

## 3. Databases

- **`zak1_dev`** (`DATABASE_URL`) — dev/demo data, **persists on disk**. ~1335 contacts, ~30 performers.
- **`zak1_test`** (`TEST_DATABASE_URL`) — auto-migrated; `resetDb()` TRUNCATEs (list includes the 019/020
  tables).
- **Migrations:** additive SQL in `src/server/db/migrations/`, `pnpm run db:migrate`. **Latest =
  `0033_membership_level.sql`** (044) — adds a `membership_level` enum (`individual`/`family`/`supporter`/
  `student`) + `memberships.level` (backfilled to `individual`, then NOT NULL); for the contact-load re-import.
  Prior: **`0032_drop_account_mapping.sql`** (039, P6-R7) — a **destructive** `DROP TABLE IF EXISTS account_mapping`
  (idempotent; the second destructive migration; snapshot `~/zak1_pre_0032.dump`; applied). `0031` (038, P6-R6)
  was the first destructive `DROP TABLE IF EXISTS non_dance_income` (snapshot `~/zak1_pre_0031.dump`).
  `0030_normalize_contact_phones.sql` (032, P5-R6) normalized `contacts.phone` to E.164 (snapshot
  `~/zak1_pre_0030.dump`). `0029_gate_sales_note.sql` (031) added nullable `gate_sales.note`.
  `0028_backfill_contact_names.sql` (027) re-split mis-split contact names (snapshot `~/zak1_pre_0028.dump`).
  **Phase 6 features 034/035/036/037 add NO migration** (UI/domain over the existing schema); 038 (`0031`) +
  039 (`0032`) are the two destructive `DROP TABLE` removals. `0027_payment_allocation_and_voids.sql` (023) =
  `payment_bookings.amount_cents` (per-line allocation,
  **backfilled** proportionally so lines sum to the check total) + `performer_payments` void columns
  (`voided_at`, `void_reason`, `replaces_payment_id`). `0026_drop_bookings_check_number.sql` (021) **removed**
  `bookings.check_number` (reconcile-then-drop; `performer_payments` is now the sole check store).
  `0025_booker_experience.sql` (020) added `booking_status 'tentative'` + `venues.short_name`.
  `0024_payments_membership.sql` (019) added `performer_payments`, `payment_bookings`, `membership_captures`,
  `paypal_notifications`, `club_settings.membership_year_end`, `memberships.source_*` indexes.
- **`pnpm run db:seed` TRUNCATEs `zak1_dev`** — never run it; it is not a migration rollback.
- **Snapshots on disk:** `~/zak1_pre_0024.dump` … `~/zak1_pre_0028.dump`, `~/zak1_pre_0030.dump`,
  `~/zak1_pre_0031.dump`, `~/zak1_pre_0032.dump` (pre-migration safety copies).

## 4. Tests & governance

Pipeline `/speckit-specify → clarify → plan → tasks → analyze → implement`. Active pointer
`.specify/feature.json` → **`specs/048-whats-on-cards`** (specced/planned/tasked; implementing next).
**Constitution v1.3.0** (non-negotiable):
I Test-First (Red-Green-Refactor), II YAGNI, III Type Safety (Zod at boundaries), IV Observability.
Testing standard: integration against **real** local infra; DBs never mocked; third-party services (Google,
PayPal) exercised at their **boundary**, never production endpoints. **Suite: 765 tests / 234 files green
through 047**. tsc, eslint, markdownlint, prettier, production build all clean on Next 16.

**⚠️ Two test types (feature 020, closes analyze finding C1):**

- **Integration/unit (node, real Postgres)** — `tests/**/*.test.ts`. The default.
- **Component (jsdom, React Testing Library + user-event + jest-dom)** — `tests/**/*.test.tsx`. A file opts
  into jsdom with a `// @vitest-environment jsdom` docblock at the top. `tests/setup.dom.ts` registers
  jest-dom matchers + guarded RTL cleanup (a no-op in node tests). Component tests **stub `fetch`** — that is
  UI-boundary isolation, **NOT** the DB-no-mock rule (which governs integration tests only). Harness committed
  separately (`5d62e1b`). ⚠️ **Lesson learned (020):** stubbed responses must mirror what the real API
  returns — a component test that stubbed `startTime: "19:30"` missed a `HH:MM:SS` validation bug (see §9).

**⚠️⚠️ MULTI-CONTRIBUTOR MODE IS NOW ACTIVE (since feature 044, 2026-08-20).** Constitution v1.3.0's
§Development Workflow is **two-mode**, keyed to how many people contribute code. **Zak landed code at 044**, so
per the amendment the project **switched permanently out of solo-maintainer mode**. The rules are now:
**every feature on its own branch → reviewed PR → merge; NO self-merge to `main`, NO direct commits to `main`.**
(The old solo habit — one atomic commit straight to `main`, feature branches optional — is retired; do not
resume it.) Features 044–047 all shipped this way (PRs #2, #4, #5, #6; backlog-tidy #7). Recorded in memory as
`zak1-multi-contributor-mode.md`.

**Commits:** one atomic commit per feature **on a feature branch**, opened as a **PR** (never self-merged),
trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Commits are **SSH-signed via 1Password**
(`commit.gpgsign=true`, `op-ssh-sign`); if a commit fails with "1Password: failed to fill whole buffer",
1Password is locked — ask the user to unlock, then retry. Ask before pushing (routine).

## 5. Repo layout (key paths)

```text
docs/use-cases.md            ★ authoritative role model + permission matrix (P3-1..P4-1 enforced)
docs/zak1_Help_Glossary.md   term → file index (has feature-019 & 020 sections)
src/app/
  (admin)/bookings-report/page.tsx booker report: venue short name, sort, status letters, empty slots, modals
  (admin)/_modals/BookingModal.tsx booking create/edit/read-only modal (typeahead, add-performer, mailto)
  (admin)/_modals/EventModal.tsx   event create/edit/read-only modal (prior-event defaults, dynamic rent)
  (admin)/payments/page.tsx        FS/Treasurer performer payments: per-line allocation + void (023) + parked online-payment linking (019)
  (admin)/door-parameters/page.tsx per-series seed float (019 US5)
  (admin)/venues/page.tsx          venue CRUD + short name (020) + landlord picker (018)
  (door)/gate/page.tsx             door money; named membership line → enrollment (019); seed float prefill; substitute add-booking (024)
  (door)/checkin/page.tsx          check-in; default-recent + desc selector, inline single-row entry, roster correction modal, staff nav on home (025)
  (public)/join/page.tsx           public membership capture + PayPal hosted button (019 US3)
  api/**/route.ts                  all declare withAuth({ requires }) EXCEPT the two withPublic routes below
  api/public/membership, api/webhooks/paypal  the ONLY unauthenticated routes (withPublic + allowlist, 019)
  api/me/capabilities              { bookingWrite, eventWrite } so the report gates edit affordances (020)
src/server/
  auth/                capabilities.ts · can.ts · fields.ts · pii.ts · nav.ts · withAuth.ts · withPublic.ts
  domain/bookings/     bookingService (lead cascade · re-point/clear guard · substitutePerformer — 024) · bandRepoint (024) · bookingStatus (tentative) · reportService (sort/venue/hasSoundTech/bandId)
  domain/payments/     performerPaymentService (per-line, void, cross-event, settlement + bookingHasLivePayment — 023/024) · reconcile
  domain/attendance/   attendanceService (recordAttendance · roster · deleteAttendance/patchAttendance/moveAttendance — 025 corrections)
  app/apiFetch.ts      shared client 401→/login wrapper (022, B41) — all staff /api fetches go through it
  domain/paypal/       verify (injectable seam) · captureService (019)
  domain/membership/   membershipService (DbOrTx) · membershipTerm · classify
  domain/performers/   performerService (searchPerformers, getPerformerMailtoEmail)
  domain/contacts/     mailtoEmail (020) · …
  domain/venues/       venueService (venueShortNameDefault) · …
  domain/parameters/   seriesParameterService (resolveParameterCentsOrNull) · rentService (resolveRentForVenue)
  domain/events/       eventService (priorEventDefaults, deleteEvent guardrail)
  db/schema/ · db/migrations/0027 · lib/routeInventory.ts · lib/rateLimit.ts · lib/audit.ts
tests/{unit,integration,component}/
```

## 5b. Memory pointers (`~/.claude/.../memory/`)

`zak1-implementation-status.md`, `zak1-020-booker-experience.md`, `zak1-phase3-roles.md`,
`zak1-015-staff-auth.md`, `zak1-demo-db-persistence.md`, plus the feature-breakdown and backlog notes, and the
**Phase 4** notes: `zak1-phase4-requirements.md` (umbrella), `zak1-phase4-fs-payments-draft.md`,
`zak1-phase4-meg-checkin-notes.md`. **Governance:** `zak1-multi-contributor-mode.md` (multi-contributor mode is
active since 044 — feature branches + reviewed PRs, no self-merge to `main`).

## 6. Implementation status (001–047 shipped)

Phase 1 (001–009) · Phase 2 (010–014) · **Phase 3 COMPLETE: 015 auth · 016 authz · 017 check-in · 018
booking/event mgmt · 019 payments & membership** · **Phase 4 COMPLETE: 020 Booker experience (P4-1) · 021 drop
`bookings.check_number` · 022 client 401→`/login` (B41) · 023 FS payments substrate · 024 booker amendments
(Area A — lead cascade, band re-point, written-check discriminator; no migration) · 025 door-attendant
experience (Area C — per-record roster corrections + selection/entry polish; no migration)** — all
**implemented and pushed**. **Nothing outstanding in Phase 4** (Areas A–D all delivered).

**Phase 5 (COMPLETE):** requirements collected in **`zak1_Phase5_Requirements.md`** (P5-R1..R7 + defects D1/D2;
all questions Q1–Q14 resolved). **Shipped: D2** gate data-loss fix (`aea57c6`); **026/027** structured name
capture + backfill (R5, migration `0028`); **028** shared event selector (P5-R1, no migration — adopted on
check-in/gate/payments/treasurer, in-page state, treasurer moved to a single `/treasurer` page); **029**
bookings report descending default (P5-R2, no migration); **030** payments per-performer workflow (P5-R3, no
migration); **031** gate cash counting (P5-R4, migration `0029` `gate_sales.note`); **032** phone
normalization (P5-R6, migration `0030`); **033** dedup review shows phone+email (P5-R7, display-only, no
migration). **All R-items R1–R7 delivered.** Deferred out of Phase 5: dedup phone/email **matching** (Q14),
backlog **B43** (simplify `is_donated` model — deferred during 030), and defect **D1** (`/payments` has no nav
link — rehomed to Phase 6, see below).

**Phase 6 (COMPLETE):** requirements in **`zak1_Phase6_Requirements.md`** (R1–R12 + defects D1/D3).
Each R-item goes through the full SpecKit pipeline as its own feature. **Requirement → feature map:**

- **Navigation** — **R1 → 034** (public-pages menu, rendered once from the ROOT layout on every page; hand-
  maintained `PUBLIC_NAV`; generation deferred to backlog **B44**). **R2 → 035** (volunteer menu, moved to the
  root layout too — on every page when signed in; **completeness guard** `auth.navCompleteness.test` walks the
  `(admin)`/`(door)` page tree so no page can be orphaned; **subsumes D1** — `/payments` + 4 other orphans added
  to `NAV`; `/dev/routes` allowlisted). **Both SHIPPED.**
- **Public event listings** — **R3 → 036** (`/whats-on` window = two-days-ago-onward, ascending;
  `homeWindowStart` helper). **R4+R5 → 037** (new `/what-was-on` history `< today` desc + server-rendered
  `?series=` filter on both listings; shared `ScheduleList`/`SeriesFilter`; internal `listPublicEvents`;
  `/what-was-on` added to `PUBLIC_NAV`). **Both SHIPPED.**
- **Treasurer report rework** — **R6 → 038 SHIPPED** (purge `non_dance_income`, migration `0031` DROP TABLE;
  `account_mapping` table kept, only its seed row removed). **R7 → 039 SHIPPED:** purged the `account_mapping`
  GL-code-per-line annotation (migration `0032` DROP TABLE) — **kept `series_qbo_map`** (customer + class) and
  `mapping_audit`; the report keeps its shape minus the account column, no computed figure changed. **R8 + R9 →
  040 SHIPPED:** the report now reads in QBO data-entry order (Sales Receipts [gate/attendance receipt first →
  named] → Bills [rent → landlord, *not paid by FS*, no check line] → Performer Payments [one section] → Deposit →
  Fees; community-dance gate = own series → Contra Gate, no special-case code) **plus** comp-admission +
  gift-card-redemption counts (raw `door_records.comp_count` / `gift_card_redemption_count`). **No migration** — a
  report reshape + 3 additive `TreasurerReport` fields (`bills`, `compCount`, `giftCardRedemptionCount`). Rent bill
  amount = `resolveEventRentCents(db, event)` (same resolver as the organizer report); vendor = venue landlord
  with `"(no landlord set)"` fallback; QBO section **order is realized on the page** (existing fields kept their
  names → zero churn to existing figure assertions). Load-bearing invariant held: **no computed figure changed**
  (FR-010). `makeEvent` factory gained optional `{ venueId, rentCents }`. D3 + B42 out of scope.
- **Door & reporting tweaks** — **R10 → 042 SHIPPED** gift-card checkbox added to **both** named-person check-in
  paths (new-contact section + returning/matched `CandidateRow`), wiring the already-supported `redeemedGiftCard`
  flag; **client-only** — `attendanceSchema` already spread `countExtras` (`isComp`+`redeemedGiftCard`) into all 3
  variants and `recordAttendance` already increments the count (the anonymous path already had it). Clarified to
  cover the returning path too, not just new-contact. No schema/service/route/migration. ·
  **R11 → 041 SHIPPED** organizer report `band` field shows the booked **band's name** (via a `bandId→bands.name`
  map loaded once; ad-hoc→joined names / "Open Band" / "" fallbacks unchanged; multiple bands→names joined) + the
  per-dance detail expansion gained a **`Band:` label** (members already listed by name+role). Display-only, no
  migration, no computed figure changed; `makeBand` test factory added. ⚠️ **jsdom lesson:** the organizer page
  reads `params` via React `use()` (suspends) → its component test needs a `Suspense` boundary **and** an awaited
  `act()` around `render`. · **R12 + D3 → 043 SHIPPED** (see below).

**043 substitution move + D3 fix (P6-R12 + defect D3, SHIPPED):** substitution moved from `/gate` to `/payments`.
The route `POST /api/bookings/[id]/substitute` re-gated `booking.write` → **`base`** (layer 1); the REAL gate is
`substitutePerformer`, which now asserts **EITHER `booking.write` OR `performer_payment.write`** in the event
scope via a new **`assertEventScopeAny`** helper (`can.ts`). ⚠️ The downstream `patchBooking`/`createBooking` calls
must pass **`authz=undefined`** (bypass their `booking.write` re-assertion — the 030 precedent), else the FS still
403s. This keeps the **Booker's** bookings-report modal substitute working (2026-08-06 clarify) while fixing the
FS's 403; the gate substitute UI was removed. 024 semantics unchanged. **D3 (client-only, `/payments`):** (a)
`recordMulti` now applies the FR-014 guard — a positive multi-booking check needs a check number **or** a note
(never forced); (b) a **multi-line** payment gets an in-place **check-number-only edit** — PATCH `{ checkNumber }`
with **no `lines`** (the patch service only replaces the allocation when `lines` is sent, so amounts are
preserved). ⚠️ An existing test (`payments.allocation.test.tsx`) had encoded the D3 bug (positive multi-check with
no number saving silently) — updated to supply a check number. No migration, no schema/Zod change. **Data already
corrected** in `zak1_dev` (not in git): payment `65fdeb94…` (event `7e9a83e7…`, 7/9/2026) `check_number` = **`1792`**
(was NULL) — Clara's one check covers Clara $50 + Micah $50.

**044 contact load (SHIPPED, merged PR #2):** operator CLI **`pnpm contacts:load`** (`src/server/db/contactLoad.ts`)
that **replaces the roster** from a real **iContact CSV export** + a **CDR membership `.ods`** workbook. Hard-reset
of all non-role contacts; **retains only role-grant holders** (FR-018); imports email-consent permissions
(custom attribute `-1` == blank, NOT unsubscribe; **all import emails valid for contact_tracing**), memberships
with the new **`level`**, and volunteer flags (`is_volunteer` from the sheet's `Yes`). Member sheet **wins
identity**; performer↔contact links are **proposed for human confirmation**, never auto-applied. Migration
**`0033`** adds `membership_level` + `memberships.level`. Domain module `src/server/domain/contactLoad/`
(parse iContact/member/payer sheets, buildRoster, buildMemberships, matchPerformers, execute, summary). Operator
safety: **dry-run by default**, **pg_dump backup**, **single transaction**, audit event. **RESTRICT-FK handling:**
null the nullable refs (`audit_events.actor_contact_id`, `role_grants.granted_by`) and retain merge-audit parties
so the hard reset can proceed. iContact attributes not already in the schema are discarded.

⭐ **Phase 7 (UNDERWAY — the public website rewrite):** requirements in **`zak1_Phase7_Requirements.md`**
(keyed `P7-Rn`). Frontend-first; each R-item is its own SpecKit feature; **all merged via reviewed PRs**
(multi-contributor mode). **Requirement → feature map:**

- **P7-R1 → 045 design tokens (SHIPPED, PR #4):** hand-rolled **CSS custom properties** in `globals.css`
  (`:root` tokens only) + **CSS Modules** (chosen over Tailwind in `/speckit-clarify`), `next/font/google`
  (Raleway + Open Sans) in `layout.tsx`, a public-scoped visual layer `(public)/public.module.css`, and a
  `(public)/_components/Container`. **WCAG AA is baked into the token *values*** — a contrast test parses
  `globals.css` (e.g. `--link: #954e27`, the AA-correct link colour, not the failing `#b96131`). `tokens.ts`
  exports `EventType` + `EVENT_TYPE_COLORS: Record<EventType, string>` → `var(--type-*)`.
- **P7-R2 → 046 public nav mobile (SHIPPED, PR #5):** `PublicNav.tsx` — a **React-controlled hamburger
  disclosure** (`aria-expanded`/`aria-controls`, list always in the DOM, `<noscript>` reveal, Escape
  closes + returns focus, close-on-route-change); `PublicNav.module.css` swaps compact↔inline at **768px**
  with ≥44px targets. Flat link list (no dropdowns).
- **P7-R3 → 047 public home (SHIPPED, PR #6):** `/` **becomes** the public home (`(public)/page.tsx`,
  the old `src/app/page.tsx` removed). Hero via `<Image src="/hero.webp" fill priority sizes="100vw">`
  (a **URL string, NOT a static import** — Next can't static-import from `public/`), `--hero-focus: center 30%`,
  `object-fit:cover` + `min-height: clamp(...)` + scrim; a `NewHere` orientation block ("no partner needed");
  next dances via `getPublicSchedule(db)` sliced to 4 + the shared `ScheduleList`. Site-wide `Footer` +
  `(public)/layout.tsx`. Asset `public/hero.webp` (283 KB, lowercase, re-encoded from a 1.2 MB PNG).
- **P7-R4 → 048 whats-on cards (SPEC/PLAN/TASKS DONE — implementing next, on branch `048-whats-on-cards`):**
  restyle the shared dance list from text rows into tappable **cards** (one `EventCard` used by `/whats-on`,
  `/what-was-on`, and the home strip). Adds **two projection fields** to `PublicScheduleItem` —
  `seriesKey: string` + `venueShortName: string | null` — by selecting `series.key` + `venues.short_name` in
  `listPublicEvents` (**no migration**). A co-located `seriesColor.ts` maps series key → R1 colour var
  (`tnc`→contra, `ecd`→english, `community_dance`→special, `general`→assembly; unmapped → neutral `var(--band)`);
  the colour is a **left accent stripe** (`--card-accent`), never behind text (AA holds). The `?series=` filter,
  cancelled marker, and confirmed-only rule are unchanged.

## 7. Load-bearing decisions (do not undo without reading why)

**016 authz:** Organizer is the BASE (every authenticated volunteer; reads all but contact PII) + additive
grants. Routes declare `withAuth({ requires })` (guarded by `auth.routeInventory.test.ts`); services call
`assertScope`/`assertEventScope`/`assertFields`. **Money is OPEN to all volunteers; only PII is gated.**
Super-user is CLI-only. President/VP/Treasurer mutually exclusive (Secretary exempt). **020 added
`GET /api/me/capabilities`** so a client page can hide edit affordances (the write itself stays server-gated).

**019 payments & membership (P3-5):** `createMembership`/`createPayer` are now `DbOrTx` (one shared,
transactional membership-creation path). **Door enrollment idempotency is keyed on (contact, target
boundary), NOT the gate-sale id** — `putGateSales` is replace-all so gate-sale ids change every save.
**Performer payments** (`performer_payments` + `payment_bookings`) are separate from bookings; the treasurer
report **cut over to read actual payments** (a booked-but-unpaid performer now shows as a reconciliation gap,
backfill preserves history; `bookings.pay_cents` is never written by the payment path). **US3 online**: the
project's **first two unauthenticated routes** via `withPublic` + an enumerated `PUBLIC_API_ROUTES` allowlist
(guarded by the route-inventory test); idempotency is the DB `provider_event_id` unique + `memberships`
partial-unique indexes; verify is an **injectable boolean seam** (tests never call PayPal); unmatched
verified payments are **parked** for admin linking. **US4** relaxed 018's delete guardrail (empty door record
= no history; attendance confirmed not blocked; gate sales/check numbers/performer payments still block).
**US5** seed float is a per-series parameter via **`resolveParameterCentsOrNull`** (null ≠ 0 — do NOT use the
`?? 0` resolver for it). **FS + Treasurer gained `performer.write`** (FR-009a) to add substitute payees.

**020 Booker experience (P4-1):** `tentative` booking status (requested→tentative→confirmed/declined,
skippable; **also added to `bookingPatchSchema`** — the enum alone isn't enough); public confirmed-only
filter excludes it with no change. Report gained `sort`, `venueShortName` (fallback to derived initials),
`hasSoundTech` (**must be on the row** — `/api/series` returns only `{id,key,name}`), and `bookingId` per
line. Two shared modals in `(admin)/_modals/` (used by the report). **`createPerformer` already links an
existing contact** when given `contactId` — the add-performer hand-off is UI-only. Rent is **dynamic
(Option A)**: leave-at-default stores `rentCents: null`; a typed value freezes an override. `/bookings` page
left as-is (keeps its band-booking flow); the modal flow lives on the report.

**021 drop `bookings.check_number`:** a check number lives **only** on `performer_payments` now (the booking
column was an error). Migration `0026` reconciles any residual value into `performer_payments` before
dropping. The event-delete guardrail's check blocker moved to `performer_payments` (Blocker 3, 019); the gate
check-entry UI was removed here and rebuilt on `performer_payments` in 023.

**022 client 401 → `/login` (B41):** a shared client wrapper `src/app/apiFetch.ts` — on a 401 it navigates to
`/login?next=<current path>` (reusing 015's `safeNextPath`) and returns a **never-settling** promise (so no
surface paints "no match" over an expired session, and fire-and-forget `.then` callers emit no unhandled
rejection). 403 and 2xx pass through for inline handling. **All staff client `/api` fetches go through
`apiFetch`**; the public `join` page keeps raw `fetch`.

**023 FS payments substrate (Area B):** `payment_bookings` gained **per-line `amount_cents`** (a check's lines
sum to its total); `performer_payments` gained **void** columns. A payment MAY settle bookings from **other
events** (cross-event delayed checks — the same-event constraint was relaxed); its `event_id` is the
**recorded-at / check-written** event, while each line's booking carries the **performance** event.
**Reconciliation & settlement count LIVE (non-voided) per-line amounts by the booking's event.** Treasurer
per-event report = checks **written-at** the event with a per-line breakdown, voided shown distinctly;
organizer performer cost = **one combined figure** (actual-paid + still-outstanding) by **incurred** date. The
event-delete guardrail was **widened** to block a live **cross-event** settlement (FR-013). Payment-create
input changed `bookingIds` → per-line **`lines: [{ bookingId, amount }]`**. B42 (non-performer reimbursement,
Mike's) stays deferred.

**024 booker amendments (Area A, no migration):** three booking-state rules on 020/023. (1) **Lead status
cascade** inside `patchBooking`: a band lead's status change propagates to sibling bookings still at the lead's
**previous** status (lockstep → every follower move is a legal transition by construction; diverged/declined
skipped; status-only). (2) **Written-check discriminator** — `bookingHasLivePayment(db, bookingId)` on the 023
payments domain; `patchBooking` re-point and `deleteBooking` **refuse** a booking settled by a **live** check;
`substitutePerformer` branches (unpaid → clean re-point; paid → keep original as a **direct** `declined`
no-show + a fresh booking for the sub). (3) **`repointBand`** (`bandRepoint.ts`): remove the outgoing band's
unpaid bookings, keep paid ones as no-shows, re-book the incoming roster via `bookBand` (widened to `DbOrTx`).
⚠️ **analyze H1**: the internal no-show `declined` (substitution / band re-point) is a **direct `bookings`
update, never via `patchBooking`**, so it bypasses the FR-001 cascade — substituting a no-show lead does NOT
decline the band. Routes: `POST /api/bookings/[id]/substitute`, `POST /api/events/[id]/repoint-band`.

**025 door-attendant experience (Area C, no migration):** per-record roster **corrections** over the existing
017/016/010 shape (the `attendance` table already had `children_count`, `is_open_band`, nullable `contact_id`;
`events.attendance_count` is already denormalized). `deleteAttendance` / `patchAttendance` (children /
reassign-with-dup-guard / open-band toggle) / `moveAttendance` keep `events.attendance_count` **and**
`door_records.open_band_count` **exact**; `adjustDoorCount` does comp/gift **±1** (counts-only, floor 0);
`getGroupSiblings` + a **server-validated** move. ⚠️ Move guardrails (analyze): refuse a **non-sibling** target
(L1), refuse when the dancer is **already on the target** (G1), and **clear `is_open_band` + release the source
`open_band_count`** when an open-band admission moves to a non-community-dance sibling (G2). **FR-015**:
children now ride the **unmatched/anonymous** path too (reverses a 017 rule; updated `checkin.family` test).
Mutations follow `recordAttendance`'s **non-transactional** style (not `db.transaction` — widening
`ensureDoorRecord`/`resolveSeedFloatCents` to a tx would cascade; YAGNI). Routes: `PATCH`/`DELETE
/api/attendance/[id]`, `GET /api/events/[id]/group-siblings`, `POST /api/events/[id]/door-count` (all
`attendance.write`). UI: default-recent + descending selector, inline single-row check-in + focus-to-search,
clickable-row correction modal, staff nav on `/` home, dropped the vestigial "open door record" button. New
audit kinds `attendance.updated`/`.deleted`; `ATTENDANCE_NOT_FOUND` error.

**026 structured name capture (R5-P1, no migration):** `createPerformer` was the only route writing a
`contacts` row from a single free-typed name (`firstName: input.displayName`). Fixed: `performerCreateSchema`
is now structured (`firstName` + `lastName?` + `displayNameOverride?`, with a refinement **contactId XOR
firstName**); the contact is built via `deriveContactNames` (012); the performer's `display_name` is **derived**
(from the names on create, or the linked contact on the link path — never free-typed). Surfaces: performers
page + booking add-performer capture structured names; linking an existing contact posts only `{ contactId }`.
The `makePerformer` factory splits its convenience string → structured (kept the suite green + upgraded test
data).

**027 backfill mis-split contact names (R5-P2, migration `0028`):** one-time idempotent `UPDATE` re-splitting
`last_name IS NULL AND btrim(first_name) LIKE '% %'` at the **last** space; writes **only** first/last
(`display_name`/`name_normalized`/`dedup_normalized` unchanged — already derived from the full name). ⚠️
**Testing a one-time migration**: the integration test **reads + executes the `0028` SQL file** against seeded
rows (single source of truth; the `last_name IS NULL` guard makes re-exec safe = the idempotency proof).

**028 shared event selector (P5-R1, SHIPPED `d30c8d7`, no migration):** extracted 025's smart selector into one
shared client component **`src/app/EventSelector.tsx`** (`{ value, onSelect(event) }`) used on all four
single-event surfaces (check-in, gate, payments, treasurer). Owns the `/api/events` (already desc) +
`/api/series` fetch; default most-recent-≤-today (else soonest upcoming) fired **once** via a `didDefault`
ref; **series + date-range filters** narrow client-side; native `<select>` (`aria-label="Event"`, options
`date · HH:MM · label`) — so "confirm on pick, not on filter" falls out; empty state. ⚠️ **NO deep links /
per-event URLs** (in-page state) → treasurer restructured `/treasurer/[eventId]` → single `/treasurer` page
(fixed the broken `/treasurer/latest` nav link, FR-010). Check-in's `Event` aria-label + option format
preserved so 025's `checkin.selector.test.tsx` stays green **unedited**. Each surface keeps its own follow-on
side effect in `onSelect` (gate opens the door record, payments loads bookings/payments, treasurer reloads
the report). ⚠️ **Gotcha found in impl:** the default fires `onSelect` on open, so the gate/payments surfaces
auto-run their side effect for the default event — intended ("land on the right event"), and the reused local
`toHHMM` in check-in's correction modal had to be re-added when the shared copy moved to `EventSelector`.
Realizes backlog **B39**.

**029 bookings report desc default (P5-R2, SHIPPED `954748f`, no migration):** flipped the bookings report's
default sort from ascending (020 US1) to **descending** (newest-relevant-first) in **three coordinated spots**:
page initial state (`bookings-report/page.tsx` `useState("desc")`), service default (`reportService.ts`
`orderBy` no-`sort` → desc), route absent-`sort` default (`api/bookings/report/route.ts` → desc). Two existing
ascending assertions moved to descending (test-first). The toggle still reaches both directions.

**030 payments per-performer workflow (P5-R3, SHIPPED `37a88d7`, no migration):** `/payments` reorganized as
**one row per performer** — enter a check number → a payment to that performer for the booked amount (blank →
booked; typed amount honored); rows commit independently; a positive amount with no check# confirms with a
**comment** (stored as the note). Free rows (donated / instructor / `$0`) show as free (open-band musicians are
comped **attendees**, not payments rows — only paid lead musicians appear). Two **narrow settlement ops gated
on `performer_payment.write`, NOT `booking.write`** (the FS/Treasurer lack booking-write): **donate-at-
settlement** (`POST /api/bookings/[id]/donate` — `0`+no check# flips a paid booking to donated; refuses a
live-paid/already-donated booking; direct `bookings` update, no band cascade) and **add-settlement-performer**
(`POST /api/events/[id]/settlement-performer` — creates a booking via `createBooking` with `authz=undefined`
after asserting payment scope; dedupes). Multi-apply moved to a popup; inline edit via `patchPerformerPayment`;
void unchanged. ⚠️ **FR-016:** `listPerformerPayments` gained **`settledByBooking`** (cross-event-aware, from
the existing `settledCentsByBookingForEvent`) so a booking paid by a check recorded at **another** event reads
**paid, not outstanding** (four-way row state: free / paid-here / settled-elsewhere / outstanding) — no schema
change, reconciliation math untouched. Realizes **B39**.

**031 gate cash counting (P5-R4, SHIPPED `5b695fb`, migration `0029`):** an **optional, transient** denomination
helper on `/gate` (bill counts × face + coins + checks → grand cash total → "Use as gross cash"); the **direct
gross-cash entry always exists** (one value, last entered wins); **checks fold into gross cash** (no separate
tender). A single free-text **anonymous-sales comment** persists on the new nullable **`gate_sales.note`**
(attached to the anon line(s); reloaded from the first anon line with a note — one section comment over a
per-row column). Denomination breakdown **not persisted** (transient). Deposit math unchanged. First Phase 5
migration.

**032 phone normalization (P5-R6, SHIPPED `cbc94ee`, migration `0030`):** contact phones stored **canonical
E.164** via `normalizePhone` (assume `+1`; `(585) 555-1234`/`585.555.1234`/`5855551234` → `+15855551234`),
applied at **three** contact-write sites (contactService create+patch, attendanceService check-in new-contact,
performerService — mirroring `deriveContactNames`). **Unparseable input** (wrong length, letters, extension)
stored **raw** (never rejected); idempotent. Pure **`formatPhone`** (dashed US, non-US keeps country code, raw
passthrough) in `src/server/domain/contacts/phone.ts` — delivered + unit-tested, **first consumed by R7** (no
surface displays a phone today). Backfill `0030` (values-only, idempotent) pinned to `normalizePhone` by a
parity test. Matching unchanged (Q14 deferred). ⚠️ Three existing tests updated to the canonical value.

**033 dedup review shows phone+email (P5-R7, SHIPPED `ea89f64`, no migration):** the `/dedup` review queue now
shows each candidate's **phone + active email(s)** so a reviewer can tell a real duplicate from a coincidental
same-name match. `getMergeSuggestions` gained `phone` (from `contacts.phone`, canonical since 032) and `emails`
(active addresses via one `ARRAY(SELECT … status='active')` subquery) per candidate; the page renders the phone
dashed via **`formatPhone`** (032's **first live consumer**) with explicit "no phone"/"no email" fallbacks.
**Display-only:** the pairs query's JOIN/WHERE/ORDER are untouched (a test asserts the pair set is unchanged);
**matching on phone/email stays deferred (Q14).** No schema, no migration, no new endpoint. Test-first:
integration (payload + matching-unchanged) + component (display).

**034 public nav menu (P6-R1, SHIPPED):** `PublicNav` (`"use client"`, `aria-label="Site"`) rendered once from
the **root layout** (`src/app/layout.tsx`) so it's the topmost bar on **every** page (public + admin + door) —
structural, not per-group. Entries are a hand-maintained typed array `src/app/publicNavItems.ts` (`PUBLIC_NAV`;
generation deferred to backlog **B44**); active-section via `usePathname`; **presentation only, never authz**.
⚠️ `PublicNav.tsx` vs `publicNav.ts` collided on the case-insensitive macOS FS → the data module is
**`publicNavItems.ts`** (not `publicNav.ts`). The `(public)` layout's wordmark header was removed (PublicNav
supplies it). No DB/API.

**035 volunteer nav menu (P6-R2, SHIPPED; subsumes D1):** the role-aware volunteer nav moved from the
`(admin)`/`(door)` layouts to the **root layout** (every page when signed in, second bar `aria-label="Main"`;
also **retired 025's home-page staff-nav** — `page.tsx` no longer renders `<Nav/>`). `Nav.tsx` = server loader
(nullable **`getActor()`** → null when anonymous → `navItemsFor`) → client `VolunteerNav.tsx` (active-state).
**Completeness guard** `tests/integration/auth.navCompleteness.test.ts` + `staffPageRoutes()` in `routeInventory`
walk the `(admin)`/`(door)` page tree and **fail on any orphan** — so D1 can't recur (hand-maintained `NAV` kept,
per clarify A). The audit found **5 orphans**, all added to `NAV`: `/payments` (`performer_payment.write`),
`/bookings-report` (`booking.write` — flip to `base` if it should be a universal oversight report),
`/venue-rents`, `/door-parameters`. Dynamic `/organizer/[seriesKey]` + outside-group `/dev/routes` are documented
exclusions/allowlist.

**036 What's On window (P6-R3, SHIPPED, no migration):** `/whats-on` lower bound moved from `today()` to
**two calendar days ago** via a pure `homeWindowStart(day, lookbackDays=2)` (UTC, rollover-safe) in
`publicSchedule.ts`; `getPublicSchedule`'s default `from` = `homeWindowStart(today())`. Recent + upcoming,
ascending. The last-two-days overlap with `/what-was-on` (037) is **deliberate**.

**037 history + series filter (P6-R4+R5, SHIPPED, no migration):** new public `/what-was-on` (dances `< today`,
desc) + a **server-rendered `?series=<key>` filter** on **both** listings (no client bundle). A shared internal
`listPublicEvents({from?,before?,seriesKey?,order})` backs `getPublicSchedule` (asc) + new `getPublicHistory`
(desc), both with optional `seriesKey`; `listSeries` feeds the filter (all series). Shared server components
`(public)/_components/ScheduleList.tsx` + `SeriesFilter.tsx`; `searchParams.series` threaded through both pages;
`/what-was-on` added to `PUBLIC_NAV`. Both link rows to the shared `/whats-on/[eventId]` detail.

**038 drop non_dance_income (P6-R6, SHIPPED, migration `0031` DROP TABLE — FIRST destructive):** removed the
unused "treasurer enters non-dance income" capability (3 yrs, 0 entries; YAGNI). Deleted the table/schema/
service/route/Zod + the treasurer-report `nonDanceIncome` section + the treasurer-page add-form; **kept the
`account_mapping` table** (only its `non_dance_income` seed row + `account("non_dance_income")` lookup removed).
Type-driven: `tsc` enumerates dangling refs. ⚠️ **Removal-migration pattern (reused by 039):** the destructive
`DROP TABLE IF EXISTS` migration + the `resetDb` TRUNCATE-list edit land in the **same** step (else the suite
errors truncating a dropped table); test-first via a migration idempotency test + `not.toHaveProperty` /
section-absent assertions; snapshot `~/zak1_pre_NNNN.dump` first. ⚠️ deleting an API route under a running dev
server leaves a **stale `.next/types/validator.ts`** that fails `tsc` — clear `.next/types` + recompile.

**039 drop account_mapping (P6-R7, SHIPPED, migration `0032` DROP TABLE — the second destructive removal):** purge
the GL-code-per-line annotation (dead: no calc, no export; the treasurer books sales-receipts/bills, QBO derives
the account). Drop the `account_mapping` table + the `account()`/`loadAccountMap` machinery + the `account` field
on **every** `TreasurerReport` line + the `/qbo-mapping` "Accounts" editor + its route/schema/`mappingKeyNotFound`.
⚠️ **KEEP `series_qbo_map`** (customer + class) and `mapping_audit` — the report keeps `class`/`customer`, only
the GL-account column goes; **no computed figure changes** (R7 is the annotation removal; the report **reshape**
is R8, a separate feature).

**018 booking/event mgmt:** `patchBooking` validates status transitions + re-point (change performerId →
reset to `proposed`). Public shows only CONFIRMED bookings. Recurrence = every-N-weeks, independent rows,
capped 60/run. Advertised price display-only.

## 8. Feature 020 — Booker experience (P4-1, DONE)

`specs/020-booker-experience/` (spec + plan + research + data-model + contracts + quickstart + tasks, all
complete; 42 tasks done). Five stories: **US1 report** (venue short name, asc/desc sort, P/R/T/C/D status
letters with color, empty role slots, click→modals) · **US2 booking modal** (create/edit/read-only, one
Save+Cancel, performer typeahead, add-performer via contact link, PII-gated mailto) · **US3 tentative** · **US4
event modal** (prior-event venue/start defaults, dynamic rent) · **US5 venue short name**. Domain logic
node-tested; modal/report interactions component-tested (jsdom).

**Phase 4 requirements (consolidated, committed at repo root):** `zak1_Phase4_Requirements_v1.md` (umbrella,
§7 sequencing — now marks **all areas SHIPPED**) + the two drafts `zak1_Phase4_FS_Payments_DRAFT.md` and
`zak1_Phase4_Meg_Checkin_NOTES.md`. **Phase 4 is fully shipped: 021, 022, 023, 024, 025.** See §7 for the 024
and 025 load-bearing decisions.

## 9. Known issues / gotchas found in real use

- **⚠️ FIXED in 020 (regression class to watch): the DB `time` column renders `HH:MM:SS`, but the event
  PATCH validates `HH:MM`.** The event modal now normalises via `toHHMM()` on load (edit + prior-event
  default). The component test that missed it stubbed `19:30` (already normalised) — a reminder that stubbed
  boundaries must mirror real API output. Same shape could bite anywhere a `time` value round-trips.
- **⚠️ Delete guardrail (019 US4, updated 021 + 023):** an *empty* door record no longer blocks deletion; gate
  sales / non-zero money / **a recorded performer payment** / **a live cross-event settlement of the event's
  bookings** (023, FR-013) still do; attendance is discarded on an explicit confirm (`EVENT_HAS_ATTENDANCE`,
  count surfaced). (The old "booking check number" blocker is gone — 021 removed that column.)
- **`door_records.seed_float_cents` default `1500` survives as the documented club fallback** (FR-024) when a
  series has no `door`/`seed_float` parameter; per-series config overrides it, FS per-record override still
  wins. (The old "hard-coded, not a parameter" gotcha from v1.9 is RESOLVED by 019 US5.)
- **Sign-in `no_match`:** `resolveSignIn` matches a Google email to an **active** email on a **volunteer**
  contact. A domain typo yields `no_match`; fix `contact_emails.email`. Still **no UI** to edit a contact's
  emails (**B40**).
- **✅ Client 401 → `/login` (B41) — FIXED in 022** via `src/app/apiFetch.ts`; all staff client `/api` calls
  go through it. Regression watch: a **new** staff client `/api` fetch must use `apiFetch`, not raw `fetch`
  (the public `join` page is the deliberate exception).
- **React Strict Mode double-fetch in dev** is expected (effects run twice); not a bug.

## 10. Pre-rollout operational TODOs (NOT code — carry forward)

- **Set the real `club_settings.membership_year_end`** — ships defaulted to placeholder `08-31`; every
  membership created before it is corrected gets the wrong expiry (019 R3).
- **Set PayPal env vars** + **confirm the PayPal event/payload** against a real sandbox notification before
  freezing the Zod schema (019 R1). Online membership (US3) is dormant until then.
- **Publish the Google consent screen** (still in Testing → only listed test users can sign in).

## 11. Backlog (`specs/BACKLOG.md`) — remainder

~~**B39** general reusable entity-picker component~~ (✅ **realized by 028's shared `EventSelector`** — the
first generalised picker; the 020 inline typeaheads remain bespoke but the pattern now has a home) ·
**B40** contact email management UI ·
~~**B41** client 401 → `/login`~~ (✅ **shipped as 022**) · **B42** organizer expense reimbursement (pay a
non-performer with no booking; **still deferred — it's the Treasurer's, confirmed out of 023**) · **B43**
simplify the `is_donated` model (derive donation from `pay_cents=0` for payable types / nullable expected pay;
**deferred during 030** — freeze-vs-dynamic + ~6-reader blast radius) · **B44** static content pages / lightweight
CMS (mission/values/history/FAQs; tabled 2026-08-04; recommended Tier-2 = a `content_pages` table + small admin
on the existing auth; the 034 public menu would gain hand-maintained entries — the "generate the menu from
published content" idea is deferred here too) · **B38**
self-service login-email change. **Phase 7 additions:** **B45** represent a **video meeting** (Google Meet
preferred, else Zoom/Teams) as a venue for meetings — standing "room" on the venue, physical+video **hybrid**
allowed; deferred to a future meetings-design feature (raised at P7-R8). **B47** dynamic **"next-band" hero**
— today's home hero becomes an image of the next band to play, intelligently centred (eyes not above the top);
the current 047 hero is a static dancers image standing in. ~~**B46** performer promo links~~ (✅ **retired
into P7-R9** — display links to performer web pages / social media is now part of that requirement). Deferred
pre-Phase-3: **B1**
group tickets · **B2** non-volunteer login · **007 US2** full online sales (019 B30 was deliberately narrower:
membership only, one hosted button). **Also open:** `/bookings` page modal parity (kept its form flow in 020);
enforcing "every performer has a contact" as NOT NULL (a few nulls today).

## 12. Command cheatsheet

```bash
# Bash already runs Node 24 (nvm default) — no prefix needed. For psql/pg_dump: set -a; . ./.env; set +a
pnpm run db:migrate            # apply migrations (0033 latest; already applied to zak1_dev)
pnpm contacts:load             # operator roster re-import (044): dry-run by default, pg_dump backup, one tx
pnpm test                      # 765 green / 234 files (node + jsdom)
pnpm exec vitest run tests/component/…   # run a component test (jsdom via docblock)
pnpm exec tsc --noEmit         # typecheck
pnpm run lint                  # eslint + markdownlint
pnpm exec prettier --check .   # formatting
pnpm build                     # production build (Turbopack, clean)
pnpm dev                       # Next 16.2.10 dev server, port 3000
pnpm run auth:bootstrap -- --email a@b.org [--contact-id <uuid>] [--role super_user]
pnpm run db:seed               # ⚠️ WIPES zak1_dev — do NOT run
# snapshot (source env first): pg_dump -Fc "$DATABASE_URL" -f ~/zak1_demo.dump
```

## 13. Google / demo setup (operational, not code)

- OAuth client lives in Google Cloud **project `729886755025`, "Maps Platform Project"**, owned under the
  **cdrochester Workspace** — browse the console **as `rcd@cdrochester.org`**, not a personal gmail.
- Consent screen: **User Type External**, app name **cdrochester**, scopes `openid`+`email`. **Still in
  Testing** → only listed test users (cap 100). **Publish before rollout.**
- ⚠️ Test users must be **real Google accounts** AND exist as an **active email on a volunteer contact**, or
  sign-in refuses with `no_match`.
- Redirect URI (in `.env`): `http://localhost:3000/api/auth/google/callback`. **`.env` is gitignored** and
  holds the real Google + PayPal secrets — never paste secrets into chat.

## 14. Committed & pushed at handoff

✅ **`origin/main` == local `main` at `51cecea`** (the PR #7 `backlog-tidy` merge). Features **044–047 are merged
to `main`** (PRs #2, #4, #5, #6): 044 contact load, 045 P7-R1 tokens, 046 P7-R2 nav, 047 P7-R3 home. `tsc`/lint/
markdownlint/prettier/**765 tests**/build all green on `main`.
**Working tree:** currently on branch **`048-whats-on-cards`** — P7-R4 has **spec + plan + tasks committed but is
NOT yet implemented** (`/speckit-implement` pending). `.specify/feature.json` → `specs/048-whats-on-cards`. Its
change is a **+2-field public projection** (`seriesKey`, `venueShortName`) + a new `EventCard`; **no migration**.
Migrations through **`0033`** (044) are applied to `zak1_dev`; 045–047 added no migration.
**Operational note (carried from Phase 6):** a one-off `zak1_dev` data fix set payment `65fdeb94…`.`check_number`
= `1792` (D3; was NULL) — data only, not in git.
**To resume:** run **`/speckit-implement`** on `048-whats-on-cards`, then branch → PR → review → merge (do NOT
self-merge). After 048, continue Phase 7 (`zak1_Phase7_Requirements.md`): **P7-R5+** (event detail enrichment,
performer promo links per updated **R9**, single-source pricing R10, admin styling, etc.). Open backlog carries
forward: **B40** contact email-management UI, **B42** organizer expense reimbursement, **B43** simplify
`is_donated`, **B44** static-content CMS, **B45** video-meeting venue, **B47** next-band hero, plus the pre-rollout
operational TODOs in §10 (real `membership_year_end`, PayPal env, publish the Google consent screen).
⚠️⚠️ **Process — MULTI-CONTRIBUTOR MODE (since 044):** every feature on its own branch → **reviewed PR** →
merge; **NO self-merge to `main`, NO direct commits to `main`** (see §4). Full SpecKit pipeline each feature.
Commits are SSH-signed via 1Password (unlock if a commit fails with "1Password: failed to fill whole buffer").
