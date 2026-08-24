# Contracts: Public performer rosters (P7-R9)

Two surfaces: (A) the **public read** projection (server functions consumed by the roster page and the
event lineup) and (B) the **admin write** payloads (extended fields on existing performer/band PATCH/POST
routes). No new HTTP routes for the public read — it is server-rendered from the projection module.

## A. Public projection — `src/server/domain/public/publicPerformers.ts`

```ts
import type { PromoLink } from "./promoLinks";

export type PublicBand = {
  bandId: string;
  name: string;
  bio: string | null;
  photoUrl: string | null;
  styles: string[];
  links: PromoLink[];
  members: { name: string; isLead: boolean; instrument: string | null }[];
};

export type PublicCaller = {
  performerId: string;
  name: string;
  bio: string | null;
  photoUrl: string | null;
  styles: string[];
  links: PromoLink[];
};

/** Publicly exposable predicate — band: is_public AND not archived. */
export function isBandPublic(b: Pick<BandRow, "isPublic" | "archivedAt">): boolean;

/** Publicly exposable predicate — caller: is_public AND is_caller. */
export function isCallerPublic(p: Pick<PerformerRow, "isPublic" | "isCaller">): boolean;

/** All exposable bands (roster), name-ordered; optional style filter. */
export function listPublicBands(db: Db, style?: string): Promise<PublicBand[]>;

/** All exposable callers, name-ordered; optional style filter. */
export function listPublicCallers(db: Db, style?: string): Promise<PublicCaller[]>;
```

**Guarantees**
- Neither function selects any contact column; the return types have no contact field (PII cannot leak).
- `style` filter: when provided and one of the known styles, returns only entries whose `styles` contains
  it (`style = ANY(styles)`); when absent/unknown, returns the full roster (no filtering).
- Ordering: by `name` / `display_name` ascending, stable.
- Archived bands and `is_public=false` entries are never returned.

## B. Promo-link validation — `src/server/domain/public/promoLinks.ts`

```ts
export const PROMO_LINK_TYPES = [
  "website", "facebook", "instagram", "youtube", "bandcamp", "spotify", "other",
] as const;

export type PromoLink = { type: (typeof PROMO_LINK_TYPES)[number]; url: string };

export const promoLinkSchema: z.ZodType<PromoLink>;   // type ∈ enum; url absolute; scheme http|https
export const promoLinksSchema: z.ZodType<PromoLink[]>; // array; default []
```

**Rules**
- `url` MUST parse as an absolute URL AND have protocol `http:` or `https:`. `javascript:`, `data:`,
  `mailto:`, `ftp:`, relative, and malformed URLs are rejected.
- Validation runs at the write boundary (create + patch on both bands and performers); an invalid link
  makes the whole write fail 422 with a clear message — no partial/unsafe store.

## C. Style validation

```ts
export const STYLE_TAGS = ["contra", "english", "community"] as const;
export const stylesSchema: z.ZodType<string[]>; // array of STYLE_TAGS members; default []
```

## D. Admin write payload extensions (existing routes, `requires: "performer.write"`)

`validation/performers.ts` — `performerCreateSchema` / `performerPatchSchema` gain:

| Field | Type | Notes |
|-------|------|-------|
| `isPublic` | `boolean?` | opt-in visibility |
| `isCaller` | `boolean?` | caller designation |
| `styles` | `stylesSchema?` | replaces the set |
| `links` | `promoLinksSchema?` | replaces the set; 422 on bad scheme |

`validation/bands.ts` — `bandCreateSchema` / `bandPatchSchema` gain `isPublic?`, `styles?`, `links?`;
band-member input gains `instrument?: string | null`.

**Authorization**: unchanged — `performer.write` (booker-scoped; organizer/super_user global). Contact
PII remains behind `contact.pii.read` and is untouched here.

## E. Lineup projection additions (US3)

- `PublicBandBlock` += `bandId: string`, `onPublicRoster: boolean` (= `isBandPublic` = `is_public &&
  archived_at IS NULL`); members += `instrument: string | null`.
- `PublicPerformer` `full_bio` += `performerId: string`, `onPublicRoster: boolean` (= `isCallerPublic` =
  `is_public && is_caller`).
- `Lineup.tsx`: render name as `<a href="/performers#band-<id>">` / `#caller-<id>` **iff `onPublicRoster`**,
  else plain text. The flag reuses the exact roster-inclusion predicate, so a link never points at a missing
  anchor (FR-005 / SC-006).

## Test contracts

- **Unit** (`tests/unit/promoLinks.test.ts`): `promoLinkSchema` accepts `https://`/`http://`; rejects
  `javascript:`, `data:`, `mailto:`, relative, malformed; `stylesSchema` accepts known styles, rejects
  unknown. (Fails until the schema exists.)
- **Integration** (`tests/integration/publicPerformers.test.ts`, real Postgres): seed a public band with
  links + styles + a member with an instrument, a non-public band, an archived public band, a public
  caller, a non-public caller, and a public performer who is NOT a caller. Assert `listPublicBands`
  returns only the public non-archived band (with instrument), `listPublicCallers` returns only the
  public caller; the style filter narrows correctly; and **no contact field** is present on any result.
  (Fails until `publicPerformers.ts` exists.)
- **Component** (`tests/component/roster.test.tsx`, jsdom): the roster renders a band with a promo link as
  `<a rel="noopener noreferrer nofollow" target="_blank">`; a private/name-only case renders no PII; an
  entry with no photo renders without a broken image. (Fails until the page/components exist.)
