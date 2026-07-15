# zak1 — Roles, Use Cases & Permission Matrix (working draft)

**Status:** Working draft — Phase 3 role/UI design input. **Will change.** Built by walking through
what each role *does* (use cases first), then deriving the security model and UI implications.

**Companions:** [`zak1_Help_Glossary.md`](zak1_Help_Glossary.md) (term ↔ file index) ·
[`../specs/BACKLOG.md`](../specs/BACKLOG.md) (deferred features B22–B31 surfaced here) ·
[`zak1_Project_Context_v1.4.md`](zak1_Project_Context_v1.4.md) (project state).

> **Big caveat:** the app does **not** enforce any of this yet. Today roles exist only as the
> `volunteer_role` enum (`door_attendant`, `administrator`) with no route/field gating. This document
> is the *target* model for Phase 3, not current behavior.

---

## 1. The role model — "base + grants", officer → delegate

Two structural findings shape everything below:

1. **Organizer is the base, not a peer role.** Every authenticated role *is* an Organizer. Organizer =
   the authenticated base (read oversight reports, browse the schedule); it has **no write power of its
   own**. Every other role is that base **plus** an additive capability grant.
2. **Club-wide officers delegate per-series / operational roles.** The elected officers hold broad
   authority and hand operational grants down to delegates. A delegate is essentially an officer's grant
   assigned to another contact.

```
Public (unauthenticated)  ── reads public site only
│
├─ Super-user  ⬡  — may write ANYTHING (global; formerly "Administrator", app role, not a bylaws officer)
│
└─ Organizer (authenticated base: read oversight, no write)
   ├─ Door Attendant           ◍ per-event/shift    — check-in + comp/gift capture
   ├─ President                ⬡ club-wide officer  — assigns roles, handles club settings
   │    └─ Booker              ⬤ per-series         — events, bookings, venues, params, public content
   ├─ Treasurer                ⬡ club-wide officer  — finance; ⊇ FS across all series
   │    └─ Financial Secretary ⬤ per-series         — door-record money + performer payments
   ├─ Vice-President (VP)      ⬡ club-wide officer  — publicity
   │    ├─ Webmaster           ⬡                    — website / public content
   │    └─ Mailing List Manager ⬤ per-series         — mailing list for their series (but may access ALL exports)
   └─ Secretary                ⬡ club-wide officer  — official notices; backup mailing-list exporter
```

The four elected bylaws officers are **President, Vice-President, Secretary, Treasurer**. The
**Super-user** is a technical app role (global write), not an officer. The President normally assigns
roles; the Super-user *can* do so too by virtue of writing anything.

**Scope legend:** ⬡ club-wide · ⬤ per-series · ⬢ **per-event-group** · ◍ per-event/shift.
Per-series roles are always "of series X" — Booker-of-ecd has no authority over tnc.

⚠️ **Scope is NOT a hierarchy.** It would be tempting to read club-wide ⊃ series ⊃ event as a tree, but
**event groups deliberately span series**: "Thanksgiving 2026" contains both **tnc** and **ecd** events, and
a double dance pairs a `community_dance` event with a `tnc` one. `event_groups` has no `series_id`, and
`events.group_id` is independent of `events.series_id` — the schema already allows this.

So **⬢ group and ⬤ series are orthogonal axes**, and a group-scoped grant can legitimately reach events in a
series the holder has **no series-scoped authority over**. That is intended, not a leak. Any permission
check must therefore evaluate scope as a **set of filters (series OR group OR event)**, never as a single
tree walk.

---

## 2. Roles

| Role | Scope | Elected? | Delegated by | Core responsibility |
|---|---|---|---|---|
| **Public visitor** | — | — | — | Browse the public site (read-only, no login). |
| **Organizer** (base) | — | — | — | Authenticated base: read oversight reports & schedule. No write. All roles below are Organizers. |
| **Door Attendant** | ◍ per event/shift | — | President grants; Booker staffs the door | Check dancers in; take admission; record comp & gift-card **counts**. **No `/gate` access.** |
| **Booker** | ⬤ per series | — | President (per bylaws, standing in for the Board) | Runs a series' program: events, bookings, venues, per-series parameters, public content. A specialized Organizer. |
| **Financial Secretary (FS)** | ⬤ per series | — | Treasurer | Owns the door-record financials (`/gate`): cash, card, deposit, performer payments/checks. May also do Door Attendant tasks. |
| **Treasurer** | ⬡ club-wide | ✔ officer | — | Club finances; treasurer report + QBO. **⊇ FS** (may do anything an FS can, any series); edits membership records; sets any series' parameters; edits venues. |
| **Vice-President (VP)** | ⬡ club-wide | ✔ officer | — | Publicity (per bylaws). Owns the mailing-list application; delegates the website and mailing list. |
| **Webmaster** | ⬡ club-wide | — | VP | Website / public-facing content (co-edits with the Booker). |
| **Mailing List Manager** | ⬤ per series | — | VP | Manages the mailing list for their series on the VP's behalf. **Exception:** may access **all** exports (cross-series), not just their own. |
| **Secretary** | ⬡ club-wide | ✔ officer | — | Sends official notices (sending is external, out of scope). Retains backup access to export mailing lists when the VP is absent. |
| **President** | ⬡ club-wide | ✔ officer | — | Assigns roles (grants the Booker, etc.) and handles club settings. |
| **Super-user** | ⬡ club-wide | — (app role) | — | **May write anything** — global god-mode. Formerly "Administrator"; the DB enum value is still `administrator` (rename pending a schema change). |
| *Performer / Contact / Member* | — | — | — | A **subject** in the system (booked, on a list, a dues-paying member), not necessarily a user. |

---

## 3. Permission matrix

Drafted as **write-owner by resource** (a full role×resource grid would be mostly empty). All
authenticated roles inherit the Organizer base (read oversight). ⚠️ = inferred or still open.

| # | Resource / capability | Write | Scope | Backlog |
|---|---|---|---|---|
| 1 | Public site — `/whats-on` | — (public reads) | ⬡ | — |
| 2 | Public content — admission price, public description, performer public profiles | **Booker + Webmaster** | ⬤/⬡ | B27 |
| 3 | Events — create / edit / **cancel** / **delete** / **reschedule** | **Booker** | ⬤ | B25 |
| 4 | Recurring event generation | **Booker** | ⬤ | B26 |
| 5 | Venues — create / edit, rents, landlord | **Booker + Treasurer** | ⬤ | B22 |
| 6 | Performers & bands — directory / rosters | **Booker** | ⬤ | — |
| 7 | Bookings — assign + **status lifecycle** (proposed→requested→confirmed/declined) | **Booker** | ⬤ | B23 |
| 8 | Per-booking **pay-rate override** | **Booker** | ⬤ | — |
| 9 | Standard rate / expense **parameters** | **Booker** (own series) **+ Treasurer** (any series) | ⬤/⬡ | — |
| 10 | Cross-event **bookings report** | — (Booker / Org read) | ⬤ | B24 |
| 11 | Check-in / attendance + **comp & gift-card capture** | **Door Attendant + FS + Treasurer** | ◍ | B29 |
| 12 | **Gate money / door record** (`/gate`) | **FS + Treasurer** · ✗ **Door Attendant** | ⬤ | — |
| 13 | **Performer payments / check numbers** (payee & amount override) | **FS + Treasurer** | ⬤ | B28 |
| 14 | Treasurer report (`/treasurer`) | **Treasurer** | ⬡ | — |
| 15 | QBO mapping + entering check numbers in QBO | **Treasurer** | ⬡ | — |
| 16 | Organizer report (`/organizer`) | — (all authenticated read) | ⬤ | — |
| 17 | Contacts / dedup | ⚠️ **VP + Mailing List Manager** *(tentative)* | ⬡ | — |
| 18 | Membership records | **Treasurer + FS** (door) **+ online self-service** | ⬡ | B30, B31 |
| 19 | Mailing-list exports (`/exports`) | **VP + Mailing List Manager + Secretary** (backup) | ⬡ | — |
|    | *— MLM is per-series (⬤) but reads/exports **all** series' lists (scope exception)* | | | |
| 20 | Role assignment / access control | **President** | ⬡ | — |
| 21 | Club settings | **President** | ⬡ | — |

> **Super-user** (§2) may write **any** row above — global god-mode. Not repeated per-row.

---

## 4. Cross-cutting rules (what the grid can't show)

- **Field-level authority within one record.** Rows 2 & 12 split write *inside* a single entity: the
  Webmaster writes an event's public price/description while the Booker writes its date/venue/cancel
  state; the FS writes door-record money while the Door Attendant's check-in only *feeds* the comp/gift
  counts. Permissions are **not purely per-page**.
- **Per-series scoping is real.** Every ⬤ cell carries an implicit "of series X" filter. Booker-of-ecd
  and FS-of-tnc are distinct grants.
- **Scope exceptions exist.** A role's scope isn't absolute per capability: the **Mailing List Manager**
  is a *per-series* role but may read/export **all** series' mailing lists. So the model is
  role × capability × scope, where scope can vary per capability — not one scope per role.
- **Short-term volunteers are ⬢ per-event-group** (decided 2026-07-14). The club recruits people for a
  single event group — a double dance, "Thanksgiving 2026" — and they get "a more restricted scope of
  activity". Per-event (◍) grants cannot express this cleanly, and per-series (⬤) would over-grant *and*
  under-grant at once, since a group spans series.
- **Group-scoped grants self-expire in effect.** Groups are named per instance ("Jane Austen Ball 2026",
  "Pride Dance 2026"), so once a group's events are past, a grant scoped to it is inert without anyone
  revoking it — a useful property for exactly the short-term case.
- **…but authentication does not expire with it — and that is fine** (decided 2026-07-14).
  `contacts.is_volunteer` is cleared by the President **only when a volunteer leaves**, so a short-term
  volunteer who helped at one Thanksgiving retains the ability to **sign in indefinitely**, and with it the
  **Organizer base read** (organizer report: attendance, Dance Net, average ticket). **The club accepts
  this**: a volunteer may retain read access to club data indefinitely. So "short-term" bounds a
  volunteer's *authority*, not their *access* — their ⬢ grants go inert while their baseline read persists.
  **Consequence for P3-2: the Organizer base stays UNSCOPED** (club-wide read) — no per-scope filtering of
  oversight reads needs to be built.
- **Delegation chains.** President→Booker, Treasurer→FS, VP→{Webmaster, Mailing List Manager}. The
  club-wide officer hands a grant down to a per-series/operational delegate.
- **Superset relationships.** Treasurer ⊇ FS (any series). **Super-user ⊇ everything** (writes any row).
- **Hard boundary (confirmed).** Door Attendant ✗ `/gate` (row 12) — the one explicit deny nailed down.
- **Membership status → mailing lists.** A contact's membership status feeds which lists they qualify
  for, which is why membership (Treasurer/FS) and exports (VP) touch overlapping data from different roles.

---

## 5. Use-case collections

### 5.1 Booker (per series)

1. Create events & event groups for their series.
2. Assign a venue to an event; create/edit venues (Treasurer + Bookers together cover all venue data —
   no separate venue-manager role needed).
3. Assign performers — caller, band, musicians, sound tech — to an event.
4. Override standard **rent** per event (negotiates with the landlord — see B22).
5. Override standard **pay rate** per booking (negotiates fees with performers).
6. Maintain the performer directory & band rosters.
7. Update public performer profiles (co-editor; Webmaster also edits).
8. Move each booking through **proposed → requested → confirmed / declined** (B23). On a decline, either
   re-point the slot to another performer (→ proposed) or park it (→ declined); optionally note why.
9. Review the **cross-event bookings report** — date · caller · band · musicians · sound tech — filtered
   by caller / band / musician / series / date-range, for fair talent distribution (B24).
10. Record internal per-booking notes (`bookings.note`).
11. **Cancel** an event (retained + shown as cancelled on the public site) (B25).
12. **Delete** an event (hard removal — a mistake) (B25).
13. **Reschedule / edit** an event, incl. changing the date, without touching its recurring siblings (B25).
14. Define a **recurring event** (first · increment · last) → bulk-create independent event rows (B26).
15. Set standard rate/expense parameters **for their own series** (Treasurer may set any) (row 9).

### 5.2 Financial Secretary (per series)

1. Record gate **cash** and the **bank deposit** (`grossCashCents`, `depositCents`).
2. Record **count + amount** of credit-card sales (`posTransactionCount`, `pcGrossCents`).
3. Own the door-record financials — the `/gate` page.
4. Confirm the **comp & gift-card counts** with the Door Attendant (counts materialized on the door
   record) (B29).
5. Write performer checks per booked rates; record **check numbers**.
6. **Override payment** — substitute payee (Audrey sits in for Eileen) or redirect/aggregate amounts
   (Ted's share → Cindy: one $250 check) (B28).
7. Enroll **door memberships** — enter a contact's name on `/gate` for cash/card/Venmo dues (B31).
8. May also perform Door Attendant tasks (check-in).

### 5.3 Door Attendant (per event/shift)

1. Check dancers in — record attendance (`/checkin`).
2. Record a **comp** at check-in (next-dance-free card / performer plus-one) — counts only (B29).
3. Record a **gift-card redemption** at check-in — counts only (B29).
4. Take admission at the door (collect cash for the FS; card via the POS device).
5. Hand off / confirm the comp & gift-card counts with the FS.
6. Review the **roster of attendees already checked in** for the event, **sortable by first name and by
   last name** (B33). Distinct from the directory search used to *find* people to check in.
7. Add a **new contact** at check-in — enter **first + last name**; the display name is auto-concatenated
   ("first last") and **editable** by the Door Attendant (B34).
8. **Family check-in** (**all series**): one parent contact + a **count of children**; children **count as
   paying** (B35).
9. **Open-band musician check-in** (**community_dance series**): note an **unpaid, non-leading** open-band
   musician; they are **comp'd into every event of the event group** and **count as attending** (B36).
10. **Boundary:** no `/gate` access.

> **Community dance** — its **own series** (`community_dance`), a peer of Thursday Night Contra (`tnc`),
> already seeded as such. It is **not** an event type: B37 proposed one and was **retired 2026-07-14**, as
> it rested on a misreading — the codebase was already right.
>
> What makes the series special is a **rule, not a shape**: it runs on a mix of **paid musicians** (booked)
> plus **open-band musicians** (unpaid volunteers), and an open-band musician is **comp'd into all events of
> the event group**, not merely the one they played (B36). ⚠️ Feature 014's `door_records.comp_count` is a
> *single-event* counter and cannot express that — the comp model must become event-group-aware.
>
> Family check-in with a children count is **not** specific to this series; it applies to **every** series
> (B35).

### 5.4 Treasurer (club-wide officer)

1. Generate the treasurer report per event (`/treasurer`); manage QBO account/class mapping.
2. Enter performer **check numbers in QBO** to prepare bank-statement reconciliation (reconciliation
   happens in QBO, out of scope).
3. Do **anything an FS can do**, for any series (gate money, payments, check-in).
4. Edit **membership records**.
5. Set **rate/expense parameters** for **any** series; edit **venues**.

### 5.5 Vice-President (publicity officer) & delegates

- **VP:** owns the mailing-list application; may **export the member list** for upload to the mail app;
  owns the contact directory (row 17, tentative). Delegates the website and the mailing list.
- **Webmaster** (VP delegate): website / public content (co-edits row 2 with the Booker).
- **Mailing List Manager** (VP delegate): a **per-series** role managing their series' mailing list,
  but with cross-series access to **all** exports (rows 17/19).

### 5.6 Secretary (club-wide officer)

1. Send official notices (sending is external — iContact/email — out of scope).
2. Usually reuses the list already exported by the VP.
3. Retains **backup access to export mailing lists** for when the VP is absent.

### 5.7 President (club-wide officer)

1. Assign roles & control access (grants the Booker, FS, delegates, etc.) — row 20.
2. Handle club settings — row 21.

### 5.8 Super-user (club-wide app role)

1. **May write anything** — global god-mode across every resource. The technical break-glass /
   administration role, distinct from the elected officers. Formerly "Administrator" (DB enum value
   `administrator` still in place until a rename migration).

### 5.9 Membership acquisition (cross-role)

A contact becomes a member by paying dues via one of:
- **(a) Online** — PayPal buy button on the website; required info captured on the site; payment
  confirmed by the existing PayPal→QBO feed (B30).
- **(b) Door, cash** — paid to the Door Attendant; the **FS** enters the contact's name on `/gate` (B31).
- **(c) Door, card/Venmo** — the **FS** enters the contact's name on `/gate` (B31).

The Treasurer may also edit membership records directly. The VP never edits them — only exports the list.

---

## 6. Open questions

1. **Row 17 scope** — does the VP (via the Mailing List Manager) own the **whole** contact directory +
   dedup, or only the mailing-side (emails, consent topics, exports), with contact *records* owned
   elsewhere? *(still open)*
*Resolved 2026-07-14 — **per-event-group (⬢) is a real, required scope**.* Short-term volunteers are
   scoped to an event group; groups deliberately span series ("Thanksgiving 2026" = tnc + ecd), so ⬢ is
   **orthogonal to ⬤**, not nested under it — see §1 and §4. Feature 015 is unaffected: it treats short- and
   long-term volunteers identically (`is_volunteer`) and deliberately does not enforce the Workspace domain,
   precisely so short-term volunteers on personal Google accounts can sign in at all.
2. **Other officers/grants** — the four bylaws officers (President, VP, Secretary, Treasurer) and the
   Super-user are now modeled. Any further grants (e.g. a member-at-large, committee chairs) are not yet
   surfaced.

*Resolved during this session:* Administrator → **Super-user** (writes anything); role assignment &
settings → **President**; venue data needs no dedicated role (**Treasurer + Bookers** suffice).

---

## 7. Backlog surfaced while building this document

| ID | Item |
|---|---|
| B22 | Venue landlord contact |
| B23 | Booking status lifecycle (proposed→requested→confirmed/declined) |
| B24 | Booker cross-event bookings report |
| B25 | Event lifecycle: cancel vs. delete, plus reschedule |
| B26 | Recurring event generation |
| B27 | Advertised admission price (Webmaster-owned, public) |
| B28 | Performer payment override — payments distinct from bookings |
| B29 | Comp & gift-card counts captured at check-in (Door Attendant → FS); resolves B21 |
| B30 | Online membership purchase (PayPal buy button) |
| B31 | Door membership enrollment — link gate `membership` payment to a membership record |
| B32 | User authentication / login + session foundation (staff roles) — **prerequisite, spec first** |
| B33 | Door Attendant checked-in roster view — sortable by first / last name |
| B34 | Check-in new-contact capture — first + last name + editable display name |
| B35 | Family check-in — one parent contact + a children count (**all series**) |
| B36 | Open-band musician check-in → comp'd into the whole event group (community_dance series rule) |
| B37 | ~~Community dance event type~~ — **RETIRED**: community_dance is a series, already seeded |

See [`../specs/BACKLOG.md`](../specs/BACKLOG.md) for full write-ups.
