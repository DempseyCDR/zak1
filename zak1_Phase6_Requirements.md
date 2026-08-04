# zak1 — Phase 6 Requirements (collecting)

**Status:** Requirements collection — open, running doc (pre-spec). **Started:** 2026-08-04.

Phase 5 is complete (features 026–033). This doc collects Phase 6 requirements as they come in; each will
later go through the SpecKit pipeline (`/speckit-specify → clarify → plan → tasks → analyze → implement`).
Requirements are keyed `P6-Rn`. **We are only collecting features now — specs come later.**

## 1. Overview

Phase 6 opens on the **public-facing site and navigation**. Two threads so far:

- **Navigation** — defect **D1** (the `/payments` page has no nav link) is not a one-off; it is a symptom that
  the site has no first-class, complete, self-maintaining navigation. Two menu components fix the class:
  1. a **public-pages menu** at the top of every web page (P6-R1), and
  2. a **volunteer-pages menu**, a second bar shown at the top when a volunteer is signed in (P6-R2).
- **Public event listings** — `/whats-on` becomes the **public home page** showing a two-days-ago-onward window
  (P6-R3); a new `/what-was-on` shows **dance history** (P6-R4); both are **filterable by series** (P6-R5).
- **Treasurer report rework** — purge the unused `non_dance_income` feature (P6-R6, 3 years / zero entries) and
  the `account_mapping` GL-code-per-line annotation (P6-R7; **keep `series_qbo_map`**), then **restructure the
  report to mirror the QBO data-entry workflow** — Sales Receipts → Bills → Performer Payments → Deposit → Fees
  (P6-R8), and add **comp-admission + gift-card-redemption counts** (P6-R9). Likely one feature (`034`).
- **Door & reporting tweaks** — gift-card option when checking in a **new** contact (P6-R10); organizer report
  shows the **band name** with a member detail pop-up (P6-R11); move **performer substitution** from the gate
  page to the payments page (P6-R12).

## 2. Requirements

### P6-R1 — Public-pages menu component (top menu on all pages)

**What:** A single component that lists the **public** pages of the site and renders as the **top menu on all
web pages** (public visitors and signed-in volunteers alike see it).

**Why:** There is no public navigation today — visitors can reach a page only by a link someone remembered to
place. A shared menu makes every public page reachable and keeps the header consistent site-wide.

**Current state (grounded):**

- Public pages live under the `(public)` route group: `/whats-on`, `/whats-on/[eventId]`, `/join`.
- `src/app/(public)/layout.tsx` renders only a wordmark link ("Country Dancers of Rochester" → `/whats-on`) —
  **no menu of the public pages.**

**Open questions (for spec time, not now):**

- Which pages count as "public menu" entries (e.g. is `/whats-on/[eventId]` a menu item or only reachable from
  the list)?
- Is the list of public pages **hand-declared** or **derived from the source tree** (see the cross-cutting note
  in §3 — this is the D1 lesson)?

### P6-R2 — Volunteer-pages menu component (second menu when signed in)

**What:** A second component that lists the **volunteer** pages and renders as a **second top menu, shown only
when a volunteer is signed in**, beneath/alongside the public menu (P6-R1).

**Why:** Volunteers need to reach their working surfaces from anywhere. A volunteer nav already exists but it is
incomplete and hand-maintained — **D1 (`/payments` missing) is the proof.** Making it a real, complete,
role-aware component closes the gap for good.

**Current state (grounded):**

- `navItemsFor(actor)` in `src/server/auth/nav.ts` derives the volunteer nav from a **hand-maintained `NAV`
  array**; it is rendered by `src/app/Nav.tsx`.
- Nav is **role-aware and correctly a courtesy, not a control** (routes still enforce authorization) — keep that
  property.
- **D1 root cause:** `/payments` was simply never added to the `NAV` array. Any new page is orphaned from the
  menu until someone remembers to edit the array by hand.

**Open questions (for spec time, not now):**

- Keep the hand-maintained capability-tagged `NAV` array, or **generate volunteer entries from the source tree**
  the way the dev route index already does (`src/server/lib/routeInventory.ts`)? A generated list would make D1
  structurally impossible to recur.
- Where does the second bar render so it is present on **all** pages a volunteer sees (public + admin + door
  layouts), not just the admin/door shells?

## 3. Cross-cutting note — the D1 lesson

The dev **route index** was deliberately converted from two hand-synced arrays to a list **generated from the
source tree** (`src/server/lib/routeInventory.ts`; see `CLAUDE.md`) precisely so a new route can't be forgotten.
D1 shows the **volunteer nav still has the old hand-maintained failure mode.** Whether P6-R1/R2 should adopt the
same "generate from the source tree" approach is the key design question to settle when these go to spec.

### P6-R3 — `/whats-on` is the public home page, showing a two-days-ago-onward window

**What:** `/whats-on` is the **public home page**. It lists all dances from **two days ago** into the future —
so visitors can see **what just happened** as well as what's coming — in **ascending** date order.

**Why:** People arriving at the site want the current picture. Including the last two days lets someone who
missed a dance (or is checking the morning after) still see it, without exposing the full history on the home
page.

**Current state (grounded):**

- `/whats-on` (`src/app/(public)/whats-on/page.tsx`) reads `getPublicSchedule(db, from = today())` in
  `src/server/domain/public/publicSchedule.ts`: `WHERE event_date >= today ORDER BY event_date ASC`. So today it
  starts at **today**, not two days ago.
- The change is narrow: the `from` bound moves from `today()` to `today() − 2 days`. Ordering (ascending) and
  the public-safe projection already match.

**Open questions (for spec time, not now):**

- Is "two days ago" a fixed constant or a configurable window? (Assume fixed 2 days unless told otherwise.)
- Confirm the boundary is calendar-date based (`event_date >= today − 2`), consistent with the existing
  date-only comparison.

### P6-R4 — `/what-was-on` public dance history

**What:** A new **public** page `/what-was-on` showing **dance history**: events dated **`< today`**, sorted
**most recent first** (descending).

**Why:** The public may browse past dances (who played, when) without that history cluttering the home page.
Complements P6-R3 — home shows now/soon (plus the last two days), history shows the past.

**Current state (grounded):**

- **No history page exists.** `getPublicSchedule` only returns `event_date >= from`. A history reader is new:
  `WHERE event_date < today ORDER BY event_date DESC` over the same public-safe projection.
- The per-event detail page (`/whats-on/[eventId]`, `getPublicEventDetail`) is history-agnostic and can be
  reused for past events — an open question is whether history links there or to a `/what-was-on/[eventId]`.

**Decided (2026-08-04):**

- **Detail link:** both listing pages link to **`/whats-on/[eventId]`** for detail (single detail route, reused
  for past and future events — no `/what-was-on/[eventId]`).
- **R3/R4 overlap is deliberate:** the home window's last two days intentionally also appear on history; no
  gap/de-dup between the two pages.

**Open questions (for spec time, not now):**

- Pagination / cap for a long history (assume none / all for now unless the list gets large).

### P6-R5 — Series filter on both event-listing pages

**What:** Both public event-listing pages — `/whats-on` (P6-R3) and `/what-was-on` (P6-R4) — may be **filtered
by series**.

**Why:** A visitor who only cares about one series (e.g. a specific dance) can narrow the list.

**Current state (grounded):**

- Neither listing filters by series today; `getPublicSchedule` joins `series` for its **name** only, with no
  series predicate. The staff-side `EventSelector` (028) already does client-side series filtering — a possible
  pattern to mirror, though these are public server-rendered pages.

**Open questions (for spec time, not now):**

- Filter mechanism: query param (`?series=…`, server-rendered) vs. client-side control. Public pages are RSC
  today (no client bundle) — a query-param approach keeps that property.
- Which series are offered in the filter (all series vs. only those with events in the page's window)?

### P6-R6 — Purge the `non_dance_income` feature (YAGNI removal)

**What:** Remove the entire "treasurer enters non-dance income separate from the door" capability — table,
migration, API, service, validation, report section, treasurer-page form, and docs.

**Why (YAGNI, confirmed):** The feature lets the treasurer hand-enter event income that wasn't collected at the
door (QBO account 4910). **In the past ~3 years there have been zero such entries** — all real income is either
admissions or a `gate_sales` category. Constitution §II (YAGNI). This is a genuine removal, not a merge: no
`gate_sales` category can represent it, but nothing needs to.

**Blast radius (grounded, traced 2026-08-04):**

- **Delete:** `src/server/db/schema/nonDanceIncome.ts` (+ its `export *` in `schema/index.ts`) ·
  `src/server/domain/treasurer/nonDanceIncomeService.ts` · `src/app/api/events/[id]/non-dance-income/route.ts` ·
  `tests/integration/treasurer.non-dance-income.test.ts` · `nonDanceIncomeCreateSchema` + type in
  `src/server/validation/treasurer.ts`.
- **Edit:** `reportService.ts` (drop the import, `ndiRows` query, the `nonDanceIncome` report section +
  `account("non_dance_income")`, and the `TreasurerReport` field) · `(admin)/treasurer/page.tsx` (remove the
  "Add non-dance income" form, `addNonDanceIncome`, the section render, the type field) ·
  `tests/component/treasurer.page.test.tsx` (NDI assertions) · `tests/integration/helpers/db.ts` (remove
  `non_dance_income` from the `resetDb` TRUNCATE list **and** the seeded `('non_dance_income','4910',…)`
  `account_mapping` row) · `seed.ts` (the `non_dance_income` QBO mapping seed row) ·
  `docs/zak1_Help_Glossary.md` (two entries).
- **New:** a **destructive** migration `00NN_drop_non_dance_income.sql` (`DROP TABLE non_dance_income` + its
  index) — take a pre-migration snapshot (`~/zak1_pre_00NN.dump`) first, per the data-migration convention.

**Decided:** the `account_mapping` **table stays** (many other line keys use it); only the seeded
`non_dance_income` **row** is removed. Any such row already in `zak1_dev`/prod becomes a harmless orphan —
optional cleanup, not required.

**Note:** unlike the display-only P6-R1..R5, this is a schema-destructive change and should ship through the
full SpecKit pipeline test-first (likely feature `034`) with a DB snapshot — not an ad-hoc edit.

### P6-R7 — Purge the `account_mapping` (GL-code-per-line) feature (YAGNI removal)

**What:** Remove the **`account_mapping`** table and everything that maintains/annotates it — table, migration
(drop), API, service methods, validation, the treasurer-report `account` column, and the `/qbo-mapping`
"Accounts" section. **Keep `series_qbo_map`** (series → gate customer + QBO class) — it is a *different* table
and is aligned with how the treasurer actually books.

**Why (YAGNI, confirmed in code + workflow):** `account_mapping` stamps a GL account code onto every
treasurer-report line via `account(key)`. **Nothing computes from it** — it's a pure display annotation, and
**there is no QBO export/IIF/CSV** that consumes the codes. The treasurer (Mike) does **not** enter amounts into
GL accounts line-by-line; he books **sales receipts** (anonymous gate receipts aggregated to pseudo-customers
**Contra Gate** / **English Gate**; the community-dance gate as a *separate* transaction to the Contra Gate
customer) and enters/pays **bills** (venue rent → landlord; performer fees). QBO derives the GL account from the
customer/item/vendor, so the per-line codes are dead output. Constitution §II (YAGNI).

**Critical boundary — `series_qbo_map` STAYS:** it supplies the report's `customer` (Contra Gate / English
Gate) and `class`, which *is* the treasurer's model. The purge must not remove it. After the purge the report
keeps **customer + class + amounts** (sales-receipt-shaped) and simply drops the GL-account column.

**Blast radius (grounded, traced 2026-08-04):**

- **Delete:** `src/app/api/qbo-mapping/accounts/[lineKey]/route.ts` · `accountMappingPutSchema` +
  `AccountMappingPutInput` in `src/server/validation/treasurer.ts` · `errors.mappingKeyNotFound()` in
  `src/server/lib/apiError.ts` (only that route uses it) · the `accountMapping` table def + `AccountMappingRow`
  type in `src/server/db/schema/qboMapping.ts` (**keep `seriesQboMap` in the same file**).
- **Edit:** `mappingService.ts` (drop `loadAccountMap`, `updateAccountMapping`, the `accounts` half of
  `getMappingConfig`; keep the `series` half + `loadSeriesQbo` + `updateSeriesQbo`) · `reportService.ts` (drop
  the `loadAccountMap` import, the `account()` helper, every `account:` field on report lines, and the `account`
  fields on `TreasurerReport`; **keep `class` (qboClass) and `customer` (gateCustomer)**) ·
  `(admin)/treasurer/page.tsx` (drop the account `<td>`s + type fields) · `(admin)/qbo-mapping/page.tsx` (drop
  the whole "Accounts" section, keep "Series → gate customer / class") · `api/qbo-mapping/route.ts` GET (return
  `{ series }` only) · `seed.ts` + `tests/integration/helpers/db.ts` (remove the account_mapping seed block +
  the `account_mapping` TRUNCATE entry) · `tests/integration/treasurer.mapping-audit.test.ts` (drop the account
  case, keep series_qbo) · `treasurer.report.test.ts` et al. (drop `.account` assertions) ·
  `docs/zak1_Help_Glossary.md`.
- **New:** a **destructive** migration `00NN_drop_account_mapping.sql` (`DROP TABLE account_mapping`) — snapshot
  first. `mapping_audit` **stays** (series_qbo still writes to it; `qbo_mapping.updated` audit kind stays).

**Out of scope (flagged, not decided):** whether the treasurer report should be *restructured* into
sales-receipts-vs-bills (a real redesign implied by Mike's workflow) is a **separate, larger** question — this
requirement is only the confirmed dead-annotation removal. The community-dance-gate "separate transaction to the
Contra Gate customer" nuance is a `series_qbo_map`/customer-assignment concern, orthogonal to this purge.

**Note:** like P6-R6, schema-destructive → SpecKit pipeline, test-first, DB snapshot. **R6 + R7 are both
treasurer-report/QBO simplifications and likely ship as one feature (`034`).**

### P6-R8 — Restructure the treasurer report to mirror the QBO data-entry workflow

**What:** Reorganize the treasurer report from today's flat "line + account + class" annotation model into
sections that mirror **how the treasurer actually books an event in QuickBooks** — Sales Receipts, then Bills,
then Performer Payments, then Deposit, then Fees. This is the redesign flagged as out-of-scope for R7; R7 (drop
GL account codes) and R6 (drop non-dance income) are prerequisites/co-requisites.

**Why:** The treasurer books **sales receipts** (to gate/named customers) and **bills** (rent, performer fees),
not GL-account lines. The report should present the event in that shape so it maps 1:1 onto his data entry.

**Target shape (DECIDED 2026-08-04):**

1. **Sales Receipts** — money in, to a customer, by class:
   1. **Gate / attendance receipt FIRST** — customer **Contra Gate** / **English Gate**: admission (cash+card)
      + merchandise, gift card, misc sales; with the card gross/fee verification.
   2. **Named receipts** — donation · advance ticket (`future_event`) · membership → each **named customer**.
2. **Bills** — owed to a vendor:
   - **Venue rent → landlord.** Shown as a bill to record; **NOT paid by the FS** — no check line here (rent is
     paid outside the FS check workflow).
3. **Performer Payments** — **single section** (the checks the FS wrote): payee · amount · class · check# +
   per-booking allocation; voided checks; expected-vs-actual reconciliation. *(Not split into Bill vs
   Bill-Payment — decided.)*
4. **Deposit → ESL Checking** (cash + card).
5. **Fees** — informational (card/PayPal processing); **not** netted into Deposit.

**Decisions & grounding:**

- **Organizing principle:** by QBO transaction type, in data-entry order, **attendance receipt first**.
- **Class** (from `series_qbo_map.qboClass`) stays on every transaction; **GL account codes are gone** (R7).
- **Community-dance gate = a separate sales receipt to the Contra Gate customer** — falls out *for free*:
  community dances are **their own series**, the report is assembled **per event**, so a community-dance event
  already yields its own gate receipt. Requires only that the community-dance series'
  `series_qbo_map.gate_customer = "Contra Gate"` — **no special-case code**.
- **Rent Bill is fully derived:** amount from the event's resolved rent (`resolveRentForVenue` / `rentCents`,
  the 020 dynamic-rent value); vendor = the **venue's landlord** (feature 018 landlord picker). No manual entry.
  ⚠️ Rent is **not in the treasurer report today** — this section is new (rent currently lives only in the
  organizer report).

**Acceptance criterion (report display works; capture/edit is BROKEN — see D3):** when Mary writes **one** check
to Clara that settles bookings for **both Clara and Micah** on the same dance, Mike's treasurer report should
show the **check number** (paid to Clara) with a per-line breakdown naming both performers. The report *display*
is already correct — it lists checks recorded-at the event with `checkNumber` at the payee level +
cross-event-aware per-line allocation (`performerPayments[].lines[]`), and a single-line check (e.g. Margaret's
`1791`) renders fine. **BUT** a real July-9 case (event `7e9a83e7…`) shows a **dash**, because the multi-booking
payment was stored with `check_number = NULL` and there is **no way to fix it** — see **defect D3**. So this is
*not* satisfied end-to-end; it depends on D3.

**Open questions (for spec time):**

- Does "Performer Payments as one section" still want a QBO hint that each is a **Bill Payment** against an
  (implicit) performer bill, or is payee + amount + check# enough for the treasurer to book it?
- Print/handoff format unchanged (the page has a Print button) vs. a new layout for the reorganized sections.
- Does the Bills section list **only rent**, or is it the future home for other event bills (B42 organizer
  reimbursement, still deferred)?

### P6-R9 — Treasurer report shows comp-admission + gift-card-redemption counts

**What:** The treasurer report displays, for the dance, the **count of comp admissions** and the **count of gift
card redemptions**.

**Why:** The treasurer needs these counts to reconcile attendance/revenue (free admissions and gift-card
redemptions explain the gap between headcount and paid gate).

**Current state (grounded):** the data **already exists** — `door_records.compCount` and
`door_records.giftCardRedemptionCount` (both maintained by `recordAttendance` and the FS's `/gate` overrides);
`eventMoney` already surfaces `compCount`, and the **organizer** report already uses effective comps. The
**treasurer** report's `TreasurerReport` type carries neither today. → surface the two counts; no schema/data
work.

**Open question:** "comp admissions" = raw `compCount`, or **effective** comps (`compCount + openBandCount`) as
the organizer report uses? (Likely raw `compCount` for the treasurer, since open-band comps are a different
concept — confirm.)

### P6-R10 — Check-in: gift-card option when creating/checking in a new contact

**What:** When Meg creates and checks in a **new** contact, she can mark **comp** *or* **gift card**.

**Why:** A first-time attendee can arrive with a gift card (or as a comp) just like a returning one; the
new-contact path shouldn't be the only one that can't record it.

**Current state (grounded):** the new-contact check-in path already has a **Comp** checkbox (`newComp` →
`isComp`), but **no gift-card checkbox** — only the *unmatched/anonymous* path has both (`unmatchedComp` +
`unmatchedGift`). `recordAttendance` **already accepts `redeemedGiftCard`**. → add a gift-card checkbox to the
new-contact section and wire `redeemedGiftCard` on that submit. Tiny.

### P6-R11 — Organizer report shows band name; detail pop-up shows band members

**What:** When a **band** is booked for a dance, the organizer report shows the **band name**; the dance's
**detail pop-up** shows the **individual members** of the band.

**Why:** The band name is the useful at-a-glance identifier on the report; the member roster is detail for when
you drill in.

**Current state (grounded):** the organizer report (`domain/organizer/reportService.ts`) currently sets the
`band` field to the **joined member display-names** (lead + musician), or `"Open Band"`, or empty — there is **no
band name and no detail pop-up** on the organizer UI (`(admin)/organizer/[seriesKey]/page.tsx`). → change the
report to carry the **Band entity name** when a band is booked, and add a per-dance detail modal listing members
(the 020 bookings-report already has band grouping via `groupEventBookingsForDisplay`/`bandBlocks` to mirror).

**Open questions (for spec time):**

- Ad-hoc case (individually-booked musicians with **no** `Band` entity): show the joined names as today, or
  require a band? (Assume fall back to joined names / "Open Band".)
- Is "detail pop-up" a new organizer-report modal, or reuse of an existing booking/event modal pattern?

### P6-R12 — Move performer substitution from the gate page to the payments page

**What:** **Mary does not substitute a performer on the gate page; Mary substitutes on the payments page.**
Remove the substitute affordance from `/gate`; add it to `/payments`.

**Why:** Substitution is a payments/settlement concern (who actually played → who gets paid), and Mary (FS)
works substitutions where she manages checks. It also fixes an authz mismatch (below).

**Current state (grounded):** the gate page (024) has a **"Substitute a performer"** section calling
`POST /api/bookings/[id]/substitute`, but that route **requires `booking.write`** — which the **FS lacks**, so
Mary gets a **403** on the gate today. The payments page (030) has *add-settlement-performer*
(`performer_payment.write`) but **no substitute**. → remove the gate substitute UI; add a substitute control to
`/payments`; and **re-gate `/api/bookings/[id]/substitute` to `performer_payment.write`** — the exact precedent
set in 030 for donate/settlement-performer (both narrow settlement ops the FS/Treasurer can do without
`booking.write`). ⚠️ Confirm the 024 substitution semantics are unchanged (unpaid → clean re-point; paid → keep
original as a `declined` no-show + fresh booking for the sub); only the **surface + gate** move.

## 4. Defects folded in

**Note:** schema-touching only via R6/R7's drops; R8 itself is a **report reshape** (service + page + tests).
Ships with / after R6+R7 as part of the treasurer-report feature (`034`).

## 4. Defects folded in

- **D1 (Phase 5 carry-over):** `/payments` has no nav link. Subsumed by **P6-R2** (a complete volunteer menu)
  rather than fixed as a one-line array edit — the point of Phase 6 is to fix the class, not the instance.

- **D3 (found in real use, 2026-08-04):** a **multi-booking check** on `/payments` can be created **without a
  check number**, and its check number **cannot be edited afterward** — so the treasurer report shows a **dash**
  for a real, valid check. Concrete case: event `7e9a83e7…` (7/9/2026 18:00), payment `65fdeb94…` to Clara
  Reidlinger, $100 = Clara $50 (lead) + Micah $50 (lead), `check_number = NULL`. Two `030` gaps:
  1. **Capture** — the *multi-apply popup* (`recordMulti`, the only path that makes a one-check-many-bookings
     payment) treats `checkNumber` as **optional** and skips the per-row **FR-014** checkless guard (positive
     amount + no check# → require a comment). It silently persists a positive multi-booking payment with a null
     check number. *(The create service + Zod schema are fine — `checkNumber` persists when sent; the popup just
     doesn't require it.)*
  2. **Correction** — the inline **Edit** affordance (amount + check#) is gated to `lines.length === 1`
     (`payments/page.tsx:375`); a multi-booking payment shows only **Void**, so a missing/wrong check number is
     **unfixable** without void-and-recreate.

  **Fix direction:** (a) allow editing the check number on **multi-line** payments (relax the `length === 1`
  gate for check-number edits — `patchPerformerPayment` already accepts `checkNumber`), and (b) apply the
  FR-014 checkless-comment guard to the multi-apply popup so a positive multi-booking payment always captures a
  check# **or** a comment. Belongs with the treasurer/payments feature (`034`). Both directions **confirmed by
  the user** — the checkless-comment option stays (do NOT make the multi popup require a check# outright).
  **Immediate data correction APPLIED (2026-08-04):** `65fdeb94…`.`check_number` set to **`1792`** in `zak1_dev`
  (was NULL) — the 7/9/2026 report now shows the check. The **code fix (a + b) is still open** under `034`.
