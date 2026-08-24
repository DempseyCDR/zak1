# Implementation Plan: Static content pages / lightweight CMS (P7-R7)

**Branch**: `051-content-pages` | **Date**: 2026-08-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/051-content-pages/spec.md`

## Summary

A Tier-2 content CMS (D-3): a **`content_pages`** store the **Webmaster** edits through a small admin editor
on the existing staff auth — no deploy — and the public reads at a clean slug URL. Body is **Markdown**, edited
as a **draft** and **published** to a separate **published body** the public sees; a page's live content never
changes until publish. The Markdown is rendered to **sanitized HTML** by a single server-side boundary
(`renderMarkdown`) — the app's **first** `dangerouslySetInnerHTML`, so the sanitizer is load-bearing. Gated by a
new **`content.write`** capability (Webmaster/VP delegate) in the existing 016 model; every write is **audited**.
Policy PDFs/images are **committed static assets** a page links to (no upload — D-4). Additive migration
**`0034`** (first since 0033). Branches off `main`, independent of the 048–050 public-frontend stack.

## Technical Context

**Language/Version**: TypeScript 5.7 (strict), React 19, Next.js 16 App Router (RSC).

**Primary Dependencies**: **new** — `marked` (Markdown → HTML) + `sanitize-html` (server-side allowlist
sanitizer; `@types/sanitize-html` dev). Existing — Drizzle, Zod, `withAuth`/`actorCan` (015/016), `writeAudit`,
the P7-R1 public tokens (045), `apiFetch` (client), `Container` (public). No client-side editor library
(Markdown chosen over WYSIWYG — clarified).

**Storage**: PostgreSQL — **additive migration `0034_content_pages.sql`** creating `content_pages`
(slug unique, title, draft_body, published_body nullable, published flag, summary, timestamps). No destructive
change. Audit via the existing `audit_events`.

**Testing**: Vitest — **unit** `contentMarkdown` (the sanitizer: XSS payloads neutralized — `<script>`,
`onerror=`, `javascript:` hrefs, etc. — and safe Markdown renders the expected safe HTML; **the security test**);
**integration** (real Postgres) `content` — service create/patch/publish/unpublish/delete, the **draft-vs-
published** invariant (public sees the published body, not the draft; unpublish makes the read 404), slug
uniqueness + reserved-slug rejection, and audit rows; **integration** authz — a content route refuses an actor
without `content.write`. The public `[slug]` page (async RSC reading the DB) and the admin editor are
**browser-verified**.

**Target Platform**: Public website (content pages) + the staff admin (the editor).

**Performance Goals**: Public read is one indexed `slug` lookup per page (server component); render+sanitize is
in-process. Admin is low-frequency.

**Constraints**: **Sanitization is mandatory** (FR-004) — untrusted Markdown must never execute; the public
render is always server-sanitized. Public pages are mobile-first (~375px, no horizontal scroll), one H1, AA,
consistent with the site. Slugs unique + URL-safe + non-colliding with existing routes.

**Project Type**: Web application (Next.js App Router); admin surface + public route group.

**Scale/Scope**: ~15 org/prose pages. One table + migration, one capability, a Markdown/sanitize module, a
content service, ~6 API routes, one admin editor page, one public `[slug]` renderer. Nav + route-inventory +
capability catalog updates.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment |
|-----------|------------|
| **I. Test-First (NON-NEGOTIABLE)** | PASS (planned). Tests first: unit — `renderMarkdown` neutralizes XSS (`<script>`, `onerror`, `javascript:`/`data:` hrefs, `<iframe>`) and renders safe Markdown (headings, links to `http(s)`/`mailto`/relative PDFs, lists, emphasis) to expected HTML; integration (real Postgres) — service CRUD, **public read shows the published body and not the draft**, unpublish → not-found, unique/reserved slug rejection, audit rows; integration — a content write route refuses a non-`content.write` actor. Public page + editor are browser-verified. |
| **II. Simplicity / YAGNI** | PASS. Tier-2 only (D-3): no WYSIWYG (Markdown), no upload (committed assets), no version history (audit only), no auto-generated nav (hand-maintained). Two **well-trusted** deps (`marked` + `sanitize-html`) instead of hand-rolling a renderer/sanitizer — hand-rolling HTML sanitization would be reckless. The one added complexity, a draft-vs-published body, is the clarified requirement. |
| **III. Type Safety** | PASS. Zod at the API boundary (`content` create/patch + slug rules); typed Drizzle schema + service; `content.write` added to the `Capability` string-union (the catalog is exhaustively checked). No `any`. |
| **IV. Observability** | PASS. `writeAudit` on every create/update/publish/unpublish/delete (who + when — FR-006). The sanitize step is the security boundary. |

**⚠️ Security note (load-bearing):** this is the app's **first** `dangerouslySetInnerHTML`. It is permitted
**only** on the output of `renderMarkdown` (marked → `sanitize-html` allowlist). The public render never trusts
stored Markdown directly; the unit test is the guard that keeps it safe.

**Development Workflow**: Multi-contributor mode — on `051-content-pages` (off `main`), lands via a **reviewed
PR** (no self-merge) after the gate suite passes. No Complexity Tracking entries.

## Project Structure

### Documentation (this feature)

```text
specs/051-content-pages/
├── plan.md
├── research.md          # Phase 0 (md+sanitize libs, sanitize allowlist, draft/published model, routing, capability, preview)
├── data-model.md        # Phase 1 (content_pages table + migration 0034; state transitions)
├── quickstart.md        # Phase 1 (edit→publish→public read, XSS-safe, unpublish 404, authz)
├── contracts/
│   └── content-api.md   # API + admin/public UI contract
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
src/server/db/migrations/0034_content_pages.sql     # NEW additive table
src/server/db/schema/contentPages.ts                # NEW Drizzle schema (exported from schema/index)
src/server/validation/content.ts                    # NEW Zod: create/patch + slug format + RESERVED_SLUGS
src/server/domain/content/
├── markdown.ts                                     # NEW renderMarkdown(md) → sanitized HTML (THE boundary)
└── contentService.ts                               # NEW create/patch/publish/unpublish/delete/list/
                                                    #   getBySlug(published-only)/getById + writeAudit
src/server/auth/capabilities.ts                     # +content.write (union + webmaster & super_user rows)
src/server/auth/nav.ts                              # +{ /content, "Content pages", content.write }

src/app/api/content/route.ts                        # GET list + POST create (content.write)
src/app/api/content/[id]/route.ts                   # GET one + PATCH (draft/title/summary) + DELETE (content.write)
src/app/api/content/[id]/publish/route.ts           # POST publish (content.write)
src/app/api/content/[id]/unpublish/route.ts         # POST unpublish (content.write)

src/app/(admin)/content/page.tsx + *.module.css     # NEW admin: list + editor (draft textarea, server-rendered
                                                    #   sanitized preview) + publish/unpublish/delete
src/app/(public)/[slug]/page.tsx + *.module.css     # NEW public render: getBySlug → notFound; <h1> + sanitized
                                                    #   published body (dangerouslySetInnerHTML on renderMarkdown)

tests/
├── unit/contentMarkdown.test.ts                    # NEW: sanitizer XSS + safe-render (security)
├── integration/content.test.ts                     # NEW: service CRUD + draft/published + slug/reserved + audit + getBySlug
└── integration/content.authz.test.ts               # NEW: content routes require content.write
```

**Structure Decision**: The **`renderMarkdown` module is the single trust boundary** — every public/preview
render goes through it, so `dangerouslySetInnerHTML` only ever sees sanitized output. The public renderer is a
`(public)/[slug]/page.tsx` dynamic segment (clean WordPress-style URLs) guarded by `notFound()` for unknown/
unpublished slugs and a **RESERVED_SLUGS** list at create time (so a page can't shadow `/whats-on`, `/join`,
`/dances`, etc.). The admin editor mirrors the existing config-CRUD pattern (a client page using `apiFetch`
against `content.write`-gated routes); **preview reuses the same server `renderMarkdown`** (one sanitization
path, no client Markdown bundle). The capability + nav + route-inventory wiring follows 016/035 exactly.

## Complexity Tracking

> No Constitution Check violations — table intentionally empty.
