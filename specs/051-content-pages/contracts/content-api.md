# Contract: content pages — API + admin/public UI

The interfaces this feature exposes: the `content.write`-gated admin API, the admin editor, and the public
page render. The public read is a server component (no API).

## Admin API (all `withAuth({ requires: "content.write" })`, default-deny)

- **`GET /api/content`** — list pages (id, slug, title, published, updated_at) for the admin list.
- **`POST /api/content`** — create `{ slug, title, draftBody, summary? }` → 201 the page. 422 on invalid/
  reserved/duplicate slug or empty title/body.
- **`GET /api/content/[id]`** — one page (incl. draft_body) for the editor.
- **`PATCH /api/content/[id]`** — edit `{ title?, draftBody?, summary? }` (the **draft** only) → the page. Does
  **not** change the published body or visibility.
- **`DELETE /api/content/[id]`** — delete the page.
- **`POST /api/content/[id]/publish`** — promote draft_body → published_body, set published=true.
- **`POST /api/content/[id]/unpublish`** — set published=false (retains published_body).
- **Preview** — the draft rendered through the server `renderMarkdown` (a `content.write` preview endpoint
  returns sanitized HTML), so the editor sees the exact public output. One sanitization path.

Every write is **audited** (who + when). Invalid input → 422 with a clear message; unknown id → 404;
insufficient capability → 403.

## Admin editor (`/content`, in the `(admin)` group + `NAV`, `content.write`)

A list of pages with their state, and an editor: **slug** (create only), **title**, a **draft Markdown
textarea**, **summary**, and **Save draft / Publish / Unpublish / Delete** + a **Preview** of the rendered
(sanitized) draft. Presentation-gated by `content.write` (the server routes enforce it regardless).

## Public page (`/<slug>`)

Rendered by `(public)/[slug]/page.tsx` (a dynamic segment; static/dynamic siblings like `/whats-on`, `/dances`
resolve first):

- Looks up the page by slug; **not-found** if unknown, unpublished, or a reserved slug.
- Renders the **title** as the single `<h1>` and the **published body** as **sanitized** HTML
  (`dangerouslySetInnerHTML` on `renderMarkdown(published_body)` — the app's first, guarded by the sanitizer).
- Styled with the P7-R1 tokens (a prose container), mobile-first (~375px, no horizontal scroll), AA.
- May link to committed static PDFs/images (relative links allowed by the sanitizer).

## Scope boundary

Content pages (Markdown, draft/published, sanitized) + the capability + admin editor + public render only. **No**
WYSIWYG editor, **no** file upload (committed assets), **no** version history (audit only), **no** auto-generated
nav (hand-maintained), **no** schema beyond `content_pages`. Does not touch the dance listings, event detail, or
series landings.
