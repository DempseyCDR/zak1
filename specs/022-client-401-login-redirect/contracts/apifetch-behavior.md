# Contract: `apiFetch` client wrapper behavior

This feature changes a **client behavior contract**, not a server API contract. **No server endpoint, request,
or response shape changes.**

## `apiFetch(input, init?): Promise<Response>`

Same signature as `fetch`. Behavior by outcome:

| Server response | `apiFetch` behavior |
|---|---|
| **401 `UNAUTHENTICATED`** | Navigate to `/login?next=<current in-app path>` (unless already on `/login`, or a redirect is already in progress), then return a **promise that never settles** — the caller never reads the 401 body. Works for both `await` and fire-and-forget `.then` callers, with **no** unhandled rejection. |
| **403 forbidden** | Return the `Response` unchanged — caller shows its inline "not allowed" message (no navigation). |
| **2xx / other** | Return the `Response` unchanged — caller proceeds normally. |
| network/throw | Propagates as `fetch` would. |

**Guarantees**
- A caller can never render a 401 body as a successful-but-empty result (the promise never settles, so no
  `.then`/`await` continuation runs) — FR-004.
- At most one sign-in navigation occurs even if many calls 401 together — FR-006.
- No navigation when already on `/login` — FR-008.
- The return-path is the current same-site path; it is validated on `/login` by the existing `safeNextPath`
  — FR-007.

## Scope of adoption

- **In**: all staff `(admin)` and `(door)` client surfaces, shared staff client components (`ContactPicker`,
  `_modals/*`).
- **Out**: the public `join` page and any public surface — they keep raw `fetch` (no staff session to expire).

## Unchanged

- `withAuth` / server authorization, the `{ error: { code, message } }` body, `/login`, `/api/auth/google`,
  and `safeNextPath` — all reused as-is.
