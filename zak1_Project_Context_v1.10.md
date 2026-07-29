# zak1 — Project Context for Session Transfer (v1.10)

**Snapshot:** 2026-07-29 (in-place update of v1.10) · **Repo:** `/Users/rcd/Repositories/zak1` · **Remote:**
`github.com/DempseyCDR/zak1` · **Head:** `ad248c5` (024 planning; this context update on top) — local `main`
is **~5 commits ahead of `origin/main` (unpushed)**: 023 planning+impl, the prior context update, 024 planning,
this doc. Since the original v1.10 snapshot: **020 follow-up + features 021, 022, 023 shipped** (021/022
pushed; 023 committed, not pushed), and **024 booker amendments is specced + planned (spec/plan/tasks
committed) but NOT yet implemented**; **Phase 3 COMPLETE, Phase 4 well underway**; the **Node-18 Bash gotcha
is RESOLVED** (Bash runs Node 24 by default; the stale Node 16 was purged). Purpose: seed a fresh session to
continue work on zak1 (CDR).

---

## 1. What this is

**zak1** = "Build 1" of a single-tenant management platform for **CDR** (Country Dancers of Rochester, a
contra/English dance club): contacts & membership, door attendance & gate money, performer bookings,
treasurer & organizer reports, mailing-list exports, a public website, staff auth, authorization, check-in,
booking & event management, membership acquisition (door + online), the Booker's booking-report/modal UX, and
the Financial-Secretary payment substrate.
**23 features shipped (001–023).** Money is always **integer cents**. Single tenant (multi-tenant deferred).

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
  `0027_payment_allocation_and_voids.sql`** (023) — `payment_bookings.amount_cents` (per-line allocation,
  **backfilled** proportionally so lines sum to the check total) + `performer_payments` void columns
  (`voided_at`, `void_reason`, `replaces_payment_id`). `0026_drop_bookings_check_number.sql` (021) **removed**
  `bookings.check_number` (reconcile-then-drop; `performer_payments` is now the sole check store).
  `0025_booker_experience.sql` (020) added `booking_status 'tentative'` + `venues.short_name`.
  `0024_payments_membership.sql` (019) added `performer_payments`, `payment_bookings`, `membership_captures`,
  `paypal_notifications`, `club_settings.membership_year_end`, `memberships.source_*` indexes.
- **`pnpm run db:seed` TRUNCATEs `zak1_dev`** — never run it; it is not a migration rollback.
- **Snapshots on disk:** `~/zak1_pre_0024.dump` … `~/zak1_pre_0027.dump` (pre-backfill safety copies, one per
  data migration).

## 4. Tests & governance

Pipeline `/speckit-specify → clarify → plan → tasks → analyze → implement`. Active pointer
`.specify/feature.json` → **`specs/024-booker-amendments`** (specced/planned; implementation pending).
**Constitution v1.3.0** (non-negotiable):
I Test-First (Red-Green-Refactor), II YAGNI, III Type Safety (Zod at boundaries), IV Observability.
Testing standard: integration against **real** local infra; DBs never mocked; third-party services (Google,
PayPal) exercised at their **boundary**, never production endpoints. **Suite: 563 tests / 167 files green.**
tsc, eslint, markdownlint, prettier, production build all clean on Next 16.

**⚠️ Two test types (feature 020, closes analyze finding C1):**

- **Integration/unit (node, real Postgres)** — `tests/**/*.test.ts`. The default.
- **Component (jsdom, React Testing Library + user-event + jest-dom)** — `tests/**/*.test.tsx`. A file opts
  into jsdom with a `// @vitest-environment jsdom` docblock at the top. `tests/setup.dom.ts` registers
  jest-dom matchers + guarded RTL cleanup (a no-op in node tests). Component tests **stub `fetch`** — that is
  UI-boundary isolation, **NOT** the DB-no-mock rule (which governs integration tests only). Harness committed
  separately (`5d62e1b`). ⚠️ **Lesson learned (020):** stubbed responses must mirror what the real API
  returns — a component test that stubbed `startTime: "19:30"` missed a `HH:MM:SS` validation bug (see §9).

**⚠️ Constitution v1.3.0 amendment (2026-07-23):** §Development Workflow is now **two-mode**, keyed to how
many people contribute code. **Solo-maintainer mode** (current): one atomic commit per feature direct to
`main`, feature branches optional, the full local gate suite standing in for a reviewer. **Multi-contributor
mode** activates permanently the moment a **second contributor (e.g. Zak)** lands code — feature branches +
mandatory PR review, no self-merge. No further amendment needed at that point.

**Commits:** one atomic commit per feature, direct to `main`, trailer
`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Commits are **SSH-signed via 1Password**
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
  (door)/gate/page.tsx             door money; named membership line → enrollment (019); seed float prefill
  (public)/join/page.tsx           public membership capture + PayPal hosted button (019 US3)
  api/**/route.ts                  all declare withAuth({ requires }) EXCEPT the two withPublic routes below
  api/public/membership, api/webhooks/paypal  the ONLY unauthenticated routes (withPublic + allowlist, 019)
  api/me/capabilities              { bookingWrite, eventWrite } so the report gates edit affordances (020)
src/server/
  auth/                capabilities.ts · can.ts · fields.ts · pii.ts · nav.ts · withAuth.ts · withPublic.ts
  domain/bookings/     bookingService · bookingStatus (tentative) · reportService (sort/venue/hasSoundTech)
  domain/payments/     performerPaymentService (per-line, void, cross-event, settlement helper — 023) · reconcile
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
`zak1-phase4-meg-checkin-notes.md`.

## 6. Implementation status (001–023 done)

Phase 1 (001–009) · Phase 2 (010–014) · **Phase 3 COMPLETE: 015 auth · 016 authz · 017 check-in · 018
booking/event mgmt · 019 payments & membership** · **Phase 4: 020 Booker experience (P4-1) · 021 drop
`bookings.check_number` · 022 client 401→`/login` (B41) · 023 FS payments substrate** — all **implemented**;
**024 booker amendments** (Area A — lead cascade, band re-point, written-check discriminator) is
**specced + planned only (spec/plan/tasks committed `ad248c5`, 17 tasks, NOT implemented)**. Through **022 is
pushed**; 023 (impl+planning), the prior context update, and 024 planning are **unpushed**. Phase-4 remaining:
**implement 024** (`/speckit-implement`, feature.json already points there) and **Meg's door-attendant
experience** (Area C).

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
input changed `bookingIds` → per-line **`lines: [{ bookingId, amount }]`**. Out of scope (next feature): the
booker-side of substitution + the lead cascade + band re-point; and B42 (non-performer reimbursement, Mike's).

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
§7 sequencing) + the two drafts `zak1_Phase4_FS_Payments_DRAFT.md` and `zak1_Phase4_Meg_Checkin_NOTES.md`.
Shipped so far: 021, 022, 023. **Booker amendments (Area A) are now specced + planned as feature 024** (lead
status cascade + band re-point + the "written check is the discriminator" rule; `substitutePerformer` +
`repointBand` + a `bookingHasLivePayment` helper on 023; **no migration**) — run `/speckit-implement` to build
it. **Remaining after that: Meg's door-attendant experience (Area C — the check-in punch-list in the Meg
notes).** ⚠️ 024 analyze surfaced H1: the internal no-show `declined` (substitution / band re-point) must be a
**direct** update, never via `patchBooking`, or it would cascade-decline the band.

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

**B39** general reusable entity-picker component (020 shipped the first inline typeaheads — the
`searchPerformers` picker and the add-performer contact search — but did NOT generalise the pattern) ·
**B40** contact email management UI ·
~~**B41** client 401 → `/login`~~ (✅ **shipped as 022**) · **B42** organizer expense reimbursement (pay a
non-performer with no booking; **still deferred — it's the Treasurer's, confirmed out of 023**) · **B38**
self-service login-email change. Deferred pre-Phase-3: **B1**
group tickets · **B2** non-volunteer login · **007 US2** full online sales (019 B30 was deliberately narrower:
membership only, one hosted button). **Also open:** `/bookings` page modal parity (kept its form flow in 020);
enforcing "every performer has a contact" as NOT NULL (a few nulls today).

## 12. Command cheatsheet

```bash
# Bash already runs Node 24 (nvm default) — no prefix needed. For psql/pg_dump: set -a; . ./.env; set +a
pnpm run db:migrate            # apply migrations (0027 already applied to zak1_dev)
pnpm test                      # 563 green / 167 files (node + jsdom)
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

## 14. Uncommitted / unpushed at handoff

Working tree clean after this doc is committed. Local `main` is **~5 commits ahead of `origin/main`
(unpushed)**: `1a45d31` (023 planning), `dd64ba1` (023 impl), `5f72e97` (prior context update), `ad248c5`
(024 planning), and this doc update. Everything through `a4b67fd` (022 impl) is pushed — i.e. 020-follow-up,
021, and 022 are on the remote. **Push these when ready** (`git push`); commits are SSH-signed via 1Password
(unlock if a commit fails with "failed to fill whole buffer").
