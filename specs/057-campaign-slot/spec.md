# Feature Specification: Campaign / promotional slot (P7-R14)

**Feature Branch**: `057-campaign-slot`

**Created**: 2026-08-26

**Status**: Draft

**Input**: P7-R14 — A first-class promotional slot (home hero/banner + optional landing page) for the **Golden Celebration Weekend, Nov 27–29 2026** — the rewrite launches mid-campaign. The slot should be **reusable** (next year it's the Jane Austen Ball). Grounding: multi-venue, 4 callers, 5 bands — representable as an event group (010/013) + a content page (R7) + the banner (R13 machinery may suffice).

## Clarifications

### Session 2026-08-26

- Q: Does R14 build a dedicated campaign landing page, or does the call-to-action just link to something that already exists? → A: **Link now, page later.** R14 builds only the home-page promotional slot; its CTA links to an existing content page (R7), an internal route, or an external URL. A purpose-built campaign landing template is deferred to a possible follow-up feature (see FR-013 and Out of Scope).
- Q: How is the campaign's optional image supplied? → A: **External image URL** — the editor pastes an `http(s)` URL to an already-hosted image (validated with the same `http(s)` allowlist as the CTA link). No image-upload/storage is built (D-4 stays deferred); this keeps the slot reusable without a developer (FR-007).
- Q: What granularity should the active window use? → A: **Date only (day granularity)** — start and end are calendar dates evaluated in the club's local time; no start/end time-of-day. A weeks-long campaign does not need timestamp precision.
- Q: When more than one campaign is active at once, what shows? → A: **The one that expires first shows; the rest wait.** When multiple campaigns' date windows include today, exactly one is shown — the one with the **earliest end date** (i.e. it expires soonest); ties broken by earliest start date, then creation order. The others stay hidden until it expires, at which point the next-soonest-expiring active campaign appears automatically. This lets the webmaster **queue successive campaigns**, stage an extension, or slot a short high-priority promo inside a longer run (it takes precedence while active, and the longer one resumes afterward) — without cluttering the home page. It **replaces** the earlier "one current record, a new post supersedes the previous" model: campaigns now form a queue and publishing one does not delete or supersede the others.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A visitor sees the current campaign on the home page (Priority: P1)

A visitor lands on the public home page and sees a prominent **promotional slot** for the club's current headline event — e.g. the 50th-anniversary **Golden Celebration Weekend** — with a short heading, a sentence or two of blurb, an optional image, and a clear **call-to-action** button ("Learn more", "Get tickets") that takes them to the full detail. When no campaign is active, no slot appears and the home page looks normal.

**Why this priority**: This is the whole point of R14 — the rewrite launches mid-campaign against a hard date (Nov 27–29 2026), and the current site already runs a "Golden Banner" promotional slide. A first-time visitor must see the marquee event above the fold on a phone, with one tap to the details.

**Independent Test**: Configure an active campaign; load the home page and confirm the slot shows the heading, blurb, image (if set), and a working CTA link; retire it and confirm the home page renders with no slot.

**Acceptance Scenarios**:

1. **Given** an active campaign, **When** a visitor opens the home page, **Then** the promotional slot shows its heading, blurb, optional image, and a call-to-action linking to more detail — prominently, above the main content.
2. **Given** no active campaign, **When** a visitor opens the home page, **Then** no slot is shown and the layout is unaffected (no reserved space, no shift).
3. **Given** a campaign with no image, **When** it renders, **Then** the slot shows the heading, blurb, and CTA in a graceful text-only form.
4. **Given** the campaign slot, **When** a visitor taps the call-to-action, **Then** they are taken to the campaign's detail destination.

---

### User Story 2 - A Webmaster creates, updates, or retires the campaign (Priority: P1)

A Webmaster-level volunteer configures a campaign — heading, blurb, optional image, a call-to-action label and link, and the dates it should run — and it appears on the public home page without a deploy. They can edit the wording or image, and retire it when the campaign is over. They may also **queue several campaigns at once**, each with its own dates; only the one that expires first shows at a time (see User Story 3), so lining up a successor never clutters the home page. Next year they reuse the same slot for a different campaign (e.g. the Jane Austen Ball) by re-entering content — **no code change**.

**Why this priority**: The slot is worthless if launching or refreshing a campaign needs a developer. The rewrite explicitly launches mid-campaign and the slot must be **reusable** year over year by a non-developer.

**Independent Test**: As an authorized editor, create a campaign → it shows on the home page; edit its heading/image → the change shows on reload; retire it → the slot disappears. As a non-authorized volunteer, confirm the editing controls are refused.

**Acceptance Scenarios**:

1. **Given** an authorized editor, **When** they publish a campaign, **Then** it appears on the public home page without a deploy.
2. **Given** an active campaign, **When** the editor edits its heading, blurb, image, or CTA, **Then** the public slot reflects the change on the next page load.
3. **Given** an active campaign, **When** the editor retires (clears) it, **Then** the public slot disappears.
4. **Given** a campaign has ended, **When** the editor enters an entirely different campaign, **Then** the new campaign shows in the same slot with no code change (the slot is reusable).
5. **Given** one or more campaigns exist, **When** the editor opens the admin, **Then** they can see **which campaign is currently shown** (if any) and manage each campaign — edit or retire — independently, without disturbing the others.
6. **Given** a campaign is currently showing, **When** the editor adds another campaign with a later window, **Then** the currently-shown campaign is unaffected (the new one waits its turn) — publishing does not supersede or delete existing campaigns.
7. **Given** a volunteer without the campaign-editing permission, **When** they attempt to create or edit a campaign, **Then** the action is refused.
8. **Given** any campaign change, **When** it is saved, **Then** it is recorded in the audit trail (who changed which campaign, and when).

---

### User Story 3 - The schedule runs itself — windows and the campaign queue (Priority: P2)

The editor sets each campaign's run dates (a start and an end) and may line up several at once. The slot appears automatically when a window opens and disappears when it closes — no staff action needed at either boundary. When **more than one** campaign is active at the same time, only the one that **expires first** (earliest end date) shows; when it expires the **next-soonest-expiring** one appears on its own. This lets the team stage a campaign ahead of time, queue a successor, and let each retire itself the day after its event.

**Why this priority**: A dated campaign (Golden Weekend runs Nov 27–29, promoted for weeks before) should not depend on someone remembering to switch it on or off, and lining up next year's campaign should not require watching the calendar to flip it over. Lower priority than showing and managing the slot, but it removes the most common operational slips (a stale promo left up after the event; a successor that has to be turned on by hand).

**Independent Test**: Set a campaign whose window has not yet opened → no slot; one whose window is open → slot shows; one whose window has closed → no slot. Then set **two** campaigns whose windows both include today with different end dates → only the one that ends sooner shows; advance past its end date → the later-ending one shows — all on the next page load with no staff action.

**Acceptance Scenarios**:

1. **Given** a campaign whose start date is in the future, **When** a visitor opens the home page, **Then** no slot is shown (it has not started yet).
2. **Given** a campaign whose end date has passed, **When** a visitor opens the home page, **Then** no slot is shown (it auto-retired), with no staff action.
3. **Given** a campaign within its window, **When** the window later closes, **Then** the slot stops showing on the next page load.
4. **Given** two campaigns whose date windows both include today with different end dates, **When** a visitor opens the home page, **Then** only the campaign that **expires first** (earliest end date) is shown and the other stays hidden.
5. **Given** two overlapping campaigns where only the sooner-expiring one is shown, **When** that campaign's end date passes, **Then** the later-ending campaign appears automatically on the next page load, with no staff action.

---

### Edge Cases

- **No campaign / outside window**: no slot, no reserved space, no layout shift — including once a campaign passes its end date (auto-retire needs no staff action).
- **Window boundary**: a campaign is *active* iff the current date is within its start–end window (inclusive) and it has not been retired early; editing/re-publishing refreshes the configured window.
- **Overlapping windows (queue)**: when two or more campaigns are active at once, exactly one is shown — the one that **expires first** (earliest end date; ties broken by earliest start date, then creation order); the rest wait. When the shown one expires, the next-soonest-expiring active campaign shows on the next page load, with no staff action.
- **Nested windows**: a shorter campaign whose window sits inside a longer one **takes precedence while it is active** (it ends sooner), then the longer campaign resumes once the shorter one expires — so a short high-priority promo can be slotted inside a long-running one and neither is starved.
- **Identical end dates**: two active campaigns sharing an end date are ordered by earliest start date, then creation order — still exactly one shown, deterministically.
- **Image missing or slow**: the slot degrades to a legible text-only card; a missing image never breaks the layout or blocks the heading/CTA. The image is an external `http(s)` image URL (no upload); a non-`http(s)` scheme is rejected at the editing boundary and never rendered.
- **Long heading/blurb**: the slot wraps gracefully on a phone; no horizontal scroll.
- **CTA link safety**: the call-to-action target is either an internal site path or an `http(s)` URL, validated at the editing boundary; an unsafe/non-`http(s)` external scheme is rejected and never rendered.
- **Coexistence with the announcement banner (R13)**: the promotional slot and the urgent announcement banner are different affordances (a marquee promo vs an "is the dance on?" notice) and may both be present at once; neither suppresses the other.
- **Relationship to the campaign's events**: the weekend's actual events (multi-venue, callers, bands) live as an event group (010/013); the slot **promotes** the campaign and links to its detail but does not create or manage those events.
- **Scripts disabled**: the slot's heading, blurb, and CTA are present server-rendered; a no-JS visitor still sees the promotion and can follow the link.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST display the **selected active** campaign (see FR-014) as a prominent promotional slot on the public **home page**, showing a heading, a short blurb, an optional image, and a call-to-action (label + link).
- **FR-002**: When **no** campaign is active (no campaign's window includes the current date), the system MUST show no slot and MUST NOT reserve space or shift layout.
- **FR-003**: A campaign MUST support a **heading** (required), a short **blurb** (required), an **optional image** (an `http(s)` **image URL** to an already-hosted image, validated at the editing boundary with the same scheme allowlist as the CTA link — no file upload), and a **call-to-action** (a required label and a required link). The CTA link MUST be an internal site path or an `http(s)` URL (validated at the editing boundary) and open safely. When an image is set, the editor MUST also provide **alt text** for it (accessibility).
- **FR-004**: The system MUST allow an authorized editor (Webmaster-level) to **create**, **edit**, and **retire** the campaign — all taking effect on the public site **without a deploy**.
- **FR-005**: The system MUST restrict campaign editing to holders of the appropriate permission; unauthorized actors MUST be refused.
- **FR-006**: A campaign MUST have a **scheduled active window** — a **start date and an end date** (calendar dates, day granularity; no start/end time-of-day). It is active only when the current date is within the window (inclusive) and it has not been retired early, and it MUST **auto-appear** on the start date and **auto-retire** after the end date with no manual action. The date boundary MUST be evaluated with the **same date convention the rest of the app uses to decide whether an event is upcoming or past** (today's date as `YYYY-MM-DD`), so a campaign and a same-day event flip together — rather than introducing a separate timezone.
- **FR-007**: The slot MUST be **reusable**: a non-developer can retire one campaign and publish an entirely different one (e.g. next year's Jane Austen Ball) purely by entering content — no code change.
- **FR-008**: The image MUST be **optional**; when absent (or unavailable), the slot MUST render a graceful **text-only** form without breaking layout.
- **FR-009**: The slot MUST be **mobile-first and accessible** — legible on a phone (no horizontal scroll, graceful wrapping), sufficient contrast, and the call-to-action reachable by keyboard.
- **FR-010**: Each campaign change MUST be **audited** (who, when).
- **FR-011**: The campaign's heading, blurb, and call-to-action MUST be **server-rendered** (present without running scripts).
- **FR-012**: The promotional slot MUST be **independent of the announcement banner** (feature 018 event status and feature R13 announcements): it neither reads nor writes event status, and it is a separate affordance from the urgent-notice banner; both may be present at once.
- **FR-014**: When more than one campaign is **active** (multiple windows include the current date), the system MUST show **exactly one** — the campaign that **expires first** (earliest end date; ties broken by earliest start date, then earliest creation) — never more than one at a time. When the shown campaign expires, the system MUST show the next-soonest-expiring still-active campaign **automatically**, with no staff action. Publishing a campaign MUST NOT delete or supersede other campaigns (they form a queue).
- **FR-013**: The campaign's call-to-action MUST link to a **detail destination the editor supplies** — an existing content page (R7), an internal route, or an `http(s)` external site. This feature builds **only the promotional slot**, not a dedicated campaign landing page (a purpose-built landing template is deferred to a possible follow-up feature).

### Key Entities *(include if feature involves data)*

- **Campaign**: a promotional item — a **heading** (required), a short **blurb** (required), an **optional image** (`{ url, alt }`, where `url` is an `http(s)` image URL and `alt` is its alt text), a **call-to-action** (`{ label, url }`, where `url` is an internal path or `http(s)`), and a **scheduled window** (`start-date`, `end-date`, calendar dates). It is **active** while the current date is within the window (inclusive; evaluated with the app's `YYYY-MM-DD` date convention) and it has not been retired early. The store may hold **several** campaigns (a queue); the home page shows **exactly one** at a time — the active campaign that **expires first** (earliest end date; ties: earliest start date, then creation) — and auto-advances to the next when the shown one expires. Publishing a campaign **joins the queue** rather than replacing existing ones. Reusable across campaigns by re-entering content.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A visitor can identify the club's headline campaign and reach its detail within ~5 seconds of loading the home page on a phone (slot above the fold, one tap to detail).
- **SC-002**: An authorized editor can publish, edit, or retire the campaign and see it reflected on the public home page with **no deploy** and within one page reload.
- **SC-003**: When no campaign is active, 100% of home-page loads render with no slot and no layout shift.
- **SC-004**: A campaign appears **only within its scheduled date window** — verified at both boundaries by date (the day before the start hidden, the start date shown; the end date shown, the day after the end hidden) — with no staff action at either boundary.
- **SC-005**: An unauthorized volunteer cannot create, edit, or retire the campaign (0 successful attempts), and every successful change is attributable via an audit record.
- **SC-006**: 100% of rendered call-to-action links use an internal path or an `http(s)` scheme; no unsafe/non-`http(s)` link is ever stored or shown.
- **SC-007**: A non-developer can replace the current campaign with an entirely different one with **no code change and no deploy**.
- **SC-008**: The slot is conveyed with a legible text-only fallback when no image is set, and has no horizontal scroll at a 375px width.
- **SC-009**: When several campaigns are active at once, **exactly one** — the one that expires first (earliest end date) — is shown (never two); and when that campaign expires, the next-soonest-expiring active campaign appears on the next page load with **no staff action** (verified across the handoff).

## Assumptions

- **A queue of campaigns; one shown at a time** *(clarified 2026-08-26)*: the store may hold several campaigns, each with its own date window; the home page shows **exactly one** at a time — the active campaign that **expires first** (earliest end date; ties: earliest start date, then creation order) — and hands off to the next automatically when the shown one expires. Still **one slot** (no stacked promos, no rotating carousel). Publishing a new campaign does **not** delete or supersede others — it joins the queue. *(This replaces the earlier "one current record, new post supersedes" model.)* "Expires-first" is the deliberate selection key: a shorter campaign nested inside a longer one takes precedence while active and the longer one resumes afterward, so no active campaign is starved.
- **Scheduled date-window activation** *(clarified 2026-08-26)*: unlike the R13 announcement banner (which is active for a duration measured from posting), a campaign is active over an explicit **start-date–end-date window** at **day granularity** (no start/end time-of-day), because a campaign is promoted for weeks ahead of a hard event date and should self-retire after it. The editor may also retire it early. The day boundary is evaluated with the **app's existing date convention** (today's `YYYY-MM-DD`, the same rule that decides whether an event is upcoming/past), so a campaign and a same-day event flip together — not with a bespoke timezone. *(The clarify answer said "club's local time"; planning refined this to the app-wide date convention for consistency — the practical difference is immaterial for a weeks-long campaign.)*
- **Home-page placement**: the slot appears on the public **home page** only (not site-wide). Site-wide urgent notices are the R13 announcement banner's job; R14 is a richer, home-page marquee promo.
- **Editing reuses the existing content permission**: campaign editing is gated by the existing `content.write` capability (Webmaster / super_user — the public-content curators), consistent with the R7 CMS, R12 officer admin, and R13 announcements; no new capability unless clarification requires one.
- **Optional image, single image, by URL** *(clarified 2026-08-26)*: at most one promotional image per campaign, supplied as an external `http(s)` **image URL** (no file upload — the D-4 storage decision stays deferred) with editor-provided alt text; the slot works with or without it. (Rotating slides / galleries are out of scope.)
- **Distinct from R13 and from the campaign's events**: the promotional slot is a separate affordance from the announcement banner and does not manage the weekend's events (event groups, 010/013) — it links to their detail.
- **The CTA target is a link the editor supplies** *(clarified 2026-08-26)*: an existing content page (R7), an internal route, or an `http(s)` external site. R14 builds no new page type; a dedicated campaign landing template is deferred to a possible follow-up.

## Dependencies

- P7-R3 (home page) — the mount point for the promotional slot.
- P7-R7 (content pages) — the most likely destination for the call-to-action (a curated landing page), pending FR-013.
- P7-R1 tokens / P7-R2 nav — the public visual system and shell the slot sits within.
- Feature 016 (capabilities) — `content.write` gating + `audit_events` for the change audit.
- Features 010 / 013 (event groups) — the campaign's underlying multi-event weekend; the slot links to but does not manage these. **Note**: event groups have **no public surface today** — `event_groups` is used only for admin organization and authorization scoping, no public projection or page exposes a group, and the public event-detail page shows a single event with no group/sibling linkage. So the CTA cannot target a group landing page (none exists); it targets a curated **content page (R7)** the editor writes. Auto-assembling a group's schedule/lineup into a public page is the deferred "page later" follow-up (a genuinely new public surface).

## Out of Scope

- Managing the campaign's **events** themselves (multi-venue schedule, callers, bands) — those are event groups (010/013); R14 only promotes and links to them.
- A **multi-slot / rotating carousel** or more than one simultaneous campaign.
- **Email / social** promotion of the campaign (on-site slot only).
- **Ticketing, registration, or payment** for the campaign (the CTA may link out to such, but R14 builds none of it).
- A general campaign **CMS** beyond the single reusable slot.
- **Image upload / hosting / storage** — *(clarified 2026-08-26)* the image is an external `http(s)` URL the editor supplies; building upload/serving (the deferred D-4 decision) is out of scope.
- A **dedicated campaign landing page / template** (its own hero, event-group schedule, lineup, gallery) — *(clarified 2026-08-26)* deferred to a possible follow-up feature; R14's CTA links to an existing content page (R7) or route instead. This is also the **only** way to publicly present an event group as a cohesive whole, since event groups have no public surface today (see Dependencies) — building that surface is out of scope here.
