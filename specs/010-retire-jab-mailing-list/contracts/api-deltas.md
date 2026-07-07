# Phase 1 Contracts: API Deltas

Only two existing endpoints change shape. No new endpoints; no new routes (dev route index unchanged).

## `GET /api/exports` — mailing list listing

**Change**: The `janeaustenball` item disappears (registry shrinks to 6 standing lists + the
`contact_tracing` export). The `note` field is **removed** from each item (it only ever carried the JAB
year). The `getMostRecentJabYear` query is dropped.

Response item shape:

```jsonc
// Before
{ "listId": "...", "filename": "...", "kind": "...", "note": string | null, "lastExport": {...} | null }
// After
{ "listId": "...", "filename": "...", "kind": "...", "lastExport": {...} | null }
```

- `listId` no longer includes `"janeaustenball"`.
- Acceptance: FR-001, FR-002, FR-004, SC-001. The exports admin page must stop reading `note`.

## `POST /api/event-groups` — create event group

**Change**: `kind` becomes optional free text instead of a fixed enum.

```jsonc
// Before  (kind: one of double_dance | weekend | jane_austen_ball | other, required)
{ "name": "Pride Dance 2026", "kind": "double_dance" }
// After   (kind: optional free text)
{ "name": "Pride Dance 2026", "kind": "double dance" }   // any non-empty text
{ "name": "Pride Dance 2026" }                            // kind omitted → null (allowed)
```

- Validation: `name` unchanged (`z.string().trim().min(1)`); `kind` →
  `z.string().trim().min(1).optional()`. An empty/whitespace `kind` is treated as omitted (null).
- Acceptance: FR-006, FR-007, SC-003, SC-006.

## Unchanged contracts (regression guardrails)

- **Contact-tracing export** (`GET /api/exports/contact-tracing`): unchanged — still returns an event's
  consented attendees (FR-005, SC-002).
- **Contact email consent** (contacts endpoints): `jane_austen_ball` consent topic still accepted and
  returned unchanged (FR-009, FR-010, SC-005).
