# Research: Campaign / promotional slot (P7-R14)

All items resolved; no NEEDS CLARIFICATION remain. The scope-shaping decisions were locked in `/speckit-clarify`
(spec §Clarifications, 2026-08-26): link-now-page-later CTA · external image URL · date-only window ·
**expires-first queue**. This file records the mechanism choices that follow.

## R1 — A queue of rows; earliest-end wins (derived on read)

**Decision**: A `campaigns` table where each campaign is a **row** (heading, blurb, image, CTA, start-date,
end-date). The home page shows **exactly one**: among rows whose window includes today, the one with the
**earliest end date** (ties: earliest start date, then `created_at`). A **pure** `selectShownCampaign(rows,
today)` filters active rows and orders them — the SC-009 source of truth, testable off-DB. `getShownCampaign`
fetches the active rows and applies it. No scheduler: activation and the queue handoff are computed at read time.

**Rationale**: "Expires-first" (the clarified rule) means a shorter/sooner-ending campaign takes precedence while
active and a longer one resumes afterward — no campaign is starved, and staging a successor never clutters the
page. A pure selector keeps the interesting logic (the queue + handoff) unit-testable without a DB.

**Alternatives**: single upserted row (R13's shape) — rejected: cannot queue or overlap. Ordering by start date
— rejected by the user in favor of end date (see spec §Clarifications).

## R2 — Date-window activation using the app's standard date convention

**Decision**: `start_date` and `end_date` are `date` columns (no time-of-day). A campaign is active iff
`start_date <= today AND today <= end_date` (inclusive). "Today" is the app's existing convention:
`new Date().toISOString().slice(0,10)` — the **UTC date string** already used by `publicSchedule.ts` `today()`
to decide what is upcoming/past. Comparison is lexicographic on ISO `YYYY-MM-DD`.

**Rationale**: The spec says "club-local"; the **codebase decides every date boundary in UTC** (event
upcoming/past uses the same `today()`), and a campaign dated the same day as an event must flip **together** with
it. Consistency beats introducing a one-off timezone; for a weeks-long campaign the evening-vs-midnight nuance is
immaterial. (Documented as a deliberate, minor deviation from the spec's "local time" wording.)

**Alternatives**: compute today in `America/New_York` — rejected: nothing else in the app does, and it would make
campaigns flip at a different instant than same-day events.

## R3 — External image URL, rendered with a plain lazy `<img>`

**Decision**: The optional image is an **`http(s)` URL** (`{ url, alt }`), validated at the write boundary with
the same scheme allowlist as the CTA/promoLinks. It is rendered with a plain `<img loading="lazy" alt=…>` — **not**
`next/image`.

**Rationale**: No upload/storage infra exists and D-4 defers building it; an editor-pasted URL keeps the slot
reusable without a developer (FR-007). `next/image` requires each remote host to be pre-listed in
`next.config` `images.remotePatterns`; editors paste arbitrary hosts (club site, Google Photos, …), which that
allowlist can't cover — so a plain `<img>` is correct here. Alt text is required when an image is set (a11y).

**Alternatives**: `next/image` with a wildcard remote pattern — rejected (over-broad, still may not match; loses
little since the slot image is not LCP-critical). File upload — rejected (out of scope, D-4).

## R4 — CTA link: internal path or `http(s)`, validated and rendered accordingly

**Decision**: The CTA `url` is either an **internal path** (starts with `/`, not `//`) or an absolute `http(s)`
URL. Validated at the write boundary. Rendered: an internal path as a same-tab link; an external `http(s)` URL as
`<a target="_blank" rel="noopener noreferrer">`. Detection is the leading `/`.

**Rationale**: The CTA usually points at an R7 content page or an internal route (same tab, in-app nav), but may
point out to an external site (ticketing) — which should open in a new tab and be scheme-allowlisted, exactly as
053/055/056 do for public links.

**Alternatives**: external-only (like the announcement link) — rejected: the "link now, page later" answer makes
an internal content page (R7) the most likely target, so internal paths must be first-class.

## R5 — Remove = delete; auto-expiry = derived (no soft-delete column)

**Decision**: Campaign CRUD is create / edit / **delete**. "Retire early" is a **delete** (or the editor shortens
the end date). There is **no** `cleared_at`/`retired_at` column: a campaign is shown iff it is present AND today
is within its window. Every create/edit/delete is audited.

**Rationale**: The date window already provides auto-expiry with no write (unlike R13, which needed `cleared_at`
because it had no end date). Adding a soft-delete flag would duplicate what the end date already expresses. The
audit row preserves who/when even across a hard delete.

**Alternatives**: `retired_at` soft-delete (R13's shape) — rejected as redundant given the end date; keeping
retired rows around would also clutter the admin list with no benefit.

## R6 — Capability & audit

**Decision**: Editing is gated by the existing **`content.write`** capability (Webmaster / super_user — the
public-content curators), consistent with 051/055/056. `create`/`update`/`delete` write an `audit_events` row via
`recordAudit` — new kinds `campaign.created` / `campaign.updated` / `campaign.deleted`. No new capability, no
bespoke audit table.

## R7 — Home-page mount, server-rendered, no client behavior

**Decision**: `(public)/page.tsx` (already an async server component reading the DB) fetches `getShownCampaign(db)`
and renders `<CampaignSlot campaign={…} />` at the **top of the home page, above the hero**, when non-null.
`CampaignSlot` is a **server component** — heading/blurb/image/CTA are static, so there is no `"use client"` and
no client bundle (unlike R13, the campaign slot has **no dismiss**). Home-page only (the slot is not in the
`(public)` layout, so it never appears on other public pages or on admin/door).

**Rationale**: One mount point on the home page satisfies "home only." Server-render satisfies FR-011 (no-JS
visitors see it). Placing it above the hero gives the marquee campaign top billing (matches the current site's
Golden Banner slide and SC-001 "above the fold"), while the hero remains directly below as the orientation
anchor. Coexists with the R13 announcement banner (which the `(public)` layout renders above everything).

**Accessibility / mobile**: the slot is a labelled region; the image (if any) carries editor-provided alt text;
the CTA is a real keyboard-focusable link; mobile-first, wraps, no h-scroll at 375px; degrades to a legible
text-only card when no image is set.

## R8 — Independence from R13 and from event status (018)

**Decision**: The slot touches **no** `events` table/row and **no** announcement (`announcements`) row. It is a
separate affordance from the R13 urgent banner; both may render at once (banner in the layout, slot on the home
page). Event groups (010/013) have **no public surface** (confirmed in the spec's Dependencies) — the CTA links
to a curated content page (R7), not a group page.
