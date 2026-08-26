# Implementation Plan: Org cluster — membership, donate, contact & board (P7-R12)

**Branch**: `055-org-cluster` | **Date**: 2026-08-25 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/055-org-cluster/spec.md`

## Summary

The public "org" cluster, plus two folded-in polish items. A **committed club-role registry** (`roleName +
emailAlias + isBoardSeat + order`) is the shared source for a single **contact directory** at **`/contact-us`**
(revised 2026-08-25 — the board page was merged in): every role → alias, plus the officer name on board seats,
plus a 051-CMS block. *(Originally two pages — a `/contact` role→alias list and a separate `/board` officers
page; merged after review, since the board page was the directory plus names.)* A small **`officers` table** maps a board-seat role → the contact
holding it (staff-maintained via a `content.write` admin); a **PII-gated projection** exposes only name + role +
alias. The **membership page** (`/join`) is content-completed — tiers, the Sep 1–Aug 31 year (derived from
`club_settings.membership_year_end`, closing the placeholder TODO), the coverage-through date a joiner gets
today, benefits — keeping the 019 capture→PayPal flow. It also **corrects the shared membership-expiry calc**
(`nextMembershipYearEnd`) to grant the club's **2-month early-renewal grace** (a payment in the final two months
rolls to the next Aug 31), so door enrollment, online capture, and `/join` share one calculation. A **donate**
affordance (PayPal donation destination) is added to the footer and `/join`. Contact / Board
/ Donate live under an **"About" group in the footer** (not the top nav). Folded-in: **favicons** wired via
layout metadata, and the header **wordmark replaced by the responsive logo** (icon on narrow, logotype on wide,
image-only with the club name in alt text, linking home).

## Technical Context

**Language/Version**: TypeScript 5.7 (strict), Node 24
**Primary Dependencies**: Next.js 16 (App Router / RSC), Drizzle ORM + hand-authored SQL migrations, Zod
**Storage**: PostgreSQL 16 — additive migration `0038` (one `officers` table); no other schema
**Testing**: Vitest — real-Postgres integration, unit, jsdom component
**Target Platform**: Server-rendered web; mobile-first public pages
**Performance Goals**: Standard web; a handful of roles/officers — no special targets
**Constraints**: Public pages expose only public-safe data — role aliases, officer **names + role**, dues
amounts; **never** a personal contact email/phone (a PII-gated board projection, 053-style). Aliases are
**server-rendered** (present without JS). Mobile-first (one H1/page, no h-scroll at 375px, AA).
**Scale/Scope**: One club, ~a dozen roles. One migration, one registry + one small service, four public pages
touched (contact, board, join, footer), one admin, plus favicon/wordmark polish.

## Constitution Check

Constitution v1.3.0. Gates:

- **I. Test-First (NON-NEGOTIABLE)** — PASS (planned). Per area: unit tests for the club-role registry
  (board seats, alias format) and the membership-year label helper; an integration test for the officer
  service (assign → board projection is PII-gated: name+role+alias only) + a `content.write` authz refusal;
  component tests for the footer About/donate, the board + contact renderers, the `/join` tiers, and the
  responsive logo (alt + home link). Tests written to fail first.
- **II. YAGNI** — PASS. Reuses: the 051 CMS (`getContentPageBySlug` + `renderMarkdown`) for the contact
  block, the `content.write` capability (webmaster = public-content curator), `club_settings.membership_year_end`
  for the year, the existing `/join` capture→PayPal flow, `ContactPicker` for the officer admin, and a
  committed registry (like 050) for the stable role/alias config. New only where required: one `officers`
  table and one pure registry. No membership-tier data model, no new payment integration (tiers displayed;
  single existing PayPal button), no per-tier buttons.
- **III. Type Safety (Zod at boundaries)** — PASS. The officer-admin write validates `roleKey` (∈ the
  registry's keys) and `contactId` (uuid | null) with Zod. The public board projection is a typed shape with
  **no PII field** (name + role + alias only), carrying the gate into the type.
- **IV. Observability** — PASS. Officer assignments write an `audit_events` row via `recordAudit` (new
  `officer.set` kind). Public reads are read-only. The 019 membership capture is unchanged.

No violations. Complexity Tracking: none.

## Project Structure

### Documentation (this feature)

```text
specs/055-org-cluster/
├── spec.md · plan.md · research.md · data-model.md · quickstart.md
├── contracts/org-cluster.md
└── checklists/requirements.md
```

### Source Code (repository root)

```text
public/CDR_Icon.svg · CDR_Logotype_4Color.svg · favicon.ico · favicon.png · favicon-96x96.png   # assets (added)

src/server/db/migrations/0038_officers.sql            # NEW — officers table
src/server/db/schema/officers.ts                       # NEW — table; export from index
src/server/domain/org/clubRoles.ts                     # NEW — committed role registry (key,label,alias,isBoardSeat,order)
src/server/domain/org/officerService.ts                # NEW — listContactRoles (PII-gated; all roles + officer
                                                       #        names), setOfficer, listOfficerAssignments
src/server/domain/membership/membershipTerm.ts         # MODIFY — add the 2-month early-renewal grace to
                                                       #   nextMembershipYearEnd (shared by door + online + /join)
src/server/domain/org/membershipYear.ts                # NEW — pure: "September 1 – August 31" label from the setting
tests/unit/membershipTerm.test.ts                      # UPDATE — the Jul/Aug window now rolls to next year
# ⚠️ re-check expiry assertions in: gate.membership.test.ts, exports.throughYear.test.ts,
#    exports.member.test.ts, door.attendance-match.test.ts (payments dated Jul 1–Aug 31)
src/server/validation/officers.ts                      # NEW — Zod: setOfficer (roleKey ∈ registry, contactId uuid|null)
src/server/validation/content.ts                       # reserve "contact","board" (protect the dedicated routes)
src/server/db/schema/clubSettings.ts                   # drop the "PLACEHOLDER" caveat (FR-003 confirmed)
src/server/lib/audit.ts                                # + officer.set AuditEvent kind

src/app/api/officers/route.ts                          # NEW — GET assignments + POST set (content.write)
src/app/(admin)/officers/page.tsx                      # NEW — assign a contact to each board role (ContactPicker)

src/app/(public)/contact-us/page.tsx (+ .module.css)   # NEW — MERGED directory: all roles + officer names +
                                                       #        051 CMS block ("contact-info"). No /board page.
src/app/(public)/_components/ContactList.tsx           # NEW — presentational (role · name? · alias) — jsdom-testable
src/app/(public)/_components/DonateButton.tsx          # NEW — PayPal donation affordance (footer + /join)
src/app/(public)/join/page.tsx                         # content-complete: tiers + year + benefits + donate
src/app/(public)/_components/Footer.tsx                # + "About" group (Contact, Board) + Donate
src/app/PublicNav.tsx (+ .module.css)                  # wordmark → responsive logo (icon/logotype), alt, home link
src/app/layout.tsx                                     # metadata.icons → favicons

tests/unit/clubRoles.test.ts · membershipYear.test.ts
tests/integration/officers.test.ts · officers.authz.test.ts
tests/component/footer.test.tsx (update) · publicNav.test.tsx (update)
tests/component/contactList.test.tsx · joinPage.test.tsx   # (boardList removed — board merged into contact-us)
```

**Structure Decision**: Single web app. Load-bearing choices: (1) **one committed role registry** feeds the
`/contact-us` directory so aliases live once; (2) the **PII-gated projection type** (name + role + alias, no
contact PII) — the same discipline as the 053 performer gate; (3) the contact CMS block is **embedded by slug**
(`contact-info`) inside the dedicated `/contact-us` route, which is **reserved** so a CMS page can't shadow it.

## Complexity Tracking

No constitution violations; no entries.

## Phase 0 — Research

See [research.md](research.md): the registry-vs-table split, the PII gate, the CMS-block slug/route-collision
resolution, the officer-admin capability (`content.write`), the membership-year derivation, the PayPal donation
destination (pre-rollout config), and the responsive-logo + favicon wiring.

## Phase 1 — Design & Contracts

- [data-model.md](data-model.md) — migration `0038`, the `officers` table, the committed role registry shape.
- [contracts/org-cluster.md](contracts/org-cluster.md) — the officer service + projection, the admin API, the
  page/registry contracts, and the test contracts.
- [quickstart.md](quickstart.md) — end-to-end validation mapped to SC-001…007.
- Agent context: `CLAUDE.md` SpecKit plan reference updated to this plan.
