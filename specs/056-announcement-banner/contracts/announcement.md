# Contracts: Site-wide announcement banner (P7-R13)

Surfaces: (A) the service (pure active-check + reads + writes), (B) the public projection, (C) the admin API,
(D) the layout mount + banner component, and the test contracts.

## A. Service — `src/server/domain/announcements/announcementService.ts`

```ts
export type AnnouncementLevel = "info" | "urgent";
export type PublicAnnouncement = {
  id: string;
  text: string;
  level: AnnouncementLevel;
  link: { label: string; url: string } | null;
};

/** Pure: active iff not cleared AND now is before posted_at + duration_hours. (Unit-tested at the boundary.) */
export function isAnnouncementActive(
  row: Pick<AnnouncementRow, "postedAt" | "durationHours" | "clearedAt">,
  now: Date,
): boolean;

/** The current active announcement (latest row if active), as a display-safe projection; else null. */
export function getActiveAnnouncement(db: DbOrTx): Promise<PublicAnnouncement | null>;

/** The current row (active or not) for the admin editor — includes duration/level/link for prefill. */
export function getCurrentForAdmin(db: Db): Promise<AnnouncementRow | null>;

/** Post a new current announcement (supersedes; window starts now). Audited. */
export function postAnnouncement(
  db: Db,
  input: { text: string; linkLabel: string | null; linkUrl: string | null; level: AnnouncementLevel; durationHours: number },
  actorContactId: string | null,
): Promise<void>;

/** Clear the current announcement early (cleared_at = now on the latest row). Audited. No-op if none. */
export function clearAnnouncement(db: Db, actorContactId: string | null): Promise<void>;
```

**Guarantees**
- `getActiveAnnouncement` returns only display-safe fields; `null` when nothing is active (expired/cleared/none).
- `postAnnouncement` writes `recordAudit(kind:"announcement.posted")`; `clearAnnouncement` writes
  `announcement.cleared`.

## B. Validation — `src/server/validation/announcement.ts` (Zod)

```ts
export const announcementPostSchema = z.object({
  text: z.string().trim().min(1),
  level: z.enum(["info", "urgent"]).default("info"),
  durationHours: z.number().int().min(1).max(720).default(24),
  link: z.object({ label: z.string().trim().min(1), url: httpUrl }).nullable().default(null),
});
```

- `httpUrl`: absolute URL whose protocol is `http`/`https` (same refine as `promoLinks`); every other scheme
  rejected. A `link` requires **both** `label` and `url` (or `null`).

## C. Admin API — `src/app/api/announcement/route.ts` (`requires: "content.write"`)

| Method | Body | Effect |
|--------|------|--------|
| GET | — | `getCurrentForAdmin` (+ whether it's currently active) for the editor |
| POST | `{ text, level, durationHours, link: {label,url} \| null }` | `postAnnouncement` (validate; 422 on bad scheme/empty) |
| DELETE | — | `clearAnnouncement` |

`content.write` (Webmaster / super_user). The **public** read does NOT use this route — the `(public)` layout
calls `getActiveAnnouncement(db)` server-side.

## D. Layout mount + banner

- **`src/app/(public)/layout.tsx`** (MODIFY → async server component): `const a = await
  getActiveAnnouncement(db);` render `{a ? <AnnouncementBanner announcement={a} /> : null}` **above**
  `{children}`. (Wraps every public page; never admin/door.)
- **`AnnouncementBanner.tsx`** (NEW, client): renders the text and, if present, the link
  (`target="_blank" rel="noopener noreferrer"`); `role="alert"` when `level==="urgent"`, else `role="status"`
  `aria-live="polite"`. A keyboard-operable **Dismiss** button writes `localStorage["cdr.announcement.dismissed"]
  = announcement.id`; on mount, if that equals the current id, it hides itself. Text is present in SSR HTML
  (no-JS sees it); dismissal is the only client behavior. Mobile-first, wraps, no h-scroll.

## Test contracts

- **Unit** `tests/unit/announcementActive.test.ts`: `isAnnouncementActive` — active just before
  `posted_at+duration`, inactive just after (SC-008 boundary), inactive when `clearedAt` set; and
  `announcementPostSchema` — text required, `link.url` rejects `javascript:`/`data:`/relative, accepts
  `https:`, `level` enum, `durationHours` bounds/default.
- **Integration** `tests/integration/announcement.test.ts` (real Postgres): `postAnnouncement` inserts +
  `getActiveAnnouncement` returns the projection (link/level), a second post **supersedes** (latest wins),
  `clearAnnouncement` makes it inactive, an announcement past its duration resolves to `null`; each write emits
  an `audit_events` row.
- **Integration** `tests/integration/announcement.authz.test.ts`: `POST`/`DELETE /api/announcement` refuse a
  base-only actor (403, names `content.write`) and allow a `content.write` actor.
- **Component** `tests/component/announcementBanner.test.tsx` (jsdom): renders text + `urgent`→`role="alert"`,
  a safe outbound link, dismiss hides it and writes the id to `localStorage`; a pre-seeded matching dismissal
  hides on mount. (The banner prop is a non-null `PublicAnnouncement`; the `(public)` layout owns the empty
  case via `{a ? <AnnouncementBanner …/> : null}`, covered by the integration/quickstart null path — the
  component is not asked to render "nothing".)
