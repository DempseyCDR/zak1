# Research: Public performer rosters (P7-R9)

All items resolved; no NEEDS CLARIFICATION remain. The four scope decisions were locked in
`/speckit-clarify` (spec §Clarifications, Session 2026-08-24); this file records the storage/mechanism
choices that follow from them.

## R1 — Dance-style storage

**Decision**: A `styles text[]` column on both `bands` and `performers`, values constrained by Zod to the
club style enum `contra | english | community`. Filtering uses `style = ANY(styles)`.

**Rationale**: The style set is tiny and closed; a native Postgres text array is queryable (`ANY`, `&&`),
trivially editable, and needs no join table. Zod at the write boundary keeps the set closed (Constitution
III). Deriving style from booking history was rejected in clarification (fragile; a never-booked performer
would have no style).

**Alternatives considered**: (a) join tables `band_styles`/`performer_styles` — more tables and joins for
no benefit at this scale (YAGNI); (b) `jsonb` — arrays of scalars filter more naturally as `text[]`.

## R2 — Promotional-link storage & validation

**Decision**: A `links jsonb NOT NULL DEFAULT '[]'` column on both `bands` and `performers`, holding an
array of `{ type, url }`. A shared Zod schema (`src/server/domain/public/promoLinks.ts`) validates:
`type ∈ website | facebook | instagram | youtube | bandcamp | spotify | other`, and `url` is a valid
absolute URL whose scheme is `http` or `https` (a `.refine` rejecting every other scheme —
`javascript:`, `data:`, `mailto:`, etc.). Order is preserved.

**Rationale**: Matches the R9 doc's suggested shape; jsonb keeps it additive and owner-local. The scheme
allowlist is the single security control (self-published but rendered as public `<a href>`); enforcing it
at the write boundary means no unsafe URL is ever stored.

**Alternatives considered**: a polymorphic `promo_links` table — the R9 doc calls it "warranted only if a
cross-owner link admin/report is ever needed." It isn't (YAGNI).

## R3 — Caller identity

**Decision**: An `is_caller boolean NOT NULL DEFAULT false` on `performers`. The callers roster section
lists performers where `is_caller AND is_public`. A performer may be both a band member and a caller.

**Rationale**: Explicit and predictable (clarified). No booking-role concept exists to derive from, and
deriving would miss new/unbooked callers.

## R4 — Instruments

**Decision**: An `instrument text` (nullable) column on `band_members`. The roster and (optionally) the
event lineup show `Name — instrument` when set, name-only otherwise.

**Rationale**: R9 names "members + instruments," but no field existed. A single nullable column satisfies
it without a new entity. Feature 049's name-only members remain valid (instrument simply absent).

## R5 — Public visibility

**Decision**: An `is_public boolean NOT NULL DEFAULT false` on both `bands` and `performers`. A band is
publicly exposable iff `is_public AND archived_at IS NULL`; a caller iff `is_public AND is_caller`.
Default `false` so no performer/band record is ever exposed until staff opt in.

**Rationale**: Mirrors R8 public venues exactly — the safe default plus an explicit opt-in, carried into
the projection type so private data can't leak.

## R6 — Style filter mechanism

**Decision**: Server-rendered `?style=<contra|english|community>` on `/performers`, matching the existing
series-filter pattern (feature 037 `SeriesFilter` / R6). An unknown/absent value shows the full roster.

**Rationale**: Consistent with the site's other public filters; no client state; shareable URLs.

## R7 — Lineup → roster linking (US3)

**Decision**: The roster page is a single page with stable anchors (`id="band-<bandId>"`,
`id="caller-<performerId>"`). To render a link only when a public entry exists, thread two fields through
the existing lineup projection: `PublicBandBlock` gains `bandId` + `isPublic`; the lineup's `full_bio`
performer variant gains `performerId` + `isPublic`. `Lineup.tsx` renders the name as a link to
`/performers#band-<id>` / `#caller-<id>` only when `isPublic`, else plain text (FR-005 graceful degrade).

**Rationale**: One page (like `/directions`) is simplest; anchors avoid per-entry routes. Carrying the
public flag into the projection keeps the "no broken link" rule truthful at the type level.

**Alternatives considered**: per-performer detail pages — more routes than the directory needs now (YAGNI);
linking unconditionally — would produce dead anchors for private/absent entries (violates FR-005).

## R8 — Outbound-link safety

**Decision**: Promo links render as `<a href={url} target="_blank" rel="noopener noreferrer nofollow">`
with a platform label/icon by `type`. No `dangerouslySetInnerHTML` (the URL is an attribute value, not
markup). Scheme already allowlisted at write (R2).

**Rationale**: `noopener noreferrer` prevents reverse-tabnabbing / referrer leak; `nofollow` since these
are third-party self-published destinations. Note: the R9 doc's claim "the app uses no
`dangerouslySetInnerHTML`" is now stale (feature 051 introduced the first, for CMS markdown) — but this
feature adds none.

## R9 — Capability

**Decision**: Reuse `performer.write` (already gates both `/api/bands*` and `/api/performers*` PATCH/POST;
booker-scoped, organizer/super_user global). PII stays behind `contact.pii.read`; the public projection
never selects contact columns.

**Rationale**: No new capability is warranted; the same actors who curate performers/bands curate their
public fields.
