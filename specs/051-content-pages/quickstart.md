# Quickstart: Static content pages / lightweight CMS (P7-R7)

Validation/run guide. Implementation lives in `tasks.md` + code; this proves the feature end-to-end.

## Prerequisites

- On `051-content-pages` (off `main`; has 015/016 auth + P7-R1 tokens).
- `pnpm install` (adds `marked` + `sanitize-html`); run the migration: `pnpm run db:migrate` (applies
  `0034_content_pages.sql`). Snapshot `zak1_dev` first (`pg_dump`), per the migration convention.
- Signed-in staff with the **`content.write`** capability (Webmaster / Super-user) for the admin steps.

## 1. Automated checks (write tests first — constitution Test-First)

```bash
pnpm test -- contentMarkdown                         # the sanitizer: XSS neutralized, safe Markdown rendered
pnpm test:integration -- content                     # service CRUD + draft/published + slug/reserved + audit
pnpm test:integration -- content.authz               # content routes require content.write
pnpm typecheck && pnpm lint
```

**Expected**: `renderMarkdown` strips `<script>`/`onerror`/`javascript:`/`<iframe>` and renders safe Markdown to
safe HTML; the service exposes the **published** body (not the draft) to the public read, unpublish makes it
404, duplicate/reserved slugs are rejected, and every write writes an audit row; a content write route refuses a
base-only actor.

## 2. Editorial flow (browser — admin)

As a signed-in Webmaster at `/content`:

- **SC-001**: create a page (slug `mission`, a title, a Markdown draft), **Preview** it (rendered, sanitized),
  then **Publish** → visit `/mission` and see it live — no deploy.
- **SC-002 / draft safety**: edit the draft and **Save** (don't publish) → `/mission` is **unchanged**;
  **Publish** → `/mission` now reflects the edit.
- **SC-004**: a signed-in volunteer **without** `content.write` cannot reach `/content` or its save actions.
- **SC-005**: each change appears in the audit trail (who + when).

## 3. Public render (browser)

Open `/mission` (and an unpublished page's slug) at 375px:

- **SC-002**: an **unpublished** or **unknown** slug → **not-found**; a published page renders its title (one
  H1) + body, styled and mobile-first (no horizontal scroll), AA.
- **SC-003**: a page whose Markdown contains `<script>` or an `onerror` image does **not** execute — the content
  is sanitized.
- Unpublish the page → `/mission` now returns not-found.
- A link to a committed PDF (e.g. `[Bylaws](/docs/bylaws.pdf)`) works.

## Success criteria mapping

| Check | Criterion |
|-------|-----------|
| Publish a new page live, no deploy | SC-001 |
| Unpublished/unknown → not-found; draft edit not public until publish | SC-002 |
| Malicious markup does not execute | SC-003 |
| Only content.write reaches the editor | SC-004 |
| Every change audited | SC-005 |
| Mobile-first, one H1, AA, on-brand | SC-006 |
