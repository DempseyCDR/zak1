# zak1 — Phase 4 Requirements (v1)

**Status:** Consolidated requirements, **pre-SpecKit** — feeds `/speckit-specify` per feature. · **Date:**
2026-07-28 · **Amends** feature 020 (Booker) · **Corrects** feature 019 (payments). · Consolidates the two
working drafts (kept for code-grounding detail):
[`zak1_Phase4_FS_Payments_DRAFT.md`](zak1_Phase4_FS_Payments_DRAFT.md) ·
[`zak1_Phase4_Meg_Checkin_NOTES.md`](zak1_Phase4_Meg_Checkin_NOTES.md).

---

## 1. Overview & personas

Phase 4 opened with **020 Booker experience (DONE)**. This doc covers the remaining Phase 4 work: the FS/
treasurer payment substrate, two booker amendments, the door-attendant experience, and one cross-cutting
auth fix. Money is always **integer cents**; constitution **v1.3.0** (solo-maintainer mode).

| Persona | Role | Surface |
|---|---|---|
| **Sean** | Booker | bookings report + booking/event modals (020) |
| **Mary** | Financial Secretary (holds the checkbook) | gate report `/gate` |
| **Mike** | Treasurer (enters QuickBooks Online) | treasurer report |
| **Meg** | Door Attendant | check-in `/checkin` |
| — | Organizers | organizer report (event-success eval) |

**Load-bearing principles** (recur across areas):

- **A written check is the discriminator** — no payment on a booking ⇒ a clean re-point/clear is fine; once a
  check is written ⇒ preserve the record (no-show), add a new booking, void + reissue. Money written ⇒ never
  erase.
- **Everyone who plays gets a booking** — appearance/earnings are booking-based.
- **Accounting is counts-only, un-attributed** — comps/gift/children are quantities; the treasurer/FS care
  about totals, not *who*.

---

## 2. Scope — feature-candidate areas

| # | Area | Nature | Personas |
|---|---|---|---|
| **A** | Booker amendments to 020 | amends 020 | Sean |
| **B** | FS payments substrate + report re-keying + 019 correction | new + corrects 019 | Mary, Mike, organizers |
| **C** | Door-attendant (Meg) check-in experience | UX polish over 017/016 + new correction modal | Meg (+ FS) |
| **D** | Client 401 → `/login` redirect (**B41**) | cross-cutting, **priority** | all |

Suggested SpecKit sequencing in §7.

---

## 3. Requirements by area

### A. Booker amendments (amends 020)

- **A1 — Lead status cascade.** When the Booker changes a band **lead's** booking status (`bandId != null` &
  `performerType = lead_musician`) on an event, sibling bookings (same `eventId`+`bandId`) that are **in
  lockstep** with the lead's previous status move to match. Diverged/declined members untouched; **status
  only** (pay/donated/note preserved); non-lead changes are independent; not triggered by re-point.
- **A2 — Band re-point ("start over").** The Booker can swap the band on an event for another — like
  re-pointing an individual slot. Wholesale replace: outgoing band's bookings out, new band's roster booked
  fresh (`proposed`, standard rates, lead = `lead_musician`). No automatic overlap recognition (a shared
  member just gets a new `proposed` booking). Justified because pay may change.
- **A3 — Disposition of a removed member** follows the **written-check discriminator**: no payment → clean
  clear/re-point; check written → keep as **no-show/declined**, void reported to the treasurer.

### B. FS payments, accounting & reports (new; corrects 019)

- **B1 — FS records payments on the gate report.** At the break, Mary reviews expected bookings, writes
  checks, and records **check number + actual amount** as `performer_payments` rows, allocated to the
  booking(s) they settle with **per-line amounts**; a discrepancy carries a **note**.
- **B2 — Aggregation.** One check may settle many bookings: usually one per performer; sometimes **one check
  to the lead** for the whole band (payee ≠ settled performers; a discrepancy → allocate across the band's
  bookings); and **cross-event** (a delayed check settles a past unpaid booking + a current one).
- **B3 — Voids & reissues.** Wrong amount or a no-show → **void** the check, write a new one. Voided rows
  **persist** (Mike records the void in QBO); void→replacement linked.
- **B4 — Substitution & guest sit-in.** A sub (Chuck for Tom) or a guest (Barney) each gets **their own
  booking**; the no-show (Tom, if a check was written) is **kept as a record**. Payee = check recipient.
- **B5 — Treasurer / QBO view (per-event).** The per-event treasurer report gains the **line-item / QBO**
  section: checks **written-at** this event (check date = event date), each expandable to the lines it
  covers; **voided checks shown distinctly**.
- **B6 — Organizer incurred-date cost.** Event-success costs are attributed to **when the performer
  performed** — each settled booking's own event date — via the per-line amounts, **not** the payment's
  `event_id`.
- **B7 — Correct 019: `bookings.check_number` is an error → remove it.** `performer_payments` becomes the
  sole check store; re-home the event-delete guardrail off `bookings.check_number`.
- **Out of scope:** **non-performer expense reimbursement** — done by **Mike**, stays **B42** backlog / YAGNI;
  no booking-less payment lines.

### C. Door-attendant (Meg) check-in experience (polish over 017/016 + correction modal)

Meg = **`attendance.write` only** (no money — that's the FS gate). Roles are **combinable** (one person can
be Door Attendant + FS → nav = union). Ten polish fixes + a correction modal (detail + code refs in the
companion notes):

- **C1** Render the role-aware **staff nav on the home page** (separate from public nav).
- **C2** Event selector **defaults to the most recent event ≤ today**.
- **C3** Events **sorted descending by date + start time** (newest-relevant-first).
- **C4** Selector label = **date + start time + label** (apply the 020 `HH:MM:SS`→`HH:MM` normalization).
- **C5** **Inline** comp + children on each search-hit / new-contact / unmatched row with its confirm button
  (retire the detached global fieldset).
- **C6** **Children count on all admission paths incl. unmatched** (head count) — validation/domain must
  accept it on the unmatched path.
- **C7** **Focus returns to the search box** after a confirmed check-in.
- **C8** **Expired session → `/login`** — see area D.
- **C9** **Remove the redundant "Open door record" button** (attendance + the gate page both ensure it).
- **C10 — Roster correction modal (Meg).** Clickable roster row → modal to: **delete** a not-present
  attendance; **edit children**; **reassign an unmatched** admission to a contact; toggle **comp/gift** as a
  **±1 on the door-record aggregate** (counts-only, decision **B** — no per-row storage) and **open_band** as
  the per-row toggle; **move a dancer to a sibling event within the same group** (both directions). The
  **events API exposes group siblings** for the move; the move PATCH server-validates a same-group target.
  *Nice-to-have:* check into **both** grouped events in one action.
  - **FS side (Mary):** per-person is Meg's; Mary only **overrides aggregate totals** on the gate (existing).

### D. Client 401 → `/login` (B41 — cross-cutting, priority)

A stale staff session 401s a staff operation; today the client swallows it (silent "no match"). Fix
**centrally**: a shared `/api/*` fetch wrapper that on **401** redirects to `/login?next=<path>`; **403**
shows inline (no bounce); stop conflating auth-failure with "0 results." Touches every client fetch (booker
modals, gate, check-in) → **prioritize**.

---

## 4. Consolidated data-model changes

| Change | Table | Note |
|---|---|---|
| **Drop `check_number`** | `bookings` | corrects 019; re-home delete guardrail to `performer_payments` |
| Void fields | `performer_payments` | `voided_at`, `void_reason`, `replaces_payment_id`; persist voided rows |
| `event_id` = **recorded-at** | `performer_payments` | = check-written date (= event date; derived, no `check_date` col) |
| Keep `payee_performer_id` | `performer_payments` | = check recipient (differs from settled performers under aggregation) |
| **Add `amount_cents`** | `payment_bookings` | per-line allocation; **`booking_id` stays NOT NULL** (no obligation lines — B42 out) |
| **PATCH + DELETE** | `attendance` | per-record; adjust `events.attendance_count` (−(1+children) delete; ±delta edit; move = dec source / inc target); **no** comp/gift columns (B29 stands) |
| Group-siblings | events API | expose an event's same-`group_id` siblings for the move |
| New migration(s) | — | `0026` drop `bookings.check_number`; payment void/allocation columns; attendance mutation support |

---

## 5. Decisions log (consolidated)

| # | Decision |
|---|---|
| D-cascade | Lead cascade to **lockstep** members only; status-only; non-lead independent |
| D-repoint | Band re-point = wholesale start-over; no overlap recognition (pay may change) |
| D-discriminator | **Written check** decides: no payment → re-point/clear; payment → preserve + new booking + void |
| D-sub-booking | Substitute **and** guest sit-in each get their **own booking** |
| D-noshow | Substituted-out performer with a written check is **kept as no-show** |
| D-check-store | **Remove `bookings.check_number`** (019 error); `performer_payments` is sole store |
| D-aggregate | Keep M:N `payment_bookings`; a check may settle many bookings incl. cross-event / pay-the-lead |
| D-per-line | `payment_bookings` carries a **per-line `amount_cents`** |
| D-b42-out | Non-performer reimbursement is Mike's → **B42 backlog/YAGNI**; `booking_id` NOT NULL |
| D-check-date | Check date = event date; **derive** from `event_id` (no `check_date` col) |
| D-report-split | Treasurer keys on **recorded-at** (check date); organizer on **incurred** booking date |
| D-void | Voids first-class, persist, shown to treasurer |
| D-void-repoint | A **voided** payment does not block re-point; only a **live** one does *(tentative)* |
| D-payee | `payee_performer_id` stays = check recipient |
| D-meg-attendance | Meg = `attendance.write` only; roles combinable (nav = union) |
| D-sort | Events selector **descending**, default most recent ≤ today |
| D-comp-gift | **B (counts-only)** — no per-row comp/gift; modal does ±1 on the aggregate; `open_band` per-row |
| D-b41 | B41 rides along in Phase 4, **prioritized** (cross-cutting) |

---

## 6. Open questions / to-validate

- **Report-validation pass** — confirm recorded-at vs. incurred reads correctly across booking, organizer, and
  treasurer reports before freezing.
- **Per-performer actual earnings under aggregation** — one check to the lead leaves members' *actual*
  earnings ambiguous; decide `getPerformer` earnings source (expected vs. actual).
- **Voided-vs-live re-point guardrail** — confirm (tentative: voided does not block).
- **Mary's `booking.write` on `/gate`** — confirm scope for adding a substitute booking there.
- **B41 packaging** — its own small feature, or folded into the door slice.

---

## 7. Suggested SpecKit feature breakdown & sequencing

SpecKit assigns real numbers; provisional grouping:

1. **019 correction — drop `bookings.check_number`** — ✅ **SHIPPED as feature `021`** (migration `0026`;
   `performer_payments` is now the sole check store). *(was: small, corrective, low-risk; do first to unblock B)*.
2. **B41 — client 401 → `/login`** — ✅ **SHIPPED as feature `022`** (shared `apiFetch` wrapper: 401 →
   `/login?next` + never-settle; migrated all staff client `/api` call sites; public `join` excluded).
   *(was: cross-cutting, prioritized; small; independent)*.
3. **FS payments substrate + report re-keying** (Area B, minus B7 which is #1) — ✅ **SHIPPED as feature `023`**
   (migration `0027`; per-line `payment_bookings.amount_cents` + `performer_payments` void columns; cross-event
   settlement; treasurer per-line QBO view + voided distinct; organizer combined actual-by-incurred cost;
   cross-event delete guardrail (H1)). Establishes the check substrate the booker amendments lean on.
4. **Booker amendments to 020** (Area A) — lead cascade + band re-point; depends on the discriminator (#3).
   Could fold into #3 since they share the payment/void semantics.
5. **Door-attendant (Meg) experience** (Area C) — polish fixes + correction modal + group-siblings API;
   largely independent of B; incorporates #2's redirect.

Dependency spine: **#1 → #3 → #4**; **#2** and **#5** parallelizable.

---

## 8. Constitution alignment (v1.3.0)

- **I Test-First** — domain rules (cascade, discriminator, aggregation/allocation, void/reissue, report
  re-keying, attendance count adjustments) test-first against real Postgres; modals get jsdom/RTL component
  tests (020 harness).
- **II YAGNI** — no `check_date` col (derive); no obligation lines (B42 out); comp/gift stay counts-only;
  reuse `BookingModal`.
- **III Type Safety** — Zod at every new boundary (payment entry, attendance PATCH/DELETE, group-move,
  gate/checkin actions).
- **IV Observability** — payment writes, voids, re-points, cascades, attendance corrections all via
  `writeAudit`.

---

## 9. Out of scope / deferred

- **Non-performer expense reimbursement (B42)** — Mike's, backlog/YAGNI; no booking-less payment lines.
- **Reassign-to-arbitrary-event / free-form move** — the move is **within an event group** only.
- Meg's experience beyond check-in + the shared `/gate` booking-add.
- Public/confirmed-only display and the online-membership path — unchanged.
- Remaining backlog (B39 picker, B40 contact-email UI, B1 group tickets, 007 US2 online sales) — not Phase 4.
