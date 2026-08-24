# Feature Specification: Public performer rosters (bands & callers)

**Feature Branch**: `053-performer-rosters`
**Created**: 2026-08-24
**Status**: Draft
**Input**: P7-R9 — Public roster page(s) for bands and callers, filterable by style, each showing name, bio, photo, the style(s) they play, and their own promotional links (website/social). Linked from event-detail lineups. PII rule applies: performer contact info stays Organizer-gated; the public roster shows name/bio/photo only, with booking inquiries routed to the role aliases (ContraBooking@ / EnglishBooking@), not personal emails.

## Clarifications

### Session 2026-08-24

- Q: How should a band's/performer's dance style(s) be determined for the roster and its style filter? → A: Explicit staff-set style tags on bands and performers (contra/english/community) — not derived from booking history.
- Q: How is an individual identified as a "caller" for the callers section? → A: Explicit staff flag on the performer (a caller designation) — not derived from booking roles; a performer may be both a band member and a caller.
- Q: R9 mentions "members + instruments," but no instrument field exists today. Include instruments now? → A: Yes — add an optional per-member instrument; roster shows "Name — instrument" when set, name-only otherwise.
- Q: When is a band/caller shown publicly on the roster? → A: Opt-in per entry — a public-visibility flag on each band/caller, default not-public (mirrors R8 public venues); staff publish deliberately.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A visitor discovers who plays and calls at the club (Priority: P1)

A prospective or returning dancer opens the public site and wants to know which bands and callers the club features. They land on a roster page, see each band and caller with a name, a short bio, a photo when available, and the dance style(s) they perform, and can follow a performer's own website or social links to hear music or learn more.

**Why this priority**: This is the core public value of the feature (Use case #5 — "Who's playing / calling?"). Without the roster page rendering real bands and callers, nothing else in the feature matters.

**Independent Test**: Seed a band and a caller with bio, photo, style tag(s), and one or more promotional links; load the public roster page and confirm each appears with name, bio, photo, style(s), and working outbound links — and that no contact email or phone number appears anywhere on the page.

**Acceptance Scenarios**:

1. **Given** a band tagged with a style and a promotional website link, **When** a visitor opens the roster page, **Then** the band's name, bio, photo, style, and a clickable outbound link to its website are shown.
2. **Given** a caller with a bio and photo, **When** a visitor opens the roster page, **Then** the caller appears in the callers section with name, bio, photo, and style(s), and no personal email or phone is shown.
3. **Given** a performer whose linked contact record holds an email and phone, **When** a visitor views the roster, **Then** neither the email nor the phone is exposed; booking inquiries are directed to the club's booking alias(es) instead.
4. **Given** a performer or band with no photo, **When** the roster renders, **Then** the entry still renders cleanly (no broken image) with the remaining details.

### User Story 2 - A visitor filters the roster by dance style (Priority: P2)

A visitor interested specifically in contra (or English) narrows the roster to only the bands and callers who perform that style, so they can quickly find relevant talent.

**Why this priority**: Filtering makes a growing roster usable and directly supports the "filterable by style" requirement, but the roster is valuable even before the filter exists.

**Independent Test**: Seed bands/callers across at least two styles; apply a style filter and confirm only performers tagged with that style appear, and clearing the filter restores the full roster.

**Acceptance Scenarios**:

1. **Given** bands and callers tagged with different styles, **When** the visitor selects a single style, **Then** only performers who perform that style are listed.
2. **Given** an active style filter, **When** the visitor clears it, **Then** the full roster is shown again.
3. **Given** a performer tagged with more than one style, **When** any of those styles is selected, **Then** that performer appears under each of its styles.

### User Story 3 - A visitor jumps from an event's lineup to a performer (Priority: P2)

While viewing an event detail page, a visitor sees the confirmed band/caller in the lineup and follows a link to that performer's roster entry to learn more.

**Why this priority**: It connects the existing event-detail lineup (feature 049 / R5) to the new roster, closing the loop from "there's a dance" to "who's playing." Valuable, but depends on US1 existing first.

**Independent Test**: With a confirmed booking on an event and its band/caller present in the roster, load the event detail page and confirm the lineup name links to the corresponding roster entry.

**Acceptance Scenarios**:

1. **Given** an event with a confirmed band that has a public roster entry, **When** the visitor views the event detail lineup, **Then** the band name links to its roster entry.
2. **Given** a lineup performer with no public roster entry (e.g., not yet tagged/published), **When** the event page renders, **Then** the name still displays as before with no broken link.

### User Story 4 - Staff maintain a performer's public profile (Priority: P2)

A staff member with performer-editing permission adds a bio, sets style tag(s), records promotional links, marks whether an individual is a caller, and controls whether the entry is publicly visible — without touching the person's private contact details.

**Why this priority**: The public roster is only as good as the data behind it; staff need a way to curate the public-facing fields. It is separable from the public read (US1) and can ship immediately after the data model exists.

**Independent Test**: As a `performer.write` actor, set a band's style and add a promotional link; confirm it appears on the public roster. Add a link with a disallowed URL scheme and confirm it is rejected at save time.

**Acceptance Scenarios**:

1. **Given** a `performer.write` actor, **When** they add a style tag and a valid `https` promotional link to a band, **Then** the change is saved and appears on the public roster.
2. **Given** a promotional link whose URL is not `http`/`https` (e.g., a `javascript:` or `data:` URL), **When** the actor tries to save it, **Then** the save is rejected with a clear validation error.
3. **Given** a base-role volunteer without `performer.write`, **When** they attempt to edit a performer's public profile, **Then** the action is refused.

### Edge Cases

- A performer or band with **no style tag**: excluded from every style-filtered view; the assumption below fixes whether it appears in the unfiltered roster.
- A performer who is **both** a band member and a caller: appears within their band(s) and also individually in the callers section.
- A band that is **archived** (feature 008 `archived_at`): not shown on the public roster.
- A promotional link with a malformed or non-`http(s)` URL: rejected at the write boundary; never rendered.
- A band or caller marked **not public / unpublished**: absent from the roster and from event-lineup links, even if booked.
- Duplicate or many promotional links of the same type (e.g., two Instagram links): all render; ordering is stable.
- A performer's linked contact is deleted or unlinked: the roster still renders name/bio/photo (public fields do not depend on the contact record).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a public roster page that lists the club's bands and callers, each with display name, bio (when present), photo (when present), and the dance style(s) they perform.
- **FR-002**: The system MUST display each band's and caller's own promotional links (e.g., website, Facebook, Instagram, YouTube, Bandcamp, Spotify) as outbound links, labelled or iconified by link type.
- **FR-003**: The system MUST allow visitors to filter the roster by dance style, showing only bands and callers tagged with the selected style.
- **FR-004**: The system MUST NOT expose any performer's personal contact information (email, phone, or the linked contact record's PII) on any public roster surface; booking inquiries MUST be directed to the club's role-based booking alias(es) instead of personal emails.
- **FR-005**: The system MUST link a confirmed performer named in an event-detail lineup (feature 049 / R5) to that performer's public roster entry when one exists, and MUST degrade gracefully (plain text, no broken link) when it does not.
- **FR-006**: The system MUST render promotional links safely — only URLs with an `http` or `https` scheme are accepted and rendered; any other scheme is rejected at the write boundary and never emitted as a link.
- **FR-007**: The system MUST allow a staff member with performer-editing permission to maintain a band's or caller's public profile fields (bio, photo reference, style tag(s), promotional links, caller designation, and public visibility) without granting access to the person's private contact details.
- **FR-008**: The system MUST restrict edits to performer/band public-profile fields to actors holding the appropriate performer-editing permission; unauthorized actors MUST be refused.
- **FR-009**: The system MUST exclude archived bands and non-public / unpublished bands and callers from the public roster and from event-lineup links.
- **FR-010**: The public roster MUST be reachable from the site's public navigation.
- **FR-011**: The public roster MUST be mobile-first and legible on a phone (single H1, no horizontal scroll at a typical phone width, accessible contrast).
- **FR-012**: Promotional links MUST open safely as outbound links (treated as untrusted destinations) without leaking referrer/window access in a way that could be abused.

### Key Entities *(include if feature involves data)*

- **Band (public projection)**: A named ensemble with a bio, an optional photo, the dance style(s) it performs, its members (name, and instrument when known), and a set of promotional links. Public visibility is controlled; archived bands are never public. Contact/PII of members is never part of this projection.
- **Caller (public projection)**: An individual performer designated as a caller, with a bio, optional photo, the dance style(s) they call, and a set of promotional links. No personal contact info is exposed.
- **Promotional link**: A `{ type, url }` pair owned by a band or a performer, where `type` identifies the platform (website, facebook, instagram, youtube, bandcamp, spotify, other) so the UI can label/iconify it, and `url` is a validated `http(s)` address.
- **Dance style tag**: A label (e.g., contra, english, community) associated with a band or performer, used for grouping and filtering. Relationship: a band/performer may carry more than one style.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A visitor can find the roster from the public navigation and identify a band or caller for a given style in under 30 seconds on a phone.
- **SC-002**: 100% of public roster surfaces expose zero personal contact details (no email or phone) for any performer, verified across bands, callers, and event-lineup links.
- **SC-003**: 100% of rendered promotional links use an `http`/`https` scheme; no non-`http(s)` link is ever stored or displayed.
- **SC-004**: Applying a style filter returns only performers tagged with that style, with zero false inclusions across the seeded test set.
- **SC-005**: The roster page presents a single H1 and produces no horizontal scroll at a 375px viewport width.
- **SC-006**: Every confirmed lineup performer on an event page that has a public roster entry links to it; those without an entry render as plain text with no broken links.

## Assumptions

- **Style tagging is explicit, not derived** *(clarified 2026-08-24)*: bands and performers carry an explicit style tag (a small set from the club's dance styles: contra, english, community), set by staff — rather than inferring style from booking history. Rationale: simpler, editable, and avoids building a derivation engine (YAGNI).
- **Callers are explicitly designated** *(clarified 2026-08-24)*: an individual performer appears in the callers section only when staff mark them as a caller; performers who are only band musicians appear via their band, not individually. A performer may be both a band member and a caller.
- **Instruments are shown when known but are not required** *(clarified 2026-08-24)*: an optional per-member instrument is captured; the roster shows a member's instrument when recorded ("Name — instrument") and simply omits it otherwise. A small additive field, not a blocker.
- **Photos reuse the existing `photo_url` reference on performers/bands**: no new image storage/upload pipeline is introduced in this feature; the roster renders whatever photo reference is already recorded (shared storage decision with R5 / §4 D-4). Empty → render cleanly without an image.
- **Public visibility is opt-in per band/caller** *(clarified 2026-08-24)*: like public venues (R8), an entry is shown publicly only when staff have marked it public; the default is not-public so real booking data is never exposed by accident.
- **Promotional links are self-published, public-safe data** — the exception to PII gating — validated at the write boundary (scheme allowlist) and rendered as plain anchors; this feature introduces no HTML-from-user rendering.
- **Performer-editing permission is the existing `performer.write` capability** (booker-scoped; organizer/super_user global); no new capability is introduced unless clarification determines bands need separate gating.
- **Booking inquiries route to existing role aliases** (ContraBooking@ / EnglishBooking@) already used by the club; this feature references them but does not create new mailboxes.
- The feature is additive to existing `performers`, `bands`, and `band_members` data (feature 008); it introduces no changes to booking or payment behavior.

## Dependencies

- Feature 008 (performers, bands, band_members) — the source data.
- Feature 049 / P7-R5 (event-detail lineup) — the surface that links into the roster.
- Feature 016 (capabilities) — `performer.write` gating and PII (`contact.pii.read`) boundary.
- P7-R1 color tokens / P7-R2 public nav — the roster page's visual system and navigation entry.

## Out of Scope

- Instrument capture UI beyond a simple optional field (full instrumentation management is not in scope).
- Any exposure of performer contact details or a public contact form to individual performers (booking goes through role aliases).
- Photo upload/storage pipeline (shared, separate decision with R5/R11).
- Single-source pricing and standing schedule (P7-R10) and photo galleries (P7-R11).
- Cross-owner promotional-link administration/reporting (the polymorphic `promo_links` table alternative) — not warranted now.
- Listing individual **musicians** who are not callers (a public performer not in a public band appears nowhere) — presentation deferred to backlog **B49** (2026-08-24 demo).
- Slimming the expanded performers admin editor into shared components — deferred to backlog **B50** (2026-08-24 demo).
