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
| B15 | **Reusable Band roster entity** | 003 (musician type added) | 003 performers/bookings | A Band = a lead musician + member musicians, reusable across events, so a band can be booked as a unit. Phase 1 books lead + musicians individually per event (roles are per booking; cross-band roles already work). |
| B16 | **Consolidate `rateParameters` + `SeriesExpenseParameter` into one `series_parameters` entity** | 003 (rate params) / 005 (expense params) | 003 domain/bookings + 005 domain/organizer | Both are effective-dated, per-kind amount parameters resolved by "greatest effective_date ≤ target date"; expense already has `seriesId` + `label`, rate has neither. **Design settled, not yet implemented:** single table `series_parameters` (`category` enum rate/expense, `kind` enum caller/sound_tech/rent/ongoing, `series_id` **NOT NULL** FK→series, amount_cents, label, effective_date) plus one shared `series_parameter_audit` table (today rate-only via `rate_parameter_audit`; expense gets audit parity in the merge). `series_id` is mandatory for rate too, matching expense's existing invariant — no nullable/global-fallback special case. Instead, add a new `general` series row (for joint/cross-series events) and backfill today's global caller/sound_tech rates into every existing series including `general`, so behavior is unchanged on migration day. One resolver replaces `resolveRateCents`/`resolveExpenseCents` with identical logic for both categories (no branching, since series is always required now). Touches: schema (`rates.ts` + `seriesExpenseParameters.ts` → `seriesParameters.ts`), domain services (`rateParameterService.ts` + `expenseParameterService.ts` → one), validation (`rateParameterCreateSchema`/`expenseParameterCreateSchema` can likely become one shared schema now that both require `seriesKey`), `bookingService.ts` (pass `event.seriesId` into rate resolution — already in scope there for the sound-tech gate), and every test importing `rateParameters`/`seriesExpenseParameters`/`rateParameterAudit` schema symbols. Rate/expense parameter UI/API surfaces (`rate-parameters/`, `expense-parameters/` pages) can stay as two thin pages calling the shared service for now; a merged single-page UI is an optional follow-on, not required. |

## How to use this file

- When deferring something during `/speckit-specify` or `/speckit-plan`, add a row here and a one-line
  pointer in the originating spec's Assumptions section.
- When a backlog item is picked up, move its detail into the target feature's spec and remove the row
  (or mark it Done with the feature number).
