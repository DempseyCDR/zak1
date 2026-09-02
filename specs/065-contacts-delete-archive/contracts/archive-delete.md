# Contract: Contact Archive & Delete

New/changed interfaces. Archive/restore + delete are new action routes; the contacts search gains an
`archived` param; the capabilities response gains three flags. UI contract items describe the editor +
search behavior (validated by component tests).

## Endpoints

### POST /api/contacts/[id]/archive  ·  POST /api/contacts/[id]/restore  *(new)*

- **Requires**: `contact.write`.
- **Effect**: sets / clears `archived_at`; returns the updated contact. Reversible.

### DELETE /api/contacts/[id]  *(new)*

- **Requires**: `contact.delete`. With `?force=1`, additionally requires `contact.delete.unrestricted`
  (else 403).
- **Safe path** (no force): permanently deletes **only if the contact is bare** (referenced by nothing
  but its own emails); otherwise refuses with a clear reason (the referencing categories) and changes
  nothing.
- **Unrestricted path** (`?force=1`, super-user): deletes regardless of references.
- **Effect**: writes a `contact.delete` audit event on success (FR-010).

### GET /api/contacts?archived=1  *(existing route — param added)*

- **Requires**: `base`.
- **Effect**: includes archived contacts in the search results (each carrying `archivedAt` so the row can
  be marked). Without the param, archived contacts are excluded (default/active).

### GET /api/me/capabilities  *(existing — three flags added)*

- **Adds**: `contactWrite`, `contactDelete`, `contactDeleteUnrestricted` — for the editor to decide which
  action buttons to show. Server still enforces on every route.

## Contract checks

| ID | Statement | Verified by |
|---|---|---|
| C1 | Archiving a contact hides it from search, needs-review, dedup candidates, launcher counts, and exports | integration |
| C2 | An archived contact's data is intact and `restore` returns it to active reads | integration |
| C3 | `searchContacts(includeArchived)` / `?archived=1` returns archived rows (marked); default excludes them | integration |
| C4 | A **bare** contact (only its own emails) is deleted by the safe `DELETE` | integration |
| C5 | A contact referenced by **each** enumerated category (membership, membership_capture, attendance, door_record, performer, officer, role_grant, staff_identity, venue-landlord) refuses the safe `DELETE` with the reason; nothing changes | integration |
| C15 | `contactDeleteBlockers` checks exactly the enumerated category list (list-parity — a newly-added contact FK cannot silently escape the guard) | integration |
| C6 | `?force=1` by a `contact.delete.unrestricted` holder deletes a referenced contact; the FK cascade/null applies | integration |
| C7 | `DELETE` without `contact.delete` → refused; `?force=1` without `contact.delete.unrestricted` → refused | integration |
| C8 | A successful delete writes a `contact.delete` audit event | integration |
| C9 | `/api/me/capabilities` returns the three delete/write flags per the actor's grants | integration |
| C10 | The search shows a **"+ archived"** toggle; on → archived rows appear marked; off → hidden | component |
| C11 | The editor shows **Archive** for an active contact and **Restore** for an archived one (when `contactWrite`) | component |
| C12 | The editor shows a **Delete** control only to a `contactDelete` holder; it requires an explicit confirm | component |
| C13 | A refused safe delete surfaces the reason (the referencing categories) in the editor | component |
| C14 | After archive / restore / delete, the view + launcher counts refresh (reuse 064 refresh) | component |
