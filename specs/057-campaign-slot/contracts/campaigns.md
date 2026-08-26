# Contracts: Campaign / promotional slot (P7-R14)

Surfaces: (A) the service (pure active-check + pure queue-selector + reads + writes), (B) the validation, (C) the
admin API, (D) the home mount + slot component, and the test contracts.

## A. Service — `src/server/domain/campaigns/campaignService.ts`

```ts
export type PublicCampaign = {
  id: string;
  heading: string;
  blurb: string;
  image: { url: string; alt: string } | null;
  cta: { label: string; url: string };
};

/** Pure: active iff start_date <= today <= end_date (inclusive; ISO YYYY-MM-DD, lexicographic). */
export function isCampaignActive(
  row: Pick<CampaignRow, "startDate" | "endDate">,
  today: string,
): boolean;

/** Pure: of the ACTIVE rows, the one that expires first — order by (endDate, startDate, createdAt); else null.
 *  This is the SC-009 source of truth (queue + handoff), unit-tested off-DB. */
export function selectShownCampaign(rows: CampaignRow[], today: string): CampaignRow | null;

/** The campaign the home page shows now (via selectShownCampaign), as a display-safe projection; else null. */
export function getShownCampaign(db: DbOrTx): Promise<PublicCampaign | null>;

/** Admin list: every campaign + its status and whether it is the one currently shown. */
export function listCampaigns(
  db: Db,
): Promise<(CampaignRow & { status: "upcoming" | "active" | "ended"; shown: boolean })[]>;

/** Create a campaign (joins the queue). Audited. Returns the new id. */
export function createCampaign(db: Db, input: CampaignInput, actorContactId: string | null): Promise<string>;

/** Edit a campaign. Audited. Throws if not found. */
export function updateCampaign(
  db: Db, id: string, input: CampaignInput, actorContactId: string | null,
): Promise<void>;

/** Remove a campaign (delete). Audited. No-op-safe if already gone. */
export function deleteCampaign(db: Db, id: string, actorContactId: string | null): Promise<void>;
```

### Guarantees

- `getShownCampaign` returns only display-safe fields; `null` when nothing is active.
- `selectShownCampaign` never returns more than one, and its order is `(endDate, startDate, createdAt)` over the
  active subset — so when the shown campaign's `end_date` passes, the next-soonest-expiring active row is returned
  with no write (the handoff).
- `create`/`update`/`delete` write `recordAudit(kind: "campaign.created" | "campaign.updated" |
  "campaign.deleted")`.

## B. Validation — `src/server/validation/campaign.ts` (Zod)

```ts
export const campaignSchema = z.object({
  heading: z.string().trim().min(1),
  blurb: z.string().trim().min(1),
  image: z.object({ url: httpUrl, alt: z.string().trim().min(1) }).nullable().default(null),
  cta: z.object({ label: z.string().trim().min(1), url: ctaUrl }),
  startDate: isoDate,           // YYYY-MM-DD
  endDate: isoDate,
}).refine((c) => c.endDate >= c.startDate, { path: ["endDate"], message: "endDate must be on/after startDate" });
export type CampaignInput = z.infer<typeof campaignSchema>;
```

- `httpUrl`: absolute URL whose protocol is `http`/`https` (same refine as `promoLinks`).
- `ctaUrl`: an **internal path** (`^/(?!/)`) **or** `httpUrl`. Every other scheme rejected.
- `isoDate`: a `YYYY-MM-DD` string (regex + real-date check).
- Image requires **both** `url` and `alt` (or `null`).

## C. Admin API — `src/app/api/campaigns/...` (`requires: "content.write"`)

| Method | Route | Body | Effect |
|--------|-------|------|--------|
| GET | `/api/campaigns` | — | `listCampaigns` (rows + `status` + `shown`) for the editor |
| POST | `/api/campaigns` | `CampaignInput` | `createCampaign` (validate; 422 on bad scheme/empty/date order) |
| PATCH | `/api/campaigns/[id]` | `CampaignInput` | `updateCampaign` (validate; 404 if unknown) |
| DELETE | `/api/campaigns/[id]` | — | `deleteCampaign` |

`content.write` (Webmaster / super_user). The **public** read does NOT use these routes — the home page calls
`getShownCampaign(db)` server-side.

## D. Home mount + slot

- **`src/app/(public)/page.tsx`** (MODIFY): `const campaign = await getShownCampaign(db);` render
  `{campaign ? <CampaignSlot campaign={campaign} /> : null}` at the **top of the home page, above the hero**.
- **`CampaignSlot.tsx`** (NEW, **server** component — no `"use client"`, no client behavior): renders the
  heading, blurb, optional image (`<img loading="lazy" alt={image.alt}>`), and the CTA. CTA rendering: an
  internal path (`url.startsWith("/")`) → same-tab link; an external `http(s)` URL → `<a target="_blank"
  rel="noopener noreferrer">`. Text-only when `image` is null. Mobile-first, wraps, no h-scroll. Present in SSR
  HTML (FR-011).

## Test contracts

- **Unit** `tests/unit/campaignSelect.test.ts`:
  - `isCampaignActive` — inside window (start/end **inclusive**) true; day before start / day after end false.
  - `selectShownCampaign` — among several active rows returns the **earliest end date**; ties broken by earliest
    start date, then `createdAt`; excludes rows outside their window; **handoff** — advancing `today` past the
    shown row's `end_date` returns the next-soonest-expiring active row; `null` when none active; nested case (a
    short window inside a longer one) → the short one shows while active, the long one before/after.
  - `campaignSchema` — heading/blurb required; `image.url` rejects `javascript:`/`data:`/relative and requires
    `alt`; `cta.url` accepts an internal path and `https:`, rejects `javascript:`; `endDate >= startDate`.
- **Integration** `tests/integration/campaign.test.ts` (real Postgres): create/list/update/delete;
  `getShownCampaign` returns the display projection (no internal columns) and honors the queue order; two active
  campaigns → only the sooner-expiring is shown; delete the shown one → the next shows; a row past its `end_date`
  is not shown; `listCampaigns` marks `status` + the single `shown`; each write emits an `audit_events` row.
- **Integration** `tests/integration/campaign.authz.test.ts`: `POST`/`PATCH`/`DELETE` refuse a base-only actor
  (403, names `content.write`) and allow a `content.write` actor; a `javascript:` CTA → 422.
- **Component** `tests/component/campaignSlot.test.tsx` (jsdom): renders heading/blurb/CTA; an image renders
  `<img>` with the alt text; no image → text-only (no `<img>`); an internal-path CTA is a same-tab link; an
  external `http(s)` CTA is `target="_blank" rel="noopener noreferrer"`; no personal data.
