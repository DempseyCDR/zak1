# Implementation Plan: Campaign / promotional slot (P7-R14)

**Branch**: `057-campaign-slot` | **Date**: 2026-08-26 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/057-campaign-slot/spec.md`

## Summary

A reusable **promotional slot** on the public **home page** for the club's headline campaign (the 50th-anniversary
Golden Weekend now, the Jane Austen Ball next year). Campaigns form a **queue**: the store holds several rows,
each a `{ heading, blurb, optional image (URL), CTA (label+link), start-date, end-date }`; the home page shows
**exactly one** — the active campaign that **expires first** (earliest end date; ties: earliest start date, then
creation) — and auto-advances when it ends, all with no staff action. Editing is a `content.write` admin + API;
every create/edit/remove is audited. The slot is **server-rendered** (FR-011) with no client behavior. Additive
migration `0040`. The image is an external `http(s)` URL (no upload); the CTA links to an existing content page
(R7), an internal route, or an external site (no dedicated landing page — "link now, page later"). Independent
of the R13 announcement banner and of event status (018).

## Technical Context

**Language/Version**: TypeScript 5.7 (strict), Node 24
**Primary Dependencies**: Next.js 16 (App Router / RSC), Drizzle ORM + hand-authored SQL migrations, Zod
**Storage**: PostgreSQL 16 — additive migration `0040` (`campaigns` table)
**Testing**: Vitest — real-Postgres integration, unit, jsdom component
**Target Platform**: Server-rendered web; mobile-first public pages
**Performance Goals**: Standard web; one indexed `SELECT` over active rows per home render (a handful of rows)
**Constraints**: Slot **server-rendered** (present without JS — FR-011; no dismiss/client behavior); image is an
`http(s)` URL rendered with a plain lazy `<img>` (arbitrary host → **not** `next/image`); CTA is an internal
path or `http(s)` (validated at the write boundary); **home page only** (never admin/door, never other public
pages); date-window activation in the app's standard date convention; accessible (image alt text; keyboard CTA);
mobile-first (no h-scroll at 375px); **no** read/write of event status
**Scale/Scope**: One club, a small queue of campaigns. One migration, one service (pure active-check + pure
queue-selector), one validation module, one API (list/create + edit/delete), one admin page, one slot component
mounted on the home page.

## Constitution Check

Constitution v1.3.0. Gates:

- **I. Test-First (NON-NEGOTIABLE)** — PASS (planned). A **unit** test for `isCampaignActive` (date-window
  boundary — start/end inclusive, retired-early excluded) and `selectShownCampaign` (the queue rule: earliest
  end date wins, ties by earliest start then creation; handoff when the shown one ends) and the Zod validation
  (heading/blurb required; image `{url:http(s), alt}` nullable; CTA internal-path-or-`http(s)`; `endDate >=
  startDate`); an **integration** test for list/create/update/delete + the shown-selection over real Postgres +
  audit + `content.write` refusal; a **component** test for the slot (renders heading/blurb/CTA, image with alt,
  text-only when no image, internal vs external CTA target).
- **II. YAGNI** — PASS. Queue selection is **derived on read** (no scheduler); a plain lazy `<img>` (no upload,
  no `next/image` remote-host config); reuse of `content.write`, `audit_events`, the `http(s)` link check
  (053/055/056), and the home page mount. No dedicated landing page, no soft-delete flag (remove = delete; an
  expired campaign is simply outside its window — both derived from dates + presence), no per-event coupling,
  no carousel. "Retire early" = delete the row (or shorten its end date).
- **III. Type Safety (Zod at boundaries)** — PASS. Create/edit payloads are Zod-validated (heading/blurb
  non-empty; image `{label→alt, url http(s)}` nullable; CTA `{label, url}` internal-path-or-`http(s)`; dates
  ISO with `endDate >= startDate`). The public projection type carries only display-safe fields (id, heading,
  blurb, image, cta) — no dates/created reach the client.
- **IV. Observability** — PASS. `createCampaign` / `updateCampaign` / `deleteCampaign` each write an
  `audit_events` row via `recordAudit` (new `campaign.created` / `campaign.updated` / `campaign.deleted` kinds).
  Public read is read-only.

No violations. Complexity Tracking: none.

## Project Structure

### Documentation (this feature)

```text
specs/057-campaign-slot/
├── spec.md · plan.md · research.md · data-model.md · quickstart.md
├── contracts/campaigns.md
└── checklists/requirements.md
```

### Source Code (repository root)

```text
src/server/db/migrations/0040_campaigns.sql             # NEW — campaigns table
src/server/db/schema/campaigns.ts                        # NEW — table; export from index
src/server/validation/campaign.ts                        # NEW — Zod: create/edit payload (heading, blurb, image, cta, dates)
src/server/domain/campaigns/campaignService.ts           # NEW — isCampaignActive (pure), selectShownCampaign (pure),
                                                         #        getShownCampaign, listCampaigns, create/update/deleteCampaign
src/server/lib/audit.ts                                  # + campaign.created / campaign.updated / campaign.deleted kinds

src/app/(public)/page.tsx                                # MODIFY — fetch shown campaign; render slot above the hero
src/app/(public)/_components/CampaignSlot.tsx            # NEW — server component: heading/blurb/image/CTA (no client JS)
src/app/(public)/_components/CampaignSlot.module.css     # NEW

src/app/api/campaigns/route.ts                           # NEW — GET list (admin) · POST create (content.write)
src/app/api/campaigns/[id]/route.ts                      # NEW — PATCH edit · DELETE remove (content.write)
src/app/(admin)/campaigns/page.tsx                       # NEW — list (which is shown) + add/edit/remove; + NAV entry (content.write)

tests/unit/campaignSelect.test.ts                        # isCampaignActive + selectShownCampaign + validation
tests/integration/campaign.test.ts                       # list/create/update/delete + shown-selection + audit (real Postgres)
tests/integration/campaign.authz.test.ts                 # content.write refusal
tests/component/campaignSlot.test.tsx                    # render + image/alt + text-only + internal/external CTA
```

**Structure Decision**: Single web app. Load-bearing choices: (1) **queue selection is pure + derived on read**
— `selectShownCampaign(rows, today)` (filter active, order by `end_date, start_date, created_at`, take first) is
the SC-009 source of truth, unit-tested off-DB; `getShownCampaign` fetches the active rows and applies it. (2)
The slot is a **server component** mounted at the **top of the home page** (`(public)/page.tsx`, above the hero)
— home-only, server-rendered, no client bundle (there is no dismiss). (3) The image is an **external `http(s)`
URL** rendered with a plain **lazy `<img>`** (not `next/image`, whose remote-host allowlist can't cover
editor-supplied hosts); a non-`http(s)` scheme is rejected at the write boundary. (4) **Remove = delete** and
**auto-expiry = derived from dates** — no `cleared_at`/`retired_at` column (simpler than R13, because the date
window already gives auto-expiry).

## Complexity Tracking

No constitution violations; no entries.

## Phase 0 — Research

See [research.md](research.md): the queue model + earliest-end selection, date-window activation using the app's
standard UTC-date convention (consistency with `/whats-on`), the external-image-URL + plain-`<img>` rendering
decision, the internal-path-or-`http(s)` CTA validation/rendering, remove-as-delete, capability/audit reuse, and
the home-page mount + server-render (no client behavior).

## Phase 1 — Design & Contracts

- [data-model.md](data-model.md) — migration `0040`, the `campaigns` table, the active predicate, the queue
  selection order, and the display-safe projection.
- [contracts/campaigns.md](contracts/campaigns.md) — the service (pure active-check + pure selector + reads +
  writes), the public projection, the admin API (list/create/edit/delete), the slot/home mount, and the test
  contracts.
- [quickstart.md](quickstart.md) — end-to-end validation mapped to SC-001…009 (including the two-active queue
  handoff).
- Agent context: `CLAUDE.md` SpecKit plan reference updated to this plan.
