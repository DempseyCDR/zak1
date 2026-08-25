# Feature Specification: Org cluster — membership, donate, contact & board (P7-R12)

**Feature Branch**: `055-org-cluster`
**Created**: 2026-08-25
**Status**: Draft
**Input**: P7-R12 — the "org" cluster of public pages: a content-complete **membership** page (tiers: Supporter $50+ / Family $30 / Individual $20 / Student $10; membership year **Sep 1 – Aug 31**), a **donate** affordance, a role-based **contact directory**, and a **board/officers** page. Plus two folded-in site-polish changes: browser-tab **favicons** and the header **wordmark linking to the home page** (`/`) instead of `/whats-on`.

## Clarifications

### Session 2026-08-25

- Q: Where should Contact, Board, and Donate surface in the site? → A: Contact and Board are grouped under an **"About" section in the footer** — **not** in the top navigation; Donate also lives in the footer. Membership (Join) stays in the top nav.
- Q: How is the board/officers page sourced? → A: Board members are existing **contacts**; each officer is listed by their **first and last name** (from the contact record) plus their **board role name**. Officers are contacts designated with a public board role — this designation is **distinct from access-control role grants** (feature 016). The page shows only names + role names; no contact email/phone/PII.
- Q: How is the officer designation stored? → A: A **new table** mapping a contact → a board role (role name + display order), staff-maintained (FR-013).
- Q: How is the contact directory sourced? → A: The role→alias list is a **committed content registry** (server-rendered); **additionally**, a curated free-text block authored in the **051 content CMS** is rendered **below** the alias list (omitted when nothing is published).
- Q: What is the relationship between board roles and the contact aliases? → A: **They are the same set of club roles.** Each board role has a **role-based email alias** (e.g., vicepresident@cdrochester.org, treasurer@cdrochester.org, contrabooking@cdrochester.org). One **committed role registry** (role name + alias + display order, and whether the role is a board seat) is the shared source: the contact directory lists role→alias; the board page shows each board-seat role with its designated contact's name **and** the role alias. The officer-designation table maps a **role → contact**; the alias comes from the registry (joined by role).
- Q: How is a dues payment's membership expiry / the membership year calculated? → A: Expiry = the club year-end boundary (`club_settings.membership_year_end`, `08-31`) that is **at least 2 months after** the payment date — i.e., a **2-month early-renewal grace**: a payment in the final two months (on/after ~Jul 1) grants coverage through the **next** Aug 31. Applies to **everyone** paying in that window (new joins and renewals alike), as **one shared calculation** used by online enrollment, door enrollment, and the public `/join` page. This **corrects the existing feature-019 `nextMembershipYearEnd`**, which lacked the grace (its tests are updated).

### Session 2026-08-25 (post-implementation revisions)

- Q: The board page duplicated the contact directory (board roles minus names). Keep two pages? → A: **Merged into one.** There is a single public **`/contact-us`** page (not `/contact`, and no separate `/board`): it lists **every** club role in order, each with its email alias and — for a board-seat role with a designated officer — the officer's **first + last name**; then the curated 051 CMS block below. The separate `/board` page/route is **removed** (`BoardList`/`listBoardOfficers` superseded by `ContactList`/`listContactRoles`). The officer-designation table + `/officers` admin still supply the names. The footer surfaces a single **"Contact Us"** link (+ Donate); no "Board" link, no top-nav entry.
- Q: The public contact route? → A: **`/contact-us`** (hyphenated), heading "Contact Us"; reserved so a CMS page can't shadow it via the 051 `/[slug]` catch-all. (`board` no longer reserved — the route is gone.)
- Q: Club-roles roster correction → A: there is **no "Membership" role/coordinator** in the club; that role is removed from the registry.
- Q: How does an editor fill the CMS block? → A: create/publish a 051 content page with the exact slug **`contact-info`** — the `/content` admin now shows a hint saying so (it renders below the directory only when published).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A prospective member understands membership and joins (Priority: P1)

A visitor considering membership opens the membership page and sees the tiers and their amounts (Supporter $50+, Family $30, Individual $20, Student $10), when the membership year runs (Sep 1 – Aug 31), and what membership supports — then proceeds to pay dues through the club's existing PayPal flow.

**Why this priority**: Use case #4. The `/join` page already captures name/email and hands off to PayPal (feature 019), but it does not tell the visitor what the tiers, amounts, year, or benefits are — so a prospective member can't make an informed decision. Content-completing it is the core deliverable.

**Independent Test**: Open the membership page; confirm all four tiers with amounts, the Sep 1 – Aug 31 year, and a benefits summary are shown, and the existing capture → PayPal payment path still works.

**Acceptance Scenarios**:

1. **Given** the membership page, **When** a visitor reads it, **Then** the four tiers with their amounts and the membership year (Sep 1 – Aug 31) are clearly presented.
2. **Given** a visitor who wants to join, **When** they submit their name/email and continue, **Then** they reach the club's PayPal payment exactly as today (no regression to the 019 capture flow).
3. **Given** the membership year boundary displayed to the public, **When** compared to the configured club setting, **Then** they agree (the Aug 31 year-end is confirmed, not a placeholder).

### User Story 2 - A supporter donates to the club (Priority: P1)

A visitor who wants to support the club beyond (or instead of) membership follows a clear "donate" affordance and completes a donation through the club's PayPal donation flow.

**Why this priority**: Use case #7. The footer already has a "Support the club" link, but it points at the join/membership flow, not a donation — a distinct, common need (one-off gifts, non-members giving).

**Independent Test**: From the footer (and the membership page), follow the donate affordance and confirm it leads to the club's PayPal donation destination, distinct from the dues button.

**Acceptance Scenarios**:

1. **Given** any public page, **When** a visitor looks for a way to give, **Then** a clearly labelled "Donate" affordance is reachable (footer and the membership page).
2. **Given** the donate affordance, **When** followed, **Then** it leads to the club's PayPal donation destination, opened safely as an outbound action.

### User Story 3 - A visitor finds who to contact (Priority: P2)

A visitor with a question (booking a band, a general inquiry, membership) finds a contact directory listing the club's role-based email aliases (e.g., president@, ContraBooking@, EnglishBooking@) and reaches the right role.

**Why this priority**: Use cases #4/#7. The current site hides these behind JS email-obfuscation; the aliases are role addresses (not personal PII), so they can be shown plainly. Valuable, but secondary to joining/donating.

**Independent Test**: Open the contact page; confirm the role → alias entries are listed and the email addresses are present in the served markup (server-rendered, not JS-injected) and mailto-actionable.

**Acceptance Scenarios**:

1. **Given** the contact directory, **When** a visitor opens it, **Then** each club role is listed with its email alias, reachable as a mailto link.
2. **Given** the served page, **When** its markup is inspected without running scripts, **Then** the aliases are present (server-rendered, no JS-only obfuscation).
3. **Given** the directory, **When** a visitor reads it, **Then** no personal (individual) email address or other PII appears — only role aliases.

### User Story 4 - A visitor learns who runs the club (Priority: P2)

> **Revised 2026-08-25 — merged into US3.** This is delivered on the single `/contact-us` page: officers appear
> there by name + role + alias alongside the other role aliases. There is no separate `/board` page.

A visitor sees the current officers by name and role (on `/contact-us`), so they know who leads the organization.

**Why this priority**: Use case #4 (about/org). Nice for transparency and credibility; lower urgency than joining/donating.

**Independent Test**: Open the board page; confirm officers are listed with name and role, and that the list is the curated public officer list (not derived from system access grants).

**Acceptance Scenarios**:

1. **Given** the board page, **When** a visitor opens it, **Then** current officers are listed with their first + last name (from their contact record), their board role name, and their role email alias (mailto) — and no personal/contact email, phone, or other PII.
2. **Given** the board designation, **When** compared to the app's role-grant/access-control data, **Then** the public officer list is independent of it (access grants are not the officer source; officer names come from the designated contacts).

### User Story 5 - Site identity polish (favicon + wordmark home link) (Priority: P3)

A visitor sees the club's icon in their browser tab, and clicking the site wordmark returns them to the home page.

**Why this priority**: Small, folded-in polish accompanying the org cluster — improves recognizability and fixes a mis-targeted wordmark link. Low risk, independent of the content work.

**Independent Test**: Load any page; confirm a favicon shows in the browser tab; click the wordmark and confirm it navigates to the home page (`/`).

**Acceptance Scenarios**:

1. **Given** any page, **When** it loads in a browser, **Then** the club favicon appears in the tab.
2. **Given** the site header, **When** a visitor clicks the wordmark, **Then** they land on the home page (`/`), not `/whats-on`.

### Edge Cases

- The membership year label (Sep 1 – Aug 31) shown to the public must not drift from the configured club setting — one source, no second hand-typed date.
- A contact alias that is not yet provisioned club-side: it still lists the role; a mailto to an unrouted alias is a club-side email-config task, not a site error.
- The board list is out of date (an officer changed): it is curated content, editable without a deploy where possible; staleness is a content problem, not a code defect.
- Membership tiers change amounts: the displayed amounts come from one place so all copies update together.
- A visitor with scripts disabled: contact aliases and all org content still render (server-rendered).
- Donate vs dues must not be confusable — the two PayPal destinations are labelled distinctly.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The membership page MUST present the membership tiers and their amounts (Supporter $50+, Family $30, Individual $20, Student $10) and the membership year (Sep 1 – Aug 31), alongside a short summary of what membership supports.
- **FR-002**: The membership page MUST retain the existing capture-then-PayPal dues flow (feature 019) without regression.
- **FR-003**: The publicly displayed membership-year boundary MUST agree with the configured club setting (the Aug 31 year-end), sourced once — and the prior "placeholder" status of that setting MUST be resolved (confirmed).
- **FR-015**: A dues payment's membership expiry MUST be the club year-end boundary that is **at least ~2 months after** the payment date (a **2-month early-renewal grace**): a payment in the final two months of the membership year grants coverage through the **next** year-end. This MUST be **one shared calculation** used by online enrollment, door enrollment, and the public membership page (correcting the feature-019 calc, which lacked the grace, and updating its tests). It applies to every dues payment in the window (new joins and renewals).
- **FR-016**: The `/join` page MUST display the coverage a member gets by joining today — the expiry date derived from FR-015's shared calculation — so the public statement of "what your dues buy" cannot diverge from what enrollment actually grants.
- **FR-004**: The system MUST provide a clearly labelled **donate** affordance, reachable from the footer and the membership page, leading to the club's PayPal donation destination (distinct from the dues button), opened as a safe outbound action.
- **FR-005**: The system MUST provide a single public **contact directory** at **`/contact-us`** listing **every** club role in order, each with its role-based email alias (mailto) and — for a board-seat role with a designated officer — the officer's **first + last name**. *(Revised 2026-08-25: the board page is merged in here; there is no separate `/board`.)*
- **FR-006**: The contact aliases MUST be **server-rendered** (present in the served markup without running scripts) and MUST expose only role aliases — never a personal/individual email or other PII.
- **FR-014**: The contact page MUST render, **below** the role→alias list, a curated free-text block authored in the content CMS (feature 051); when no such content is published, the block is simply omitted (the alias list still renders).
- **FR-007**: The public directory (`/contact-us`, FR-005) MUST show current **officers** by their **first and last name (from their contact record)**, their **board role name**, and their **role alias** (mailto). Officers are **contacts designated with a public board role**; this designation is separate from the application's access-control role grants (feature 016). It MUST expose only the officer's name, role, and role alias — no personal/contact email, phone, or other PII. *(Revised 2026-08-25: rendered on the merged `/contact-us` page, not a standalone `/board`.)*
- **FR-013**: Staff MUST be able to designate which **contact** holds each board role, so the public officer list stays current as officers rotate — without exposing any contact PII on the public page. (The board **display order** is a property of the role, fixed by the committed role registry — not set per assignment.)
- **FR-008**: The org pages MUST be reachable as follows *(revised 2026-08-25)*: a single **"Contact Us"** link (→ `/contact-us`) and a **Donate** affordance live in the **footer**; **Membership** (Join) remains in the top navigation. Contact Us / Donate are NOT added to the top nav. (The earlier "About" group with a separate Board link is gone — the board is merged into Contact Us.)
- **FR-009**: The site MUST present a **favicon** in the browser tab on every page.
- **FR-010**: The site header **wordmark** MUST link to the home page (`/`).
- **FR-011**: All org pages MUST be mobile-first and legible on a phone (a single H1 per page, no horizontal scroll at a typical phone width, accessible contrast).
- **FR-012**: Amounts and dates presented as facts (tier amounts, the membership year) MUST each come from a single source so duplicate copies cannot disagree.

### Key Entities *(include if feature involves data)*

- **Membership tier**: a named dues level with an amount and a short descriptor (Supporter/Family/Individual/Student). Presentation content; changes rarely.
- **Club role (committed registry)**: the shared source for both org pages — `{ roleName, emailAlias, isBoardSeat, order }` (e.g., Vice President → vicepresident@cdrochester.org, board seat; Contra booking → contrabooking@cdrochester.org). Role addresses, public-safe; no personal PII. Drives the contact directory (role→alias) and supplies each board seat's role name + alias.
- **Officer designation (new table)**: maps a **board-seat role → the contact** currently holding it (one row per role), staff-maintained. Joined to the club-role registry by role to render the board page; display **order** comes from the registry, not this table.
- **Board member / officer (public projection)**: for each board-seat role — the designated contact's **first + last name**, the **role name**, and the **role email alias**. No personal/contact email, phone, or other PII. Independent of access-control role grants (016).
- **Contact page CMS block**: a curated 051 content page (referenced by a fixed slug) whose published body renders below the alias list on `/contact`; absent/unpublished → omitted.
- **Membership year**: the club's Sep 1 – Aug 31 window; the year-end is an existing club setting (`membership_year_end = 08-31`) — the single source for the displayed boundary.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A visitor can identify their membership tier, its amount, and the membership year on the membership page within 30 seconds on a phone.
- **SC-002**: The existing join capture → PayPal dues flow succeeds unchanged (0 regressions in the 019 path).
- **SC-003**: A visitor can reach the donate destination from the footer in ≤ 2 taps, and it is visibly distinct from paying dues.
- **SC-004**: 100% of contact aliases are present in the server-rendered markup (scripts disabled) and contain zero personal/individual email addresses.
- **SC-005**: The board page lists officers by name and role and matches the curated content, with zero dependency on access-grant data.
- **SC-006**: Every page shows the club favicon in the browser tab, and the wordmark navigates to `/` from every page.
- **SC-007**: The membership-year boundary shown publicly equals the configured club setting in 100% of checks (no divergent hard-coded date).

## Assumptions

- **One shared committed role registry** *(clarified 2026-08-25)*: club roles (`roleName + emailAlias + isBoardSeat + order`) live in a **committed content registry** rendered server-side (mirroring 050's `landingContent.ts`). The **contact directory** lists role→alias from it; the **board page** shows each board-seat role's name + alias from it, joined to the officer designation for the person. Aliases are stable club email config (rarely change), suited to a committed registry.
- **Officer designation is a new table** *(clarified 2026-08-25)*: a small staff-maintained table maps a **board-seat role → the contact** holding it (one row per role), so the board list stays current as officers rotate (FR-013). Display **order** is the role's — owned by the committed registry (`BOARD_ROLES.order`), not stored per assignment. The public board projection joins to the contact for first/last name and exposes only name + role + alias (PII-gated). Distinct from the 016 access-control grants.
- **Contact page CMS block** *(clarified 2026-08-25)*: the `/contact` page renders a curated free-text block from a **051 content page** below the aliases (FR-014). ⚠️ Plan note: the CMS block is read **by slug and embedded inside the dedicated `/contact` page** — its slug must not collide with 051's public `/[slug]` catch-all route.
- **Membership tiers are page content, not per-event pricing**: dues tiers are distinct from admission pricing (feature 054) and change rarely; they are presented as membership-page content (single-sourced within the feature), not modeled as data or tied to the 054 pricing tables.
- **Payment stays the existing PayPal hosted buttons**: dues use the current hosted button (feature 019); donations use the club's PayPal **donation** hosted button/destination. No per-tier PayPal buttons and no new payment integration in v1 — the page displays the tiers and the member pays via the existing flow.
- **The Aug 31 membership year-end is already correct**: `club_settings.membership_year_end = 08-31` — the Phase-6 placeholder is confirmed by the audit; this feature closes that TODO (removes the "placeholder" caveat) rather than changing the value.
- **Favicons are provided as committed image assets** (already added to the repo) and wired as the site icon; no favicon-generation pipeline.
- **The header brand is committed logo art, shown responsively** *(decided 2026-08-25)*: the compact **logomark** (`public/CDR_Icon.svg`) on narrow/mobile viewports and the full **logotype** (`public/CDR_Logotype_4Color.svg`) in wide formats. Both are SVGO-optimized (verified visually identical). The logo is presented **image-only** — the "Country Dancers of Rochester" text appears solely as the link's alt/accessible-name markup, not as visible text — and the brand link still targets the home page (`/`).
- **The org pages are public** (no auth); they expose only public-safe information (role aliases, officer names/roles, dues amounts).
- **PayPal account alignment** (merchant / donation button ids) is a **pre-rollout configuration** item carried from Phase 6; this feature wires the donate affordance to the club's donation destination but going fully live with the production PayPal account remains a rollout task.

## Dependencies

- Feature 019 US3 (`/join` capture + PayPal hosted button) — the membership flow this restyles/completes.
- `club_settings.membership_year_end` (feature 024) — the single source for the displayed membership year.
- P7-R2 public nav / footer, P7-R1 tokens — where the org pages are surfaced and their visual system.
- Feature 051 (content CMS) — the `/contact` page renders a curated content-page block below the aliases (FR-014); `renderMarkdown` + published-body read reused.
- Feature 012 (contacts, first/last name) + 016 (access grants — explicitly NOT the officer source) — officers are contacts designated via the new officer table.

## Out of Scope

- A blog / news system (that is P7-R13's banner and beyond).
- Any new payment integration, per-tier PayPal buttons, or membership-tier data model.
- Deriving the public officer list from access-control role grants (explicitly not the source).
- Going live with the production PayPal account (a separate pre-rollout task).
- The 50th-anniversary campaign slot (P7-R14) and the printable calendar (P7-R15).
