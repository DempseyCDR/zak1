# Research: Org cluster (P7-R12)

All items resolved; no NEEDS CLARIFICATION remain. The scope decisions were locked in `/speckit-clarify`
(spec §Clarifications, 2026-08-25); this file records the mechanism choices that follow.

## R1 — One committed club-role registry (roles + aliases)

**Decision**: A committed TS registry `src/server/domain/org/clubRoles.ts` — `CLUB_ROLES: { key, roleName,
emailAlias, isBoardSeat, order }[]` — is the single source for both org pages. The contact directory lists
`roleName → emailAlias`; the board page shows each `isBoardSeat` role's name + alias.

**Rationale**: Aliases (`vicepresident@cdrochester.org`, `treasurer@…`, `contrabooking@…`) are stable club
email config — rarely changing, well-suited to version-controlled committed data (mirrors 050's
`landingContent.ts`). Keeping roles+aliases in one place means the two pages can't disagree.

**Alternatives**: a DB table for aliases (overkill — they change on the order of years and are config, not
user data); 051 CMS prose for the directory (loses the structured role→alias mapping and mailto links).

## R2 — Officer designation: a small `officers` table

**Decision**: A new `officers` table maps a **board-seat role → the contact** holding it (`role_key` unique,
`contact_id` FK, timestamps). Staff assign/clear via a `content.write` admin. The board page joins registry
board-seats → `officers` → `contacts` for the person's name.

**Rationale**: The *person* rotates annually (unlike the alias), so it is **data**, not committed — hardcoding
contact UUIDs would need a deploy each year. One row per office (`role_key` unique). The registry supplies
role name/alias/order; the table supplies only the assignment.

## R3 — PII-gated board projection

**Decision**: `PublicOfficer = { roleName; alias; name: string | null }` (dollars n/a). `listBoardOfficers`
SELECTs only `contacts.first_name`/`last_name` (→ a display name) for assigned roles; the type has **no**
email/phone/contact field. Unassigned board seats render with `name: null` (role + alias still shown, or the
role is simply listed without a person). Mirrors the 053 performer gate: the gate lives in the projection type.

**Rationale**: Board members are contacts with real PII (email/phone); FR-007 requires names only. Carrying
the gate in the type means a renderer can't leak PII.

## R4 — Contact CMS block: embed by slug, reserve the route names

**Decision**: The `/contact` page renders a curated 051 content page **by a fixed slug `contact-info`**
(`getContentPageBySlug` → `renderMarkdown`, published-only; omitted when absent). Add **`contact` and `board`**
to `RESERVED_SLUGS` so no CMS page can be created that would be shadowed by (or collide with) the dedicated
`/contact` and `/board` routes.

**Rationale**: Next.js static routes (`(public)/contact/page.tsx`) win over the 051 dynamic `(public)/[slug]`,
so `/contact` is safe. Using a **distinct** slug (`contact-info`) for the embedded block avoids any collision
with the dedicated route; reserving `contact`/`board` prevents a webmaster from creating a conflicting page.
The block is also independently viewable at `/contact-info` (harmless — same curated text); if that ever
matters, a later change can make the catch-all skip embedded slugs (deferred, YAGNI).

## R5 — Officer-admin capability: reuse `content.write`

**Decision**: The officer-assignment admin + API are gated by **`content.write`** (already held by webmaster +
super_user, the public-content curators). No new capability. The admin uses the existing `ContactPicker`
(PII-free, `base`-gated search) to pick the person; assigning is `content.write`; writes `recordAudit`
(`officer.set`).

**Rationale**: Board/officers is public-facing content the webmaster owns, exactly like the 051 pages. Contact
PII stays behind `contact.pii.read`; picking a contact by id needs only the PII-free search.

## R6 — Membership year + the 2-month early-renewal grace (corrects feature 019)

**Decision** *(clarified 2026-08-25)*: A dues payment's expiry = the club year-end boundary **at least ~2
months after** the payment — i.e. `nextMembershipYearEnd(paymentDate + 2 months)`. A payment in the final two
months (on/after ~Jul 1 for an 08-31 boundary) rolls to the **next** Aug 31, granting an early-renewal grace;
applies to **everyone** paying in the window (new + renewal). This is folded **into the existing shared
`nextMembershipYearEnd`** (`src/server/domain/membership/membershipTerm.ts`), so **online capture**
(`captureService`), **door enrollment** (`doorRecordService`), and the public **`/join`** page all use the one
corrected calculation.

- `/join` displays the coverage-through date via the same function (`nextMembershipYearEnd(today, setting)`) —
  FR-016 — plus the recurring "September 1 – August 31" label derived from the setting; the `clubSettings.ts`
  "PLACEHOLDER" caveat is removed (FR-003).
- **Implementation**: add `EARLY_RENEWAL_GRACE_MONTHS = 2` and an `addMonths(date, n)` (clamped) helper;
  `nextMembershipYearEnd` returns the next boundary on/after `addMonths(paymentDate, 2)`.

**⚠️ Blast radius** (this corrects live behavior, not just R12): update `tests/unit/membershipTerm.test.ts`
(the July case now → next year) and re-check any integration test that asserts a membership **expiry** for a
payment/event dated in the **Jul 1 – Aug 31** window — candidates: `gate.membership.test.ts`,
`exports.throughYear.test.ts`, `exports.member.test.ts`, `door.attendance-match.test.ts`. Payments outside
that window are unaffected.

**Rationale**: One shared calc means the public page can never misstate coverage vs what enrollment grants;
the door/online renewal no-op check (`maxExpiry >= targetExpiry`) automatically does early renewal correctly
once the boundary is corrected.

## R6b — Membership tiers display

The four tiers (Supporter $50+, Family $30, Individual $20, Student $10) are page content on `/join`; the
membership-year label + coverage-through date come from R6. One source (FR-012/SC-007).

## R7 — Membership tiers & payment (default)

**Decision**: The four tiers (Supporter $50+, Family $30, Individual $20, Student $10) are **page content**
displayed on `/join`; payment keeps the **existing single PayPal hosted button** (feature 019) — the member
pays the correct amount in PayPal. No tier data model, no per-tier buttons (clarify default, not revisited).

**Rationale**: Dues change rarely and are distinct from admission pricing (054); YAGNI on a data model / four
hosted buttons.

## R8 — Donate affordance (PayPal donation)

**Decision**: A `DonateButton` component points at the club's PayPal **donation** destination, reused by the
footer and `/join`, opened as a safe outbound action (`target="_blank" rel="noopener noreferrer"`), visibly
labelled "Donate" (distinct from "Pay dues"). The exact donation button/URL is a **pre-rollout config value**
(carried from Phase 6; the audit lists the WP donate button) — wired as a single constant to set when the
production PayPal account goes live.

**Rationale**: FR-004 needs a distinct donate path now; going live with the production account is a separate
rollout task (spec Out of Scope). One constant keeps the pre-rollout swap trivial.

## R9 — Favicons & the responsive logo (folded-in polish)

**Decision**: (a) Wire the committed favicons via Next `metadata.icons` in `layout.tsx` (`/favicon.ico`
default + `/favicon.png`, `/favicon-96x96.png`). (b) Replace the header text wordmark with the **responsive
logo**: `CDR_Icon.svg` on narrow viewports, `CDR_Logotype_4Color.svg` on wide (CSS show/hide by width),
**image-only** with `alt="Country Dancers of Rochester"`, the link targeting `/` (already changed), keeping a
≥44px tap target. Both SVGs are SVGO-optimized (done, verified visually identical).

**Rationale**: The icon stays legible small (logomark), the logotype shines wide; single-theme site (no dark
mode) so the 4-color art on cream is safe (verified in review). Alt text carries the club name (FR-009/FR-010,
US5).
