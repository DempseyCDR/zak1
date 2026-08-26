# Research: Site-wide announcement banner (P7-R13)

All items resolved; no NEEDS CLARIFICATION remain. The three scope decisions were locked in `/speckit-clarify`
(spec §Clarifications, 2026-08-25); this file records the mechanism choices that follow.

## R1 — One record, latest-wins

**Decision**: An `announcements` table where each **post inserts a row**; the **current** announcement is the
latest by `posted_at`. Posting a new one naturally **supersedes** the previous (spec: one current
announcement). A light history remains for reference; who/when is also in `audit_events`.

**Rationale**: Insert-per-post gives clean supersede semantics and an audit-friendly trail with no upsert
gymnastics. Reading the "current" is one indexed `ORDER BY posted_at DESC LIMIT 1`.

**Alternatives**: a single upserted row (id=1, like `club_settings`) — simpler storage but loses the small
history and needs an explicit clear flag anyway; not worth it.

## R2 — Duration-based expiry, derived on read

**Decision**: The current row is **active** iff `cleared_at IS NULL` **and** `now < posted_at +
(duration_hours × 1h)`. Computed at read time — **no scheduler/cron**. `getActiveAnnouncement` fetches the
latest row and applies a **pure** `isAnnouncementActive(row, now)` (also usable in SQL, but the pure form makes
the boundary unit-testable off-DB). `duration_hours` defaults to 24.

**Rationale**: A cancellation self-clears after the dance without anyone remembering to turn it off (the
clarified model). Deriving on read means nothing to run in the background; the boundary (SC-008) is a pure
function test.

## R3 — Clear-early without losing history

**Decision**: "Clear/replace early" sets `cleared_at = now()` on the **current** row (it stops being active
immediately). Posting a new announcement supersedes regardless. No hard delete (history + audit retained).

**Rationale**: Honors FR-004 ("clear/replace early") while keeping the trail; `cleared_at` folds into the same
active predicate as expiry.

## R4 — Server-render + client-dismiss split

**Decision**: The **`(public)` layout** becomes an **async server component** that calls
`getActiveAnnouncement(db)` and, when non-null, renders `<AnnouncementBanner announcement={a} />` **above**
`{children}` (it already wraps every public page and never admin/door). `AnnouncementBanner` is a **client**
component: its initial HTML (text + link) is server-rendered (FR-009 — a no-JS visitor sees it), and after
hydration it reads `localStorage` keyed to the announcement **id** to honor a prior **dismissal**; the dismiss
button writes that key. A changed announcement has a new id, so a stale dismissal never suppresses a new notice
(FR-008).

**Rationale**: One mount point guarantees site-wide + never-staff. Server-rendered text satisfies the no-JS
requirement; per-browser dismissal needs no server state. (Accept a brief show-then-hide flash for a
previously-dismissed banner — acceptable for a rare, low-frequency element.)

**Accessibility**: the banner is a landmark/region with an appropriate live-region role — `role="status"`
(`aria-live="polite"`) for `info`, `role="alert"` for `urgent` — and a keyboard-operable dismiss button
(FR-007). Contrast: `urgent` uses an accent that holds AA on the public ground.

## R5 — Link safety

**Decision**: The optional link is `{ label, url }`; `url` MUST be an absolute `http(s)` URL, validated at the
write boundary (same refine as 053/055 `promoLinks`: `new URL(url).protocol ∈ {http:,https:}`). Rendered as
`<a target="_blank" rel="noopener noreferrer">`. `label` required when `url` is present.

**Rationale**: The link is staff-authored but rendered publicly; the scheme allowlist is the single control.

## R6 — Capability & audit

**Decision**: Editing is gated by the existing **`content.write`** capability (Webmaster / super_user — the
public-content curators, per the R13 "Webmaster/VP grant" note), consistent with 051/055. `postAnnouncement`
and `clearAnnouncement` write an `audit_events` row via `recordAudit` — new kinds `announcement.posted` and
`announcement.cleared`. No new capability, no bespoke audit table.

## R7 — Level (urgency)

**Decision**: A small fixed set `level ∈ { info, urgent }` (text column, Zod enum), driving only the banner's
visual emphasis and its ARIA role/politeness. Not a rich taxonomy.

**Rationale**: FR-006 needs "normal vs urgent"; two values cover the use case (info notice vs cancellation).

## R8 — Independence from per-event cancellation (018)

**Decision**: This feature touches **no** `events` table/row and no event status. The banner is a separate
site-wide notice; per-event cancellation stays on the event (feature 018, its card/detail marker). Stated so an
implementer never wires the two together (FR-012).
