# Phase 1 Data Model: Static content pages / lightweight CMS (P7-R7)

**Additive migration `0034_content_pages.sql`** — one new table, no destructive change. First migration since
`0033`. Audit uses the existing `audit_events` (no new audit table).

## `content_pages` — new table

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK (default random) | |
| `slug` | `text` **unique, not null** | URL-safe (lowercase, `[a-z0-9-]`), not a `RESERVED_SLUG`; the public URL is `/<slug>` |
| `title` | `text` not null | the page `<h1>`; edited in place |
| `draft_body` | `text` not null | the Markdown the Webmaster edits and previews |
| `published_body` | `text` **nullable** | the Markdown the public sees; null until first publish; retained on unpublish |
| `published` | `boolean` not null default `false` | public visibility; `true` ⇒ the `/<slug>` page shows `published_body` |
| `summary` | `text` nullable | optional short meta/description for the page head |
| `created_at` | `timestamptz` not null default now | |
| `updated_at` | `timestamptz` not null default now | bumped on every write |

Indexes/constraints: `UNIQUE (slug)`. (Slug lookups for the public read hit the unique index.)

## State & transitions

- **Create** → row with `draft_body` set, `published_body = null`, `published = false`. Not public yet.
- **Edit** (`PATCH`) → updates `title` / `draft_body` / `summary`; **never** touches `published_body` or
  `published`. The public page is unchanged.
- **Publish** → `published_body := draft_body`, `published := true`, `updated_at := now`. Now public.
- **Unpublish** → `published := false` (keeps `published_body`). The public `/<slug>` returns not-found.
- **Delete** → row removed; `/<slug>` returns not-found.

Invariants:

- The public read (`getContentPageBySlug`) returns a page **only when `published`**, and exposes
  **`published_body`** (never `draft_body`).
- Editing `draft_body` does not change what the public sees until the next publish (clarified safety net).
- `slug` is **set on create and not editable in v1** — it is the page's public URL, so changing it would break
  the URL and any inbound links; a different URL means a **new page**. The create schema validates it
  (unique + reserved); `PATCH` accepts only `title`/`draftBody`/`summary` and never the slug. (Matches spec
  FR-002, which lists only title + draft body as editable.)

## Validation (Zod — `validation/content.ts`)

- `contentPageCreateSchema`: `slug` (lowercase `[a-z0-9-]{1,80}`, not in `RESERVED_SLUGS`), `title` (non-empty),
  `draftBody` (non-empty Markdown), `summary?`.
- `contentPagePatchSchema`: `title?`, `draftBody?`, `summary?` (all optional; at least one present).
- `RESERVED_SLUGS`: the known top-level public + app segments (`whats-on`, `what-was-on`, `join`, `dances`,
  `login`, `api`, `dev`, plus the `(admin)`/`(door)` route names) — a content page may not shadow a real route.

## Rendering (`domain/content/markdown.ts`)

- `renderMarkdown(md: string): string` — `marked` → `sanitize-html` (conservative allowlist; body headings from
  `h2`, safe links/images only, no script/style/iframe/`on*`/`javascript:`/`data:`). **The only** source of HTML
  for `dangerouslySetInnerHTML`.

## Capability & audit

- `Capability` gains **`content.write`**; `CAPABILITIES.webmaster` and `.super_user` get it (`global`).
- Audit kinds: `content.created`, `content.updated`, `content.published`, `content.unpublished`,
  `content.deleted` (each via `writeAudit`, carrying the page id/slug + actor).

## Validation rules (enforced by tests)

- `renderMarkdown` neutralizes XSS and renders safe Markdown correctly (unit).
- The service enforces the state transitions + the published-body invariant; slug unique/reserved; audit rows
  written (integration).
- Content write routes require `content.write` (route-inventory + a deny test); `/content` is in `NAV`.
