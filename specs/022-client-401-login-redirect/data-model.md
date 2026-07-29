# Data Model: Client 401 → sign-in redirect (B41)

**No persistent data model.** This is a client-behavior feature: no schema, no migration, no new or changed
entity, no server-side data.

The only state introduced is **client, in-memory, transient**:

- **`redirecting` flag** (module-level, in `apiFetch`) — a boolean guarding against multiple sign-in
  navigations when several requests fail unauthenticated at once (research R4). Not persisted; reset by the
  page navigation itself.

The reused server concept is unchanged:

- **Return-path (`next`)** — a validated same-site path carried on `/login?next=…`, already defined and
  guarded by `safeNextPath` (feature 015). This feature only *produces* the value (the current path); it does
  not define or store it.
