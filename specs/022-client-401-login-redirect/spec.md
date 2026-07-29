# Feature Specification: Client 401 → sign-in redirect (B41)

**Feature Branch**: `022-client-401-login-redirect`

**Created**: 2026-07-28

**Status**: Draft

**Input**: User description: "B41 — client 401 redirects to /login"

## Overview

When a staff member's sign-in session expires or is withdrawn, the pages they use keep running in the browser
and their next server-backed action quietly fails. Today the client **swallows** that failure — most visibly,
the door check-in search renders an expired session as **"no match"** for a person who plainly exists
(reproduced live: a search for a real contact returned nothing while the server logged an unauthenticated
rejection). The staff member has no idea they've been signed out. This feature makes an expired/absent session
**send the user to sign in and bring them back** to what they were doing, uniformly across every staff page —
while leaving genuine *permission* denials as plain inline messages, not a confusing sign-in prompt.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - An expired session sends you to sign in, then back (Priority: P1)

A staff member (e.g. Meg working the door) has a page open when their session expires. Their next action that
talks to the server takes them to the sign-in page; after they sign in again, they land back on the page they
were using and can continue.

**Why this priority**: This is the core fix. Without it, an expired session is invisible and manifests as
silent wrong results — the worst kind of failure for someone working a live event.

**Independent Test**: With a page open, invalidate the session, perform an action that calls the server, and
confirm the user is taken to sign-in; after signing in, confirm they return to the page they started on.

**Acceptance Scenarios**:

1. **Given** a staff member on a page whose session has expired, **When** they take an action that calls the
   server, **Then** they are taken to the sign-in page instead of seeing a silent or generic failure.
2. **Given** a staff member who was redirected to sign in from a page, **When** they successfully sign in
   again, **Then** they are returned to that same page.
3. **Given** the door check-in search with an expired session, **When** the attendant searches for an existing
   person, **Then** they are sent to sign in — never shown a false "no match".

### User Story 2 - A permission denial is not a sign-in prompt (Priority: P1)

A staff member who **is** signed in but is not permitted to perform a particular action sees a clear inline
message telling them so, and stays where they are. They are **not** bounced to sign in.

**Why this priority**: Must ship with US1. Redirecting a permission denial to sign-in would trap a legitimately
signed-in user in a pointless re-authentication that can never grant the action, and hides the real reason.

**Independent Test**: As a signed-in user lacking a capability, attempt the gated action and confirm an inline
"not allowed" message appears with no navigation to sign-in.

**Acceptance Scenarios**:

1. **Given** a signed-in staff member lacking permission for an action, **When** they attempt it, **Then** they
   see an inline message that they are not allowed, and remain on the page.
2. **Given** the same situation, **When** the denial occurs, **Then** no sign-in redirect happens.

### User Story 3 - Uniform across every staff surface, no silent failures (Priority: P2)

Every staff page that talks to the server behaves the same way on session expiry — the booker's report and
modals, the gate money page, the door check-in, and any other staff surface. No surface renders an expired
session as a successful-but-empty result.

**Why this priority**: The behavior is only trustworthy if it is consistent; a single surface that still
swallows a 401 reintroduces the silent-failure class the feature exists to kill.

**Independent Test**: Across a representative set of staff surfaces, expire the session, trigger each surface's
server call, and confirm each redirects to sign-in rather than showing empty/blank/no-result content.

**Acceptance Scenarios**:

1. **Given** any staff surface with a server-backed action, **When** the session is expired, **Then** that
   action results in a sign-in redirect.
2. **Given** a surface whose page-load automatically fetches data, **When** the session is expired on load,
   **Then** the user is sent to sign in rather than shown an empty page.

### Edge Cases

- **Concurrent failures**: several of a page's server calls fail unauthenticated at once → a **single** sign-in
  redirect, never a loop or repeated navigation.
- **Already on the sign-in page**: an unauthenticated response there MUST NOT cause a redirect loop.
- **Unsaved work**: a session that expires mid-edit loses the unsaved action (it failed server-side anyway);
  the user is redirected and re-does it after signing in. No false "saved" confirmation is shown.
- **Unsafe return-path**: the remembered destination must be validated so it cannot send the user anywhere
  outside the application.
- **Public pages**: unauthenticated visitors on public pages are unaffected — this concerns staff surfaces.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When a staff client action receives an **unauthenticated** response (session expired, absent, or
  withdrawn), the system MUST navigate the user to the sign-in page.
- **FR-002**: The sign-in redirect MUST carry a safe return-path identifying the page the user was on, and on
  successful sign-in the user MUST be returned to that page. (Reuses the existing return-path mechanism.)
- **FR-003**: A **forbidden** response (the user is authenticated but lacks permission) MUST NOT trigger a
  sign-in redirect; it MUST surface as an inline, user-visible "not allowed" message on the current page.
- **FR-004**: No staff client surface may present an unauthenticated failure as a successful-but-empty result
  (e.g. "no matches", a blank list); the sign-in redirect supersedes any such rendering.
- **FR-005**: The behavior MUST apply **uniformly** to all staff client server-calls — user-initiated actions
  and automatic page-load fetches alike — so no surface is exempt.
- **FR-006**: Multiple concurrent unauthenticated responses MUST produce at most **one** sign-in redirect.
- **FR-007**: The return-path MUST be validated so it cannot redirect the user to an external or otherwise
  unsafe destination.
- **FR-008**: An unauthenticated response received while already on the sign-in page MUST NOT cause a redirect
  loop.
- **FR-009**: Server-side authorization MUST be unchanged; this feature only changes how the client *reacts* to
  the server's existing unauthenticated/forbidden responses.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of staff client server-calls that receive an unauthenticated response result in a sign-in
  redirect — **zero** silent/empty renderings of an expired session.
- **SC-002**: After re-authenticating, the user returns to the page they were on in 100% of cases for valid
  in-application destinations. (This feature only *produces* the `next` value; the return round-trip itself is
  the existing feature-015 flow — validated by that feature and a manual browser check, not by a new
  automated test here.)
- **SC-003**: A permission-denied action shows an inline message and triggers **zero** sign-in redirects.
- **SC-004**: The reproduced defect — an expired session on door check-in search showing "no match" for an
  existing person — no longer occurs.
- **SC-005**: **Zero** redirect loops occur, including when already on the sign-in page or when several calls
  fail at once (at most one navigation).

## Assumptions

- The safe return-path flow already exists (feature 015: the sign-in page accepts a validated `next`
  destination and the sign-in round-trip returns the user to it). This feature **reuses** it — it does not add
  a new authentication flow, and FR-007's validation is the existing safe-path check.
- The server already returns a **uniform unauthenticated response** when there is no valid session, distinct
  from a **forbidden** response for a permitted-but-denied action. This feature keys the client's behavior on
  that existing distinction; it does not add or change those server responses.
- Scope is the **staff (authenticated) surfaces**; public/unauthenticated pages and the membership/webhook
  public endpoints are out of scope.
- An expired session mid-action loses only the in-flight unsaved action (which the server already refused);
  recovering it after sign-in is out of scope.
- Solo-maintainer workflow (constitution v1.3.0): one atomic commit to `main`, full local gate suite as the
  reviewer.
