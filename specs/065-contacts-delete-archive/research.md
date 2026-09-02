# Research: Contact Archive & Delete

Phase 0 decisions. Spec clarifications were resolved in `/speckit-clarify`; no `NEEDS CLARIFICATION`
remain. Notes record the load-bearing choices and the existing code they build on.

## D1 — the archived marker: a nullable column mirroring bands

- **Decision**: Add `contacts.archived_at timestamptz NULL` (migration 0041), mirroring
  `bands.archived_at`. Archived ⇔ `archived_at IS NOT NULL`. Archive sets it (`now()`), restore clears it
  (`NULL`). Independent of `merged_into_id`.
- **Rationale**: reversible, cheap, and consistent with the codebase's existing archive pattern. A
  timestamp also records *when* it was archived at no extra cost.
- **Alternatives**: a boolean `archived` (loses the when); a separate archive table (overkill).

## D2 — active-read filter: add `archived_at IS NULL` wherever merged is already excluded

- **Decision**: Every read that filters `merged_into_id IS NULL` also filters `archived_at IS NULL`:
  `contactService.searchContacts` (all three branches), `countNeedsReview`, `listNeedsReview`;
  `suggestionService.getMergeSuggestions` + `countMergeSuggestions` (raw SQL, both `a` and `b`); and the
  mailing-list/contact-tracing export reads (`exports/exportService`, `mailingLists`,
  `contactTracingService`). `searchContacts` gains an `includeArchived` option that drops **only** the
  `archived_at` predicate (never the merged one).
- **Rationale**: "active contact" now means non-merged **and** non-archived; applying the same predicate
  everywhere merged is excluded keeps the definition consistent (M-R10) and the launcher counts / exports
  correct.
- **Index**: M-R10 mentions a `contacts_active` partial index, but no such index exists today. Deferred —
  the search paths are trigram-GIN-backed; add a partial index only if a regression appears.
- **Alternatives**: a DB view for "active contacts" (larger change; harder to opt out for the toggle).

## D3 — surfacing archived: the "+ archived" search toggle

- **Decision**: The contacts search offers a compact toggle **labeled "+ archived"** (off by default).
  On, it passes `?archived=1` so `searchContacts` includes archived rows; results carry `archived_at` so
  the row can be marked. Opening an archived contact offers **Restore**. No separate archived view.
- **Rationale**: archives are rare, so a dedicated view is usually empty; the toggle reuses the search
  surface and keeps archived contacts out of every default/active read.

## D4 — the safe-delete guard: bare-record-only

- **Decision**: A safe delete succeeds only when the contact is **bare** — referenced by nothing but its
  own `contact_emails` rows. `contactDeleteBlockers(db, id)` checks for any row in the substantive
  referencing tables and returns which categories are present; a non-empty result refuses the delete with
  a clear reason. The concrete set (from the schema's contact FKs): **memberships, membership_captures,
  attendance, door_records, performers, officers, role_grants, staff_identities, and venues (landlord)**.
  Excluded: `contact_emails` (owned, cascades with the contact) and audit rows (a log; the deletion is
  itself audited).
- **Rationale**: those FKs are a mix of `ON DELETE CASCADE` (grants, staff identity, officers, emails —
  a delete erases them) and `ON DELETE SET NULL` (memberships, attendance, captures, door, performers,
  venue-landlord — a delete orphans them). Both are unacceptable for a "safe" delete, so only a truly
  bare record is safe-deletable (clarification Q1 = B).
- **Alternatives**: the three named categories only (M-R11 literal) — leaves volunteer/officer/performer
  contacts hard-deletable, cascading their grants/identity; rejected.

## D5 — delete mechanics + the unrestricted override

- **Decision**: `deleteContact(db, id, { unrestricted })`. Safe path: run `contactDeleteBlockers`; if
  non-empty, throw a typed "has references" error (→ 4xx with the reason). Unrestricted path: skip the
  guard. Both then `DELETE FROM contacts` (FKs cascade/null per schema) and write a `contact.delete`
  audit event (with a safe/unrestricted detail), mirroring the `contact.merge` audit.
- **Route**: `DELETE /api/contacts/[id]` requires `contact.delete`; `?force=1` selects the unrestricted
  path and additionally requires `contact.delete.unrestricted` (else 403). Archive/restore are separate
  `POST …/archive` and `POST …/restore` action routes (`contact.write`), mirroring the 064 `reviewed`
  endpoint.
- **Rationale**: one delete endpoint with a force flag keeps the surface small; the extra capability is
  checked in-handler (layer-1 `actorCan`), consistent with the catalog design.

## D6 — capabilities + UI gating

- **Decision**: Add two catalog capabilities — `contact.delete` (mailing_list_manager + super_user) and
  `contact.delete.unrestricted` (super_user only). Extend `GET /api/me/capabilities` with `contactWrite`,
  `contactDelete`, `contactDeleteUnrestricted` so the editor shows Archive/Restore (write), a Delete
  button (delete), and the unrestricted option (super_user) only to holders.
- **Rationale**: distinct capabilities per the catalog principle (no inline `role === super_user`); the
  server enforces (route + `deleteContact`), the capabilities response only decides which controls to
  offer. (063 removed a speculative `roleAssign` flag; here the flags are actually consumed by buttons.)
