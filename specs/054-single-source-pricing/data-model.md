# Data Model: Single-source admission pricing (P7-R10)

Additive migration **`0037_admission_pricing.sql`** (latest is `0036`). One new table + one series column. No
change to `events` (`advertised_price_cents` from 018 is reused as the flat override). `IF NOT EXISTS` so
re-run is safe.

## Migration `0037`

```sql
-- Admission pricing: series-scoped, effective-dated sliding-scale tiers. A "revision" is the batch of tiers
-- sharing one effective_date; an event resolves the batch with the greatest effective_date <= its date.
CREATE TABLE IF NOT EXISTS admission_prices (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id      uuid NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  label          text NOT NULL,
  amount_cents   integer NOT NULL,
  sort_order     integer NOT NULL DEFAULT 0,
  effective_date date NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admission_prices_series_date_idx
  ON admission_prices (series_id, effective_date);

-- Standing-schedule sentence (curated text; no recurrence engine). DST-dependent English time authored here.
ALTER TABLE series ADD COLUMN IF NOT EXISTS schedule_sentence text;
```

Snapshot `zak1_dev` first, then `pnpm run db:migrate`. Add `admission_prices` to the test `resetDb()` TRUNCATE
list; `series` is already reset by re-seed.

## Drizzle schema

- `src/server/db/schema/admissionPrices.ts` (NEW): mirror the table; export `admissionPrices`,
  `AdmissionPriceRow`. Export from the schema index.
- `src/server/db/schema/events.ts`: `series` gains `scheduleSentence: text("schedule_sentence")` (nullable).

## Entities

### AdmissionPrice (row = one tier of one revision)

| Field | Type | Rule |
|-------|------|------|
| `seriesId` | uuid | FK → series (cascade) |
| `label` | text | non-empty (e.g. "Supporter", "Dancer", "Student", "Family cap", "Musicians") |
| `amountCents` | int | `≥ 0` (0 = free, e.g. musicians) |
| `sortOrder` | int | display order within the revision |
| `effectiveDate` | date | `YYYY-MM-DD`; all tiers of one revision share it |

**Resolution rule** (`resolveAdmissionTiers(db, seriesId, onDate)`): let `d` = max `effective_date ≤ onDate`
for `seriesId`; return every row with `effective_date = d`, ordered by `sort_order`. No such `d` → `[]`.

### Per-event override (reused `events.advertised_price_cents`)

- Non-null → the event's price is a **flat** `advertised_price_cents` (a special). Null → the event uses the
  resolved series tiers. (No schema change.)

### series.schedule_sentence

- Nullable curated text; rendered on the landing. Not machine-parsed.

## Derived (not stored)

### PublicPricing (public projection value)

```ts
type PublicPricing =
  | { kind: "flat"; amount: number }                               // dollars
  | { kind: "tiers"; tiers: { label: string; amount: number }[] }  // dollars, ordered
  | null;
```

- `resolveEventPricing(db, { seriesId, eventDate, advertisedPriceCents })`:
  `advertisedPriceCents != null → { flat }`; else tiers = resolveAdmissionTiers → `tiers.length ? { tiers } : null`.
- `pricingSummary(p)` (card): `flat → "$X"` (or `"Free"` if the flat amount is 0); `tiers → "$min–$max"` over
  distinct **non-zero** amounts (single → "$X"); a non-empty tier set that is **all `$0`** → `"Free"` (not
  blank — configured-free ≠ unconfigured); `null → null`. Detail/landing render the full `tiers` (including any
  `$0` tier).

## Audit

- New `AuditEvent` kind `admission_pricing.set`. `setAdmissionPricing` and `setScheduleSentence` call
  `recordAudit(db, { kind, actorContactId, details })` (details: seriesId, effectiveDate, tier count / sentence
  length) — an `audit_events` row per change (FR-008). No dedicated audit table.

## Lifecycle

- Append-only revisions: a price change **inserts** a new batch (new `effective_date`); prior revisions are
  retained (history). Reordering/removing tiers happens within a new revision, never by mutating an old one.
