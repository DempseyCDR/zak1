# Backlog — Deferred & Cross-Cutting Items

Items intentionally out of scope for their originating feature, captured so they aren't lost. Each
notes where it surfaced and where it will likely land. Not a commitment to a phase.

| # | Item | Surfaced in | Likely home | Notes |
|---|------|-------------|-------------|-------|
| B1 | **Group tickets** — a single ticket purchased once and redeemable as admission across all events in an `EventGroup` (Double Dance, weekend festival, JAB). | 002 (EventGroup entity added; tickets deferred) | 007 (online purchase) + 002 (door redemption) + 004/005 (revenue attribution across constituent events) | Entity `event_group` + `event.group_id` exist as of feature 002. Needs: ticket purchase, redemption-at-door, and splitting one ticket's revenue across events. |
| B2 | **Non-volunteer contact login + self-service profiles** | 001 (Phase 1 = volunteer/admin login only) | Future auth phase | Deferred per source doc. |
| B3 | **Primary email designation** | 001 (no primary email in Phase 1) | Future | Needed if a single canonical public-profile address must be chosen among several. |
| B4 | **Cross-club shared performer directory** | source doc / 003 | Future / multi-tenant | Deferred. |
| B5 | **Configurable fiscal quarters** | 005 (calendar quarters assumed) | Future | Organizer report currently uses calendar quarters. |
| B6 | **Separate Venmo fee rate** | source doc / 004 | Future | Phase 1 shares the PayPal/Venmo door fee; admin splits when rates diverge. |
| B7 | **iContact API sync** | 006 (CSV export only in Phase 1) | Future | Platform is system of record; CSV is the Phase 1 delivery path. |
| B8 | **QBO API integration** | 004 (manual copy/paste Treasurer Report in Phase 1) | Future | No CSV import / API in Phase 1. |
| B9 | **Native iOS/Android apps** | 007 | Future | Web only for now. |
| B10 | **Automated email from the platform** | 006 / source doc | Future | Platform produces lists; sending stays in iContact. |
| B11 | **Multi-tenant data model** | build 1 chosen single-tenant | Future build/refactor | Build 1 is single-tenant (CDR); club-level settings already configurable. |
| B12 | **Additional event attributes (venue, etc.)** | 002/003 (event creation added) | 002 events + 007 public site | Event currently has series/date/group/charges-admission. Add venue (with maps in 007) and other attributes in a future phase. |
| B14 | **Comps (free admissions) at the door** | 005 clarify (paying-dancers derivation) | 002 door/attendance + 005 report | Door attendant records attendees admitted free ("comps"). Then paying_dancers = attendance − performers − door attendant − comps. Until then comps count as paying dancers, slightly understating Avg Ticket. |

## How to use this file

- When deferring something during `/speckit-specify` or `/speckit-plan`, add a row here and a one-line
  pointer in the originating spec's Assumptions section.
- When a backlog item is picked up, move its detail into the target feature's spec and remove the row
  (or mark it Done with the feature number).
