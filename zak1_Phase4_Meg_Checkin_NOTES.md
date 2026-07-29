# Phase 4 — Meg (Door Attendant) check-in fixes — RUNNING NOTES

**Status:** Pre-spec running punch-list ("too soon to draft") · **Date:** 2026-07-28 · Mostly a **UX polish
layer** over feature **017** (check-in) and **016** (role-aware nav), the way 020 was for the Booker.

> **Meg = `attendance.write` only** (check-in; she does *not* enter money — that's the FS gate page). Roles
> are **combinable**: one person can hold Door Attendant *and* FS, so nav shows the **union** of their
> capabilities — already how [`navItemsFor`](src/server/auth/nav.ts:47) works. Don't bake
> "door attendant ⇒ no gate" into any logic. Default-recent-event + sort exist so **Meg or the FS can easily
> correct attendance** on a recent event.

Core happy path (search → comp → children → confirm) **already exists** in
[checkin/page.tsx](src/app/(door)/checkin/page.tsx) (017). The items below are the fixes.

## Fix list

1. **Staff nav on the home/landing page.** The landing page [src/app/page.tsx](src/app/page.tsx) is a static
   stub (one hardcoded link) — it does **not** render the role-aware staff nav. Render the staff
   [Nav](src/app/Nav.tsx) (`navItemsFor(actor)`) on the home page after auth, kept as a **separate element
   from public nav**. (Nav derivation is done + tested; only its placement on home is missing. Today `Nav` is
   rendered by the protected route-group layouts, not `/`.)

2. **Default event = most recent event ≤ today.** The selector defaults to `""` (— select —); auto-select the
   newest event at/before today (today's if present, else latest past).

3. **Event selector sorted DESCENDING by date + start time** (newest-relevant-first).
   [`listEvents`](src/server/domain/events/eventService.ts) does a plain `select()` with **no `orderBy`** today.

4. **Selector label = date + start time + event label.** Currently renders `{eventDate}{label}` — **no start
   time** ([checkin/page.tsx:178](src/app/(door)/checkin/page.tsx:178)); the page's `EventRow` type even drops
   `startTime`. Data exists (events table has `startTime`). ⚠️ Apply the **020 `HH:MM:SS`→`HH:MM` (`toHHMM`)
   normalization** — it's a `time` column.

5. **Inline the optional info on each row — the "confusing button" fix.** Move comp + children **onto the same
   line as each hit**, with the confirm button, retiring the detached global "This check-in" fieldset
   ([checkin/page.tsx:195–229](src/app/(door)/checkin/page.tsx:195)). Applies to **all three** row types:
   matched search hit, new-contact ("No match" create), **and** unmatched/anonymous.

6. **Children count on ALL admission paths, incl. unmatched (head count).** Today children only attaches to a
   real person ([`personExtras`](src/app/(door)/checkin/page.tsx:105)); comp/gift ride any admission
   ([`countExtras`](src/app/(door)/checkin/page.tsx:99)). Move **children into the count layer** so an
   unmatched admission can carry it. ⚠️ The **validation + domain for the `{ unmatched: true }` path must
   accept `childrenCount`**, or the number silently drops — add a test that an unmatched admission with
   children lands the count. **open-band stays** person + community-dance only.

7. **Focus returns to the search box after a confirmed check-in.** `resetForms()` clears the query but doesn't
   refocus ([checkin/page.tsx:114](src/app/(door)/checkin/page.tsx:114)); explicitly focus the search input for
   rapid successive check-ins.

8. **Expired session → redirect to `/login` (backlog B41).** A stale staff session 401s a staff operation;
   today [`search()`](src/app/(door)/checkin/page.tsx:72) swallows the 401 into `data.items ?? []` → renders as
   a **silent "no match"** (reproduced live: `alex fortier` "not found" while the contact exists; log showed
   `401 UNAUTHENTICATED`). Fix centrally:
   - Shared fetch wrapper for `/api/*` that **redirects to `/login?next=<path>` on 401** (return-path so Meg
     lands back on `/checkin`).
   - **Only 401** (re-auth) redirects; a **403** (authenticated-but-not-permitted) shows inline, no bounce.
   - Stop conflating auth-failure/errors with "0 results" in the search/roster handlers.
   - Cross-cutting (touches every client `/api/*` fetch), but a door-experience blocker — either its own small
     fix or folded into this slice.

9. **Remove the redundant "Open door record" button.** [checkin/page.tsx:186–190](src/app/(door)/checkin/page.tsx:186)
   (`openDoorRecord`) manually calls the idempotent `ensureDoorRecord`, but **`recordAttendance` already
   ensures it on the first check-in** ([attendanceService.ts:128](src/server/domain/attendance/attendanceService.ts:128))
   and the **FS gate page ensures it independently** ([gate/page.tsx:93](src/app/(door)/gate/page.tsx:93)) —
   covering even the zero-check-in event. It's vestigial scaffolding exposing an internal step on Meg's
   surface; drop the button + its plumbing.

10. **Roster correction modal (Meg).** Make each **roster row clickable** → a **correction modal**. Meg views
    the roster and fixes problems:
    - Someone **missing** → not a correction; she just **checks them in** (normal search + confirm — existing).
    - Someone **listed but not present** → click the name → modal → **delete the attendance**.
    - Someone with the **wrong number of children** → update the **children count** in the modal.
    - An **unmatched** admission that's since been identified → **reassign it to a contact** (search + pick →
      set `attendance.contactId`; watch for a dup if that contact is already on the roster).
    - **comp / gift-card** → a **±1 adjustment to the door-record count** (counts-only per decision **B** — no
      per-person storage, nothing to "show"); **open_band** → the real per-row toggle (`attendance.is_open_band`).
    - **Wrong event within a group** → **move the dancer to the sibling event** (e.g. community dance ↔ contra
      grouped on the same day — [`event_groups`](src/server/db/schema/events.ts), `events.group_id`, feature
      010). Happens when Meg forgets to switch the selector, or opens the next event early. **Both
      directions**, constrained to events sharing a `group_id`.
    ⚠️ New backend: attendance is **append-only** today (POST/GET only; no PATCH/DELETE, no edit/delete domain
    fn). Add per-record **PATCH** (children, contactId, open_band, and **eventId** — restricted to a sibling in
    the same group) + **DELETE**, with domain fns that **keep the denormalized `events.attendance_count`
    right**: `−(1+children)` on delete; `±delta` on a children edit; on a **move, decrement the source event
    and increment the target** by `(1+children)`. The comp/gift `±1` lands on the **door-record** counts, not
    the attendance row. Works for **matched and unmatched** rows. *(the "correct decrement on correction" the
    [schema](src/server/db/schema/attendance.ts) already anticipated.)*

    **API — expose sibling group events for the move.** The modal needs to know valid move targets, so the
    events API must surface an event's **group siblings**. The raw data is already present — `listEvents` does
    a full `select()`, so `group_id` is in the `/api/events` payload — but the sibling relationship isn't
    explicit. Add either a focused **`GET /api/events/[id]/group-siblings`** (returns the other events sharing
    `group_id`: `{ id, eventDate, startTime, seriesKey|label }`, empty if ungrouped) or a `siblings` array on
    the event response. Either way, the move **PATCH must server-side-validate the target is a real sibling**
    (same non-null `group_id`) — never trust the client's list.

    **Nice-to-have:** check a dancer into **both events of a group in one action** (one click records
    attendance on both grouped events).

## FS side (Mary) — aggregate totals only, no per-person

Mary does **not** correct per-person. On the **gate page** she simply **overrides the totals** (seed float,
comp, gift-card, open-band counts — already built: `compCount` / `giftCount` / `openBandCount` in
[gate/page.tsx](src/app/(door)/gate/page.tsx)). **Accounting is counts-only and un-attributed** — we don't
care *who* brought the kids or used a gift card. Meg's per-person edits keep the **source data** accurate —
head count (`events.attendance_count`), children, and individual comp/open_band/gift — while **Mary overrides
the aggregate totals** on the gate for final accounting (her override supersedes). Attribution serves Meg's
corrections and roster accuracy, **not** accounting — which is why "we don't care who" still holds at Mary's
end. Split: **Meg = source/roster accuracy; Mary = final money totals.**

## To confirm / open
- Sort direction confirmed **descending**; "first event ≤ today" = most recent at/before today. ✓
- **B41 (fix #8) — ✅ SHIPPED as feature 022** (shared `apiFetch` wrapper; 401 → `/login?next` + never-settle;
  all staff `/api` client calls migrated; public `join` excluded). Was flagged priority since it cuts across every
  client `/api/*` fetch (booker modals, gate, check-in). Decision 2026-07-28.
- FS attendance-correction **resolved**: per-person roster fixes = **Meg's correction modal** (#10);
  aggregate totals = **Mary's existing gate override**.
- **comp/gift fork → RESOLVED: B (counts-only).** B29 "never attributed" stands — **no comp/gift columns on
  the attendance row.** In the modal, comp/gift are a **±1 on the door-record aggregate** (`comp_count` /
  `gift_card_redemption_count`); `open_band` remains the one per-row toggle. Mary still overrides totals.
