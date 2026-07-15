# zak1 — Phase 3 Requirements (roles, UI, and the check-in/finance backlog)

_Input for `/speckit-specify`. Phase 1 delivered features 001–009; Phase 2 delivered 010–014
(see [zak1 implementation status] memory). Phase 3 fleshes out **user roles + UI** and works through the
backlog **B22–B37** surfaced during the 2026-07-12/13 role/use-case review. The authoritative role model
is [`../docs/use-cases.md`](../docs/use-cases.md); per-item detail lives in [`BACKLOG.md`](BACKLOG.md).
Each package below is written to be handed to `/speckit-specify` as one (or a small number of) feature
descriptions; run `/speckit-clarify` afterward to resolve the flagged open questions._

Status: **in progress**. **P3-1 shipped as feature 015** (auth foundation, commit `6702db1`, 2026-07-14).
P3-2 onward are still planning; nothing in the codebase has changed for B22–B31 or B33–B36.
Phase 3 features number **015+**.

---

## 0. Sequencing overview

The sixteen items fall into five work packages. **Order is driven by dependencies, not by backlog
number** (B-numbers are creation order). The one hard rule: **authentication and authorization come
first** — nothing in the role model can be _enforced_ without them, and building scope-aware behavior is
far cheaper up front than retrofitted.

| Pkg | Theme | Backlog items | Depends on |
|---|---|---|---|
| **P3-1** | Authentication & session foundation ✅ **SHIPPED** (feature 015) | **B32** | — |
| **P3-2** | Authorization — role × capability × scope enforcement | _(derived from `use-cases.md`, not a B-item)_ | P3-1 |
| **P3-3** | Check-in overhaul (Door Attendant + community dance) | **B34, B33, B35, B36, B29** | P3-1/P3-2 |
| **P3-4** | Booking & event management (Booker) | **B23, B24, B25, B26, B22, B27** | P3-1/P3-2 |
| **P3-5** | Performer payments & membership acquisition | **B28, B31, B30** | P3-1/P3-2; B30 also relates to 007 US2 / B1 |

**Dependency graph (within/between packages):**

- **B32 → everything.** Auth is the prerequisite for all role gating and role-aware UI.
- **P3-2 → P3-3/4/5.** The permission layer (base + grants, scope-aware) is the framework the feature
  packages plug into; it must exist before UI is gated by role.
- **B34 → B33** (last-name capture must exist before a last-name roster sort is meaningful).
- **B23 → B24** (booking status must exist before the report can distinguish proposed/requested/confirmed).
- **B29 ↔ B36** (the comp model B29 builds feeds the open-band cross-comp in B36; do B29 first).
- **After P3-2, packages P3-3 and P3-4 are largely independent** and could proceed in parallel; **P3-5
  is best last** (B30's online/PayPal path is the most novel and touches external reconciliation).

**Still-open model question that gates P3-2:** **row 17 scope** — does the VP / Mailing List Manager own
the _whole_ contacts directory + dedup, or only the mailing-side (emails, consent, exports)? Resolve
before finalizing the contacts capabilities in the permission layer. _(The per-event-group scope question
was resolved 2026-07-14 — see `use-cases.md` §1/§4.)_

**Decided 2026-07-14 — the Organizer base stays UNSCOPED.** `is_volunteer` is cleared only when a
volunteer _leaves_, so a short-term volunteer's ⬢ grants go inert once the group's events pass while their
authentication and Organizer-base read persist indefinitely. **The club accepts this**: a volunteer may
retain read access to club data indefinitely. P3-2 therefore does **not** need to scope oversight reads —
scope filtering applies to _grants and writes_, not to the authenticated baseline. "Short-term" bounds
authority, not access.

---

## P3-1 — Authentication & session foundation (B32) ✅ SHIPPED

> **Shipped 2026-07-14 as feature 015** (`specs/015-staff-auth`, commit `6702db1`): Google
> sign-in, DB-backed revocable sessions, `/api/*` default-deny, operator bootstrap. Verified
> end-to-end against real Google. 291 tests green. Authorization remains P3-2.

### Context / why

There is **no authentication in the app today**: no auth library, no `middleware.ts`, no session/login/
cookie handling. Roles exist only as the unused `volunteer_role` enum with zero route/field gating. The
entire `role × capability × scope` model assumes an authenticated identity to attach grants to, and there
is nothing to attach to. This is the foundation the rest of Phase 3 stands on.

### What must change

1. **Sign in with Google** (decided 2026-07-14 — the club runs Google Workspace and issues accounts to all
   staff). No passwords are stored; Google verifies identity and owns recovery. A staff identity links to a
   **volunteer** contact by matching Google's verified email to the contact's `is_login` email — activating
   the dormant feature-001 substrate (`is_volunteer` / `volunteer_roles` / `is_login`) rather than building
   a parallel one. Distinct from B2 (deferred _non-volunteer_ contact login).
2. Login / logout, session management, and the accessor the authorization layer reads (server-side
   session → current user + their grants).
3. A route/middleware seam so pages and API handlers can require an authenticated user.
4. An **operator bootstrap** (seed/CLI) to designate the first volunteer/officer — without it nobody can
   sign in, since **0 of 1334 contacts are volunteers** today and no UI sets `is_volunteer`.

### Expected outcomes (testable)

- An unauthenticated request to a non-public route is rejected/redirected; the public site (`/whats-on`)
  stays open.
- A staff user can log in, obtain a session, and log out; the session is readable server-side.

### Dependencies / notes

- None (foundational). Everything else in Phase 3 depends on this.

### Open questions for `/speckit-clarify`

_Resolved during `/speckit-specify` + `/speckit-clarify` (see `specs/015-staff-auth/spec.md`):_ auth method
= **Google sign-in**; identity ↔ contact = **Google verified email → contact's `is_login` email**, gated on
`is_volunteer`; **no passwords**, so no reset/issuance question; **officer approval dropped** as redundant.

_Remaining, for `/speckit-plan`:_

- Session inactivity timeout value; whether to additionally restrict sign-in to the club's Workspace domain.

_Settled by constitution v1.2.0 (2026-07-14):_ the Google round-trip test strategy — automated tests must
not call Google's production endpoints; exercise the provider at its boundary (local conforming
implementation or signed-OIDC-token fixture) while integration-testing everything behind the seam against
real Postgres.

---

## P3-2 — Authorization: role × capability × scope (derived from `use-cases.md`)

### Context / why

This is **not a backlog line item** — it is the core of "flesh out user roles," derived directly from
[`../docs/use-cases.md`](../docs/use-cases.md). It turns the permission matrix into enforcement.

### What must change

1. Model roles as **base (Organizer) + additive grants**, with **scope that can vary per capability**
   (the Mailing List Manager is per-series but exports across all series — see `use-cases.md` §4).
   ⚠️ **Scope is not a tree.** Four granularities — ⬡ club-wide, ⬤ per-series, ⬢ **per-event-group**,
   ◍ per-event — and **⬢ is orthogonal to ⬤**: event groups deliberately span series ("Thanksgiving 2026"
   = tnc + ecd; a double dance = community_dance + tnc). `event_groups` has no `series_id` and
   `events.group_id` is independent of `events.series_id`, so a group-scoped grant legitimately reaches
   events in a series the holder has no series authority over. Evaluate scope as a **set of filters
   (series OR group OR event)**, never a single tree walk. **Short-term volunteers are ⬢ group-scoped**
   (decided 2026-07-14) — per-event grants cannot express it.
2. Implement the **officer → delegate** assignment paths (President→Booker, Treasurer→FS,
   VP→{Webmaster, Mailing List Manager}) and the **Super-user** global-write role (rename the DB enum
   `administrator` → super-user semantics).
3. Enforce the matrix: per-route **and** per-field rules (e.g. an event's public price/description
   = Webmaster/Booker while its date/venue/cancel = Booker), plus the **Door Attendant ✗ `/gate`** deny.
4. **Give the dormant volunteer substrate real writers.** `contacts.is_volunteer` and
   `contacts.volunteer_roles` exist since feature 001 but **no UI sets them** (0 of 1334 contacts are
   volunteers today); the only write path is `PATCH /api/contacts/[id]`. P3-1 bootstraps just the first
   officer via an operator seed/CLI — **P3-2 owns designating volunteers and assigning their roles in the
   UI** (the President's job, matrix row 20). Same dormant-field pattern as B21.

### Expected outcomes (testable)

- A per-series grant (e.g. Booker-of-ecd) can act on its series and is denied on another series.
- A Door Attendant is denied `/gate`; the FS is allowed.
- The Mailing List Manager can export all series' lists but only manages its own series' mailing list.

### Dependencies / notes

- Requires P3-1. Consumes the whole `use-cases.md` matrix. **Resolve row 17** first (see §0).
- Retire the provisional `/dev/routes` index convention here (Phase 3 introduces real role-aware nav).

### Open questions for `/speckit-clarify`

- **Grant storage.** Extend the `volunteer_roles` array, or a new `role_grants` table (role, scope,
  contact) — the per-series/per-capability scope strongly favors a table.
- **Row 17** — contacts directory ownership (see §0).

---

## P3-3 — Check-in overhaul (Door Attendant + community dance)

### Included: B34, B33, B35, B36, B29 · Internal order: B34 → B33; B29 before B36

> **B37 retired 2026-07-14**: a community dance is its own **series** (already seeded), not an event
> type — so no `events.type` is needed. B35 (children count) applies to **all series**; B36 is the
> community_dance series' own rule.

### Context / why

The current `/checkin` page only searches the directory for people to check in and records attendance; it
captures a single first-name field and shows no roster. This package makes the Door Attendant's real
workflow work, and introduces the **community dance** event type and its special rules. It also relocates
comp capture to check-in, revising feature 014 and resolving B21.

### What must change (by item — see `BACKLOG.md` for full detail)

1. **B34** — new-contact capture takes **first + last name** (schema already allows `lastName`) and an
   **editable display name** (add `displayNameOverride` to the check-in path; concatenation already works).
2. **B33** — a **checked-in roster** panel on `/checkin`, **sortable by first / last name** (the
   `listEventAttendance` endpoint must return structured first/last and support ordering).
3. **B35** — **family check-in** (**all series**): one parent contact + a **children count**; **children
   count as paying** (attendance total and paying dancers include them).
4. **B36** — **open-band musician** check-in (the **community_dance series** rule): flag an unpaid,
   non-leading musician; they are **comp'd into ALL events of the event group** and **count as attending**.
5. **B29** — capture **comp & gift-card counts at check-in** (Door Attendant), materialized on the door
   record for FS confirmation; counts only, no attendee attribution. Revises feature 014; resolves B21.

### Expected outcomes (testable)

- A new contact added at check-in persists first + last + (optional) overridden display name.
- The roster lists checked-in attendees and re-sorts by first vs. last name.
- A `community_dance` event accepts a family (parent + N children) and the children raise both attendance
  and paying dancers; an open-band musician is recorded, counts as attending, and yields a comp against
  the paired event.
- Comp/gift counts entered at check-in appear on the door record; `/gate` shows them for FS confirmation.

### Dependencies / notes

- Requires P3-1/P3-2 for role gating (Door Attendant scope; ✗ `/gate`).
- **Cross-event comp complexity (B36):** the comp is earned at the community dance but redeemed at the
  paired contra dance — the single-event `comp_count` (feature 014) cannot express "earned here, redeemed
  there." This is the one genuinely new modeling problem in the package; ties to event groups (B1).
- Paying-dancers formula (`attendance − performers − 1 − comps`) must incorporate the children count.

### Open questions for `/speckit-clarify`

- **B36 comp accounting** — which event absorbs the open-band comp (the community dance, the paired contra
  dance, or both), and how is it represented so revenue/paying-dancers stay correct across the group?
- **Event `type`** — enum vs. lookup; does a non-community event get an explicit type (e.g. `regular`)?
- **Children** — do they need any per-child data, or is a bare count sufficient? (Count assumed.)

---

## P3-4 — Booking & event management (Booker)

### Included: B23, B24, B25, B26, B22, B27 · Internal order: B23 → B24; others independent

### Context / why

Rounds out the Booker's toolkit: a real booking-status lifecycle, a cross-event planning report, full
event lifecycle (cancel/delete/reschedule), recurring-event generation, venue landlord data, and the
public admission price. Most of this is net-new (today event PATCH can't even change the date, and there
is no DELETE or `cancelled` state).

### What must change (by item — see `BACKLOG.md`)

1. **B23** — per-booking status **proposed → requested → confirmed / declined**; threads through
   `bookingService` + `bookBand`.
2. **B24** — **cross-event bookings report** (date · caller · band · musicians · sound tech), filterable
   by caller / band / musician / series / date-range. _(Needs B23 to show status.)_
3. **B25** — event **cancel** (retained + shown on the public site), **delete** (hard), and **reschedule**
   (add `eventDate` to the event PATCH; add a DELETE path; add a `cancelled` state).
4. **B26** — **recurring event generation** (first · increment · last) → many independent event rows.
5. **B22** — **venue landlord contact** (nullable `landlord_contact_id` on `venues` → `contacts`).
6. **B27** — **advertised admission price** on events (Webmaster-owned, public); display-only, not an
   accounting input.

### Expected outcomes (testable)

- A booking moves through the status lifecycle; a decline re-points the slot or parks it.
- The bookings report returns the right rows for a given filter (e.g. all dances using a named musician).
- An event can be cancelled (still visible, marked cancelled on `/whats-on`), deleted, and rescheduled.
- A recurrence spec generates independent events; editing/cancelling one leaves siblings untouched.
- A venue can name a landlord contact; an event can show a public admission price.

### Dependencies / notes

- Requires P3-1/P3-2 (Booker per-series scope; B27 write is Webmaster + Booker on public fields).
- Independent of P3-3; the two packages can parallelize after P3-2.

### Open questions for `/speckit-clarify`

- **B25 delete vs. cancel guardrails** — restrict delete to events with no financial/attendance history?
- **B26 recurrence** — increment semantics (weekly only, or arbitrary day/interval?); cap on rows/range.
- **B23 declined history** — swapping a slot's performer loses "who declined" unless the note records it
  (accepted in the backlog; confirm no structured decline history is required).

---

## P3-5 — Performer payments & membership acquisition

### Included: B28, B31, B30 · Internal order: B28 and B31 independent; B30 last (external/PayPal)

### Context / why

Completes the FS/Treasurer finance surface and the three membership-acquisition paths. B28 separates
_payment_ from _booking_ (today they are conflated on one row). B31/B30 make dues payment actually create
membership records — at the door and (newly) online.

### What must change (by item — see `BACKLOG.md`)

1. **B28** — **performer payment override**: payee may differ from the booked performer (substitution),
   and amounts may redistribute/aggregate (one check covering several bookings). Likely a new
   `performer_payments` table; the booked rate becomes the _expected_ pay, the payment records _actual_
   disbursement.
2. **B31** — **door membership enrollment**: the FS entering a named `membership` gate payment
   creates/renews the `memberships` record and recomputes status (today the gate `membership` line is
   dollars-only).
3. **B30** — **online membership purchase** via the club's existing **PayPal Hosted Button** (id
   `Z5FUDMVGE6CVQ`; drop-in snippets in [`../docs/paypal_Z5FUDMVGE6CVQ.pdf`](../docs/paypal_Z5FUDMVGE6CVQ.pdf)).
   The button is fully PayPal-hosted, so it gives our app **no automatic callback**; the deliverable is a
   public page that **captures the member info** plus a **PayPal webhook** (decided 2026-07-13) that
   receives payment notifications server-side and matches them to the captured info to create/renew the
   `memberships` record. Financial reconciliation still happens in QBO via the existing PayPal→QBO feed.
   First online sale to land (narrower than 007 US2 / B1).

### Expected outcomes (testable)

- A booking can be paid to a substitute payee and to an aggregated amount; the sum of payments reconciles
  against booked obligations.
- A door dues payment creates/renews the member's record and updates their status atomically with the sale.
- An online dues payment creates/renews a membership from website-captured info.

### Dependencies / notes

- Requires P3-1/P3-2 (FS/Treasurer scope; B30's public flow ties to the P3-1 identity↔contact decision).
- **B30 relates to 007 US2 / B1** (deferred online sales) but is deliberately narrower — membership only,
  one buy button, no group tickets. Keep it scoped to avoid pulling in B1.

### Open questions for `/speckit-clarify`

- **B28 shape** — extend `bookings` with payee/amount overrides vs. a dedicated `performer_payments`
  table (aggregation favors the table). Confirm.
- **B30** — webhook specifics (decided to use a webhook): which PayPal event(s) to subscribe to, how to
  **verify** webhook authenticity, and how to **match** a payment to the captured member info (email? a
  reference field passed to the button?). Hosted buttons carry limited custom metadata — confirm what
  identifying data the webhook payload actually provides.

---

## Cross-cutting notes

- **Revises feature 014** (P3-3/B29 moves comp capture to check-in) and **resolves B21** (gift-card count
  gets its capture point).
- **Re-sync on implementation:** `specs/DATA_MODEL.md`, the `/dev/routes` index (retired in P3-2), and
  auto-memory should be updated as packages land — same discipline as Phase 2.
- **Constitution still applies:** test-first against real Postgres, Zod at boundaries, structured
  logs/audit, YAGNI. Each package should enter the pipeline via `/speckit-specify` → `/speckit-clarify`.
- **Not in Phase 3 (still deferred):** B1 group tickets, B2 non-volunteer login, B3–B11, B17, B18 (see
  `BACKLOG.md`). B30 is the only toe into online sales.
