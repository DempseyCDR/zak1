# Feature Specification: Static content pages / lightweight CMS (P7-R7)

**Feature Branch**: `051-content-pages`

**Created**: 2026-08-23

**Status**: Draft

**Input**: User description: "P7-R7 — the org cluster of mostly-prose public pages (mission, about-CDR, board
of directors, resources like etiquette/scholarships/performer info, policies like the social contract, bylaws,
privacy). Decide B44 = a Tier-2 CMS: a content-pages store + a minimal admin editor on the existing staff auth
(Webmaster/VP), with public rendering. ~15 pages the club wants to edit without a developer deploy."

## Overview

About fifteen of the current site's pages are **prose the club maintains** — mission, about CDR, the board of
directors, resources (etiquette, scholarships, performer info), and policies (the social contract, bylaws,
privacy). Today changing any of them requires a developer and a deploy. This feature adds a **lightweight
content-management capability (Tier-2, decided in D-3)**: a store of **content pages** that a **Webmaster** (the
VP's delegate, using the existing staff sign-in) can **create, edit, and publish through a small admin editor —
no deploy** — and that the **public reads** at a clean URL, styled consistently with the rest of the site. Page
content is **sanitized** before it is shown (it must never execute scripts). This is the club's own editorial
surface; it is deliberately minimal (not a general website builder), and it does **not** replace the
purpose-built pages (the dance listings, event detail, or series landings) — those stay as they are.

## Clarifications

### Session 2026-08-23

- Q: How should the Webmaster author a page's body, and how is it stored (D-3's open editor question)? → A:
  **Markdown** — edit plain Markdown, store the Markdown, render to **sanitized HTML** on display; a live
  preview covers "what will it look like". No WYSIWYG editor library.
- Q: What publication workflow should a content page support? → A: **Separate draft vs published body** — the
  Webmaster edits a **draft** body without changing the live page, previews it, then **publishes** to promote
  the draft to the **published** body the public sees. Editing a live page never changes it until publish.
- Q: How should policy PDFs and images inside content pages be handled? → A: **Committed static assets,
  linked** — PDFs (bylaws, social contract) and images live in the repo as committed files a page links to; no
  upload substrate (consistent with D-4).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The public reads the club's info pages (Priority: P1)

A visitor opens the club's mission, about, board, resources, or policy page and reads it — cleanly laid out,
mobile-first, consistent with the rest of the site. The content is current because the club can keep it current.

**Why this priority**: These pages are the club's public identity and obligations (mission, policies); the
public must be able to read them, and stale content is the problem this feature exists to fix.

**Independent Test**: Publish a content page and load its public URL — the title and body render as a styled,
readable page (one H1, mobile-first); an unknown or unpublished page returns not-found.

**Acceptance Scenarios**:

1. **Given** a published content page, **When** a visitor loads its URL, **Then** the page's title and body
   render as a styled, readable page consistent with the site.
2. **Given** an unpublished page or an unknown URL, **When** a visitor loads it, **Then** they get a clear
   not-found result (the content is not exposed).
3. **Given** a page body containing markup, **When** it renders, **Then** any unsafe/script content is
   neutralized — nothing executes.

---

### User Story 2 - The Webmaster edits a page without a deploy (Priority: P1)

The Webmaster signs in with the existing staff login, opens the content admin, and creates or edits a page —
its title and body — then publishes it. The change is live to the public without any developer or deploy.

**Why this priority**: The whole point of the feature (D-3 / B44) is that the club edits its own prose without
engineering. Without this, the pages are just as stuck as before.

**Independent Test**: As a signed-in Webmaster, create a page, give it a title and draft body, publish it, and
confirm it is live at its public URL; edit the draft and publish again, and confirm the change is reflected —
all without a code change.

**Acceptance Scenarios**:

1. **Given** a signed-in Webmaster, **When** they create a page with a slug, title, and draft body and publish
   it, **Then** the page is live at its public URL showing the published body.
2. **Given** a published page, **When** the Webmaster edits its draft body and saves, **Then** the public page
   is **unchanged**; **When** they then publish, **Then** the public page reflects the change — with no deploy.
3. **Given** a person **without** content-edit permission, **When** they try to reach the content admin or its
   save actions, **Then** they are denied (default-deny).
4. **Given** any create/edit/publish action, **When** it is saved, **Then** it is recorded in the audit trail
   (who and when).

---

### User Story 3 - Safe editing: preview, unpublish, and manage the set (Priority: P2)

Before making a page public, the Webmaster can preview it; they can unpublish a page (take it down without
deleting), delete a page, and see the list of pages and their state — so editing public content is safe and
reversible.

**Why this priority**: Editing live public content needs a safety net (preview before publish, take-down); it's
important but secondary to the core read (US1) and edit (US2).

**Independent Test**: As a Webmaster, preview an unpublished page (visible to the editor, not the public);
publish it; unpublish it and confirm the public URL now 404s; see the page listed with its state.

**Acceptance Scenarios**:

1. **Given** a page's draft body, **When** the Webmaster previews it, **Then** they see it rendered as it will
   appear, without it being public.
2. **Given** a published page, **When** the Webmaster unpublishes it, **Then** its public URL returns not-found.
3. **Given** the content admin, **When** the Webmaster opens it, **Then** they see the pages and each one's
   published/unpublished state, and can delete a page.

### Edge Cases

- **Duplicate or reserved slug**: creating a page with a slug that already exists, or that collides with an
  existing site route (e.g. `whats-on`, `join`), is rejected with a clear message.
- **Empty title or body**: rejected with a clear validation message.
- **Unpublished page**: not reachable by the public (not-found), but previewable by the Webmaster.
- **Unsafe content in the body**: neutralized (sanitized) — never executed.
- **Deleting a page**: its public URL then returns not-found; the deletion is audited.
- **Long content**: renders readably at ~375px with no horizontal scroll.
- **A policy document (PDF)**: linked from a page as a committed asset (see Assumptions), not broken/inline.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A person with **content-edit permission** (the Webmaster capability) MUST be able to **create** a
  content page with a unique **slug**, a **title**, and a **Markdown body** (a **draft**).
- **FR-002**: They MUST be able to **edit** a page's title and **draft body** without changing the live page;
  **publish** (promote the draft body to the **published** body the public sees); **unpublish** (take the page
  down without deleting); and **delete** a page. Editing a published page's draft MUST NOT change what the
  public sees until the next publish.
- **FR-003**: A **published** page MUST be readable by the public at a **clean URL** derived from its slug,
  showing the **published** body; an **unpublished** page or an **unknown** URL MUST return **not-found** to
  the public.
- **FR-004**: The Markdown body MUST be rendered to **sanitized** HTML before display — untrusted markup MUST
  NOT execute (no script injection/XSS).
- **FR-005**: The content admin and all its create/edit/publish/delete actions MUST be **default-deny**,
  permitted only for the content-edit capability (the existing staff-auth model).
- **FR-006**: Every create/edit/publish/unpublish/delete MUST be **audited** (who and when), using the existing
  audit trail.
- **FR-007**: Public content pages MUST render **consistently with the site** (P7-R1 tokens), **mobile-first**
  (~375px, no horizontal scroll), with **exactly one H1** and WCAG AA contrast.
- **FR-008**: A page MUST be able to **link to a policy document** (e.g. the social contract or bylaws PDF) held
  as a committed static asset; the feature does **not** provide file upload (see Assumptions).
- **FR-009**: Slugs MUST be **unique and URL-safe**, and MUST NOT collide with existing site routes; content
  changes MUST require **no code deploy**.
- **FR-010**: The Webmaster MUST be able to **preview** the **draft** body rendered (as it will appear), without
  it being public.

### Key Entities

- **Content page**: the unit of editable prose. Identity is a unique, URL-safe **slug**. Attributes: **title**
  (the page heading); a **draft body** (Markdown — what the Webmaster edits and previews); a **published body**
  (the Markdown the public sees, set when the draft is published; empty until first publish); a **published**
  state (public vs. not); create/update **timestamps**; and **editor attribution** (via audit). Optionally a
  short **summary/meta** description for the page head. Body is **Markdown**, rendered to **sanitized** HTML.
- **Content-edit capability**: a new staff **capability** (held by the Webmaster / VP delegate) that gates the
  content admin and its write actions, within the existing role × capability model.

## Success Criteria *(mandatory)*

- **SC-001**: A Webmaster publishes a new info page and it is live at its public URL within one editing session,
  **with no developer involvement and no deploy**.
- **SC-002**: An **unpublished** or **unknown** page returns **not-found** to the public 100% of the time.
- **SC-003**: Malicious markup placed in a page body **does not execute** when the page is viewed (sanitized).
- **SC-004**: Only holders of the content-edit capability can reach the editor or its save actions; everyone
  else is denied.
- **SC-005**: Every content change is **attributable** (who and when) in the audit trail.
- **SC-006**: Public content pages render **mobile-first** (375px, no horizontal scroll), one H1, AA contrast,
  consistent with the rest of the site.

## Assumptions

- **Built on the existing staff auth + authorization** (features 015/016) and the P7-R1 public token styling
  (045, on `main`). This feature branches off `main` (independent of the 048–050 public-frontend stack). It adds
  the club's first **content-editing** surface and a new **content-edit capability** (Webmaster/VP), wired into
  the existing capability catalog, route-inventory, and nav-completeness guards.
- **Tier-2 CMS (D-3, decided)** — a content-pages store + a minimal admin editor on the existing auth, **not** a
  third-party/headless CMS and **not** a general website builder. Scope is the ~15 org/prose pages.
- **Editor / body format (clarified)** — **Markdown**: the body is edited as plain Markdown, stored as Markdown,
  and rendered to **sanitized** HTML; a live preview shows the rendered result. **No WYSIWYG editor library.**
- **Publication workflow (clarified)** — **separate draft vs published body**: the Webmaster edits a **draft**
  body (previewable, not public) and **publishes** to promote it to the **published** body the public sees;
  editing a live page never changes it until publish. **Unpublish** takes a page down without deleting it.
- **Media in pages (clarified)** — **committed static assets**: policy PDFs (bylaws, social contract) and images
  live in the repo as committed files a page **links** to; **no upload substrate** (consistent with D-4).
- **Navigation** — a published page is reachable at its URL; **PUBLIC_NAV stays hand-maintained** (feature 034):
  a nav entry for a content page is added deliberately. Auto-generating the public menu from published pages is
  **deferred** (the 034/B44 decision).
- **Versioning** — v1 records **who/when via the existing audit**; a full page-version history is **out of
  scope**.
- **The prose content itself is supplied by the club** (migrated from the current site), as the landing copy
  and images were; this feature provides the **capability and rendering**, not the words.

## Dependencies

- Staff auth (015) + authorization / capability model (016), the existing **audit** trail, and the P7-R1 tokens
  (045). Realizes backlog **B44** (Tier-2). Relates to feature 034 (the public nav single source) — if
  menu-from-published-content is ever wanted, it builds on this.

## Out of Scope

- **A third-party / headless CMS**, or a general drag-and-drop website builder — Tier-2 only (D-3).
- **A file-upload substrate** — PDFs/images are committed static assets (D-4); revisit later.
- **Full page-version history / rollback** — audit records who/when only in v1.
- **Auto-generating the public menu** from published pages — deferred (034/B44); nav stays hand-maintained.
- **The dance listings, event detail, and series landing pages** (R3–R6) — separate, purpose-built pages.
- **Public venues/directions (R8), performer rosters (R9), pricing/schedule (R10), galleries (R11)** — their
  own features; a content page may link to them once they exist.
