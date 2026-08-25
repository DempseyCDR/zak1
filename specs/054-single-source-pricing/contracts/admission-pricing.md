# Contracts: Single-source admission pricing (P7-R10)

Three surfaces: (A) the **pricing service** (resolution + writes), (B) the **public projection** value every
render consumes, and (C) the **admin API** (extends nothing — new routes gated by `parameter.write`).

## A. Pricing service — `src/server/domain/pricing/admissionPricingService.ts`

```ts
export type AdmissionTier = { label: string; amountCents: number; sortOrder: number };

/** Tiers effective on/before `onDate` for a series (the latest revision), ordered; [] if none. */
export function resolveAdmissionTiers(db: DbOrTx, seriesId: string, onDate: string): Promise<AdmissionTier[]>;

/** Insert a new revision (a batch of tiers sharing `effectiveDate`) + audit. Replaces nothing; append-only. */
export function setAdmissionPricing(
  db: Db,
  input: { seriesId: string; effectiveDate: string; tiers: { label: string; amountCents: number }[] },
  actor: Actor,
): Promise<void>;

/** All revisions for a series (grouped by effective_date, tiers ordered) — for the admin. */
export function listAdmissionRevisions(db: Db, seriesId: string): Promise<
  { effectiveDate: string; tiers: AdmissionTier[] }[]
>;

/** Set/clear a series' curated schedule sentence + audit. */
export function setScheduleSentence(db: Db, seriesId: string, sentence: string | null, actor: Actor): Promise<void>;
```

- `sort_order` is assigned from the tiers' array order on write.
- Both writers `recordAudit(kind: "admission_pricing.set")`.

## B. Public projection — `src/server/domain/public/publicPricing.ts`

```ts
export type PublicPricing =
  | { kind: "flat"; amount: number }
  | { kind: "tiers"; tiers: { label: string; amount: number }[] }
  | null;

/** Override wins; else series tiers for the date; else null. Amounts converted cents→dollars. */
export function resolveEventPricing(
  db: DbOrTx,
  input: { seriesId: string; eventDate: string; advertisedPriceCents: number | null },
): Promise<PublicPricing>;

/** Concise card label: flat → "$12"; tiers → "$5–$15" (distinct non-zero amounts); null → null. */
export function pricingSummary(p: PublicPricing): string | null;
```

**Guarantees**
- The card summary and the detail tiers are both derived from the same `PublicPricing`, so they never disagree
  (SC-001).
- No configured pricing and no override → `null` → no price rendered (never `$0`) (FR-006/SC-005).

### Projection wiring — `publicSchedule.ts`

- `PublicScheduleItem` (cards) and `PublicEventDetail`: replace `advertisedPrice: number | null` with
  `pricing: PublicPricing` (resolved via `resolveEventPricing`, needing `seriesId` + `eventDate` +
  `advertisedPriceCents`, all already selected/joinable).
- `listPublicEvents` / `getPublicEventDetail` call `resolveEventPricing` per event.

## C. Admin API (new routes, `requires: "parameter.write"`)

| Route | Method | Body | Effect |
|-------|--------|------|--------|
| `/api/admission-pricing?series=<id>` | GET | — | `listAdmissionRevisions` |
| `/api/admission-pricing` | POST | `{ seriesId, effectiveDate, tiers:[{label,amountCents}] }` | `setAdmissionPricing` |
| `/api/admission-pricing/schedule` | POST | `{ seriesId, sentence: string \| null }` | `setScheduleSentence` |

Validation (`validation/admissionPricing.ts`, Zod): `effectiveDate` `YYYY-MM-DD`; `tiers` non-empty array of
`{ label: non-empty, amountCents: int ≥ 0 }`; `sentence` string or null. 422 on invalid; scope enforced by
`parameter.write` (treasurer/FS scoped, organizer/super_user global).

## D. Landing & components

- `PricingBlock.tsx` (NEW): renders `PublicPricing` — `tiers` as a labeled list, `flat` as one price, `null`
  as nothing. Used on the event detail page and the series landing.
- `EventCard.tsx`: render `pricingSummary(item.pricing)` (was `advertisedPrice`).
- `(public)/dances/[style]/page.tsx`: resolve the series' tiers **as of today** → `PricingBlock`; render
  `series.schedule_sentence`.
- `landingContent.ts`: delete the hard-coded "Cost: $5…" line (FR-011).

## Test contracts

- **Unit** (`tests/unit/publicPricing.test.ts`): `resolveEventPricing` — override wins, series tiers by date,
  none→null; `pricingSummary` — flat, range over distinct non-zero, single, null. (Pure over injected tiers.)
- **Integration** (`tests/integration/admissionPricing.test.ts`, real Postgres): seed two revisions at
  different effective dates → an event before vs on/after resolves the right tiers; an event with
  `advertised_price_cents` set → flat override wins; a series with no pricing → null; `setAdmissionPricing`
  writes an `audit_events` row.
- **Integration authz** (`tests/integration/admissionPricing.authz.test.ts`): `POST /api/admission-pricing`
  refuses a base-only actor (403) and allows a `parameter.write` actor.
- **Component** (`tests/component/pricingBlock.test.tsx`, jsdom): `PricingBlock` renders a tier list, a flat
  price, and nothing for null; a card shows the summary string.
