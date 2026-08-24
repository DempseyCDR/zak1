# Phase 0 Research: Static content pages / lightweight CMS (P7-R7)

Format per decision: **Decision / Rationale / Alternatives**. The three shape choices (Markdown editor, draft-
vs-published body, committed-asset media) were settled in `/speckit-clarify` (see spec Clarifications); this
resolves the implementation unknowns.

## R1. Markdown → sanitized HTML — `marked` + `sanitize-html`, one server boundary

**Decision**: A single server module `domain/content/markdown.ts` exporting `renderMarkdown(md: string):
string` = **`marked`** (Markdown → HTML) piped through **`sanitize-html`** with a **conservative allowlist**.
Allowed: headings `h1–h4` (the page owns the top `<h1>`, so body headings start at `h2` — downgrade or allow
from h2), `p`, `ul/ol/li`, `a` (href **http/https/mailto/relative only**, `rel="noreferrer"`, target optional),
`strong/em/blockquote/code/pre`, `hr`, `img` (src http/https/relative only, requires `alt`), and simple
`table` tags. **Disallowed**: `script`, `style`, `iframe`, `object`, event handlers (`on*`), `javascript:` /
`data:` URLs, and any attribute not in the allowlist. `renderMarkdown` is the **only** producer of HTML that a
`dangerouslySetInnerHTML` may consume.

**Rationale**: Rendering + sanitizing untrusted Markdown for a public page is security-critical; hand-rolling a
sanitizer is reckless (the exact thing OWASP warns against). `marked` is a small, ubiquitous renderer;
`sanitize-html` is a mature, allowlist-based, **server-side** sanitizer (pure Node — no jsdom/DOM needed for
SSR). Both are widely used and maintained. Per the constitution's third-party rule, **we test our
`renderMarkdown` wrapper at its boundary** (XSS payloads in → safe HTML out), not the libraries' internals.

**Alternatives**: `isomorphic-dompurify` (DOMPurify + jsdom) — rejected (drags jsdom into the server runtime for
SSR; heavier). A `remark`/`rehype`/`rehype-sanitize` pipeline — rejected for v1 (more packages/config than two
focused libs need). Hand-rolled regex sanitization — rejected (unsafe). Storing pre-rendered HTML — rejected
(we store Markdown and render on read, so the allowlist can tighten later without a data migration).

## R2. Draft vs published body (clarified) — two body columns + a published flag

**Decision**: `content_pages` carries **`draft_body`** (Markdown the Webmaster edits) and **`published_body`**
(Markdown the public sees; **nullable**, null until first publish) plus a **`published`** boolean. **Publish**:
`published_body := draft_body`, `published := true`. **Unpublish**: `published := false` (public read 404s;
`published_body` retained so re-publish needs no re-edit). **Public read** returns a page only when `published`
and shows `published_body`; **preview** renders `draft_body`. Editing `draft_body` never changes the public
page until the next publish (the clarified safety net).

**Rationale**: Directly models the clarified workflow. Keeping `published_body` on unpublish makes take-down
reversible without losing content. A boolean (not `published_body IS NOT NULL`) lets unpublish hide without
discarding the last-published copy. Title/summary edit in place (low risk); the **body** is what needs the
draft/published split (the clarified scope).

**Alternatives**: A published flag + preview only (no separate published body) — the simpler default, **rejected
by clarification** (they chose the safer separation). A full page-version history table — out of scope (audit
records who/when; YAGNI). Snapshotting title too — deferred (title edits are low-risk; keep one title column).

## R3. Public routing — a `(public)/[slug]` segment + a reserved-slug guard

**Decision**: Public pages render at a clean top-level URL via `src/app/(public)/[slug]/page.tsx` (a single
dynamic segment). Next resolves the static/dynamic siblings first (`/whats-on`, `/what-was-on`, `/join`,
`/dances/*`, `/`), so `[slug]` only catches the rest; an unknown or unpublished slug → `notFound()`. Slugs are
validated at create time: lowercase, hyphen/alphanumeric, and **not in `RESERVED_SLUGS`** (the known top-level
public + app segments: `whats-on`, `what-was-on`, `join`, `dances`, `login`, `api`, `dev`, and the admin/door
route names) so a content page can never shadow a real route (FR-009).

**Rationale**: WordPress-parity clean URLs (`/mission`, `/bylaws`) are what the org pages want. A single `[slug]`
(not a `[...slug]` catch-all) is enough for flat org pages and won't swallow nested paths. The reserved list is
the guard the spec calls for.

**Alternatives**: A prefixed namespace (`/pages/[slug]` or `/about/[slug]`) — rejected (uglier URLs; the org
pages are top-level on the current site). A `[...slug]` catch-all — rejected (broader match than needed; single
segment is safer). Enumerating every route to detect collisions dynamically — rejected (a maintained reserved
list is simpler and sufficient for a Webmaster tool).

## R4. Capability + authorization — a new `content.write`, Webmaster-scoped

**Decision**: Add **`content.write`** to the `Capability` union and grant it `global` to **`webmaster`** and
**`super_user`** in `CAPABILITIES` (mirroring how `event.public.write` is Webmaster-only and **not** inherited
by the VP). All content **write** routes declare `withAuth({ requires: "content.write" })`; the admin `/content`
page sits in the `(admin)` group (default-deny) and is added to `NAV` keyed on `content.write`. The public
`[slug]` read is unauthenticated (public route group), reading **published** pages only.

**Rationale**: Follows 016 exactly — a capability means something only because a handler checks it; the
`Capability` union is exhaustively checked so the catalog can't silently drift. Webmaster is the content owner
(grounding: VP delegate owns public content); the VP grants the Webmaster role, matching the existing
`event.public.write` precedent.

**Alternatives**: Reuse `event.public.write` — rejected (that is the event blurb/price capability; content pages
are a distinct resource). Put `content.write` on the VP too — rejected (the existing model keeps Webmaster
capabilities Webmaster-only; the VP delegates via the role).

## R5. Editing + preview — admin editor reusing the server renderer

**Decision**: `(admin)/content/page.tsx` is a client page (like `door-parameters`) using `apiFetch` against the
`content.write` routes: a **list** of pages with state, and an **editor** (slug on create, title, a **draft
Markdown textarea**, summary) with **Save draft**, **Publish**, **Unpublish**, **Delete**. **Preview** renders
the draft through the **same server `renderMarkdown`** (a `content.write` preview endpoint returns sanitized
HTML the editor displays) — so there is **one** sanitization path and **no client Markdown bundle**.

**Rationale**: Matches the established admin-CRUD pattern; keeping preview server-side means the editor sees
exactly the public sanitized output and no second (client) sanitizer exists to drift. The Webmaster is trusted,
but the boundary stays server-side regardless.

**Alternatives**: A client-side Markdown live preview — rejected (a second render path + a client Markdown lib;
the clarify chose "no editor library"). Save-then-reload to preview — acceptable but a preview endpoint is
snappier; either is fine (an implementation detail for tasks).

## R6. Media — committed static assets, linked (clarified)

**Decision**: PDFs (bylaws, social contract) and images live as **committed static assets** under `public/`
(e.g. `public/docs/…`), and a page **links** to them in Markdown (`[Bylaws](/docs/bylaws.pdf)`). The sanitizer
allows **relative** hrefs/img-src so these links/images work; **no upload** is built. The migration path for the
current site's `/flyers/` PDFs is to commit them as static assets.

**Rationale**: Consistent with D-4 (committed assets for v1, no upload substrate). Relative links keep the
allowlist safe (no arbitrary external/`data:`/`javascript:` URLs).

**Alternatives**: A file-upload substrate — rejected/clarified out (a substantial subsystem D-4 defers). Hot-
linking external PDFs — allowed by http(s) href, but the club's own docs should be committed for durability.

## R7. Testing — the sanitizer is the headline test

**Decision**: unit `contentMarkdown.test.ts` — **the security test**: `<script>alert(1)</script>`, `<img
src=x onerror=alert(1)>`, `[x](javascript:alert(1))`, `<iframe>`, `<a href="data:...">`, and event-handler
attributes are all neutralized; safe Markdown (headings→h2+, `http(s)`/`mailto`/relative links, images with
alt, lists, emphasis, blockquote, code) renders to the expected safe HTML. Integration `content.test.ts` (real
Postgres) — create/patch/publish/unpublish/delete; **`getContentPageBySlug` returns the published body only**
(edit draft → public unchanged until publish; unpublish → null/404); slug uniqueness + `RESERVED_SLUGS`
rejection; audit rows written per action. Integration `content.authz.test.ts` — a content write route refuses a
base-only actor (uses the auth-protection harness). The public `[slug]` page and the admin editor are
**browser-verified** (render, XSS-safe display, 375px/one-H1, unpublish 404).

**Rationale**: The sanitizer carries the security weight, so it gets the most explicit test; the DB-backed
service/state gets a real-Postgres test (constitution: integration on real infra); authz declaration is guarded
by the route-inventory test and exercised by the deny test; layout is browser-verified (the page is a DB-reading
RSC).

**Alternatives**: Rendering the async `[slug]` page in jsdom — rejected (reads the DB). Trusting the libraries
without a wrapper test — rejected (the wrapper/allowlist is ours to prove).
