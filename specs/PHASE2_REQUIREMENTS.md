# zak1 — Phase 2 Requirements (cleanup)

_Input for `/speckit-specify`. Phase 1 delivered features 001–009 (see
[zak1 implementation status] memory + `specs/DATA_MODEL.md`). Phase 2 addresses gaps and cleanups
noticed after Phase 1. Each item below is written to be handed to `/speckit-specify` as a feature
description; run `/speckit-clarify` afterward to resolve the flagged open questions._

Status: **planning** — not yet specified/implemented. Nothing in the codebase has changed for these
items yet.

---

## P2-1 — Retire the Jane Austen Ball mailing list; make event-group kind a free-text label

### Context / why

- **The Jane Austen Ball (JAB) list is maintained in iContact, not the platform.** That external list
  already carries a per-contact "last year attended" attribute, and future ball attendance will
  augment it. The platform already has the right mechanism for that: the **event-scoped
  contact-tracing export** (feature 006) — run it on the JAB event to get the attendees (those with an
  active, contact-tracing-consented email) and use that output to augment the iContact JAB list. A
  dedicated `janeaustenball` opt-in-topic export in the platform is therefore redundant and a source
  of future confusion.
- **`event_group_kind` earns almost nothing today.** Of its four values
  (`double_dance` / `weekend` / `jane_austen_ball` / `other`), only `jane_austen_ball` ever drives
  behavior — solely to label the JAB mailing list with the most-recent-ball year, which goes away with
  this change. The values are otherwise just loose descriptive categories. The club wants to categorize
  groups **freely**, where the group's _name_ is the specific instance and _kind_ is a free-form
  category — e.g. name "Pride Dance 2026", kind "double dance"; name "Jane Austen Ball 2027", kind
  "weekend". Grouping itself (for planning and results review) is delivered by the `event_group_id`
  association and is unaffected.

### What must change

1. **Remove the Jane Austen Ball mailing list entirely.**
   - Fully remove the `janeaustenball` value from the `mailing_list_id` enum (recreate the Postgres
     type without it — `DROP VALUE` is unsupported; safe because no `mailing_list_exports` rows use it).
     Full removal (not leaving the value dormant) is intended, to reduce future confusion.
   - Remove its entry from the mailing-list registry, its Zod validation, and the exports admin UI.
   - Remove the "most recent JAB year" logic (`getMostRecentJabYear`) — nothing else uses it.
   - The platform then offers **6** standing mailing lists (contra, english, openband, specialevents,
     performer, member) plus the separate event-scoped contact-tracing export.

2. **Convert `event_group_kind` to a free-text label.**
   - Drop the `event_group_kind` enum type; change `event_groups.kind` to a free-text (`text`) column
     holding a free-form category the club chooses (e.g. "double dance", "weekend").
   - Update the event-group create/edit API, Zod validation, and the events admin UI so `kind` is a
     free-text input rather than a fixed dropdown.

3. **Retain the `jane_austen_ball` email consent topic — unchanged.**
   - The `email_consent_topic` enum keeps `jane_austen_ball`. Consent is still recorded per email (and
     shown in the contacts UI). No export derives from it after this change; that's acceptable — it
     documents opt-in and remains available for a future iContact sync (BACKLOG B7).
   - Note the deliberate distinction: `jane_austen_ball` (email consent topic — **kept**) vs.
     `janeaustenball` (mailing_list_id — **removed**) vs. `jane_austen_ball` (event_group_kind —
     **removed**, folded into free text).

### Expected outcomes (testable)

- The exports page/API offers exactly 6 standing mailing lists; `janeaustenball` is gone from every
  surface (enum, registry, validation, UI) with no residual references.
- Running the contact-tracing export on a JAB event still returns that ball's consented attendees
  (unchanged behavior — the intended JAB-augmentation path).
- An event group can be created with any free-text kind (e.g. "double dance"); no fixed set is
  enforced.
- The `jane_austen_ball` consent topic still exists and is still settable/visible on contact emails.

### Dependencies / notes

- No platform data migrates: the "last year attended" attribute lives in iContact, not our schema, and
  no `mailing_list_exports` rows reference `janeaustenball` (verified in dev on 2026-07-04).
- Feature 006's spec/artifacts drop from 7 lists to 6 and lose FR-005 (JAB-year scoping). Feature
  002's event-group model changes `kind` from enum to free text. `specs/DATA_MODEL.md` and the
  auto-memory should be re-synced when this is implemented.
- Removing an enum _value_ (`janeaustenball`) requires recreating the `mailing_list_id` type; dropping
  an enum _type_ (`event_group_kind`) is a clean `ALTER TABLE … ALTER COLUMN … TYPE text` +
  `DROP TYPE`.

### Open questions for `/speckit-clarify`

- **Q: Should `event_groups.kind` (now free text) be required or optional?** It is `NOT NULL` today as
  an enum. As a free-text category, making it **nullable/optional** is likely more flexible (a group
  needn't have a category). Recommend optional.
- **Q: Keep the column name `kind`, or rename to `category`/`label`?** "kind" reads oddly for free
  text. Renaming to `category` is clearer but adds churn; keeping `kind` minimizes the diff.
  Recommend keeping `kind` unless a rename is wanted.

---

## P2-2 — Reshape rate/expense parameters (revisit the 009 consolidation)

### Context / why

Feature 009 consolidated performer rates and series expenses into one `series_parameters` table on the
premise they were structurally identical (both effective-dated per-series amounts resolved by "greatest
`effective_date` ≤ date"). That was a **shape** coincidence, not a **behavioral** one. By how each is
actually consumed, there are three distinct behaviors, and `kind`/`label` were split artificially:

- **Standard amount, resolved and overridable per instance** — performer pay (dimension = performer
  type; instance = a booking, which already carries `pay_cents` + `is_overridden`). **Rent is the same
  shape**: a venue is booked to an event the way a performer is booked to an event (today that booking
  is just `events.venue_id` — the degenerate single-venue case), the standard rent varies by venue, and
  it should be overridable per _event_ exactly as pay is overridable per booking. The one difference is
  _grain_: performer pay is keyed by performer **type** — a grouping one level above the booked
  individual (all callers share a rate; the specific caller is interchangeable for pay) — whereas rent
  is keyed by the **venue itself**, the leaf. There is no "venue type" because venues are few and each
  is genuinely distinct, so the standard already lives at the individual grain. Same pattern, two grains.
- **Recurring series charge, auto-applied, ended by zeroing** — an ongoing expense. It applies
  automatically to **every** dance in the series from its effective date and continues until a
  (possibly future) effective-dated row **sets it to 0** — e.g. when a piece of equipment finishes
  depreciating. It is never deleted; the $0 row ends it while preserving history. No per-event override.
- **Per-event ad-hoc line** — a misc expense (already `misc_expenses`: per-event `description` +
  `amount`; no standard, no recurrence).

Two consequences: **(1) rent is in the wrong bucket** — it belongs with performer pay, not with
ongoing. Rent was series-scoped only as a stand-in before venues existed (005 research: "rent is a
venue stand-in until the deferred venue model, B12"); feature 007 has since built `venues` +
`events.venue_id`, so the stand-in has outlived its reason. **(2) `kind` is overloaded** — it's a
controlled _resolution key_ only where something resolves by it (performer type → rate kind; venue →
rent), while `label` is a pure human display name. To the organizer these all read as "just
parameters," which is why the current split feels artificial.

### What must change

1. **Rent → standard-with-per-event-override, keyed by venue.**
   - A standard rent per **venue**, effective-dated.
   - An event resolves its venue's rent for the event date and may **override** it for that one event
     (mirroring a booking's pay override). This needs an instance to hold the actual/overridden value —
     an event-level rent slot (or a small per-event rent record).
   - Edge: an event with no `venue_id` has no standard to resolve, so it falls back to a directly-entered
     per-event rent (the override path covers this).

2. **Ongoing → recurring series charge (keep; clarify semantics).**
   - Series-scoped, effective-dated, **auto-applied to every event** in the series on/after its effective
     date. Labeled (what the charge is).
   - **Ended by setting a $0 effective-dated row, not by deletion** — so history stays intact (the
     depreciation case). No per-event override.

3. **Misc → unchanged** (per-event ad-hoc labeled amount).

4. **Performer pay → unchanged.** Standard rate per performer type, per series, effective-dated,
   resolved at booking, overridable on the booking. Per-_individual_ standard pay is **YAGNI** — and note
   it is simply "drop the performer dimension from _type_ down to the _leaf_," i.e. make performers work
   the way venue rent already does. The "standard keyed by a dimension + per-instance override" family
   absorbs it later with no new mechanism if ever proven out.

5. **Retire the artificial `kind`/`label` split accordingly.** Keep a controlled resolution key only
   where resolution happens by it (performer type → rate; venue → rent); the human-facing name of a
   charge is a label (this subsumes the `kind`/`label`-overloading concern raised alongside P2-1).

### Expected outcomes (testable)

- Rent can be set per venue and **overridden for a single event**; the organizer report reflects the
  overridden rent for that event only and the standard for the rest.
- An event with no venue can still have a rent entered directly.
- An ongoing expense set effective 2026-01-01 applies to every event in the series from then on; adding
  a $0 row effective 2027-06-01 stops it for events on/after that date while earlier events keep the
  prior amount (history intact).
- Dance Net for every existing event is unchanged by the re-scoping (rent/ongoing/misc net out the same
  amounts until a deliberate change).

### Dependencies / notes

- Depends on `venues` + `events.venue_id` (feature 007 — already built).
- **Revisits feature 009's single-table consolidation** and the organizer report's **fixed** Rent /
  Ongoing columns: rent now comes from venue + override; ongoing may need dynamic labeling. Dance Net
  math itself is unchanged (it already subtracts total rent + total ongoing + misc).
- Needs an event-level rent slot (a field on `events` or a small per-event rent record) to hold the
  resolved/overridden value.
- Touches: the `series_parameters` model, `resolveParameterCents`, the `bookingService`/`reportService`
  resolution call sites, and the rate/expense admin surfaces.

### Open questions for `/speckit-clarify`

- **Q: One consolidated table, or split by behavior?** Does rent (venue standard + event override)
  warrant its own shape distinct from performer pay and from ongoing, or can one generalized
  "standard-with-override" model cover both pay and rent?
- **Q: Where does the per-event rent override live** — a `rent_cents` / `rent_overridden` pair on
  `events`, or a dedicated per-event rent record?
- **Q: When a series' events span multiple venues, is rent purely venue-driven**, or is there still a
  series-level default when a venue has no rent set?

---

## P2-3 — Contact first/last name, overridable display name, pronouns

### Context / why

Contacts today carry only `display_name` (+ a derived `name_normalized`); there is no structured
first/last name. We need first and last name as **separate fields** because:

- **Check-in needs them as sort fields.** A single name blob can't be sorted reliably by last (or
  first) name for the door roster.
- **Mailing-list generation needs them separately.** iContact and mail-merge tooling expect distinct
  First Name / Last Name columns (feature 006 export).

The **display name** should **default to `first + " " + last` but remain overridable** — for nicknames
("Bob" vs "Robert"), mononyms, or organizational contacts. Display name is what shows on the check-in
**member buttons**. Contacts also need a **pronouns** field (recorded and shown in the contacts UI).

### What must change

1. Add `first_name`, `last_name`, and `pronouns` columns to `contacts`. `first_name`/`last_name` are
   **required** going forward (no legacy-nullable concern — see Dependencies); `pronouns` is optional
   **free text**.
2. Make the display name **derived-by-default with a stored override**: add a **nullable
   `display_name_override`** column; the effective display name is
   `display_name_override ?? (first_name + " " + last_name)`. Ordinary name edits keep flowing into the
   default, while an explicit override (nickname, mononym, org contact) sticks. The effective display
   name remains the label on check-in member buttons. _(Replaces today's single required `display_name`
   column.)_
3. Keep `name_normalized` (dedup/search) deriving from the **effective** display value, so dedup
   behavior is unchanged.
4. Surface first/last/pronouns in the contacts create/edit API + UI; add sort-by-name to check-in; add
   separate First Name / Last Name (and optionally pronouns) columns to the mailing-list export
   (feature 006).

### Expected outcomes (testable)

- A contact created with first + last gets display name "First Last" by default, and the display name
  can be overridden without altering first/last.
- The check-in roster can be sorted by last name (and/or first).
- The mailing-list export contains distinct First Name / Last Name columns.
- Pronouns can be recorded on a contact and shown in the contacts UI.

### Dependencies / notes

- Touches feature 001 (contacts model, dedup normalization, contacts UI), feature 002 (check-in sort +
  member buttons), feature 006 (export columns).
- **No backfill of existing rows.** Contacts are loaded fresh from the club's existing lists at go-live,
  so the import populates `first_name`/`last_name` directly — there is no legacy `display_name`-only data
  to split. (This is why first/last can be required from the start.)

### Open questions for `/speckit-clarify`

- None outstanding — pronouns are free text, the display-name override storage is settled above, and
  there is no backfill (fresh load at go-live).

---

## P2-4 — Event short label + start time

### Context / why

Events carry `series`, `date`, optional `group`, optional `venue`, and `charges_admission` — but no
short label and no start time.

- A **short label** is needed to distinguish **event-group members that fall on the same day** — e.g. a
  "Pride Dance 2026" double dance with an afternoon and an evening session on one date; the label
  ("Afternoon" / "Evening", or "English" / "Contra") tells them apart in listings, check-in, and the
  public site.
- A **start time** is needed so **dancers know when to come** (shown on the public schedule / event
  detail, feature 007).
- An optional **long-text description** is needed for display on the public website (event detail) — a
  free-form blurb about the dance.

### What must change

1. Add `label` (short **free text**, optional), `start_time`, and `description` (long text, optional) to
   `events`, stored separately from `event_date`. `start_time` is a **bare wall-clock `time`, taken as
   venue-local and displayed exactly as entered** — no time-zone data, storage, or conversion (a SQL
   `time` is zoneless, which is exactly what's wanted here). "7:30 PM" means 7:30 PM at the venue.
2. Surface `label`, `start_time`, and `description` in the events create/edit API + UI.
3. Show `label` and `start_time` wherever events are listed (public schedule + event detail, feature
   007; check-in/events admin; anywhere same-day group members appear together); show `description` on
   the public event detail.

### Expected outcomes (testable)

- Two events in the same group on the same date are distinguishable by their labels in every listing.
- The public schedule / event detail shows each event's start time exactly as entered (venue-local
  wall-clock), independent of the viewer's browser.
- The public event detail renders the event's description when present.

### Dependencies / notes

- Touches feature 002 (events model + admin) and feature 007 (public schedule / detail rendering).
- Only **start** time is requested; end time is YAGNI (add later if a duration is ever needed).
- **No time-zone handling** — the club treats start time as venue-local wall-clock; there is no
  cross-zone conversion and venues need no time-zone field.
- Complements P2-1: `label` distinguishes _instances within_ a group, while the (now free-text) group
  `kind` categorizes the group — different, complementary fields.

### Open questions for `/speckit-clarify`

- None outstanding — `label` is free text, and `start_time` is venue-local wall-clock displayed as
  entered.

---

## P2-5 — Door record: comp count feeding paying-dancers (with gift-card redemptions)

### Context / why

The door record should account for **comps** — free admissions — so the organizer report's
paying-dancer count, and therefore Avg Ticket, isn't distorted. Comps are redemptions of "your next
dance free" cards and performers' guests. There is **no field for this today**.

**Gift-card redeemers, by contrast, count as paying dancers** — they paid at gift-card purchase. The
existing `gift_card_redemption_count` on `door_records` is for revenue reconciliation, not the
paying-dancer count, and needs no change here.

Today `payingDancers(attendanceCount, performerCount) = max(0, attendance − performers − 1)` — it
subtracts distinct performers and the single door attendant only (`danceResult.ts`). Comps currently
fall through as "paying," **overstating** paying dancers and **understating** Avg Ticket. This is the
gap tracked as **BACKLOG B14**; this item supersedes it.

### What must change

1. Add a **`comp_count`** column to `door_records` — its own separate count, covering "your next dance
   free" redemptions **and** performers' guests together.
2. Capture `comp_count` in the door/gate-money entry API + UI (a distinct field from the existing
   `gift_card_redemption_count`).
3. Fold comps into the paying-dancer derivation:
   `paying_dancers = attendance − performers − door attendant − comps`. **Gift-card redeemers remain
   counted as paying** — their treatment does not change.

### Expected outcomes (testable)

- A door record can record a comp count; the organizer report's paying-dancer count drops by that
  amount and Avg Ticket rises correspondingly.
- Gift-card redeemers continue to count as paying dancers (unchanged behavior).
- With comps = 0, paying dancers and Avg Ticket are unchanged from today (no regression on existing
  events).

### Dependencies / notes

- Touches feature 002 (`door_records` model + gate-money entry) and feature 005 (`payingDancers` /
  `avgTicketCents` in `danceResult.ts`, organizer report).
- Supersedes **BACKLOG B14** — remove/retire that row when this is specified.

### Open questions for `/speckit-clarify`

- None outstanding — gift-card redeemers count as paying; comps are a single separate count that
  reduces paying dancers.

---

## Additional Phase 2 items

_To be added as more gaps are captured. Candidate items already tracked in `specs/BACKLOG.md`
(e.g. B14 comps at the door, B18 self-service create-series) may be pulled into Phase 2 here when
prioritized._

- _(placeholder — add items as you identify them)_
