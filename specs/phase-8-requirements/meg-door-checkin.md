# Phase 8 — Meg's Area: Door Check-in (requirements draft)

**Status:** pre-SpecKit requirements draft (developed conversationally; will seed `/speckit-specify`).
**Phase 8 goal:** make it easy for volunteers to maintain data. This doc covers **Meg**, the door
attendant, checking dancers in quickly and correctly at the door.

Requirement IDs are `MEG-Rn`. Anything marked _(open)_ is not yet decided. Cross-cutting search work
lives as **X-R3** in [mel-contact-maintenance.md](mel-contact-maintenance.md).

---

## 1. Actor & authority

- **Meg** holds `door_attendant` (`attendance.write`; `contact.write` to create walk-ins at the door;
  `contact.pii.read` to disambiguate the right "John Smith"). Roles are combinable — she may hold more.
- **Depends on X-R3** (the `searchContacts` fix — substring-primary matching, name ∪ dedup ∪ email).
  It is marked **priority** precisely because the door is where poor search hurts most and where
  duplicate contacts get created. Meg's flows below assume that fix is in.

## 2. Requirements

- **MEG-R1 — Match-list display.** The result list shows **first name, last name, and personal email**
  (structured first/last, not `display_name`, so a nickname override like "DJ" doesn't obscure "David
  Jones" while disambiguating). Requires `searchContacts` to project `first_name`/`last_name`, and the
  route to attach the active email whose `purposes` include `personal`. PII gating already works
  (door_attendant holds `contact.pii.read` global). _Open: which email when there are several personal
  ones (no primary designation — backlog B3), and the fallback when a contact has no personal email._
- **MEG-R2 — Exclude already-checked-in contacts from the match list.** The search results show only
  candidates **not yet checked in** for this event. Anyone already checked in appears in the
  **checked-in list below**, which is where Meg corrects them (un-check-in / fix counts / move event).
  This keeps the two lists non-overlapping: "find someone to check in" vs. "fix someone already in."
- **MEG-R3 — Row layout.** No line wrap **between the name and the check-in button** — they stay
  together on one line. A wrap **before** the children / comp / gift-card controls is acceptable (they
  may fall to a second line). Part of the mobile-first, fast-entry ergonomics (X-R1).
- **MEG-R4 — Door create-contact form.** When a walk-in isn't found, Meg creates a contact with:
  **first name, last name, display name (optional), email, phone.** Email/phone may be left blank if the
  dancer declines. **No pronouns at the door** — see the pronouns rule below. Optional display name maps
  to `display_name_override` (blank = automatic "first last", per M-R6); consent defaults to
  `contact_tracing` (door check-in _is_ contact tracing), email purpose to `personal` — Meg doesn't set
  those. The new contact is checked in immediately and flagged for Mel's review (see C1).

> **Pronouns rule (cross-cutting).** Pronouns are collected when a contact **becomes a member**, not at
> the door — the club makes identifying buttons (with pronouns) as a **member benefit**. So the door
> form omits pronouns; Mel's record view keeps them editable (M-R5); and the **membership flow** should
> prompt for pronouns for the button. _(Membership-flow requirement — capture fully when we reach that
> area; noted here because it's why MEG-R4 has no pronouns field.)_

- **MEG-R7 — Open-band comped at BOTH the community dance and the paired contra.** Open-band musicians
  get in **free at the community dance _and_ at the contra in the same event group.** The community-dance
  comp is **unchanged** (feature 017 already comps them via `open_band_count`); the rule **adds** the
  same comp at the paired contra. **Additive, not a reversal.** Applies to **community dances only**
  (open-band is community_dance-only); free events need nothing special. **Implement as an
  easily-removable rule** (policy may change).
  - **Mechanism (resolved):** derive the contra's comp from the paired community dance's `open_band_count`
    (aggregate, matches C2, easily removable) rather than marking open-band at the contra. The
    attend-both assumption is **accepted** — in practice the error (a musician who skips the contra) is
    very small.
  - **Report math:** the community dance is **unchanged**; only the **contra's** `effectiveComps` gains
    the open-band count, lowering its paying-dancer total by that many. _(Verified today's math:
    `effectiveComps = compCount + openBandCount`, `payingDancers = attendance − performers − 1 − comps`;
    open-band already excludes booked performers per FR-022a — preserve that.)_
  - **Pairing (VERIFIED in the live dev DB — corrects the earlier seed-only finding):** a 2nd-Thursday
    event group pairs a **community_dance** event with a **tnc (contra)** event on the same date ("0826
    2nd Thursday", "1026 2nd Thursday" each hold both). So "the contra in the group" = the
    non-community_dance (tnc / contra-series) event sharing the `group_id`.
  - **Data dependency:** the paired contra must actually be in the group. **"Sept 2026 2nd Thursday" is
    currently missing its tnc contra** (confirmed) — the rule then finds no contra and applies no contra
    comp. Consider a validation/warning for a community-dance group lacking its paired contra.
- **MEG-R6 — Own session; event-persisted shared state.** The door device runs the attendant's **own**
  session (not a shared login). Check-in state — the roster and the live count — is **event-scoped and
  server-persisted**, so when one attendant relieves another (Rich takes over from Meg), signing into
  `/check-in` shows the **current list and count** with no handoff step. Relies on `/check-in` defaulting
  to the active event (feature 017) so the reliever lands on the right event.
- **MEG-R5 — Shared-email affordance at the door.** When Meg enters an email already **owned** by
  another contact, offer three resolutions instead of a raw error: **(a)** it's that person → check them
  in (dedup); **(b)** a different person who **shares** that email → link as message recipient (family
  shared email, per M-R23), then check in; **(c)** different email → correct it. Prevents both false
  merges and duplicate contacts. See M-R26 (sharing is not merging) and M-R25 (a shared reference can
  never be that contact's login).

## 3. Open considerations for Meg's check-in duties

Raised for decision as we develop this area:

- **C1 — Door-created contacts → Mel (mostly resolved).** When Meg creates a walk-in (MEG-R4):
  - **Trigger:** **every** door-created contact is flagged `needs_review` (Mel reviews/completes and
    uploads new addresses to the provider regardless).
  - **Nature:** the flag is about **data completeness / provider upload — NOT duplicates.** Duplicate
    detection is a **separate automated sweep** (the existing dedup suggestion engine) that feeds the
    duplicates triage queue independently.
  - **Clearing (resolved → upload worklist):** `needs_review` is the **upload worklist**. It clears when
    the record is complete **and** its new address has been uploaded/exported to the provider — not on
    data-completeness alone. Implies tracking a "not-yet-uploaded / new-since-last-export" state, tied to
    the export mechanism (`mailing_list_exports`) and reflected in Mel's triage (see M-R18).
  - **Prevent at the door:** MEG-R5 (email-collision → merge / share / correct) plus the X-R3
    _"did you mean…?"_ search. Best dedup is the dup never created.
- **C2 — Comp / gift-card stay aggregate (resolved).** `door_records.comp_count` and
  `gift_card_redemption_count` **remain aggregate counters** (no per-person attribution). Only
  `children_count` and `is_open_band` are per-check-in. So the comp/gift-card controls near the row
  **increment the door-record totals**, they don't tag an individual. **Permission note:** these
  counters live on `door_records`, whose _money_ fields are the FS's (`gate.write`) — but the comp/
  gift-card **counts** are set by the door attendant during check-in. The capability catalog already
  anticipates this split ("a door record's money vs. its comp counts"), so Meg writes these counters
  under her attendance authority, not `gate.write`. **Gift-card is an event-level count** (not per person,
  not a row item); **comp** is bumped per guest via a checkbox at check-in but still lands on the
  aggregate `comp_count`; **children** is the only true per-person quantity on the row.
- **C4 — Live door tally (resolved).** Show a live count at the door (`events.attendance_count`, net of
  comps/open-band). Confirmed by the relief scenario (MEG-R6): a reliever sees the **current count**.
- **C5 — Door-device session (resolved → MEG-R6).** Meg's **own** session; state is event-persisted so
  relief is seamless. _(Long-shift TTL: an 8h idle window on the attendant's own session should cover a
  normal night; a multi-day festival is the edge to keep in mind, but not designed around now.)_
- **C6 — Fast-entry ergonomics.** Focus-to-search on load, Enter checks in the top result, large tap
  targets, minimal taps per person (builds on 017 and X-R1 / MEG-R3).
- **C7 — Free events, performers, open-band (resolved).** **Guests:** Meg checks the comp box (→
  aggregate `comp_count`). **Open-band:** see MEG-R7 (free at BOTH the community dance and the paired
  contra; removable rule). **Free events** (`charges_admission = false`): Meg does nothing special —
  just checks dancers in (no comp/gift-card/open-band).
- **C8 — Connectivity — not a concern** (no flaky-wifi experience). Dropped from scope.

- **C3 — Correction affordances on the checked-in list (resolved → inline).** All corrections are
  inline: un-check-in (`deleteAttendance`, decrements the count), fix children/counts
  (`patchAttendance`), and wrong-event move (`moveAttendance`). No confirm step required.
