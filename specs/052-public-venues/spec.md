# Feature Specification: Public venues & directions (P7-R8)

**Feature Branch**: `052-public-venues`

**Created**: 2026-08-23

**Status**: Draft

**Input**: User description: "P7-R8 — a public directions page (and the per-event venue blocks) that render
**public** venues only: name, address, map link, directions/transit/parking text. Venue address visibility
becomes an **explicit opt-in field** — the current site's defect is that its venue directory dumped
private-home addresses and 'null' placeholder records onto the public page. Public exposure must be opt-in per
venue, not a default. Public core venues: Rose Room, First Rochester, German House, Rosette Studio."

## Overview

The club dances at a mix of venues — public halls (the Rose Room, First Rochester, German House, Rosette
Studio) **and** private homes and members' spaces. The old website leaked this distinction: its venue directory
published **every** venue's address, including **private-home addresses**, plus empty "null" placeholder
records. This feature fixes that by making a venue's public exposure an **explicit, opt-in choice**: a venue is
**not public by default**, and only a venue a staff member has deliberately marked public — with a real address
— ever shows its address, map, or directions on any public surface. It adds a per-venue **directions/transit/
parking** note, a **public directions page** listing the public venues, and it **gates the venue address in the
event pages** so a private venue's location is never exposed there either. The private/public line is a safety
and privacy requirement, not a display preference.

## Clarifications

### Session 2026-08-23

- Q: On an event's public page, what should show for a non-public venue (e.g. a private home)? → A:
  **Name only** — the page still names the place (its full venue name) but shows **no** address, map link, or
  directions. (The name is public, so it should be a label such as "a private home", not an address.)
- Q: Can a venue be marked public without a real address? → A: **No — reject**: the venues admin won't let a
  venue be marked public unless it has an address (a hard guard that prevents the "null records" defect at the
  source).
- Q: What should the public directions page list? → A: **All public venues** — the club's standing directory
  of every public venue, useful even between events.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A visitor finds a public venue's location and directions (Priority: P1)

Someone deciding to come to a dance opens the directions page (or an event's page) and sees the public venues:
name, address, a tappable map link, and any directions/transit/parking note. They can find where to go and how
to get there.

**Why this priority**: Use case #3 — "where is it and how do I get there?" is a core public question, and the
directions content is what a newcomer needs.

**Independent Test**: With a venue marked public (name, address, directions), load the directions page and
confirm it shows that venue's name, address, tappable map link, and directions note.

**Acceptance Scenarios**:

1. **Given** a public venue with an address and a directions note, **When** the directions page loads, **Then**
   it shows the venue's name, address, a tappable map link, and the directions note.
2. **Given** a public venue on an event, **When** the event's page loads, **Then** its venue block shows the
   name, address, map link, and directions note.
3. **Given** the directions page, **When** it loads on a phone (~375px), **Then** it is readable with no
   horizontal scroll and one H1.

---

### User Story 2 - A private venue's address is never exposed publicly (Priority: P1)

A dance is held at a member's home (a non-public venue). No public surface — not the directions page, not the
event page — ever shows that venue's address, map, or directions. The private location stays private.

**Why this priority**: This is the **defect being fixed** and the privacy obligation; leaking a member's home
address is the failure mode this feature exists to prevent.

**Independent Test**: With a venue **not** marked public used on an event, confirm the directions page does not
list it and the event page does not show its address or map.

**Acceptance Scenarios**:

1. **Given** a venue that is not marked public, **When** the directions page loads, **Then** that venue is
   **not** listed.
2. **Given** an event at a non-public venue, **When** the event page loads, **Then** the venue's **address, map
   link, and directions are not shown**.
3. **Given** a venue with no address or a placeholder record, **When** any public surface loads, **Then** it is
   **never** shown publicly (no "null"/empty venue rows).

---

### User Story 3 - Staff mark a venue public and write its directions (Priority: P1)

A staff member (the venues editor) opens the venues admin and, for a hall the club wants to advertise, marks it
**public** and writes its directions/transit/parking note. For a private home, they leave it **not public**.
The choice is explicit and per-venue.

**Why this priority**: The opt-in control is what makes the whole feature safe; without a deliberate toggle the
default-private guarantee cannot be maintained.

**Independent Test**: As the venues editor, mark a venue public and save a directions note; confirm it then
appears on the public directions page; unmark it and confirm it disappears.

**Acceptance Scenarios**:

1. **Given** the venues admin, **When** the editor marks a venue public and saves a directions note, **Then**
   the venue appears on the public directions page with that note.
2. **Given** a public venue, **When** the editor unmarks it public, **Then** it is removed from all public
   surfaces.
3. **Given** the venues admin, **When** the editor opens a venue, **Then** they can see and set whether it is
   public and edit its directions note.

### Edge Cases

- **Non-public venue on an event**: the event page shows the venue's **name only** (its full venue name) — no
  address, map link, or directions.
- **Public venue with no directions note**: the directions/map still show; the note line is simply omitted.
- **Venue with no address**: never shown publicly, and cannot be the basis of a public listing.
- **A venue's public flag changes**: the change takes effect on the next public page load (no stale exposure).
- **Long directions text**: wraps/reads cleanly at ~375px, no horizontal scroll.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A venue MUST carry an explicit **public** flag that is **off by default** (opt-in), and a
  **directions/transit/parking** note.
- **FR-002**: The **venues admin** MUST let an authorized editor set a venue's **public** flag and edit its
  **directions** note.
- **FR-003**: A **public directions page** MUST list **only public venues** — each with its name, address, a
  tappable **map link**, and its directions note (note omitted when empty) — and MUST NOT list non-public,
  address-less, or placeholder venues.
- **FR-004**: On an **event's public page**, the venue's **address, map link, and directions** MUST be shown
  **only when the venue is public**; a **non-public** venue MUST show its **name only** — the venue's full name
  (which is public, so it must be a label such as "a private home", not an address) — with **no** address, map
  link, or directions.
- **FR-005**: No public surface (directions page, event page, or any other) MUST **ever** expose a non-public
  venue's address, map, or directions.
- **FR-006**: The public directions page MUST be **mobile-first** (~375px, no horizontal scroll), with exactly
  **one H1** and WCAG AA contrast, consistent with the rest of the public site, and **reachable** from the
  site's navigation.
- **FR-007**: Setting a venue public MUST **require** it to have a real **address** — the venues admin MUST
  **reject** marking a venue public when it has no address (a hard guard, so an address-less/placeholder venue
  can never become public).

### Key Entities

- **Venue** (existing): gains an explicit **public** flag (default **not public**) and a **directions** note
  (free text: transit/parking/how-to-get-there). Its existing name, address, short name, and map location are
  unchanged; what changes is **when the address/map/directions are exposed publicly** (only for public venues).
- **Public directions listing** (a projection): the set of public venues with a real address, each with name,
  address, map link, and directions — the data behind the directions page and the event-page venue blocks.

## Success Criteria *(mandatory)*

- **SC-001**: A visitor can, from the directions page, see every **public** venue's name, address, tappable map
  link, and directions note — mobile-first, one H1, no horizontal scroll.
- **SC-002**: A **non-public** venue's address, map, and directions appear on **zero** public surfaces
  (directions page and event pages) — 100% of the time.
- **SC-003**: Address-less or placeholder venues are **never** shown publicly (the "null records" defect cannot
  recur).
- **SC-004**: A staff editor can mark a venue public (with an address) and write its directions, and it then
  appears on the directions page; unmarking removes it from every public surface.
- **SC-005**: The four public core venues (Rose Room, First Rochester, German House, Rosette Studio), once
  marked public, appear on the directions page; private venues do not.

## Assumptions

- **Built on the existing `venues` model + venues admin (018/020)** and the P7-R1 public tokens (045, on
  `main`). This feature branches off `main` (independent of the 048–050 public-frontend stack). It adds two
  additive venue fields (a public flag, default off; a directions note) — no destructive change.
- **Address gating covers the event pages too** — the existing public event-detail read exposes a venue's
  name/address/map today; this feature makes that exposure conditional on the venue being public, so the fix
  is not limited to the new directions page.
- **Non-public venue on an event page (clarified)** — the event page shows the venue's **name only** (its full
  name — which is public, so it should be a label, not an address) and **never** its address, map, or directions.
- **A public venue requires an address (clarified)** — the venues admin **rejects** marking a venue public
  without a real address (a hard guard), which also defends against the "null records" defect at the source.
- **Directions page scope (clarified)** — the page lists **all public venues** (the club's standing directory),
  useful even between events.
- **The map link reuses the existing venue map behavior** (a map link, or a static-map image when a maps key is
  configured); no new mapping capability is introduced.
- **Editing the R5 event-detail venue block to render the directions note** is a small follow-up once both R5
  (event detail) and this feature are on `main` — R5 already reserved the slot; this feature provides the field
  and the address gating.

## Dependencies

- The existing `venues` schema + venues admin (features 007/018/020), the public event-detail read (037), the
  venue map link (007), and the P7-R1 tokens (045) + P7-R2 nav (046). Realizes backlog-adjacent audit finding
  (private-home address leak). Relates to **P7-R5** (event-detail venue block, which will render the directions
  note once both land) and **B45** (a virtual/video venue is never public by construction — excluded here).

## Out of Scope

- **Virtual / video-meeting venues** (**B45**) — a future venue kind; a virtual venue can never be public by
  construction (its join URL is a secret) and is not addressed here.
- **A new mapping/geocoding capability** — the existing map link/static-map behavior is reused.
- **Rewiring the R5 event-detail venue block** to render the directions note — a small follow-up when R5 + R8
  are both on `main` (R5 reserved the slot).
- **Any change to how venues are used internally** (bookings, rent, the venues admin's other fields) — only the
  public exposure + the two new fields are in scope.
