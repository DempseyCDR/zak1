# zak1 — Project Context for Session Transfer (v1.9)

**Snapshot:** 2026-07-18 · **Repo:** `/Users/rcd/Repositories/zak1` · **Remote:**
`github.com/DempseyCDR/zak1` · **Head:** `61d9197` = `origin/main` (pushed). **Supersedes v1.8.** Since
then: **Next.js upgraded 15.x → 16.2.10**, and **P3-5 (the last Phase 3 package) is specified + clarified**
but not yet planned. Purpose: seed a fresh session to continue work on zak1 (CDR).

---

## 1. What this is

**zak1** = "Build 1" of a single-tenant management platform for **CDR** (Country Dancers of Rochester, a
contra/English dance club): contacts & membership, door attendance & gate money, performer bookings,
treasurer & organizer reports, mailing-list exports, a public website, staff auth, authorization, check-in,
and booking & event management. **18 features shipped (001–018); 019 (P3-5) is in specification.** Money is
always **integer cents**. Single tenant (multi-tenant deferred).

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
| Tests | Vitest against **real Postgres** (no DB mocking — constitution) |
| Runtime | **Node 24** (`.nvmrc`, `engines`) · package manager **pnpm** (NOT npm) |

**⚠️ Shell gotcha:** the Bash tool defaults to Node 18. Prefix every `node`/`pnpm` command:
`export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 24 >/dev/null 2>&1`. For `psql`/`pg_dump`:
`set -a; . ./.env; set +a`.

**⚠️ CLI env (016 fix):** `db:migrate`, `db:seed`, `auth:bootstrap` use `tsx --env-file-if-exists=.env` —
`client.ts` reads env at module scope. Don't revert.

**⚠️ Next 16 upgrade (2026-07-18, commit `61d9197`):** bumped 15.x → **16.2.10** (React already 19.2; Node
24 fine). Two fixes were required and are already in: (1) `dev/routes/page.tsx` must NOT pass a
dynamic-segment path (`/organizer/[seriesKey]`) to `<Link>` — the App Router now hard-errors; dynamic paths
render as plain text. (2) `.markdownlint-cli2.jsonc` ignores `.next/**` — the Turbopack build vendors deps
under `.next/node_modules` whose READMEs the `**/*.md` glob would otherwise lint. `pnpm run lint` calls
`eslint` directly (not the removed `next lint`), so it was unaffected. `next`/`eslint-config-next` are
pinned `^16.2.10` (still a caret — can float within 16.x).

## 3. Databases

- **`zak1_dev`** (`DATABASE_URL`) — dev/demo data, **persists on disk**. ~1335 contacts.
- **`zak1_test`** (`TEST_DATABASE_URL`) — auto-migrated; `resetDb()` TRUNCATEs.
- **Migrations:** additive SQL in `src/server/db/migrations/`, `pnpm run db:migrate`. **Latest =
  `0023_booking_event_mgmt.sql`** — two enums (`booking_status`, `event_status`), `bookings.status`,
  `events.status`/`.advertised_price_cents`, `venues.landlord_contact_id`, plus **one intentional backfill**
  (`UPDATE bookings SET status='confirmed'` — see §7).
- **`pnpm run db:seed` TRUNCATEs `zak1_dev`** — never run it; it is not a migration rollback.

## 4. SpecKit & governance

Pipeline `/speckit-specify → clarify → plan → tasks → analyze → implement`. Active pointer
`.specify/feature.json` → **`specs/019-payments-membership`**. **Constitution v1.2.0** (non-negotiable):
I Test-First (Red-Green-Refactor), II YAGNI, III Type Safety (Zod at boundaries), IV Observability.
Testing standard: integration against **real** local infra; DBs never mocked; third-party services (Google)
exercised at their **boundary**, never production endpoints. **Suite: 450 tests / 137 files green.** tsc,
eslint, markdownlint, prettier, production build all clean on Next 16.

**Commits:** one atomic commit per feature, direct to `main`, trailer
`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Ask before pushing (routine).

## 5. Repo layout (key paths)

```text
docs/use-cases.md            ★ authoritative role model + permission matrix (P3-1..P3-4 enforced)
docs/zak1_Help_Glossary.md   term → file index
src/app/
  (admin)/bookings/page.tsx        booking status controls (advance/decline/revive) + re-point
  (admin)/bookings-report/page.tsx cross-event report w/ filters (B24)
  (admin)/events/page.tsx          reschedule, cancel/revive, delete, recurrence, advertised price
  (admin)/venues/page.tsx          landlord contact picker (B22)
  (admin)/access/page.tsx          President/VP: designate volunteers, grant roles (016)
  (door)/checkin/page.tsx          last+display name, children count, open-band flag, comp/gift
                                   checkboxes, sortable roster (017)
  (door)/gate/page.tsx             FS money; comp/gift counts + read-only open_band_count
  (public)/whats-on/**             cancelled marker + advertised price; CONFIRMED bookings only
  dev/routes/page.tsx              generated route index, Super-user only (dynamic paths = plain text)
  api/**/route.ts                  all declare withAuth({ requires })
src/server/
  auth/                capabilities.ts · can.ts · fields.ts (assertFields) · pii.ts · nav.ts · withAuth.ts
  domain/bookings/     bookingService · bookingStatus · reportService
  domain/events/       eventService (updateEventDetails, deleteEvent[guarded], generateRecurringEvents)
  domain/attendance/   attendanceService (children, open-band, roster sort)
  domain/door/         doorRecordService · calc
  domain/membership/   membershipService (createMembership, recomputeContactStatus) · classify
  domain/public/       publicSchedule (cancelled + advertisedPrice) · bands/publicDisplay (confirmed-only)
  db/schema/ · db/migrations/0023 · lib/routeInventory.ts · lib/audit.ts · lib/apiError.ts
tests/{unit,integration}/
```

## 6. Implementation status (001–018 done; 019 specified)

Phase 1 (001–009) · Phase 2 (010–014) · **Phase 3: 015 auth (P3-1) · 016 authorization (P3-2) · 017
check-in (P3-3) · 018 booking & event mgmt (P3-4)** — all committed AND pushed. **019 = P3-5, the last
Phase 3 package — spec + clarify complete, plan NOT started.**

## 7. Load-bearing decisions (do not undo without reading why)

**016 authorization:** Organizer is the BASE (every authenticated volunteer; read everything except contact
PII) + additive grants. `role_grants` scope = two nullable FKs (`series_id`/`group_id`, both NULL =
club-wide, `UNIQUE NULLS NOT DISTINCT`). Capability catalog in code (`auth/capabilities.ts`); the three
supersets are FLATTENED in. Two layers: routes declare `withAuth({ requires })` (mandatory; guarded by
`auth.routeInventory.test.ts`), services call `assertScope`/`assertEventScope`/`assertFields`. **Money is
OPEN to all volunteers; only PII is gated.** Super-user is CLI-only. President/VP/Treasurer mutually
exclusive (Secretary exempt).

**017 check-in:** children ride inside the persisted `events.attendance_count` (+1+N) so `payingDancers` is
UNCHANGED and children count as paying. Comp/gift are **per-check-in booleans** that increment
`door_records.comp_count`/`gift_card_redemption_count` — counts-only, never attributed (nothing stored on
the attendance row). Open-band is a **manual** flag (never from bookings), `community_dance`-only, rejected
for a booked performer (FR-022a), comped per event via persisted `door_records.open_band_count`; report uses
`effectiveComps = comp_count + open_band_count`.

**018 booking & event mgmt:** `patchBooking` validates status transitions and re-point (change performerId →
reset to `proposed` **and clear `check_number`**). **Public shows only CONFIRMED bookings** (filtered in
`groupEventBookingsForDisplay`); internal reports use all statuses; performer pay never public; the
cross-event report is `base`/staff-only. Migration backfilled existing bookings to `confirmed` so the public
display didn't regress. Event PATCH reuses `assertFields`/`EVENT_FIELDS`: `eventDate`/`status` →
`event.write` (Booker), `advertisedPriceCents` → `event.public.write` (Webmaster **and** Booker). Recurrence
= every-N-weeks, independent rows, capped 60/run. Advertised price is display-only (no accounting effect).

## 8. Feature 019 — P3-5 payments & membership (IN SPECIFICATION)

`specs/019-payments-membership/` has **spec.md + checklists/requirements.md** (spec + clarify done; **no
plan/tasks yet**). Three stories: **US1/B31** door membership enrollment (a *named* gate membership payment
creates/renews the membership + recomputes status, atomic with the gate sale) · **US2/B28** performer
payment override (payee may differ; one check aggregates several bookings) · **US3/B30** online membership
(public capture page + PayPal hosted button `Z5FUDMVGE6CVQ` + verified webhook).

**Clarifications already settled (Session 2026-07-18) — carry these into the plan:**

1. **B28 shape:** a dedicated **`performer_payments`** table (payee contact, actual amount, check number,
   override reason) + a **`payment_bookings` many-to-many join**, so one payment settles several bookings.
   The booking's rate stays the *expected* figure, untouched.
2. **Membership term:** a dues payment extends to the **next membership-year-end boundary** — a fixed date
   shared by all members, regardless of payment date. **This introduces a NEW club configuration** for that
   boundary (FR-003a); the date itself is an operational input still to be set.
3. **B30 online matching:** verify each webhook's **signature**, then **auto-match by payer email** to the
   captured member; a verified-but-unmatched payment is **parked for manual admin linking**, not dropped.
   The exact PayPal event/payload is confirmed at implementation.

**Next command:** `/speckit-plan` (then tasks → analyze → implement).

## 9. Known issues / gotchas found in real use

- **⚠️ Delete guardrail is too strict — an EMPTY door record blocks deletion.** `deleteEvent` refuses (409
  `EVENT_HAS_HISTORY`) if the event has a door record, any attendance row, or a booking with a check number.
  But `ensureDoorRecord` creates a door record merely from opening the check-in/gate page (the "Open door
  record" button, comp/gift capture, or an open-band check-in). Verified 2026-07-18: two `tnc` 2026-07-16
  events that never happened each carry a door record with **all money zero, no gate-sale lines, all counts
  zero** — only `seed_float_cents = 1500` (the schema default). One also has 1 attendance row + 5 bookings
  (no checks). **Suggested refinement:** treat an *empty* door record (no gate sales, all money/counts zero)
  as "no history" — or cascade-delete it — so a never-held event stays deletable. Not yet implemented.
- **`door_records.seed_float_cents` is HARD CODED, not a parameter.** Two hard-coded places: the DB column
  default `1500` ($15.00) in `0004_door.sql` / `schema/door.ts`, and the gate page's initial state
  `useState("15")`. There is **no** `series_parameters` entry and **no** club setting for it. The FS can
  override it per door record via the gate PATCH (`seedFloat`), but the default is not configurable. Making
  it a parameter would be a small new backlog item.
- **Sign-in `no_match`:** `resolveSignIn` matches a Google email to an **active** email on a **volunteer**
  contact by exact match. A domain typo (`@google.com` vs `@gmail.com`) yields `no_match`; fix the
  `contact_emails.email`. There is still **no UI** to edit a contact's emails (**B40**).
- **Client-side 401s don't redirect** (**B41**): the `(admin)`/`(door)` layouts redirect via `requireStaff()`
  on a *server render*, but a client `fetch('/api/*')` that 401s just shows an inline error (e.g. a stale
  tab on the treasurer report). Needs a shared fetch wrapper.
- **React Strict Mode double-fetch in dev** is expected (effects run twice); not a bug.

## 10. Backlog (`specs/BACKLOG.md`) — remainder after P3-5

**B38** self-service login-email change · **B39** entity pickers (polished typeahead; UI-spec phase) ·
**B40** contact email management UI (Phase 4; add/deactivate/set-login — addresses stay immutable, correct =
add-new + deactivate-old) · **B41** client-side 401 → `/login` redirect. Deferred pre-Phase-3: **B1** group
tickets · **B2** non-volunteer login · **007 US2** online sales (B30 is deliberately narrower).
**Done:** B22–B27 → 018; B29/B33/B34/B35/B36 → 017 (B21 resolved); B32 → 015.

## 11. Command cheatsheet

```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 24 >/dev/null 2>&1   # ALWAYS first
pnpm run db:migrate            # apply migrations (0023 already applied)
pnpm test                      # 450 green / 137 files
pnpm exec tsc --noEmit         # typecheck
pnpm run lint                  # eslint + markdownlint
pnpm exec prettier --check .   # formatting
pnpm build                     # production build (Turbopack, clean)
pnpm dev                       # Next 16.2.10 dev server, port 3000
pnpm run auth:bootstrap -- --email a@b.org [--contact-id <uuid>] [--role super_user]
pnpm run db:seed               # ⚠️ WIPES zak1_dev — do NOT run
# snapshot (source env first): pg_dump -Fc "$DATABASE_URL" -f ~/zak1_demo.dump
# verification: preview_start {name:"dev"} — GOOGLE_REDIRECT_URI must match exactly
```

## 12. Google / demo setup (operational, not code)

- OAuth client lives in Google Cloud **project `729886755025`, named "Maps Platform Project"** (created for
  feature 007 maps). Owned under the **cdrochester Workspace** — browse the console **as
  `rcd@cdrochester.org`**, not a personal gmail.
- Consent screen: **User Type External** (never Internal — would lock out short-term volunteers on personal
  accounts), app name **cdrochester**, scopes `openid`+`email`. **Still in Testing** → only listed test users
  can sign in (cap 100). **Publish before rollout.**
- ⚠️ Test users must be **real Google accounts**, and the address must also exist as an **active email on a
  volunteer contact** in the DB, or sign-in refuses with `no_match`.
- Redirect URI (in `.env`): `http://localhost:3000/api/auth/google/callback`. **`.env` is gitignored** and
  holds the real Google client secret — never paste secrets into chat.

## 13. Demo data state (zak1_dev, 2026-07-18)

Migration 0023 applied (existing bookings backfilled to `confirmed`). `db:seed` NOT run. Grants:
`rcd@cdrochester.org` = **Super-user** (CLI bootstrap); `dempsey.peggy@gmail.com` = volunteer → **President**;
`peggy@cdrochester.org` = volunteer (base); `peggytbd@gmail.com` = volunteer → **door_attendant** (contact
"PeggyTBD"). ⚠️ **Three separate "Peggy Dempsey"-ish contacts exist** (President / base / PeggyTBD) — a
dedup candidate before the demo. To exercise the latest features: `/bookings` move a booking
proposed→confirmed and re-point one; `/bookings-report` filter by musician; `/events` reschedule/cancel/
generate a recurring run/set an advertised price; `/venues` set a landlord; `/checkin` family + comp/gift
checkboxes; public `/whats-on` shows only confirmed performers, cancelled markers, and advertised prices.

## 14. Uncommitted at handoff

`git status` shows `.specify/feature.json` (→ 019) modified and `specs/019-payments-membership/` untracked —
i.e. **the 019 spec + clarify work is NOT yet committed**. Everything through `61d9197` is pushed.
