# Feature Specification: Gate cash counting — denomination helper, direct total, and an anonymous-sales comment

**Feature Branch**: `031-gate-cash-counting`

**Created**: 2026-08-02

**Status**: Draft

**Input**: User description: "P5-R4"

## User Scenarios & Testing *(mandatory)*

At close-out the Financial Secretary reconciles the gate. Today there is a single "gross cash" field into
which the FS must type a pre-totaled number — which is error-prone for an FS who counts physically by
denomination, and offers no place to note what merchandise sold. This feature adds an **optional
denomination helper** that totals the cash for the FS, keeps the **direct-total** entry for the FS who
prefers it, and adds a **free-text comment** to the anonymous-sales section.

### User Story 1 - Count cash by denomination and let the gate total it (Priority: P1)

Mary closes out by physically counting the cash. She enters **how many bills of each denomination**, a
**coins** amount, and a **checks** amount; the gate **multiplies each bill count by its face value** and sums
everything (bills + coins + checks) into a **grand cash total**. That total becomes the counted gross cash
that feeds the deposit — she never has to add it up in her head.

**Why this priority**: Mary's real workflow is a denomination count; making her pre-total by hand is the
error-prone step this feature exists to remove. The helper is the core of the change.

**Independent Test**: On the gate, enter counts for a few denominations plus coins and checks → the displayed
grand cash total equals `Σ(count × face value) + coins + checks`, and that total is what the close-out uses as
gross cash.

**Acceptance Scenarios**:

1. **Given** the denomination helper, **When** Mary enters bill counts (e.g. 3×$20, 5×$10), a coins amount,
   and a checks amount, **Then** the grand cash total equals the sum of `count × face value` for the bills
   plus the coins amount plus the checks amount.
2. **Given** a computed grand cash total, **When** Mary completes the close-out, **Then** that total is used
   as the gross cash for the deposit (same downstream effect as typing it directly).
3. **Given** the helper, **When** Mary changes a single count, **Then** the grand cash total updates
   accordingly without her re-entering anything else.

---

### User Story 2 - Enter the total directly, without the helper (Priority: P1)

Pat, also a Financial Secretary, doesn't want the per-denomination detail — she counts and enters the **total
cash** directly, as today. The denomination helper is **optional**: a direct gross-cash entry always exists,
and using the helper simply fills that same total.

**Why this priority**: The fast path must never be taken away; some FSes prefer it. It is inseparable from US1
being non-mandatory.

**Independent Test**: Without touching the helper, type a gross-cash total directly and complete the
close-out → the deposit is computed from the typed total exactly as before.

**Acceptance Scenarios**:

1. **Given** the gate close-out, **When** Pat types the total cash directly and ignores the helper, **Then**
   the close-out records that total with no requirement to use the helper.
2. **Given** the helper has produced a total, **When** the FS prefers, **Then** the same single gross-cash
   figure is what gets recorded (helper and direct entry drive one value, not two).

---

### User Story 3 - Note what anonymous items sold (Priority: P2)

When merchandise, gift cards, or other miscellaneous items sell, Mary wants to record **what** sold without an
inventory system. She enters a **single free-text comment** for the anonymous-sales section (e.g. "3 CDs, 2
shirts"). The comment is saved and reappears when the door record is reopened.

**Why this priority**: A useful record for the treasurer, but secondary to getting the cash total right, and
it carries the one small schema change.

**Independent Test**: Enter an anonymous-sales comment, save, reopen the door record → the comment reappears
verbatim alongside the reloaded anonymous-sale amounts.

**Acceptance Scenarios**:

1. **Given** anonymous sales (merchandise / gift card / misc), **When** Mary types a free-text comment and
   saves, **Then** the comment is persisted with the record.
2. **Given** a saved comment, **When** the door record is reopened, **Then** the comment reloads verbatim
   (like the anonymous-sale amounts do today).

---

### Edge Cases

- **Empty helper**: no counts entered → the helper contributes nothing; the FS can still type a gross-cash
  total directly (the two never conflict — one value results).
- **Helper then direct edit**: if the FS uses the helper and then hand-edits the gross-cash total, the last
  value entered is the one recorded (the helper is an aid, not a lock).
- **Reopen after using the helper**: only the **gross-cash total** reloads, not the per-denomination counts
  (the breakdown is transient and not stored) — accepted.
- **No anonymous sales**: the comment may be left blank; a blank comment stores nothing and shows nothing on
  reopen.
- **Checks with no cash**: a checks-only close-out still totals correctly (checks fold into gross cash; there
  is no separate checks figure).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The gate MUST offer an **optional** denomination helper where the FS enters a **count of bills
  per denomination**, a **coins** amount, and a **checks** amount; it MUST compute a **grand cash total** =
  `Σ(bill count × face value) + coins + checks`.
- **FR-002**: The grand cash total from the helper MUST populate the **single gross-cash** figure used for the
  deposit. The helper MUST NOT be required — a **direct gross-cash entry** MUST always be available, and the
  helper and direct entry MUST drive the **same one value**, never two competing figures.
- **FR-003**: The **checks** amount MUST fold into the grand cash total (part of gross cash). The system MUST
  NOT introduce a separate checks tender or a stored checks figure.
- **FR-004**: The denomination breakdown MUST be **transient** — not persisted. On reopening a door record,
  the **gross-cash total** reloads (as today) but the per-denomination counts do not.
- **FR-005**: The **anonymous-sales** section MUST accept a **single free-text comment** describing the mix of
  items sold across the anonymous categories (merchandise, gift card, misc sales). The system MUST NOT require
  or provide structured per-item line items.
- **FR-006**: The anonymous-sales comment MUST be **persisted** and MUST **reload** when the door record is
  reopened, alongside the reloaded anonymous-sale amounts.
- **FR-007**: The deposit formula, card totals, seed float, cash-paid-out, named-customer sales, comp/gift
  counts, and the FS-only write boundary MUST be **unchanged** — this feature adds only the cash-entry aid and
  the anonymous-sales comment.

### Key Entities

- **Door record**: the event's gate close-out — gross cash, card gross, seed float, cash paid out, deposit.
  Unchanged; the gross-cash figure may now be produced by the helper. (Existing.)
- **Gate sale**: an amount in a category (anonymous or named) by tender. Gains a nullable **note** (the
  anonymous-sales comment). (Existing + one field.)
- **Denomination count**: a **transient, non-persisted** working set — per-denomination bill counts, coins,
  and checks — that produces the grand cash total. (New; client-side only.)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Using the helper, the FS produces the counted cash total **without adding it up by hand**, and
  the computed total exactly equals `Σ(bill count × face value) + coins + checks`.
- **SC-002**: The FS who prefers it records the close-out by typing the total cash **directly**, with **zero**
  required interaction with the helper.
- **SC-003**: A saved anonymous-sales comment reappears **verbatim** when the door record is reopened, 100% of
  the time.
- **SC-004**: For equivalent totals, the deposit and treasurer figures are **identical** to before the change
  (no regression) — including that checks are counted within gross cash.

## Assumptions

- **Denomination set**: the helper covers the common US bill denominations (e.g. $100 / $50 / $20 / $10 / $5 /
  $1) with a count for each, plus a single **coins** amount and a single **checks** amount. The exact set and
  labels are a UX detail; per-coin-denomination counting is out of scope (a coins subtotal suffices).
- **One value, not two**: the helper is a calculator layered over the existing single gross-cash field; its
  output *is* the gross-cash figure. There is no second stored "counted cash" concept.
- **Transient breakdown (no persistence)**: consistent with the existing reload behavior, only the gross-cash
  total round-trips; the per-denomination counts are not stored (accepted trade-off).
- **Checks fold into gross cash**: checks deposit physically with the cash and are rare; no separate checks
  column or tender is added.
- **One comment for the anonymous-sales section** (not one per line): it describes the overall mix; it is
  stored on the anonymous gate-sale record(s) and reloaded into the single section comment on reopen. Named
  categories (donation / future event / membership) are unaffected.
- **Scope / authority**: the FS-only gate-money write boundary is unchanged; the Door Attendant still cannot
  write gate money. No change to the deposit math, card handling, or comp/gift counts.
- **One small migration** adds the nullable `note` to the gate-sale record — the first Phase 5 migration; no
  other columns (no denomination storage, no checks column).
