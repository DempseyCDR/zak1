# zak1 — Phase 5 Requirements (collecting)

**Status:** Requirements collection — open, running doc (pre-spec). **Started:** 2026-07-30.

Phase 4 is complete (features 021–025; Areas A–D). This doc collects Phase 5 requirements as they come in;
each will later go through the SpecKit pipeline (`/speckit-specify → clarify → plan → tasks → analyze →
implement`). Requirements are keyed `P5-Rn`.

## 1. Overview

Phase 5 continues the "make the real day-to-day surfaces pleasant and consistent" theme that 020 (Booker) and
025 (Meg's check-in) began — carrying the smart-event-selector pattern to the other event-scoped staff pages.

## 2. Requirements

### P5-R1 — Smart event selector on the Gate, Payments, and Treasurer pages

> **Status: SHIPPED as feature `028`** (2026-08-01). One shared `EventSelector` component
> (`src/app/EventSelector.tsx`) now backs all **four** single-event surfaces — check-in, gate, payments,
> treasurer: default most-recent-≤-today (else soonest upcoming), newest-first, `date · HH:MM · label`
> options, plus **series + date-range filters** (narrow the list only; never auto-commit). Selection is
> **in-page state — no deep links / per-event URLs** (clarified YAGNI), so the **treasurer report moved from
> `/treasurer/[eventId]` to a single `/treasurer` page** and the broken `/treasurer/latest` nav link is fixed
> (FR-010). Each surface keeps its own follow-on side effect in `onSelect` (gate opens the door record,
> payments loads bookings/payments, treasurer reloads the report); check-in's 025 contract is preserved so its
> test stays green unedited. **No API/schema/migration.** This realizes backlog **B39** (general reusable
> picker).

**What:** The **Gate page** (`/gate`, FS door money), the **Payments page** (`/payments`, FS performer checks
— see P5-R3), and the **Treasurer report** (`/treasurer/[eventId]`) should each get the same smart event
selector that the **check-in** page got in feature 025 (US2): it already shows the event the user almost
certainly wants — the one happening **today, or the most recent past one** — and lists events
**newest-relevant-first** with **enough detail to tell same-day events apart**. So the shared selector's
single-event consumers are **four**: check-in (already), gate, payments, treasurer.

**Why:** Same rationale as 025 on check-in — the FS (Mary) and the treasurer (Mike) work a specific recent
event; a blank/unsorted selector makes them hunt and risks picking the wrong event (which mis-files money /
reads the wrong report). Consistency across the door/finance surfaces.

**Precedent (feature 025 US2, the behavior to mirror):**

- **Default** to the most recent event with `event_date ≤ today` (today's if one exists, else the latest past
  event); empty only when no events exist.
- **Order** by date then start time, **descending** (newest first). `listEvents` **already returns this order**
  (025 added it) — so the ordering half is shared infra already in place.
- **Label** each option as **date + start time (HH:MM) + label** (apply the 020 `toHHMM` `HH:MM:SS → HH:MM`
  normalization) so two events on the same day are distinguishable.

**Current state (grounded):**

- **Gate** (`src/app/(door)/gate/page.tsx`): has a selector, but its `EventRow` is only `{ id, eventDate }` and
  the option text is just `{eventDate}` — **no default selection, no start time, no label**. ⚠️ Its `onChange`
  has a side effect (opens/ensures the door record) — the selector change handler must stay owned by the gate;
  only the *presentation + default* should be shared.
- **Treasurer** (`src/app/(admin)/treasurer/[eventId]/page.tsx`): **no selector at all** — it is a
  param route reached by URL (`eventId` in the path). Giving it a selector means adding an **entry point**
  (see open question Q1).

**Reuse angle (DECIDED — extract + refactor):** the 025 selector logic (default-select effect + `toHHMM` +
`eventLabel`) currently lives inline in `checkin/page.tsx`. We will extract a shared **event-selector
component/hook** and refactor check-in, gate, and treasurer onto it (rather than copy it a third and fourth
time). This is the natural home for backlog **B39** (general reusable picker). It stays presentation-only for
side effects (value + onChange + default), so page-specific behavior (gate's door-record open) lives in the
page — but it **carries its own filtering** (see next point).

**Filtering (DECIDED — series + date range):** a plain "pick an event" dropdown will not scale as the event
list grows, so the shared selector includes filtering built in: **filter by series** and a **date-range
selector**, with the smart default kept within the active filter. This makes it the reusable, filterable event
picker (B39), not a bare `<select>`. The same filter sub-components (series dropdown, date-range) are shared
with the bookings report so filtering UX is consistent across surfaces.

**Interaction shape (DECIDED — uniform across the single-event pages):** because the selector is shared, the
shape around it is the same on **all four single-event pages** — check-in, gate, payments, and treasurer — not
a special case for any one. Each gets a **landing that defaults to the most-recent event** (via the shared
selector) **and a deep-linkable per-event URL**; the selector drives selection uniformly. This supersedes the
earlier "index page for treasurer only" idea. The **bookings report is the exception**: it is a multi-event
*filtered list* (`/bookings-report`), not a one-event pick, so it does **not** consume the single-event picker
— it only shares the filter sub-components (above) and the descending default (P5-R2). The exact selection
mechanism (event id in the route param on every page vs. shared state with an optional deep-link) is an
implementation detail to settle at spec time; the **shape** — land on default, deep-linkable, one shared
selector — is fixed.

**Selection confirm (DECIDED — Enter/tap):** the shared picker filters as you type/choose and the selection is
**confirmed by Enter or tap** on an option — it does not fire a load/side-effect on every intermediate change.
(Fits the filterable design: filter → pick → confirm.)

**Acceptance sketch (to firm up in spec):**

- Opening `/gate` pre-selects the most recent event ≤ today; options are descending with date + start time +
  label; two same-day events are distinguishable.
- The treasurer report is reachable with the same landing-default + deep-link shape as gate and check-in.
- Check-in's and gate's behavior is unchanged (regression) after they are refactored onto the shared piece.

### P5-R2 — Bookings report defaults to descending date

> **Status: SHIPPED as feature `029`** (2026-08-01). The bookings report now defaults to **descending** event
> date (newest-relevant-first), matching the shared event selector direction (025/028) — closing the last
> ascending-default surface. The default was flipped test-first in **three coordinated spots**: the page's
> initial sort state (`bookings-report/page.tsx`), the service default (`reportService.ts` `orderBy` when no
> `sort` is given), and the route's absent-`sort` default (`api/bookings/report/route.ts`). The sort toggle is
> unchanged and still reaches both directions. **No schema/migration/API-shape change.** (Analyze noted one
> MEDIUM: the route's absent-`sort` branch is covered only indirectly — the service default is tested and the
> page always sends `sort` explicitly; accepted as a trivial pass-through.)

**What:** The **bookings report** (`/bookings-report`) should default its sort to **descending date**
(newest-relevant-first), matching the direction the smart selector uses everywhere else.

**Why:** Consistency with the 025 selector direction and the P5-R1 pattern; the booker most often looks at the
nearest/upcoming and recent events, not the oldest first.

**Current state:** 020 US1 set the report's default sort to **ascending** (`useState<"asc"|"desc">("asc")` in
`bookings-report/page.tsx`; `assembleBookingsReport` orders `asc` unless `sort=desc`). The toggle already
exists — this just flips the **default** (page initial state, and the service default to match a no-`sort`
call). Small, no migration. **Ships as its own tiny standalone feature** (not folded into P5-R1).

### P5-R3 — Payments page optimized for Mary's per-performer check workflow

> **Status: SHIPPED as feature `030`** (2026-08-02). `/payments` is now **one row per performer**: enter a
> check number → a payment to that performer for the booked amount (or a typed amount); rows commit
> independently. Non-paying bookings (donated / instructor / `$0`) render **free**; open-band musicians are
> comped attendees, not rows — only the paid **lead musicians** appear. A paid performer is **donated at
> settlement** (`0` + no check#) via a narrow `POST /api/bookings/[id]/donate`, and a walk-in is added via
> `POST /api/events/[id]/settlement-performer` — **both gated on `performer_payment.write`, not
> `booking.write`** (the FS/Treasurer lack booking-write). The one-check-many-bookings path moved to a
> **multi-apply popup**; a recorded payment is **edited inline**; a positive amount with no check# confirms
> with a **comment** (stored as the note). **No schema/migration** — a UI/UX redesign over the 023 substrate;
> the payments read gained one derived field `settledByBooking` so a **cross-event**-settled booking reads
> paid, not outstanding (FR-016). Suite 637/195 green.

**What (Mary's workflow, verbatim intent):**

1. Mary opens `/payments` to see the **payments due for this event**.
2. The **event selector defaults** to the most recent event ≤ today (shared selector — P5-R1; `/payments` is a
   consumer).
3. Mary optionally moves the selector and **confirms with Enter/tap** (P5-R1 confirm behavior).
4. Mary sees the **list of this event's performers** with **role and booked amount**.
5. Because she **almost always writes a separate check per performer**, the form is **optimized for the
   per-performer path** — one check-number entry per performer row — but a **button pops up a checklist** to
   apply one check across **more than one** booked performer (the occasional shared check).
6. **If the paid amount is left blank but a check number is entered, the booked amount is assumed** (the common
   case: paid == booked).
7. Mary may **click any performer line that already shows a payment to edit** that payment's **paid amount and
   check number**.
8. A **button adds a performer + payment** for **last-minute lineup changes**.

**Why:** The current page is optimized for the *opposite* path and is the reason the workflow feels wrong for
Mary (she does per-performer checks, not one-check-many-bookings by default).

**Current state (grounded — `src/app/(admin)/payments/page.tsx`, 019 US2 + 023):** a **payee dropdown** (all
performers) + check# + note, then a **checkbox list of the event's bookings** each with a per-line amount, and
one "Record check" (one check → many bookings). Editing an existing payment exists in the domain
(`patchPerformerPayment`, void via 023) but not as click-the-line inline edit. **So the multi-booking path is
the current default; P5-R3 inverts that** — per-performer rows first, multi-apply as a popup — plus
assume-booked-amount, inline line edit, and add-performer.

**Per-row entry rules (what Mary types on a performer's row):**

- **check# + blank amount** → paid the **booked** amount (the common case; assume booked).
- **check# + explicit amount** → paid that amount (adjusted/partial).
- **amount `0` + no check#** → a **last-minute donation**: the performer chose to donate at settlement, so no
  money and no check. Must **not** read as an outstanding gap (see "last-minute donation" below).
- **row left untouched** → **still outstanding** (not yet paid) — the reconciliation gap Mary is working down.

**Deltas from today:**

- **Per-performer row entry**, payee **always that row's booked performer** (each performer gets their **own**
  check — no per-row "pay someone else" override); the existing payee-dropdown + booking-checkbox becomes the
  **"apply to multiple" popup**.
- **Amount defaults to booked** when only a check# is given (currently the per-line amount is required).
- **Click-to-edit** a paid line (amount + check#) — surfaces `patchPerformerPayment` inline.
- **Add-performer + payment** button for a last-minute player → **creates a booking first** (Q5: everyone who
  plays gets a booking; B42 booking-less stays deferred), then records that performer's own check.

**Not every booking is a payment (resolved — respect `requires_check`):** some bookings are booked but **never
paid** and must not prompt a check or count as an outstanding item:

- a **donated** performer (Richard donates his services regularly) — `is_donated = true`, `pay_cents = 0`;
- **open-band musicians** (`open_band_musician` type) — forced-free, not paid (as previously established);
- **instructors** — forced-free; and any `pay_cents = 0` booking.

The substrate already computes this: `bookingRequiresCheck(type, payCents) = PERFORMER_RULES[type].requiresCheck
&& payCents > 0`, persisted on `bookings.requires_check`. The payments per-performer list **respects
`requires_check`**: no-pay rows show clearly as **donated / open-band / free** (no check field, excluded from
"payments due" and from the reconciliation gap), so the roster reads complete but only check-requiring bookings
prompt a check. (The event-bookings view fed to `/payments` should carry `requiresCheck`/`isDonated` for the
UI — a small view addition, like 020 added `hasSoundTech`/`bandId` to report rows; no schema change.)

**Last-minute donation (a booked-paid performer donates at settlement):** Mary enters **`0` and no check#** on
that performer's row. The effect must equal the booked-donated case above — the performer keeps their booking
(they played → appearance stands), earns nothing, no check, and it is **not** an outstanding gap. **DECIDED
(Q7 → option a):** this **flips the booking to donated** (`is_donated = true`, `pay_cents → 0`,
`requires_check → false`), reusing the exact `isDonated` semantics — appearance kept, earnings excluded, no
check, expected drops to 0, no reconciliation gap. Because that is a booking mutation (normally `booking.write`,
the Booker's), P5-R3 adds a **narrow FS-permitted "donate at settlement" action** — a dedicated op/route (e.g.
`POST /api/bookings/[id]/donate`) gated on **`performer_payment.write`** (Mary's capability), conceptually part
of settlement — rather than granting the FS full `booking.write`. Exact route/capability shape firms at spec
time. (Rejected (b): a $0 payment-side marker that would instead bend 023's reconciliation semantics.)

**Substitution (resolved — own check, not a payee swap):** a substitute does **not** cash the no-show's check.
The sub gets their **own booking** (024 substitute keeps the no-show + creates the sub's booking) and their
**own check**; if the no-show's check was already written, Mary **voids** it (023 void). So the payments UI
needs **no per-row payee override** — the 023 `payee_performer_id` (payee ≠ settled performers) is used in
**exactly one** place: the **multi-apply popup**, where one check is written to a single payee (typically the
band lead) settling several bookings.

**Reuse / consistency:** keep the 023 substrate unchanged (per-line `payment_bookings.amount_cents`, void,
cross-event, reconciliation, `payee_performer_id`) — this is a **UI/UX redesign over the existing substrate**,
no schema change expected. A "separate check per performer" is simply one `performer_payment` with a single
line = that booking, payee = that performer, amount defaulted to booked.

### P5-R4 — Gate cash counting: denomination helper (Mary) + direct total (Pat), and a merchandise comment

> **Status: SHIPPED as feature `031`** (2026-08-02). The gate gained an **optional, transient denomination
> helper** — bill counts per denomination + coins + checks → a grand cash total the FS pushes into the single
> gross-cash field ("Use as gross cash"); the **direct gross-cash entry** always exists (one value, last
> entered wins). **Checks fold into gross cash** (no separate tender/column). A **single free-text comment**
> on the anonymous-sales section persists via the new nullable **`gate_sales.note`** and reloads on reopen
> (attached to the anon line(s); read back from the first anon line with a note — one section comment over a
> per-row column). The denomination breakdown is **not persisted** (Q8). Migration **`0029_gate_sales_note.sql`**
> — the **first Phase 5 migration**; latest migration is now `0029`. Deposit/card/seed-float/comp math and the
> FS-only write boundary unchanged. Suite 643/198 green.

**What:**

1. **Mary counts cash by denomination.** She enters **how many bills of each denomination**, **coins**, and
   **checks** (rare now). The gate **multiplies each out** (count × face value) and shows a **grand cash
   total**. That grand total is the counted cash (feeds the existing `grossCash` / deposit).
2. **Pat (also an FS) skips the detail.** She just enters the **total cash** and **total checks** directly.
   So the denomination helper is **optional** — a direct-total path must always exist.
3. **Merchandise comment.** When merchandise is sold, Mary enters a **free-text comment** identifying **how
   many of what**. Building/tracking **structured per-item line items is YAGNI** — a comment is enough.

**Why:** Mary's real close-out is a physical denomination count; making her pre-total in her head (today's
single "gross cash" field) is error-prone and loses the check. Pat wants the fast path. Merchandise needs a
"what sold" note for the record without an inventory system.

**Current state (grounded — `door_records` / `gate_sales`, feature 014/019):** a **single** `grossCashCents`
(the FS types the pre-counted total — already Pat's model), `pcGrossCents` for card, `posTransactionCount`,
`seedFloatCents`, `cashPaidOutCents`; **deposit = grossCash − seedFloat − cashPaidOut**. **No** denomination
breakdown, **no** checks tender (`payment_method` is **cash | card** only), **no** note/comment on a gate sale.

**Decisions (settled):**

- **Two FS modes coexist:** the denomination helper is **optional**; the **direct total** entry (Pat) is
  always available. Using the helper fills the grand cash total; not using it, the FS types the total.
- **Denomination breakdown is NOT persisted (Q8 → YAGNI):** the helper is a **transient client-side
  calculator** that only produces the grand cash total → stored as `grossCash`. Consequence: on re-open only
  the **total** reloads (the D2 fix already handles that), not the per-denomination counts — accepted.
- **Checks fold into gross cash (Q9):** the checks total is part of the grand cash total (`grossCash`), for
  the treasurer; **no separate `checksCents`**. (Checks deposit physically with cash; they're rare.)
- **Merchandise/anon comment → `gate_sales.note` (Q10):** a **free-text comment**, and it applies to **all
  anonymous sale categories** (merchandise, gift_card, misc_sales) — not merchandise only. **No per-item line
  items** (explicit YAGNI). The note is persisted and so **must reload** with the anon sale lines (D2
  discipline — the gate reload's anon rebuild carries `note`).

**Schema — one small migration (the first in Phase 5):** just **`gate_sales.note`** (nullable text). Q8 (no
denomination persistence) and Q9 (checks folded) mean **no other columns**. Minor granularity detail for spec:
one note for the whole anonymous-sales entry vs. a note per anon line — lean **one comment for the anon
section**, since it describes the mix ("3 CDs, 2 shirts").

### P5-R5 — Consistent structured name capture on every contact-creation route

> **Status:** **R5-P1 (the capture fix) SHIPPED as feature `026`** (performer creation now captures structured
> first/last/display, reusing `deriveContactNames`; no migration). **R5-P2 (backfill of existing mis-split
> contacts) SHIPPED as feature `027`** — migration `0028` re-splits the historical rows at the last space
> (idempotent; display/search/dedup keys unchanged). Latest migration is now `0028`. **P5-R5 complete.**

**What:** Every path that creates a contact MUST capture **first name, last name, and display name
separately** — the structured shape feature 012 introduced. Today some routes capture only a single "name" and
stuff it into `contacts.first_name` with no split, while others already capture first/last.

**Why:** Inconsistent capture yields bad data (a full name in `first_name`), breaks name-based sort/search and
dedup, and makes display names wrong. One capture shape everywhere.

**Current state (grounded):** **inconsistent.** Door check-in's new-contact path captures structured
first/last/`displayNameOverride` (017/012). But **`createPerformer`**
([performerService.ts](src/server/domain/performers/performerService.ts)) takes a single `displayName` and does
`deriveContactNames({ firstName: input.displayName })` → the whole name lands in `first_name`. The booking-modal
add-performer flow (020) and any public/join capture inherit this. `deriveContactNames` (012) already exists;
the gap is at the **input/validation/UI** layer of the single-name routes.

**Scope:** audit all `insert(contacts)` sites (`performerService`, `contactService`, `attendanceService`,
public/join capture, seed) and make each collect first/last/display; reuse `deriveContactNames`. **Plus a
backfill migration (Q11 resolved):** re-split existing single-name `first_name` values into first/last
(best-effort heuristic — e.g. split on the last space; exact rule + edge cases firm at spec). The **backfill
may ship as its own migration/feature separate from the capture fix** (both are wanted).

### P5-R6 — Phone number normalization (store stripped, display dashed, US default)

> **Status: SHIPPED as feature `032`** (2026-08-03). Contact phones are stored in one **canonical E.164** form
> (`normalizePhone`, assume `+1`; `585.555.1234` / `(585) 555-1234` / `5855551234` → `+15855551234`), applied
> at all **three** contact-write sites (directory, check-in new-contact, performer create — mirroring
> `deriveContactNames`). **Unparseable input** (wrong length, letters, extension) is stored **raw** (never
> rejected). A pure **`formatPhone`** renders dashed US (`585-555-1234`), keeps non-US country codes, and
> passes raw values through — delivered + unit-tested, first consumed by **P5-R7** (no live phone display
> today). One-time backfill migration **`0030_normalize_contact_phones.sql`** (values-only, idempotent,
> pinned to `normalizePhone` by a parity test) → latest migration now `0030`. `contacts.phone`/`formatPhone`
> live in `src/server/domain/contacts/phone.ts`. No schema change, matching unchanged (Q14 deferred). Suite
> 659/201 green.

**What:** Contact phone numbers are **stripped of punctuation for storage** and **displayed with standard
dashed punctuation**. Assume **US (+1)** unless a country code is explicitly provided.

**Why:** `contacts.phone` is free-form today, so the same number stores many ways — bad for display, matching,
and (future) dedup.

**Design (Q12/Q13 resolved):** a `normalizePhone` at the write boundary (mirrors 012's name normalization)
storing **canonical E.164** (`+15855551234`; assume `+1` when no explicit country code); a `formatPhone` for
**dashed** display (e.g. `585-555-1234`, or `+1 585-555-1234` for a non-default country code). Normalize on
write **and a one-time backfill migration** of existing phones. Exact display of extensions / non-US /
unparseable input firms at spec (keep raw when unparseable).

### P5-R7 — Dedup page shows phone + email alongside display name

> **Status: SHIPPED as feature `033`** (2026-08-03). The `/dedup` review queue now shows each candidate's
> **phone** (dashed, via 032's `formatPhone` — its first live consumer) and **active email(s)** beside the
> display name, with a clear "no phone" / "no email" when absent. `getMergeSuggestions` gained `phone` +
> `emails` per candidate — phone from `contacts.phone` (canonical since 032), active emails via one
> `ARRAY(SELECT … status='active')` subquery. **Display-only**: the pairs query's JOIN/WHERE/ORDER are
> untouched (matching identical, guarded by a test); matching on phone/email stays deferred (Q14). No schema,
> no migration, no new endpoint. Suite 661/203 green. **This completes all Phase 5 R-items (R1–R7).**
> Remaining Phase 5: defect **D1** (`/payments` nav link) + backlog.

**What:** The **dedup review page** (`/dedup`) shows **phone and email** as well as display name for each
proposed merge, so the reviewer can tell real duplicates from coincidental name matches.

**Why:** Name alone is ambiguous (two "Chris Smith"s); phone/email disambiguate.

**Current state:** dedup proposes merges on `dedup_normalized` (name-based, 012) and the page shows display
name. This adds **phone + email** columns — a **display-only** change (the dedup *matching* is unchanged).
**Matching on phone/email is deferred to backlog** (Q14 resolved). Benefits from **P5-R6** (formatted phone)
and **P5-R5** (clean names). The dedup service/API must return phone + the contact's emails per candidate.

## 3. Open questions

- **P5-R1 detail:** the exact selection mechanism (route param on every page vs. shared state + deep-link) is
  deferred to spec time; additional filters beyond series + date range can be revisited then.
- **Q5 — RESOLVED:** "add performer + payment" **creates a booking first** (everyone who plays gets a booking),
  then records that performer's own check. B42 (booking-less payment) stays deferred.
- **Q6 — RESOLVED:** a substitute gets their **own booking + own check**; the no-show's check (if any) is
  **voided**. No per-row payee override; the 023 payee field is used only in the multi-apply popup.
- **Q7 — RESOLVED (option a):** "`0` + no check#" **flips the booking to `is_donated`** (appearance kept, no
  check, no gap), via a **narrow FS "donate at settlement" op/route gated on `performer_payment.write`** (not
  full `booking.write`). Exact route/capability shape firms at spec time.
- **Q8 — RESOLVED (YAGNI):** the denomination breakdown is **not persisted** — the helper is a transient
  calculator that only fills `grossCash`. On re-open only the total reloads (accepted).
- **Q9 — RESOLVED:** checks **fold into `grossCash`** for the treasurer; no separate `checksCents`.
- **Q10 — RESOLVED:** the comment lives in **`gate_sales.note`** and applies to **all anonymous sale
  categories** (not merchandise only); no per-item line items.
- **Q11 — RESOLVED:** **backfill** existing mis-split names (heuristic split) **and** fix capture; the backfill
  may ship as its own migration/feature separate from the capture fix.
- **Q12 — RESOLVED:** canonical **E.164** storage; dashed display.
- **Q13 — RESOLVED:** **backfill** existing phones (one-time migration) in addition to normalize-on-write.
- **Q14 — RESOLVED:** dedup **matching on phone/email → backlog** (R7 stays display-only). Add to
  `specs/BACKLOG.md` at spec time.

## 4. Decisions log

- **D-selector-shared (Q2):** extract a **shared, filterable event-selector component/hook** and refactor
  check-in + gate + treasurer onto it (closes B39's first real use). Presentation-only for side effects.
- **D-selector-filtering (Q3/Q4):** the shared selector **carries filtering — series + a date-range selector**
  — with the smart default kept within the active filter; the same filter sub-components are shared with the
  bookings report.
- **D-selector-shape (Q1):** all three single-event pages (check-in, gate, treasurer) adopt the **same
  landing-default + deep-linkable shape** driven by the shared selector — no treasurer-only index. The bookings
  report stays a multi-event filtered list (shares filters, not the picker).
- **D-report-desc (P5-R2):** the bookings report **defaults to descending date**, shipped as its own tiny
  feature.
- **D-selector-confirm:** the shared picker **confirms selection on Enter/tap** (filters as you go; no
  load/side-effect on every intermediate change).
- **D-payments-per-performer (P5-R3):** the `/payments` form is **optimized for one check per performer**
  (per-performer rows, payee = that performer), with multi-booking apply demoted to a **popup checklist**;
  blank amount + a check# ⇒ **assume the booked amount**; click a paid line to **edit** amount + check#; an
  **add-performer** button for last-minute changes. UI/UX redesign over the **unchanged 023 substrate** (no
  schema change expected).
- **D-substitution-own-check (Q5/Q6):** a last-minute/substitute player **creates a booking first** (everyone
  who plays gets a booking) and gets **their own check**; the no-show's check, if written, is **voided** (023).
  **No per-row payee override** — the 023 `payee_performer_id` is used only in the multi-apply popup (one check
  to a single payee across several bookings). B42 (booking-less payment) stays deferred.
- **D-payments-nopay:** the payments list **respects `requires_check`** — donated (e.g. Richard), open-band
  (`open_band_musician`), instructor, and any `$0` booking show as **no payment due** (no check field, not a
  reconciliation gap). Already modeled by `bookingRequiresCheck`/`bookings.requires_check`; the `/payments`
  bookings view just needs to expose the flag (no schema change).
- **D-lastminute-donate (Q7 → a):** entering **`0` + no check#** on a performer row **flips that booking to
  `is_donated`** (appearance kept, no check, no gap) via a **narrow FS "donate at settlement" op gated on
  `performer_payment.write`** — not full `booking.write`. Reuses existing `isDonated` semantics; rejected the
  $0-marker alternative that would bend 023 reconciliation.
- **D-cash-count (P5-R4, Q8/Q9):** the gate offers an **optional, transient denomination helper** (counts ×
  face value + checks → grand cash total) **and** a **direct total** path (Pat) — both always available. The
  breakdown is **not persisted** (only `grossCash` is); **checks fold into `grossCash`** (no separate column).
- **D-merch-comment (P5-R4, Q10):** anonymous sales get a **free-text comment** ("how many of what") in a new
  **`gate_sales.note`**, applying to **all anon categories**; **no per-item line items** (explicit YAGNI).
- **D-name-capture (P5-R5, Q11):** every contact-creation route captures **first/last/display separately**
  (reuse `deriveContactNames`); **plus a backfill migration** re-splitting existing single-name `first_name`
  values (may ship separately from the capture fix).
- **D-phone-e164 (P5-R6, Q12/Q13):** store phones as **canonical E.164** (assume `+1`), display **dashed**;
  normalize on write **+ a one-time backfill** migration.
- **D-dedup-display (P5-R7, Q14):** the dedup page shows **phone + email + display name** (display-only);
  dedup **matching** on phone/email is **backlog**, not this feature.

## 5. Candidate SpecKit breakdown

- **P5-R1** → one feature: a **shared, filterable event-selector** component/hook (B39) + apply it to the gate,
  the treasurer entry point (new `/treasurer` index, pending Q1), and refactor check-in onto it. No migration
  expected (pure UI + possibly one new route). Test-first: component tests for default/sort/label/filter on the
  shared piece; per-surface tests that each renders it and keeps its own side effects (gate door-record open);
  a route/nav test for the `/treasurer` index.
- **P5-R2** → its **own tiny standalone feature**: flip the bookings-report default sort to descending (page
  initial state + service default); a component/service test asserting the default request/order.
- **P5-R3** → one feature: **payments-page workflow redesign** (per-performer rows with own-check payee,
  multi-apply popup, assume-booked-amount, click-to-edit line, add-performer-creates-a-booking) over the
  unchanged 023 substrate; consumes the P5-R1 selector; reuses 024 substitute + 023 void for the substitution
  path. No migration expected. Sequencing: **P5-R1 (shared selector) before P5-R3** (payments consumes it);
  likely build the selector first, then R3, then R2 anytime.
- **P5-R4** → one feature: **gate cash counting** — optional (transient) denomination helper + direct-total
  path + anon-sales comment. **One small migration: `gate_sales.note`** (Q8/Q9 add no columns). The note must
  reload with the anon lines (D2 discipline). Independent of R1–R3 (can ship any time), though it lives on the
  same gate page as the R1 selector work.
- **P5-R5/R6/R7 → a "contact data quality" cluster** (one feature, or R5+R6 together then R7 small):
  structured name capture on every creation route (R5), phone normalize+format helpers at the write/display
  boundary (R6), and phone/email on the dedup page (R7, display-only). Reuses `deriveContactNames` (012); adds
  `normalizePhone`/`formatPhone`. **Two backfill migrations** (mis-split names, phones→E.164) — each may ship
  as its own migration; the capture/normalize fixes are code-only. R7 depends on R6 (formatted phone) + R5
  (clean names).
- **New backlog item (from Q14):** dedup **matching on phone/email** (beyond `dedup_normalized`) → add to
  `specs/BACKLOG.md`.

## 6. Found-in-use defects (bugs, not Phase 5 features)

- **D1 — `/payments` has no nav link** (only reachable by URL) — the reason Mary looked on the gate for check
  entry. Fix = one nav entry gated on `performer_payment.write` (FS + Treasurer). Tiny standalone commit.
- **D2 — ✅ FIXED (standalone bugfix): the Gate page destroyed previously-saved data on re-open + re-save.**
  Fix shipped: `getDoorRecord` now returns the sale lines with the payer's `contactName`, and `openDoorRecord`
  reloads **all** money scalars + rebuilds the anon/named sale lines, so a re-save round-trips instead of
  wiping. Tests: `tests/integration/doorRecord.reload.test.ts` + `tests/component/gate.reload.test.tsx`.
  (Already-corrupted `zak1_dev` values from before the fix are not recoverable without a snapshot.) Original
  report + root cause, for the record:
  Reproduced with real data: the 2026-06-25 tnc door record was rewritten to all zeros (cash/card/sales) when
  the FS re-opened it the next day and saved. Two-part cause:
  1. `openDoorRecord` ([gate/page.tsx:106](src/app/(door)/gate/page.tsx)) **does not reload** the persisted
     `grossCash`/`pcGross`/`posTxns`/`cashPaidOut` (present in the door-record response) and **never fetches the
     saved gate-sales lines** — it resets anon/named to empty and reloads only seed-float/comp/gift/open-band.
  2. `save()` then **overwrites**: PATCH writes the blank money scalars as `|| 0`, and `putGateSales` is
     **replace-all** (deletes all prior sale lines, inserts only the current blank form).

  So a second visit + save zeros the money and wipes the sales (incl. the membership income line); performer
  checks survive because they live in `performer_payments` (a different table). **Fix direction:** load the
  full persisted state on open (money scalars from the door record + existing gate-sales via `getDoorRecord`),
  and/or make the save non-destructive; add a regression test that a re-open→save round-trips all fields.
  **This is active data loss — recommend fixing it as an urgent standalone bugfix BEFORE the Phase 5 gate
  rework**, not folded into a feature. (It also overlaps the P5-R1 gate work, which will touch this page.)

---

More requirements to follow as collected.
