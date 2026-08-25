# Contracts: Org cluster (P7-R12)

Surfaces: (A) the club-role registry, (B) the officer service + PII-gated projection, (C) the admin API,
(D) the public pages + folded-in polish, and the test contracts.

## A. Club-role registry — `src/server/domain/org/clubRoles.ts`

```ts
export type ClubRole = { key: string; roleName: string; emailAlias: string; isBoardSeat: boolean; order: number };
export const CLUB_ROLES: readonly ClubRole[];
export const BOARD_ROLES: readonly ClubRole[];        // isBoardSeat, ordered
export function isRoleKey(k: string): boolean;
export function isBoardRoleKey(k: string): boolean;    // key exists AND isBoardSeat
```

Rules: unique keys; unique `order`; every `emailAlias` matches `^[a-z0-9._-]+@cdrochester\.org$`.

## B. Officer service — `src/server/domain/org/officerService.ts`

```ts
export type PublicOfficer = { roleName: string; emailAlias: string; name: string | null };

/** Board page: every board-seat role (registry order) with its officer's display name (null if vacant). */
export function listBoardOfficers(db: Db): Promise<PublicOfficer[]>;

/** Admin read: current assignments (roleKey → contactId + name) for the officer editor. */
export function listOfficerAssignments(db: Db): Promise<{ roleKey: string; contactId: string; name: string }[]>;

/** Assign (upsert) or clear (contactId=null) the holder of a board-seat role. Scoped + audited. */
export function setOfficer(
  db: Db,
  roleKey: string,
  contactId: string | null,
  actorContactId: string | null,
): Promise<void>;
```

**Guarantees**
- `listBoardOfficers` returns **only** name + role + alias — no contact email/phone/PII on the type.
- `setOfficer` rejects a `roleKey` that is not a board-seat registry key (422).
- `contactId=null` deletes the assignment (vacant seat).
- Writes `recordAudit(kind: "officer.set")`.

## C. Admin API — `src/app/api/officers/route.ts` (`requires: "content.write"`)

| Route | Method | Body | Effect |
|-------|--------|------|--------|
| `/api/officers` | GET | — | `listOfficerAssignments` (+ the board-role list for the editor) |
| `/api/officers` | POST | `{ roleKey, contactId: string \| null }` | `setOfficer` |

Validation (`validation/officers.ts`, Zod): `roleKey` non-empty (service enforces board-seat membership),
`contactId` uuid or null. 422 on invalid; `content.write` (webmaster/super_user).

## D. Public pages, components & polish

- **`(public)/contact/page.tsx`** — server page: render `CLUB_ROLES` as a `roleName → emailAlias` (mailto)
  list via `<ContactList>` (server-rendered, no JS), then `getContentPageBySlug("contact-info")` →
  `renderMarkdown(publishedBody)` in a prose block **below** (omitted when null). FR-005/006/014.
- **`(public)/board/page.tsx`** — server page: `listBoardOfficers(db)` → `<BoardList>` (role + name + alias
  mailto). FR-007. One H1.
- **`ContactList.tsx` / `BoardList.tsx`** — presentational (jsdom-testable); aliases as `mailto:` links.
- **`DonateButton.tsx`** — the PayPal donation affordance (constant destination; `target="_blank"
  rel="noopener noreferrer"`, label "Donate"); reused by footer + `/join`. FR-004.
- **`(public)/join/page.tsx`** — content-complete: the four tiers + amounts, the membership-year label
  (`membershipYearLabel(membership_year_end)`), a benefits summary, and `<DonateButton>` — **keeping** the
  019 capture→PayPal dues flow unchanged. FR-001/002/003.
- **`Footer.tsx`** — add an **"About"** group linking `/contact` and `/board`, and swap the "Support the
  club" link for `<DonateButton>` (or a Donate link). FR-008.
- **`PublicNav.tsx` (+ css)** — replace the text wordmark with the responsive logo: `CDR_Icon.svg` (narrow) /
  `CDR_Logotype_4Color.svg` (wide) via CSS width breakpoints, `alt="Country Dancers of Rochester"`, link → `/`,
  ≥44px tap target. FR-009/010, US5.
- **`layout.tsx`** — `metadata.icons` → `/favicon.ico` (+ `/favicon.png`, `/favicon-96x96.png`). FR-009.
- **`validation/content.ts`** — add `"contact"`, `"board"` to `RESERVED_SLUGS`.
- **`membershipYear.ts`** — `membershipYearLabel(monthDay: string): string` (e.g. `"08-31"` →
  `"September 1 – August 31"`).
- **`membershipTerm.ts` (MODIFY)** — `nextMembershipYearEnd(paymentDate, boundaryMMDD)` now returns the next
  boundary on/after **`addMonths(paymentDate, 2)`** (a `EARLY_RENEWAL_GRACE_MONTHS = 2` constant), granting the
  2-month early-renewal grace to every dues payment. Shared by door + online enrollment + `/join`.

## Test contracts

- **Unit** `tests/unit/clubRoles.test.ts`: registry integrity — unique keys/orders; every alias matches the
  `@cdrochester.org` role-alias pattern; `BOARD_ROLES` are the `isBoardSeat` subset in order; `isBoardRoleKey`.
- **Unit** `tests/unit/membershipYear.test.ts`: `membershipYearLabel("08-31") === "September 1 – August 31"`
  (and another boundary).
- **Unit** `tests/unit/membershipTerm.test.ts` (UPDATE): the 2-month grace — `nextMembershipYearEnd("2026-07-01",
  "08-31") === "2027-08-31"` and `("2026-06-30","08-31") === "2026-08-31"` (window edge); existing outside-window
  cases unchanged. Re-check enrollment integration tests with Jul 1–Aug 31 payment/event dates.
- **Integration** `tests/integration/officers.test.ts` (real Postgres): `setOfficer` upserts/clears; a
  reassign replaces the holder; `listBoardOfficers` returns board seats in order with the assigned name (null
  when vacant) and **no contact-PII field**; a non-board `roleKey` is rejected; an audit row is written.
- **Integration** `tests/integration/officers.authz.test.ts`: `POST /api/officers` refuses a base-only actor
  (403, names `content.write`) and allows a `content.write` actor.
- **Component** (jsdom): `boardList.test.tsx` (role + name + alias mailto; vacant seat renders role+alias, no
  name; no PII text), `contactList.test.tsx` (aliases as mailto, server-rendered text present),
  `joinPage.test.tsx` (tiers + amounts + year label render), `footer.test.tsx` (About group + Donate — update),
  `publicNav.test.tsx` (logo img with alt "Country Dancers of Rochester", link href `/` — update).
