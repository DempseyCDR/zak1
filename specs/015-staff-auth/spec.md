# Feature Specification: Staff Authentication & Session Foundation

**Feature Branch**: `015-staff-auth`

**Created**: 2026-07-14

**Status**: Draft

**Input**: User description: "P3-1" — Phase 3 requirements package P3-1 (Authentication & session
foundation, backlog B32); see `specs/PHASE3_REQUIREMENTS.md` and `docs/use-cases.md`.

## Overview & Scope

Today the application has **no authentication**: anyone who can reach a page can use it, and the roles
described in `docs/use-cases.md` are recorded but unenforced. This feature establishes the **foundation**
on which all role-based behavior will later stand: staff members prove who they are by **signing in with
Google**, obtain a session, and stay signed in; everyone else is kept out of staff areas while the public
website stays open.

**In scope**: staff sign-in via Google, sign-out, session persistence and expiry, automatic linking of a
Google identity to a volunteer contact, protecting non-public areas, an **operator bootstrap path** for
the first officer, and exposing the signed-in identity so a later feature can make authorization
decisions.

**Existing substrate this builds on**: feature 001 already added `contacts.is_volunteer`,
`contacts.volunteer_roles`, and `contact_emails.is_login` (with the rule that only volunteers may hold a
login email) — but they are **dormant**: no UI writes them, the seed does not set them, and in the live
data **0 of 1334 contacts are volunteers** with **0 login emails**. This feature activates that substrate
rather than inventing a parallel one.

**Explicitly out of scope** (deliberate boundary): **authorization** — i.e. deciding *what* a given
signed-in person may do based on their role/scope (President, Booker, Financial Secretary, etc.). That is
the next Phase 3 package (P3-2) and depends on this one. This feature only answers *"who is signed in?"*,
never *"are they allowed to do this?"*. Designating other contacts as volunteers and assigning their roles
also belongs to P3-2 (this feature bootstraps only the first officer). **Passwords are not stored at all**
and credential recovery is Google's responsibility. Non-volunteer / public-member login (backlog B2)
remains deferred.

## Clarifications

### Session 2026-07-14

- Q: How do staff authenticate? → A: **Sign in with Google.** The club already runs **Google Workspace**
  and issues accounts to everyone who would sign in as staff. No passwords are stored; Google verifies
  identity and owns credential recovery. *(Supersedes an earlier email+password assumption, along with its
  password policy, throttling, and manual officer-reset path — none of which are needed now.)*
- Q: With Google verifying identity, is officer approval of new staff accounts still needed? → A: **No —
  dropped as redundant.** Google verifies identity, `is_volunteer` authorizes staff status, and the email
  match binds the account to exactly one contact. *(Supersedes an earlier "pending until an officer
  approves" decision, which existed only because platform email was deferred and identity could not
  otherwise be verified.)*
- Q: What is a staff member's login identifier? → A: The contact's **login email** — the existing
  `contact_emails.is_login` designation (dormant since feature 001), which the code already restricts to
  volunteer contacts (`isLoginAllowed`). The Google account's verified email must match an **active**
  email on **exactly one volunteer contact**.
- Q: How is the first officer bootstrapped, given **0 of 1334 contacts are volunteers**, no UI sets
  `is_volunteer`, and nobody could otherwise sign in? → A: This feature provides an **operator-run
  seed/CLI path** to designate the initial volunteer/officer(s). The volunteer-designation **UI** is out
  of scope here and arrives with the role-assignment feature (P3-2).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Staff member signs in with Google and out (Priority: P1)

A club volunteer with staff duties (e.g. a Booker or Financial Secretary) opens the app, chooses "sign in
with Google", authenticates with their club Workspace account, works in the staff area, and signs out when
finished. The first time they do this their staff identity is created automatically by matching their
verified Google email to their volunteer contact — there is no separate registration step.

**Why this priority**: This is the core capability the whole feature exists to provide, and everything
else in Phase 3 depends on it. Without sign-in there is no authenticated identity to build on.

**Independent Test**: Sign in with a Google account belonging to a designated volunteer and confirm a staff
page is reachable; sign out and confirm it is no longer reachable. Delivers a working, demonstrable login
on its own.

**Acceptance Scenarios**:

1. **Given** a designated volunteer whose Workspace email is an active email on their contact, **When**
   they sign in with Google for the first time, **Then** a staff identity is created and linked to that
   contact, and they can reach staff pages.
2. **Given** that same volunteer returning later, **When** they sign in with Google, **Then** they are
   signed in to their existing staff identity.
3. **Given** a signed-in staff member, **When** they sign out, **Then** their session ends and staff pages
   are no longer reachable without signing in again.
4. **Given** a Google account whose verified email does not match an active email on exactly one volunteer
   contact, **When** they attempt to sign in, **Then** access is refused and the attempt is recorded.

---

### User Story 2 - Public stays open, staff areas are protected (Priority: P2)

A member of the public browses the What's On schedule and event details without any account. If they (or
anyone not signed in) try to open a staff page or perform a staff action, they are turned away and sent to
sign in.

**Why this priority**: Establishes the access boundary that makes authentication meaningful, while
preserving the existing public browsing experience (feature 007). High value, but only demonstrable once
sign-in (P1) exists.

**Independent Test**: Without signing in, confirm the public schedule loads and a staff page redirects to
sign-in.

**Acceptance Scenarios**:

1. **Given** a visitor who is not signed in, **When** they open a public page (schedule / event detail),
   **Then** it loads normally with no sign-in required.
2. **Given** a visitor who is not signed in, **When** they request a non-public (staff) page or action
   directly, **Then** access is refused and they are directed to sign in.

---

### User Story 3 - Staying signed in across a working session (Priority: P3)

A staff member moves between several staff pages during an evening's work without re-authenticating on
every page, and is signed out automatically after a period of inactivity or when they choose to sign out.

**Why this priority**: A usability and safety property of the session; valuable but refines P1 rather than
standing alone.

**Independent Test**: Sign in, navigate across multiple staff pages without re-authenticating, then confirm
the session ends after the defined inactivity period.

**Acceptance Scenarios**:

1. **Given** a signed-in staff member, **When** they navigate between staff pages, **Then** they remain
   signed in without repeating the Google flow.
2. **Given** a signed-in staff member who has been inactive beyond the session limit, **When** they next
   act, **Then** they are treated as signed out and must sign in again.

---

### Edge Cases

- A Google account whose verified email matches **no** contact → refused with a generic "not authorized
  for staff access" message.
- A Google email matching a contact who is **not** a designated volunteer → refused.
- A Google email matching **more than one** volunteer contact → refused as ambiguous (must not guess).
- **A volunteer whose club Workspace email is not yet recorded as an active email on their contact** →
  sign-in fails until that email is added. This is a real data prerequisite, not a code bug.
- A volunteer whose access has been withdrawn (`is_volunteer` cleared) → cannot sign in; an existing
  session is not honored.
- A Google account suspended/revoked by the Workspace administrator → Google refuses **new** sign-ins
  immediately. An **existing** app session is unaffected until it idles out, because the app does not
  re-contact Google after sign-in: worst-case exposure is one idle window (`SESSION_IDLE_TTL_HOURS`,
  default 8h). **Clearing `is_volunteer` is the authoritative, immediate kill-switch** (FR-011) and is
  therefore the required offboarding step — Workspace suspension alone does NOT end an active session.
- Directly opening a deep staff URL while signed out → redirected to sign in (ideally returning to the
  intended page afterward).
- A session that has expired or been signed out elsewhere → next action is treated as unauthenticated.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow a staff member to authenticate by **signing in with Google** and, on
  success, establish an authenticated session.
- **FR-002**: The system MUST allow a signed-in staff member to sign out, ending their session immediately.
- **FR-003**: The system MUST keep the public website (schedule and event detail pages) fully accessible
  without authentication.
- **FR-004**: The system MUST require a valid authenticated session for every non-public (staff) page and
  action, refusing or redirecting unauthenticated requests.
- **FR-005**: The system MUST make the signed-in staff member's identity available to server-side request
  handling, as the seam a later authorization feature will read — **without** itself enforcing any
  role-based permissions.
- **FR-006**: The system MUST associate each staff identity with an existing **volunteer** contact.
- **FR-007**: The system MUST persist the session so a staff member remains signed in across page
  navigation until they sign out or the session expires.
- **FR-008**: The system MUST end a session after a defined period of inactivity and treat subsequent
  requests as unauthenticated.
- **FR-009**: The system MUST refuse sign-in when the verified Google email does not match an **active**
  email on **exactly one volunteer contact** — covering no match, multiple matches, and a match on a
  non-volunteer contact — using a generic message that does not disclose which condition applied.
- **FR-010**: The system MUST record authentication events (successful sign-in, sign-out, and refused
  attempts) with enough context for later security review, per the project's observability principle.
- **FR-011**: The system MUST prevent a person whose volunteer access has been withdrawn from obtaining or
  continuing an authenticated session.
- **FR-012**: The system MUST **provision a staff identity automatically on first successful Google
  sign-in** that satisfies FR-009 — there is no separate registration form and no approval step.
- **FR-013**: Only contacts designated as volunteers (`is_volunteer`) may obtain a staff identity; a
  non-volunteer MUST NOT be able to sign in.
- **FR-014**: A staff member's login identifier MUST be their contact's **login email**
  (`contact_emails.is_login`), which the system already permits only on volunteer contacts. The matched
  active email MUST become that contact's login email.
- **FR-015**: A contact MUST have **at most one** login email. (The `is_login` flag exists today with no
  constraint enforcing single-designation; this feature makes the "one login email per person" rule real.)
- **FR-016**: The system MUST NOT store passwords or any authentication secret of its own; credential
  recovery is Google's responsibility and is out of scope.
- **FR-017**: The system MUST provide an **operator-run path outside the web UI** (seed/CLI) to designate
  the initial volunteer/officer account(s). Without it the feature cannot be bootstrapped: no contact is a
  volunteer today, so nobody could sign in at all.
- **FR-018**: Designating *other* contacts as volunteers, and assigning their roles, is **out of scope**
  for this feature; it belongs to the role-assignment feature (P3-2). This feature needs only enough
  bootstrap (FR-017) to make staff sign-in demonstrable.

### Key Entities *(include if feature involves data)*

- **Staff sign-in identity**: represents a volunteer's ability to authenticate via Google. Links a Google
  account to a **Contact** by verified email; the contact's **login email**
  (`contact_emails.is_login`, at most one per contact) is the identifier. Holds no password. Distinct from
  the person's role grants, which live in the later authorization feature.
- **Session**: an authenticated period belonging to a staff identity; has a start and an expiry, and can be
  ended early by sign-out or withdrawal of volunteer access.
- **Volunteer designation** *(existing, dormant)*: `contacts.is_volunteer` — the standing flag marking a
  contact as staff, and the eligibility gate for holding a login email and signing in. Orthogonal to
  **attendance** (a per-event `attendance` row), which never implies volunteer status.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A designated volunteer can go from the sign-in page to a working staff page in a single
  Google sign-in step, in under 30 seconds.
- **SC-002**: 100% of non-public pages and actions deny access when no valid session is present.
- **SC-003**: The public schedule and event pages remain reachable with zero sign-in steps (no regression
  from feature 007).
- **SC-004**: A signed-in staff member can navigate across all staff pages for a full working session
  without re-authenticating, until sign-out or the defined inactivity timeout.
- **SC-005**: Every sign-in success, sign-out, and refused sign-in is recorded and retrievable for security
  review.
- **SC-006**: A person whose volunteer access has been withdrawn cannot sign in and cannot continue an
  existing session.
- **SC-007**: A Google user whose verified email does not match an active email on exactly one volunteer
  contact is refused 100% of the time.
- **SC-008**: Starting from the current data (no volunteers, no login emails), an operator can designate a
  first officer who can then sign in with Google — i.e. the feature is demonstrable end-to-end from a cold
  start with no manual database editing.
- **SC-009**: The system never stores or prompts for a password.

## Assumptions

- **The club runs Google Workspace and issues accounts to everyone who signs in as staff** (stated by the
  club). Google sign-in is therefore universal for staff; no password fallback is needed.
- **Staff = volunteers already in the contact directory.** A staff identity links to an existing `contact`
  designated a volunteer. New-person onboarding is not part of this feature.
- **Data prerequisite**: a volunteer's Workspace email must be recorded as an **active email on their
  contact** for sign-in to match. Adding missing emails uses the existing contacts/email management; this
  feature does not add a bulk-import path.
- **Provisioning = automatic on first Google sign-in** (decided): no registration form, no approval step.
  `is_volunteer` is the deliberate access decision, set by the operator bootstrap (FR-017) here and by the
  President in P3-2.
- **Login identifier = the contact's `is_login` email** (decided). Reuses the dormant feature-001
  mechanism (which already restricts login emails to volunteers) rather than inventing a new identifier.
  Deliberately avoids depending on primary-email designation, which is deferred (B3). Note `is_login` has
  no single-designation constraint today — FR-015 makes that rule real.
- **Bootstrap = operator seed/CLI for the first officer** (decided, FR-017). Necessary because the
  volunteer substrate is entirely unpopulated (0 of 1334 contacts) and no UI sets `is_volunteer`.
- **Authorization is a separate, later feature (P3-2).** This feature deliberately stops at "who is signed
  in"; role/scope permission checks (the `docs/use-cases.md` matrix) are out of scope here.
- **Session model**: the app maintains its own server-side session after Google sign-in, with an inactivity
  expiry; a sensible default timeout will be chosen at planning and MAY be configurable.
- **Google-side suspension is not detected mid-session** (deliberate). The Google identity is verified once,
  at sign-in; thereafter the app relies on its own session plus a live `is_volunteer` check. Re-validating
  with Google per request would put an external dependency on every request and contradict the boundary seam
  the constitution (v1.2.0) is built around. Consequence: suspending a Workspace account stops *new* sign-ins
  at once but leaves an active session alive for up to one idle window, so offboarding MUST clear
  `is_volunteer` (FR-011), which takes effect on the next request.
- **Open for planning — restricting sign-in to the club's Workspace domain** is available as extra
  hardening, but the real gates are the volunteer-contact match and `is_volunteer`; whether to also enforce
  a domain restriction is a planning decision.
- **Testing the identity provider is now settled by the constitution** (amended to **v1.2.0**,
  2026-07-14). Automated tests MUST NOT call Google's production endpoints; the provider is exercised at
  its boundary via either a locally-run conforming implementation or a fixture reproducing its verified
  contract (signed OIDC tokens). Everything behind that seam — claim validation, email→contact matching,
  `is_login`, `is_volunteer` gating, session creation — MUST still be integration-tested against real
  Postgres. This keeps testing off Google's abuse/rate-limit radar without weakening the database rule.
