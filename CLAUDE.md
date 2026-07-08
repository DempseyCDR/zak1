<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
at specs/012-contact-name-fields/plan.md
<!-- SPECKIT END -->

## Development conventions (temporary)

- **Route index**: `src/app/dev/routes/page.tsx` is a temporary review page listing every UI page and
  API endpoint. **Whenever you add or remove a route** (a `page.tsx` under `src/app` or a `route.ts`
  under `src/app/api`), update that page's `uiRoutes` / `apiRoutes` lists in the same change.
  This requirement is provisional and will be revised when the UI is formally designed.
