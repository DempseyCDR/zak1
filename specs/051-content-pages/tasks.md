# Tasks: Static content pages / lightweight CMS (P7-R7)

**Feature dir**: `specs/051-content-pages/` · **Branch**: `051-content-pages` (off `main`)
**Input**: plan.md, research.md, data-model.md, contracts/content-api.md, quickstart.md, spec.md

**Constitution**: Test-First (NON-NEGOTIABLE) — the test task in each area precedes its implementation task.
**Additive migration `0034`.** New deps `marked` + `sanitize-html`. Integrates with 016 capabilities, 035 nav,
the route-inventory guard, and `writeAudit`. ⚠️ The **first `dangerouslySetInnerHTML`** — only on
`renderMarkdown` output.

## Phase 1: Setup

- [X] T001 Add dependencies: `pnpm add marked sanitize-html` and `pnpm add -D @types/sanitize-html`. Confirm
  they resolve and `pnpm install` is clean.

## Phase 2: Foundational (blocking prerequisites for all stories)

- [X] T002 Migration `src/server/db/migrations/0034_content_pages.sql`: create `content_pages` (`id` uuid PK,
  `slug` text unique not null, `title` text not null, `draft_body` text not null, `published_body` text null,
  `published` boolean not null default false, `summary` text null, `created_at`/`updated_at` timestamptz).
  Additive. Snapshot `zak1_dev` first, then `pnpm run db:migrate`.
- [X] T003 Drizzle schema `src/server/db/schema/contentPages.ts` (mirror the table) and export it from the schema
  index; add `content_pages` to the test `resetDb()` TRUNCATE list (`tests/integration/helpers/db.ts`).
- [X] T004 [P] Zod `src/server/validation/content.ts`: `contentPageCreateSchema` (`slug` `[a-z0-9-]{1,80}` and
  not in `RESERVED_SLUGS`; `title` non-empty; `draftBody` non-empty; `summary?`), `contentPagePatchSchema`
  (`title?`/`draftBody?`/`summary?`, ≥1 present), and the `RESERVED_SLUGS` set (`whats-on`, `what-was-on`,
  `join`, `dances`, `login`, `api`, `dev`, + the `(admin)`/`(door)` route names).
- [X] T005 [P] Capability + nav: add `content.write` to the `Capability` union and grant it `global` to
  `webmaster` and `super_user` in `src/server/auth/capabilities.ts`; add
  `{ href: "/content", label: "Content pages", capability: "content.write" }` to `NAV` in
  `src/server/auth/nav.ts`. Update any capability-catalog test if the union change requires it.
- [X] T006 [P] Unit test `tests/unit/contentMarkdown.test.ts` (the security test): `renderMarkdown` neutralizes
  `<script>`, `<img onerror=…>`, `[x](javascript:alert(1))`, `<iframe>`, `<a href="data:…">`, and `on*`
  attributes; and renders safe Markdown (headings → `h2+`, `http(s)`/`mailto`/relative links, images with alt,
  lists, emphasis, blockquote, code) to the expected safe HTML. (Test-first — fails until T007.)
- [X] T007 Implement `src/server/domain/content/markdown.ts`: `renderMarkdown(md): string` = `marked` →
  `sanitize-html` with the conservative allowlist (research R1). **The only** producer of HTML for
  `dangerouslySetInnerHTML`.
- [X] T008 Integration test `tests/integration/content.test.ts` (real Postgres): `contentService`
  create/patch/publish/unpublish/delete; **`getContentPageBySlug` returns the published body only** (edit draft
  → public read unchanged; publish → reflected; unpublish → null); duplicate + `RESERVED_SLUGS` rejection; an
  audit row per write. (Test-first — fails until T009.)
- [X] T009 Implement `src/server/domain/content/contentService.ts`: `createContentPage`, `patchContentPage`
  (draft/title/summary only), `publishContentPage` (draft_body → published_body, published=true),
  `unpublishContentPage`, `deleteContentPage`, `listContentPages`, `getContentPageById`,
  `getContentPageBySlug` (published-only). `writeAudit` on every write (`content.created/updated/published/
  unpublished/deleted`).

## Phase 3: User Story 1 — The public reads the club's info pages (Priority: P1)

**Goal**: a published page renders at its clean URL, sanitized and on-brand; unknown/unpublished → not-found.
**Independent test**: seed a published page; load `/<slug>` → title (one H1) + sanitized body render; an
unpublished/unknown slug → not-found. (The read invariant + sanitizer are covered by T006/T008.)

- [X] T010 [US1] Create `src/app/(public)/[slug]/page.tsx` (+ `contentPage.module.css`): async server page —
  `getContentPageBySlug(slug)` else `notFound()`; render the `title` as the single `<h1>` and
  `dangerouslySetInnerHTML={{ __html: renderMarkdown(publishedBody) }}` in a prose `Container`; mobile-first,
  no horizontal scroll, AA. (Guarded by the sanitizer — the app's first `dangerouslySetInnerHTML`.)

## Phase 4: User Story 2 — The Webmaster edits a page without a deploy (Priority: P1)

**Goal**: a Webmaster creates/edits a draft and publishes it live — no deploy; non-editors are denied.
**Independent test**: as a `content.write` actor, create a page, publish, see it at `/<slug>`; edit the draft
(public unchanged) then publish (reflected); a base actor is refused; every write is audited.

- [X] T011 [US2] Integration test `tests/integration/content.authz.test.ts`: the content write routes
  (`POST /api/content`, `PATCH /api/content/[id]`, `POST /api/content/[id]/publish`) **refuse a base-only
  actor** (403) and allow a `content.write` actor. (Test-first — fails until T012.)
- [X] T012 [US2] API routes (all `withAuth({ requires: "content.write" })`): `src/app/api/content/route.ts`
  (`GET` list + `POST` create), `src/app/api/content/[id]/route.ts` (`GET` one + `PATCH` draft/title/summary +
  `DELETE`), `src/app/api/content/[id]/publish/route.ts` (`POST` publish). Validate with `validation/content.ts`;
  422 on bad/reserved/duplicate slug; 404 unknown id. (Routes declare a requirement → route-inventory guard
  passes.)
- [X] T013 [US2] Admin editor `src/app/(admin)/content/page.tsx` (+ `*.module.css`): a client page (`apiFetch`)
  — a **list** of pages and an **editor** (slug on create; title; a **draft Markdown textarea**; summary) with
  **Save draft** (POST/PATCH) and **Publish**. (In the `(admin)` group + `NAV` from T005 → nav-completeness
  guard passes.)

## Phase 5: User Story 3 — Safe editing: preview, unpublish, manage (Priority: P2)

**Goal**: preview the draft (rendered, not public), unpublish (take down), delete, and see each page's state.
**Independent test**: preview a draft; publish; unpublish → `/<slug>` 404s; delete; the list shows state.

- [X] T014 [US3] Routes: `src/app/api/content/[id]/unpublish/route.ts` (`POST`, `content.write`) and a preview
  endpoint `src/app/api/content/preview/route.ts` (`POST`, `content.write`) that returns
  `renderMarkdown(draftBody)` sanitized HTML — one server sanitization path, no client Markdown.
- [X] T015 [US3] Extend the admin editor (`(admin)/content/page.tsx`): a **Preview** panel (shows the sanitized
  draft HTML from the preview endpoint), **Unpublish** and **Delete** actions, and the page **list showing
  published/unpublished state**. (Same file as T013 — sequential.)

## Phase 6: Polish & validation

- [X] T016 Gate suite: `pnpm exec vitest run tests/unit/contentMarkdown.test.ts tests/integration/content.test.ts
  tests/integration/content.authz.test.ts`, then `pnpm exec tsc --noEmit`, `pnpm run lint`, and
  `pnpm exec prettier --check` on the changed files. Full `pnpm test` green (migration applied).
- [X] T017 Browser verify (quickstart §2–3): as a Webmaster at `/content` — create → **Preview** (sanitized) →
  **Publish** → `/<slug>` live (SC-001); edit draft + Save → `/<slug>` unchanged; Publish → reflected (SC-002);
  a Markdown body with `<script>`/`onerror` does **not** execute (SC-003); **Unpublish** → `/<slug>` 404s;
  a committed-PDF link works; 375px, one H1, AA (SC-006). Confirm a non-`content.write` volunteer can't reach
  `/content` (SC-004).

## Dependencies

- T001 (deps) precedes T007 (imports `marked`/`sanitize-html`). T002 → T003 → (T004 [P]) → T008/T009.
- T006 → T007 (test-first, independent of the service). T008 → T009 (test-first). T005 [P] (capability/nav).
- **US1** T010 needs T007 (render) + T009 (getBySlug). **US2** T011 → T012 (needs T009 + T005 + T004) → T013.
  **US3** T014 (needs T007 + T009) → T015 (needs T013). Phase 6 last.

## Parallel opportunities

- T004 (validation), T005 (capability/nav), and T006 (the sanitizer test) are independent files ([P]).
- The two test tasks (T006 unit, T008 integration) can be written before their implementations land.

## Implementation strategy

**MVP** = Setup + Foundational + US1 + US2 — a working CMS: create/edit/publish a Markdown page and read it
publicly, sanitized, gated by `content.write`. **US3** (preview + unpublish + delete + state) adds the safe-
editing net. Security-first ordering: the **sanitizer (T006/T007)** and the **service invariant (T008/T009)**
land in Foundational before any page renders untrusted content.
