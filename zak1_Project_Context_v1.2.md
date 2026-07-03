# CDR Dance Club Management Platform — Project Context

## Document Status
- Requirements document: v1.2 (Phase 1 complete)
- Last updated: May 2026
- All Phase 1 open questions resolved

---

## Project Overview

Country Dancers of Rochester (CDR) has operated since 1976. The goal is to replace:
- WordPress website (cdrochester.org)
- Three Excel workbooks (Contra_Results_v3_0.xlsx, ECD_Results_v3.xlsx, CDR_Member_DB_v1.xlsx)
- Paper cash form
- Manual QBO entry processes

With a purpose-built, open-source, multi-tenant dance club management platform that can be licensed to similar folk dance clubs.

---

## Dance Activities

| Activity | Frequency | Notes |
|---|---|---|
| Thursday Night Contra (TNC) | Weekly | Primary series; ~60 dancers avg |
| Sunday English Country Dance (ECD) | Bi-weekly | ~18 dancers avg |
| Community Dance | Monthly | 1 hour before TNC; own Door Record and financials |
| Instructor-led event (e.g. Contra 102) | Occasional | Free; no financials; led by Instructor |
| Organizational Meeting | Twice monthly | No admission; attendance tracked |
| Double Dance | Occasional | Special event group; ≥2 Contra sessions |
| Weekend Festival | Occasional | Multi-day; advance PayPal tickets |
| Fringe Dance | Annual | Free; Rochester Fringe Festival loss leader |
| Jane Austen Ball (JAB) | Annual | Formal ball; prep sessions grouped as Event Group |
| Barn Dance | Occasional | Informal |

---

## People Model

### Two-Tier Structure
- **Contact**: Everyone CDR communicates with. UUID PK. ~1,300 records. Multiple emails via ContactEmail.
- **Member**: A Contact who has paid dues. ~152 current/recent. Linked to a Payer.

### ContactEmail Entity
Each Contact has one-to-many email addresses. Key fields:
- `email` — unique across active + transition records globally
- `type` — personal / booking / public-profile / other
- `status` — active / transition / inactive
- `icontact_export` — Boolean; marketing consent for this address
- `is_login` — Boolean; Phase 1: volunteer/admin Contacts only
- `ic_setdate`, `ic_lastopendate`, `ic_lastclickdate` — read-only iContact metadata
- No primary email designation in Phase 1

### Membership Status (materialized on Contact)
| Status | Definition | list_member |
|---|---|---|
| current | Most recent expiry ≥ today | true |
| lapsed | Lapsed ≤ long_lapse_cycles cycles | true |
| long_lapsed | Lapsed > long_lapse_cycles cycles | true |
| never | No Membership record | false |

- `long_lapse_cycles`: configurable per club (CDR default: 3)
- Updated by trigger on Membership change + nightly job
- Included as column in member.csv iContact export for segmentation

### iContact List Flags (7 lists)
| List ID | CSV Filename | Notes |
|---|---|---|
| contra | contra.csv | TNC announcements |
| english | english.csv | ECD announcements |
| openband | openband.csv | Community Dance |
| specialevents | specialevents.csv | Special events |
| janeaustenball | janeaustenball.csv | Year of most recent JAB |
| performer | performer.csv | Performers |
| member | member.csv | Members; includes membership_status column |

- iContact does not accept list ID in upload; CSV filename guides list selection
- App is system of record; iContact is delivery mechanism
- `tracing_event` is computed at export time for contact tracing mailings only — not stored
- `memberthrough` (year) derived from Membership expiry at export time — not stored

### Door Attendance — Fuzzy Name Search
- Volunteer types name → fuzzy search (trigram/Jaro-Winkler) → ranked pick list within 300ms
- Email disambiguates multiple matches
- No match: volunteer enters name + email → new Contact created; admin reviews
- Dancer declines: Unmatched Attendance Contact

### Contact Deduplication
- Fuzzy name matching surfaces suggestions in admin review queue
- Admin confirms all merges; no automatic merges
- Merge: canonical UUID chosen; all related records re-linked

---

## Performer Types

| Type | Paid? | Check? | Public Display | Notes |
|---|---|---|---|---|
| Caller | Yes | Yes — one per event | Full bio + photo | $0 if fee donated; no check |
| Lead Musician | Yes | Yes — one per musician | Full bio + photo | $0 if donated |
| Open Band Musician | No | No | "Open Band" label | Untracked beyond 1–2 paid leads |
| Sound Tech | Yes | Yes — one per event | Not listed publicly | TNC/ECD only; not Community Dance |
| Instructor | No | Never | Name + short note | Always free; no exceptions; leads free pre-dance events |

- **$0 bookings**: performer donates fee; booked at $0; no check; counts in appearance history; excluded from YTD earnings
- **Community Dance**: paid Caller + 1–2 paid Lead Musicians + Open Band; no Sound Tech
- **Instructor-led events** (e.g. Contra 102): free; no Door Record; no financials

---

## Gate Sales Model

Seven categories, each tracked separately by cash and card:

| Category | Dance Net? | Organizer Report | QBO Treatment |
|---|---|---|---|
| today_admission | Yes — primary revenue | Gross Gate column | Gate receipt line item |
| merchandise | Yes | Merchandise Sales column | Gate receipt line item |
| donation | No — FYI only | Own column | Gate receipt line item |
| future_event | No — FYI only | FYI column | Separate named receipt |
| membership | No — FYI only | FYI column | Separate named receipt |
| gift_card | No — FYI only | FYI column | Gate receipt line item (liability 2201) |
| misc_sales | No — FYI only | FYI column | Gate receipt line item |

- **Dance Gate** = today_admission (cash + card) only
- **Merchandise** = what the spreadsheet calls "Fund Raising"
- **Donations** = voluntary contributions; do NOT flow into Dance Net
- **Non-Dance Income** (grants, bank interest) = excluded from organizer report entirely

---

## Dance Net Formula

```
Dance Net = Gross Gate + Merchandise Sales − Rent − Performer Total − Ongoing Expense − Misc Expenses
```

- **Gross Gate** = today_admission cash + today_admission card
- **Performer Total** = Caller + Musicians + Sound Tech (combined; drill-down modal for breakdown)
- **Ongoing Expense** = per-series configurable parameter with effective-date history (TNC: "Equipment Depreciation" $10/dance; ECD: none currently)
- **Misc Expenses** = ad-hoc expenses + CC fees
- **Net Gate** = Gross Gate − door POS fees (used for Avg Ticket only)
- **Avg Ticket** = Net Gate ÷ Paying Dancers
- **Break-Even Dancers** = shown only when Dance Net < 0

---

## Fee Structures

| Context | Formula |
|---|---|
| Door PayPal/Venmo POS | $0.09 per transaction + 2.29% of gross total |
| Online PayPal (advance tickets, memberships) | $0.49 per transaction + 1.99% of amount |

- Door volunteer reads transaction count from POS app; fee calculated by system; not shown to volunteer
- Fees excluded from door report; rolled into Misc Expenses in organizer report
- All revenue reported to QBO at gross; QBO is system of record for fees
- PayPal POS card data flows to QBO directly from PayPal; Treasurer verifies totals match door report

---

## QBO Integration

**No CSV import** — QBO does not natively accept CSV imports; no plugin in Phase 1.

**Treasurer Report** — formatted per-event report (screen-first, laptop dimensions; print-supported) for manual copy/paste into QBO. Five sections:
1. **Gate Sales Summary** — for anonymous QBO sales receipt; includes PayPal POS verification line
2. **Named-Customer Receipts** — memberships and advance tickets collected at door
3. **Performer Payments** — check number, payee, amount, QBO account, QBO class
4. **Deposit** — cash deposit amount to QBO 1021 ESL Checking
5. **Fees** (informational) — door POS fee calculation for reconciliation awareness

**QBO Sales Receipt Structure:**
- One sales receipt per event
- Customer: "Contra Gate" (TNC, Community Dance, Double Dance) or "English Gate" (ECD)
- Line items with QBO class per category
- Community Dance + TNC evening: two receipts (one per event), both to "Contra Gate"
- Memberships and advance tickets: separate named-customer receipts (NOT on gate receipt)

**QBO Classes** (already in use at CDR):
- Applied per line item based on event type
- Configurable mapping per club in admin settings

**Gift Cards on receipt**: line item → QBO books to liability 2201; Treasurer creates journal entry to move to revenue on redemption

---

## QBO Account Reference (App Scope)

### Revenue
| QBO # | Account Name | App Category |
|---|---|---|
| 4100 | Voluntary Contributions | Donations |
| 4200 | Program Service Revenue | Advance Ticket Proceeds |
| 4210 | Program Service Revenue:Dance Gate | Today's Admission |
| 4300 | Membership Dues | Memberships |
| 4700 | Sales of Inventory | Merchandise Sales |
| 4900 | Uncategorized Income | Misc Sales |
| 4910 | Other Miscellaneous Revenue | Non-Dance Income (excluded from organizer report) |

### Expenditures
| QBO # | Account Name | App Category |
|---|---|---|
| 5310 | Program Staff:Bands | Musician Pay |
| 5320 | Program Staff:Callers | Caller Pay |
| 5330 | Program Staff:Sound Tech | Sound Tech Pay |
| 5420 | Facilities:Rent | Venue Rent |
| 5810 | Bank Charges & Fees:PayPal Fees | Door POS fees + Online PayPal fees |
| 5950 | Other Misc Expenditure | Ongoing Expense + Misc Expenses |

### Balance Sheet
| QBO # | Account Name | App Action |
|---|---|---|
| 1021 | ESL Checking | Cash deposits from all dance events |
| 1030 | PayPal Bank | Online PayPal proceeds |
| 2110 | A/P:Performers Payable | Checks outstanding |
| 2120 | A/P:Rent Payable | Rent owed |
| 2201 | Prepaid Services:Pre-paid Gift Card | Gift card balance (deferred revenue) |

### Removed from Scope
- 1012, 1014 (Contra/ECD Cash on hand) — deposits go to 1021
- 2202, 2204 (Annual passes) — program ended
- 5352, 5354 (Travel) — folded into performer pay

---

## Organizer Report

### Structure
- **TNC Report**: TNC per-dance rows + quarterly summary + 52-week charts → Community Dance per-dance rows + quarterly summary + 52-week charts
- **ECD Report**: ECD per-dance rows + quarterly summary + 52-week charts
- Separate reports for TNC and ECD

### Per-Dance Row Columns
| Column | Dance Net? | Notes |
|---|---|---|
| Date | — | |
| Series | — | TNC / ECD / Community Dance |
| Caller | — | $0 shown if donated |
| Band | — | "Open Band" for unpaid slots |
| Dancers | — | Paying count |
| Gross Gate | Yes | today_admission cash + card |
| Merchandise Sales | Yes | Formerly "Fund Raising" |
| Rent | Yes (expense) | From rate table |
| Performer Total | Yes (expense) | Drill-down modal; $0 donations at $0 |
| Ongoing Expense | Yes (expense) | Per-series; TNC = Equipment Depreciation $10 |
| Misc Expenses | Yes (expense) | Includes CC fees |
| Dance Net | Calculated | Black = positive; red = negative |
| Avg Ticket | — | Net Gate ÷ Paying Dancers |
| Break-Even Dancers | — | Only when Dance Net < 0 |
| Donations | FYI | Own column |
| Memberships sold | FYI | |
| Future Event sold | FYI | |
| Gift Cards sold | FYI | |
| Misc Sales | FYI | |

### Quarterly Summary
- Q1 (Jan–Mar), Q2 (Apr–Jun), Q3 (Jul–Sep), Q4 (Oct–Dec) + YTD + Last Year
- Replaces Last 4 Weeks / Last 12 Weeks from spreadsheets
- Columns: Count, Avg Dancers, Avg Gross Gate, Avg Merchandise, Avg Rent, Avg Performer Total, Avg Ongoing Expense, Avg Misc Expenses, Avg Dance Net, Avg Ticket
- FYI totals per quarter: Donations, Memberships, Future Event, Gift Cards, Misc Sales

### 52-Week Trend Charts
- Rolling 52-week window
- Two panels: Dance Net (top), Attendance (bottom)
- Each panel: individual event data points + smoothed trend line (4-event rolling avg)
- Dance Net: black markers = positive, red markers = negative
- Hover/tap shows date, Dance Net, Dancers, Caller, Band

---

## Door Record

Key fields:
- `pos_transaction_count` — read from PayPal/Venmo POS app by volunteer
- `pos_gross_total` — door PayPal/Venmo gross
- `pos_fee` = (pos_transaction_count × $0.09) + (pos_gross_total × 2.29%) — system-calculated
- `gross_cash_collected` — including seed float
- `cash_paid_out` + reason
- `deposit_amount` = gross_cash − seed_float − cash_paid_out → to QBO 1021 ESL Checking
- `gift_card_redemption_count` — count of gift cards redeemed for admission
- Gate Sales: one-to-many Gate Sale records (category × payment method)
- Attendee contacts: fuzzy name search; purged after 90 days; quarterly counts persist permanently

---

## Rate Parameters (all with effective-date history)

| Parameter | Scope | Notes |
|---|---|---|
| Venue rent rates | Per venue | Auto-selected by event date |
| Standard caller pay | Per booking | Overridable |
| Standard sound tech pay | Per booking | Overridable |
| Ongoing Expense | Per dance series | TNC: "Equipment Depreciation" $10; ECD: none; configurable label |
| Door PayPal/Venmo fee | Per Door Record | $0.09/txn + 2.29% |
| Online PayPal fee | Per online order | $0.49/txn + 1.99% |
| Seed float | Per Door Record | Default $15 |

---

## Data Sources Analyzed

1. `CDR_Member_DB_v1.xlsx` — member/payer database (3 sheets)
2. `Contra_Results_v3_0.xlsx` — TNC workbook (8 sheets, 2022–2026)
3. `ECD_Results_v3.xlsx` — ECD workbook (6 sheets, 2023–2026)
4. WordPress DB backup (37 MB SQL, May 2026): 4,981 events, 1,231 performers, 928 bands, 109 venue records, 33 sponsors
5. `CDR_Chart_of_Accounts.csv` — QBO chart of accounts (May 2026)
6. `Testing.csv` — iContact contact export sample (5 of ~1,300 contacts)
7. cdrochester.org — 4 screen captures
8. Stakeholder dialogue — May 2026 requirements elicitation

---

## Key Decisions Summary (all phases)

### Confirmed for Phase 1
- People: Contact (UUID PK) + ContactEmail (one-to-many); no primary email label
- Phase 1 login: volunteer/admin Contacts only
- Membership status: materialized (current/lapsed/long_lapsed/never); long_lapse_cycles = 3
- iContact: CSV only; 7 list IDs; filename = list ID + .csv
- Gift cards only (no punch cards)
- Fuzzy name search at door; fuzzy deduplication suggestions (admin confirms)
- QBO: formatted Treasurer Report for manual copy/paste; no CSV import; no API
- QBO classes in use; "Contra Gate" / "English Gate" anonymous customers
- Deposit to 1021 ESL Checking
- Dance Gate = today's admission only
- Dance Net = Gross Gate + Merchandise Sales − Rent − Performer Total − Ongoing Expense − Misc Expenses
- Performer Total = combined; drill-down modal
- Ongoing Expense replaces CDR Overhead; configurable per series; effective-date history
- $0 bookings: donated fee; no check; appearance history yes; YTD earnings no
- Instructors always free; no exceptions
- Community Dance: separate Door Record; paid Caller + 1–2 lead musicians; no Sound Tech
- Instructor-led events: free; no Door Record; no financials
- Organizer report: quarterly summaries; 52-week trend charts; black/red conditional color
- Contact tracing retention: 90 days (quarterly counts permanent)
- WooCommerce discarded entirely
- Google Static Maps API
- PayPal SDK for online advance tickets and memberships
- Venmo/PayPal fee shared in Phase 1; admin splits when rates diverge

### Deferred to Future Phase
- Non-volunteer Contact login + self-service profiles
- Primary email label
- Cross-club shared performer directory
- Fiscal quarter configuration
- Separate Venmo fee rate
- iContact API sync
- QBO API integration
- iOS/Android native apps
- Automated email from platform

---

## Requirements Document Version History

| Version | Key Changes |
|---|---|
| v0.1 | Initial requirements from stakeholder dialogue |
| v0.2 | WordPress DB analysis; integration decisions (PayPal, Maps, WooCommerce) |
| v0.3 | QBO chart of accounts mapping; PayPal à la carte; check number workflow |
| v0.4 | Online membership sales; ad-hoc payees; annual pass removal; travel removal |
| v0.5 | Instructor model; fee parameters; payer renewal; security simplification |
| v0.6 | Contact + ContactEmail entities; iContact integration; quarterly attendance |
| v0.7 | tracing_event as export-only; setdate reclassified; iContact PK confirmed |
| v0.8 | Multi-email Contact model; ContactEmail entity; iContact export strategy |
| v0.9 | 10 open questions resolved; scope parameters finalised |
| v1.0 | All Phase 1 open questions resolved; fuzzy name search; gift cards only; iContact list IDs |
| v1.1 | Membership status classification (current/lapsed/long_lapsed/never); materialized field; nightly job |
| v1.2 | Gate sales model; QBO Treasurer Report; fee structures; Instructor vs Community Dance; Dance Net formula; Organizer Report fully specified |
