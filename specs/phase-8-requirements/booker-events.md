# Phase 8 — Booker's Area: Event & Group Fixes (requirements draft)

**Status:** pre-SpecKit requirements draft (developed conversationally; will seed `/speckit-specify`).
**Phase 8 goal:** make it easy for volunteers to maintain data. This doc covers the **Booker**'s
event/group maintenance — starting with fixes for gaps where no control is surfaced today.

Requirement IDs are `BK-Rn`. Anything marked _(open)_ is not yet decided.

---

## 1. Actor & authority

- The **Booker** holds `booker` (`event.write` etc., **per-series scoped**). Treasurer and super_user
  reach it globally. Event-group operations are gated by `event.write` with scope awareness
  (`assertScope(actor, "event.write", { seriesId, groupId })`).

## 2. Requirements

- **BK-R1 — Add an existing event to an event group (and remove it).** Surface a control to assign an
  already-created event to an event group, and to remove it from its group. **Verified gap:** today
  `group_id` is settable **only at event creation** (`createEvent` / `generateRecurringEvents`);
  `updateEventDetails` patches label/time/description/date/status/price but **not** `group_id`, and there
  is no `addEventToGroup` service — so an existing event can never be moved into or out of a group.
  - **Why it matters now:** this is exactly how an incomplete pairing gets fixed — e.g. **"Sept 2026 2nd
    Thursday"** currently holds only its community_dance event; the Booker would use this control to add
    the existing **tnc** contra event to that group (which MEG-R7's open-band comp then depends on).
  - **Capability:** `event.write`. _Scope note:_ event groups are **orthogonal to series** (a group may
    span series), and a group grant can confer authority over the events in it. So adding event E (series
    S) to group G should require the actor's `event.write` to reach **E's series** (and the group), and
    the change can widen who else can touch E via the group — worth an explicit scope rule.
  - _Open:_ where the control lives (event detail page? the group's page?), and whether a group has any
    membership rules (e.g. one community_dance + one contra for a 2nd-Thursday group, or free-form).

## 3. Open considerations

- **BK-C1 — Group completeness / validation.** MEG-R7 relies on a community-dance group actually
  containing its paired contra. Should the Booker's group view **flag an incomplete pairing** (a
  community_dance group with no contra), so gaps like "Sept 2026 2nd Thursday" are caught? _(See MEG-R7
  data dependency.)_
