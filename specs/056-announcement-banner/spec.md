# Feature Specification: Site-wide announcement banner (P7-R13)

**Feature Branch**: `056-announcement-banner`
**Created**: 2026-08-25
**Status**: Draft
**Input**: P7-R13 — a lightweight **announcement**: short text (+ optional link), shown as a **banner** across the public site while active. Covers cancellations ("is the dance on?"), weather, and big news. Replaces the current site's stale "banner derived from the latest blog post." A full blog is **out of scope** (banner-only v1). Editable by a Webmaster-level volunteer. Distinct from per-event cancellation, which the event itself already carries (feature 018).

## Clarifications

### Session 2026-08-25

- Q: How many announcements does the system hold? → A: **One current announcement.** Posting/activating a new one supersedes the previous; a single record with the current notice.
- Q: How is the banner turned on/off? → A: **Duration-based auto-expiry.** When posted, the banner is active for a set number of **hours (default 24)**, then **auto-expires** (no banner). No manual "off" needed; the editor may still clear/replace it early, and sets the duration when posting.
- Q: Where does the banner appear? → A: **All public pages** (site-wide — home, `/whats-on`, landings, etc.); never on staff `(admin)`/`(door)` screens.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A visitor sees the current announcement (Priority: P1)

A visitor lands on any public page and immediately sees an active announcement — e.g. "Tonight's dance is CANCELLED — icy roads, stay safe" — as a banner, with an optional link for more detail. When there is no active announcement, no banner appears and the page looks normal.

**Why this priority**: This is the whole point (Use case #8 — "is the dance on tonight?"). A dancer checking before heading out must see a cancellation/weather notice at a glance, above the fold, on any page.

**Independent Test**: Post an active announcement; load several public pages (home, `/whats-on`, a landing page) and confirm the banner text (and its link, if set) shows on each; clear it and confirm the banner disappears everywhere.

**Acceptance Scenarios**:

1. **Given** an active announcement, **When** a visitor opens any public page, **Then** the banner shows its text prominently (above the main content) and, if configured, a link to more detail.
2. **Given** no active announcement, **When** a visitor opens any public page, **Then** no banner is shown and layout is unaffected.
3. **Given** an urgent announcement (e.g. a cancellation), **When** it renders, **Then** it is visually distinct from a routine/informational notice so its urgency reads at a glance.
4. **Given** the banner, **When** a screen-reader user loads the page, **Then** the announcement is conveyed via an appropriate live-region/landmark (it is an announcement, not decoration).

### User Story 2 - A Webmaster posts, updates, or clears the announcement (Priority: P1)

A Webmaster-level volunteer writes a short announcement (and an optional link), makes it active, and it appears across the public site within moments — no deploy. They can edit the wording, change urgency, or clear it when the situation passes.

**Why this priority**: An announcement is worthless if it's slow or hard to change — cancellations are same-day, weather is last-minute. The point is that a non-developer can put it up and take it down instantly. Replacing the stale blog-derived banner requires this to be easy.

**Independent Test**: As an authorized editor, create an active announcement → it shows publicly; edit its text → the change shows on reload; deactivate/clear it → the banner is gone publicly. As a non-authorized volunteer, confirm the editing controls are refused.

**Acceptance Scenarios**:

1. **Given** an authorized editor, **When** they post an active announcement, **Then** it appears on the public site without a deploy.
2. **Given** an active announcement, **When** the editor edits its text/link/urgency, **Then** the public banner reflects the change on the next page load.
3. **Given** an active announcement, **When** the editor deactivates or clears it, **Then** the public banner disappears.
4. **Given** a volunteer without the announcement-editing permission, **When** they attempt to post or edit, **Then** the action is refused.
5. **Given** any announcement change, **When** it is saved, **Then** it is recorded in the audit trail (who changed the site-wide notice, and when).

### User Story 3 - A visitor dismisses the banner (Priority: P2)

A visitor who has read the announcement dismisses the banner so it stops taking up space as they browse; it stays dismissed for that announcement, but a **new/changed** announcement shows again.

**Why this priority**: A persistent banner on every page becomes noise once read; letting a visitor close it is a courtesy. Lower priority than showing and managing it, and must never suppress a *new* notice.

**Independent Test**: Dismiss the banner; navigate to another public page and confirm it stays dismissed; then change the announcement (or post a new one) and confirm the banner reappears.

**Acceptance Scenarios**:

1. **Given** a shown banner, **When** the visitor dismisses it, **Then** it stays hidden as they move between public pages.
2. **Given** a dismissed banner, **When** the announcement is changed or replaced, **Then** the banner reappears (a dismissal applies only to the announcement that was dismissed).

### Edge Cases

- **No announcement / expired**: no banner, no reserved space, no layout shift — including once a posted announcement passes its duration (auto-expiry needs no staff action).
- **Duration boundary**: an announcement whose `posted-at + duration` has passed is treated as inactive on the next page load; editing/re-posting refreshes the active window.
- **Long text**: the banner wraps/truncates gracefully on a phone; no horizontal scroll.
- **Optional link only vs text only**: text is always required; the link is optional; a link with an unsafe/non-`http(s)` URL is rejected at the editing boundary and never rendered.
- **Admin/door pages**: the public announcement banner is a *public* affordance; it does not intrude on staff `(admin)`/`(door)` screens.
- **Relationship to per-event cancellation**: a single event being cancelled is carried on the **event** (feature 018, shown on its card/detail). The banner is for **site-wide** notices; cancelling one event does NOT post a site banner, and posting a banner does NOT change any event's status. They are independent.
- **Scripts disabled**: the banner text is present server-rendered (dismissal is a progressive enhancement); a no-JS visitor still sees the notice.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST display an **active** announcement as a banner on public pages, above the main content, showing its short text and an optional link.
- **FR-002**: When no announcement is active, the system MUST show no banner and MUST NOT reserve space or shift layout.
- **FR-003**: The announcement MUST support a short **text** (required) and an **optional link** (label + URL); a link URL MUST be `http(s)`-only (validated at the editing boundary) and open safely as an outbound action.
- **FR-004**: The system MUST allow an authorized editor (Webmaster-level) to **post** the announcement (text, optional link, urgency, and an **active duration in hours** — default 24), **edit** it, and **clear/replace** it early — all taking effect on the public site **without a deploy**.
- **FR-013**: A posted announcement MUST be **active for its set duration** (hours, default 24) from when it is posted, and MUST **auto-expire** afterward — after which no banner is shown, with no manual action required.
- **FR-005**: The system MUST restrict announcement editing to holders of the appropriate permission; unauthorized actors MUST be refused.
- **FR-006**: The banner MUST convey **urgency level** (at least: a normal/informational style vs an urgent/alert style, e.g. for a cancellation) so its importance reads at a glance.
- **FR-007**: The banner MUST be **accessible** — announced to assistive tech via an appropriate live region/role, sufficient contrast, and keyboard-operable dismiss (if dismissible).
- **FR-008**: A visitor MUST be able to **dismiss** the banner; the dismissal persists as they browse and applies only to the specific announcement shown (a changed/new announcement reappears).
- **FR-009**: The banner text MUST be **server-rendered** (present without running scripts); dismissal is a progressive enhancement.
- **FR-010**: Each announcement change MUST be **audited** (who, when).
- **FR-011**: The banner MUST be mobile-first and legible on a phone (no horizontal scroll; graceful wrapping/truncation).
- **FR-012**: The announcement banner MUST be **independent of per-event cancellation** (feature 018): it neither reads nor writes any event's status; it is a separate site-wide notice.

### Key Entities *(include if feature involves data)*

- **Announcement**: the single site-wide notice — a short **text** (required), an optional **link** (`{ label, url }`, `http(s)`), an **urgency/level** (e.g. info | urgent), a **posted-at** time, and a **duration in hours** (default 24). It is **active** while `now < posted-at + duration`, then auto-expires. Only one exists (a new post supersedes). Carries enough identity that a visitor's dismissal can be scoped to "this announcement" and reset when it changes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A visitor can tell whether tonight's dance is on/cancelled from an active announcement within ~5 seconds of loading any public page on a phone (banner above the fold).
- **SC-002**: An authorized editor can post or clear the announcement and see it reflected on the public site with **no deploy** and within one page reload.
- **SC-003**: When no announcement is active, 100% of public pages render with no banner and no layout shift.
- **SC-008**: A posted announcement stops showing on public pages once its duration (default 24h) elapses, with no staff action — verified for the boundary (just-before shows, just-after hidden).
- **SC-004**: 100% of rendered announcement links use an `http(s)` scheme; no non-`http(s)` link is ever stored or shown.
- **SC-005**: An unauthorized volunteer cannot post, edit, or clear the announcement (0 successful attempts), and every successful change is attributable via an audit record.
- **SC-006**: A dismissed banner stays hidden across public navigation, and a changed/replaced announcement reappears in 100% of cases.
- **SC-007**: The announcement is conveyed to assistive technology (live region/role present) and the banner has no horizontal scroll at a 375px width.

## Assumptions

- **One current announcement** *(clarified 2026-08-25)*: the site shows a single current banner; posting a new one supersedes the previous (no stacked banners). One record holds it.
- **Duration-based auto-expiry** *(clarified 2026-08-25)*: the editor sets an active duration in hours (default 24) when posting; the banner is active while `now < posted-at + duration` and auto-expires afterward (no manual "off"). The editor may still clear/replace it early. No fixed start/end date-times.
- **Shown site-wide on public pages** *(clarified 2026-08-25)*: the banner appears on all public pages (home, `/whats-on`, landings, etc.); never on `(admin)`/`(door)` staff screens.
- **Editing reuses the existing content permission**: announcement editing is gated by the existing `content.write` capability (Webmaster / super_user — the public-content curators), consistent with the R7 CMS and R12 officer admin; no new capability unless clarification requires one.
- **Urgency is a small fixed set** (e.g. `info` and `urgent`) used only for visual emphasis and the ARIA politeness/role; not a rich taxonomy.
- **Dismissal is client-local** (per browser), keyed to the announcement's identity so a new/changed announcement re-shows; no per-user server state.
- The blog/news system is **out of scope** (banner only); narrative posts stay on the club's social channels.

## Dependencies

- P7-R2 public nav / P7-R1 tokens — the public shell the banner sits within, and its visual system.
- Feature 016 (capabilities) — `content.write` gating + `audit_events` for the change audit.
- Feature 018 (event status) — the per-event cancellation this feature is deliberately independent of.

## Out of Scope

- A full **blog / news** system, post archive, comments, or RSS (banner-only v1).
- **Per-event** cancellation UI or logic (already carried on the event, feature 018).
- **Calendar-scheduled** start/end at specific future date-times (v1 uses duration-based auto-expiry from posting, not a scheduler).
- **Multiple simultaneous** banners / targeted banners per page or per audience.
- Email/push notification of announcements (on-site banner only).
