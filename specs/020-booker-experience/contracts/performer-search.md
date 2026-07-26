# Contract: Performer Search (US2)

The first B39 entity-picker. `requires: 'base'` — the performer directory is staff-readable.

---

## `GET /api/performers?q=<query>` (existing route, extended)

Add an optional `q` param to the existing performers list. Returns performers whose `display_name` matches
`ILIKE %q%`, ordered by `display_name`. Empty/absent `q` returns the full list ordered by display name (the
browse case). Backed by `searchPerformers(db, q, limit)`.

```jsonc
// GET /api/performers?q=fab
{ "items": [ { "id": "uuid", "displayName": "Bob Fabinski" } ] }
```

- **~30 performers** → ILIKE is instant; no `pg_trgm`/normalized column (unlike `searchContacts`, which
  ranks 1,340 contacts by similarity). Deliberately simple (research R3).
- Returns a `performer_id` — exactly what a booking references. No contact→performer resolution step.

---

## Add-performer hand-off (US2, FR-013) — no new endpoint

When the search finds nothing, the UI:

1. Searches an **existing contact** via `GET /api/contacts?q=` (existing, PII-free, `base`).
2. Creates the performer via `POST /api/performers` with the chosen **`contactId`**, a `displayName`
   (defaulted from the contact), and `performerType` (from the slot Sean clicked).
3. Returns to the booking modal with the new performer selected.

`createPerformer` **already** links an existing contact when `contactId` is supplied (only auto-creating a
contact when it is absent) — so this reuses the current `performer.write` route with **zero new backend**.
The **booking** is not created until Sean saves the modal.
