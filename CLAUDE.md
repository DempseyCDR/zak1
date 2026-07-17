<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
at specs/017-checkin-overhaul/plan.md
<!-- SPECKIT END -->

## Development conventions

- **Route index**: `src/app/dev/routes/page.tsx` lists every UI page and API endpoint. As of feature
  016 it is **generated from the source tree** (`src/server/lib/routeInventory.ts`, shared with
  `auth.routeInventory.test.ts`) and shown only to a Super-user. There is **nothing to hand-maintain** —
  a new route appears automatically. *(The previous convention to keep two arrays in sync was retired
  here.)*
