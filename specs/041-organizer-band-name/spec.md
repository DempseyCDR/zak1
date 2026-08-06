# Feature Specification: Organizer Report Shows the Band Name (+ member detail on drill-in)

**Feature Branch**: `041-organizer-band-name`

**Created**: 2026-08-06

**Status**: Draft

**Input**: User description: "R11"

## User Scenarios & Testing *(mandatory)*

The organizer report lists each dance in a series with its caller, band, dancers, and money. Today the "band"
column shows the **joined member names** (e.g. "Alice Fiddle, Bob Piano") — noisy, and not how the organizer
thinks of a booked act. When a real **band** (a named group) is booked, the organizer wants the report to show the
**band's name** at a glance, and to see the **individual members** only when they drill into a dance's detail.

### User Story 1 - Band name at a glance on the report (Priority: P1)

The organizer opens a series report and, for each dance where a named band played, sees the **band's name** in the
band column instead of a list of member names. Dances with individually-booked musicians (no named band) still
show the joined member names; open-band dances show "Open Band"; dances with no musicians show nothing.

**Why this priority**: This is the core of P6-R11 — the band name is the useful at-a-glance identifier. It
delivers standalone value even without the drill-in change.

**Independent Test**: Seed a dance where a named band (with two members) is booked, plus a dance with two
individually-booked musicians (no band); confirm the first row's band column shows the band's name and the second
shows the joined member names, and that no money or dancer figure changed.

**Acceptance Scenarios**:

1. **Given** a dance where a named band of two musicians is booked, **When** the organizer views the report,
   **Then** the band column shows the **band's name** (not the two member names).
2. **Given** a dance where two musicians are booked individually with no named band, **When** the organizer views
   the report, **Then** the band column shows the **joined member names** (as today).
3. **Given** a dance where only open-band musicians played, **When** the organizer views the report, **Then** the
   band column shows **"Open Band"**; **Given** a dance with no musicians, the band column is **blank**.
4. **Given** a dance where two different named bands played, **When** the organizer views the report, **Then** the
   band column shows **both band names**.

---

### User Story 2 - Member roster when drilling into a dance (Priority: P2)

The organizer opens a dance's detail and sees the **individual members** of the band listed by name and role, so
the band name in the report is backed by "who actually played" on demand.

**Why this priority**: Detail-on-demand — valuable but secondary to the at-a-glance name. The organizer report
already lets a row expand to a per-dance detail; this ensures the band's members are clearly presented there.

**Independent Test**: Open the detail for a dance where a named band played; confirm each member is listed by name
and role (and the caller / any open-band musicians still appear as before). No money figure changes.

**Acceptance Scenarios**:

1. **Given** a dance where a named band played, **When** the organizer opens that dance's detail, **Then** the
   detail lists each **band member by name and role**.
2. **Given** a dance with individually-booked musicians (no band), **When** the organizer opens the detail,
   **Then** it lists those musicians by name and role (consistent with today).
3. **Given** any dance, **When** the organizer opens the detail, **Then** the caller and any open-band musicians
   continue to appear as they do today.

---

### Edge Cases

- **Ad-hoc musicians (no named band)**: the band column falls back to the joined member names; the detail lists
  those musicians (no band name to show).
- **Multiple named bands on one dance**: the column shows all their names; the detail lists all members.
- **A named band plus an extra individually-booked musician on the same dance**: the column shows the band
  name(s); the extra musician still appears in the detail's member list.
- **Open-band-only dance**: column shows "Open Band"; the detail lists the open-band musicians.
- **No musicians (caller only, or nothing booked)**: the band column is blank; the detail shows the caller (if
  any) and no band members.
- **A substituted / no-show performer**: the report reflects the current bookings exactly as it does today —
  changing that behavior is out of scope.

## Requirements *(mandatory)*

### Functional Requirements

#### Band name on the report (P6-R11)

- **FR-001**: When the musicians booked for a dance belong to a **named band**, the organizer report's per-dance
  band identifier MUST show the **band's name** (not the joined member names).
- **FR-002**: When musicians are booked **individually with no named band** (ad-hoc), the band identifier MUST
  fall back to the **joined musician names**, exactly as today.
- **FR-003**: When only **open-band** musicians played, the band identifier MUST show **"Open Band"**; when **no
  musicians** played, it MUST be **blank** — both unchanged from today.
- **FR-004**: When **more than one distinct named band** played a single dance, the band identifier MUST show
  **all their names**.
- **FR-005**: The band-identifier change MUST be **display-only** — it MUST NOT alter any computed figure on the
  report (dancers, gross, performer total, dance net, averages, quarterly, trend).

#### Member detail on drill-in (P6-R11)

- **FR-006**: The organizer MUST be able to open a **per-dance detail** that lists the **individual members** of
  the band(s) that played, each by **name and role**.
- **FR-007**: The detail MUST also present the ad-hoc, open-band, caller, and no-band cases (list whoever
  performed), consistent with today's per-dance detail.
- **FR-008**: Opening the detail MUST NOT alter any computed figure (display-only).

### Key Entities *(include if feature involves data)*

- **Organizer report (per-dance row)**: gains a band identifier that resolves to the **band name** when a named
  band is booked. Every money/count figure is unchanged.
- **Band**: a named group (has a name) that musicians can be booked as. A dance "has a band" when its booked
  musicians belong to a named band; the band's name is the at-a-glance identifier.
- **Band member (booked musician)**: a musician booked for the dance, with a name and a role (lead musician /
  musician / open-band musician). The drill-in detail lists these.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For every dance where a named band played, the report's band column shows the **band's name**, not
  the member list.
- **SC-002**: For every dance with individually-booked musicians and no named band, the band column shows the
  **joined member names** (unchanged behavior).
- **SC-003**: The organizer can open any dance's detail and see each band member listed **by name and role** in
  100% of dances that had musicians.
- **SC-004**: **No** money or count figure on the report changes versus before this feature (display-only).

## Assumptions

- **"A named band" = booked musicians whose bookings share a band grouping** (a `Band` entity with a name).
  Individually-booked musicians with no such grouping are "ad-hoc".
- **Ad-hoc / open-band / empty fallbacks are unchanged**: joined member names / "Open Band" / blank — the current
  behavior, retained for the non-band cases.
- **The "detail pop-up" reuses the organizer report's existing per-dance detail expansion** (the report row
  already expands to a detail that lists the dance's performers) rather than introducing a separate modal overlay
  — the member roster is surfaced there. This keeps one detail affordance; whether it should instead be a distinct
  modal is a UI choice confirmable at `/speckit-clarify`.
- **Multiple named bands on one dance** → the band identifier joins their names; the detail lists all members.
  (Rare in practice.)
- **Display-only, no schema change**: the report already loads each dance's bookings (which carry the band link)
  and the performer names; the band's name is looked up from the band the musicians are booked under. No stored
  figure changes.
- **Caller and open-band musicians are unchanged**: the caller keeps its own column; the detail continues to show
  the caller and any open-band musicians as it does today.
- **Out of scope**: changing how substitutions / no-shows are recorded or displayed; the public-facing band
  display (`/whats-on`); and any booking-report change — R11 is the **organizer** report only.
