# Contract: Undo merge

Two new routes. **No new capability is introduced** — undoing requires `dedup.write`, the same authority
that performs a merge (FR-023), and the sign-in portion additionally requires `role.assign` (FR-024),
both of which already exist.

## 1. Merge — unchanged on the wire

```http
POST /api/dedup/merge   { "canonicalId": "…", "mergedId": "…" }
```

The request and the discriminated outcome are **exactly as feature 072 left them**. The manifest is
written server-side and is never returned: it is a record, not a result, and it contains row identities
across half the schema that no client has business reading.

The only observable change is that a completed merge is now reversible — which the client learns from
route 2, not from this response.

## 2. Merge history for a contact

```http
GET /api/dedup/merges?contactId=…
```

Requires `dedup.write`. Returns **the whole chain** that produced this contact, newest first, each with
its reversibility verdict (FR-026 to FR-028).

"The whole chain" rather than only direct merges: where A was merged into B and B later into C, all three
records' data ends up on C, so all of it must be visible from C. An earlier version listed only merges
whose `canonical_id` was the contact being viewed, which hid A → B entirely — that merge names B as its
survivor, and B is retired and cannot be opened. It also left the `survivor_merged` verdict with nowhere
to appear. Each entry therefore carries `intoContact` (the contact the merge actually went into) and
`direct` (false when that is not the contact being viewed), so the row cannot claim A was merged into C.

```jsonc
{
  "merges": [
    {
      "mergeId": "…",
      "mergedContact": { "id": "…", "displayName": "Chris Scott" },
      "intoContact": { "id": "…", "displayName": "Christopher Scott" },
      "direct": true,
      "actor": "…",
      "mergedAt": "2026-09-10T18:22:04.113Z",
      "ageDays": 1,
      "activitySince": 3,              // closed three-table count since the merge — FR-027
      "verdict": "reversible",
      "reversal": null
    },
    {
      "mergeId": "…",
      "mergedContact": { "id": "…", "displayName": "Jim Sloboda" },
      "actor": "…",
      "mergedAt": "2026-07-02T14:05:00.000Z",
      "ageDays": 71,
      "activitySince": 24,
      "verdict": "no_manifest",        // recorded before feature 074 — FR-007
      "reversal": null
    },
    {
      "mergeId": "…",
      "mergedContact": { "id": "…", "displayName": "Elizabeth Smith" },
      "actor": "…",
      "mergedAt": "2026-09-09T09:14:00.000Z",
      "ageDays": 2,
      "activitySince": 0,
      "verdict": "already_undone",
      "reversal": {                    // FR-021
        "actor": "…",
        "undoneAt": "2026-09-09T09:31:12.004Z",
        "skipped": []
      }
    }
  ]
}
```

`verdict` is one of `reversible`, `no_manifest`, `survivor_merged`, `contact_archived` or
`already_undone` — exhaustively those five. Only `reversible` may be offered as an action; every other
value carries its own explanatory text in the UI (FR-028).

`activitySince` counts rows created on either contact since the merge across `contact_emails`,
`attendance` and `membership_accounts` — a closed set, defined in
[data-model.md](../data-model.md). It is a risk indicator for the operator's judgement, not an audit
total, and clients must not present it as one.

## 3. Undo a merge

```http
POST /api/dedup/merges/{id}/undo     {}
```

Requires `dedup.write`. The verdict is re-checked inside the transaction — a merge shown as reversible a
minute ago may not be one now.

**200 — reversed** (FR-020). `restored` counts what was applied, per table; `skipped` names everything
that was not, with a reason (SC-006):

```jsonc
{
  "mergeId": "…",
  "restoredContactId": "…",
  "restored": {
    "contact_emails": 2,
    "membership_members": 1,
    "attendance": 3,
    "performers": 1,
    "role_grants": 1
  },
  "skipped": [
    { "kind": "move",    "table": "gate_sales",       "key": { "id": "…" }, "reason": "gone" },
    { "kind": "destroy", "table": "attendance",       "key": { "id": "…" }, "reason": "occupied" },
    { "kind": "move",    "table": "staff_identities", "key": { "id": "…" }, "reason": "not_authorized" }
  ]
}
```

A 200 with a non-empty `skipped` is still a success: the reversal committed, and the list is what the
operator must be told (FR-018). The UI must never render an undo as wholly clean when `skipped` is
non-empty.

**409 — not reversible.** In the project's standard `ApiError` shape, with the verdict in `detail` so the
client can say *why* without parsing prose (FR-028):

```jsonc
{
  "error": {
    "code": "MERGE_NOT_REVERSIBLE",
    "message": "The surviving contact has since been merged into another. Undo that later merge first.",
    "detail": "survivor_merged"
  }
}
```

An earlier draft of this contract sketched a bespoke `{ "error": "merge_not_reversible", "verdict": … }`
body. The house shape wins: every other route in the app answers `{ error: { code, message, … } }`, and
one endpoint inventing its own would break the client's single error path for no gain. `message` is
Mel's, `detail` is the client's.

Returned for every non-`reversible` verdict, including `already_undone` — which is also what the loser of
a concurrent-undo race receives (research R7).

**404** — `MERGE_NOT_FOUND`, no merge with that id. Distinct from a merge that exists but cannot be
undone. **403** — the caller lacks `dedup.write`.

The request body is empty, and there is deliberately **no Zod schema** for it: a schema over `{}` would
validate nothing and exist only to satisfy a pattern.

Note there is no 403 for lacking `role.assign`: missing role-assignment authority never refuses the
request, it skips the access-changing entries and reports them as `not_authorized` in the 200 (FR-025).

## 4. What the merge confirmation says

FR-029 requires the operator be told a merge will be reversible *before* performing it, so the safety net
is known in advance rather than discovered afterwards. This is UI copy on the existing confirmation
surface, not a route: no request is needed to know that a merge performed now will carry a manifest.
