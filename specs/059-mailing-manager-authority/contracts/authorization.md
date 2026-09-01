# Contract: `mailing_list_manager` Authorization (feature 059)

The observable interface of this feature is the **authorization decision** for a holder of
`mailing_list_manager` (and no other role). Expressed as `can(grants, capability, target?)` outcomes and
the equivalent route-guard results.

## Capability matrix — holder of `mailing_list_manager` only

| Capability | Before 059 | After 059 | Gated operation (already exists) |
|---|---|---|---|
| `contact.write` | ❌ refuse | ✅ allow (global) | `POST /api/contacts`, `PATCH /api/contacts/[id]` |
| `contact.mailing.write` | ⚠️ series-scoped only | ✅ allow (global) | `POST/PATCH /api/contacts/[id]/emails…` |
| `contact.pii.read` | ✅ allow | ✅ allow | (unchanged) |
| `export.read` | ✅ allow | ✅ allow | (unchanged) |
| `mailing_list.write` | ✅ (scoped) | ✅ (scoped) | (unchanged) |
| `dedup.write` | ✅ allow | ✅ allow | (unchanged) |
| `role.assign` | ❌ refuse | ❌ refuse | boundary — governance only |
| `contact` delete/archive | ❌ refuse | ❌ refuse | boundary — not conferred |
| `membership.write` | ❌ refuse | ❌ refuse | boundary — not conferred |
| any other capability | ❌ refuse | ❌ refuse | boundary — absent from map |

## Contract assertions (drive the tests)

### C1 — contact.write is conferred globally

- `can([{role:"mailing_list_manager", seriesId:null, groupId:null}], "contact.write")` → **true**
- `can([{role:"mailing_list_manager", seriesId:S, groupId:null}], "contact.write", anyTarget)` → **true**
  (a series-scoped grant still confers it everywhere — `global`)
- Effect: `POST /api/contacts` and `PATCH /api/contacts/[id]` succeed for an MLM-only session.

### C2 — contact.mailing.write is conferred globally

- `can([{role:"mailing_list_manager", seriesId:S, groupId:null}], "contact.mailing.write", anyTarget)`
  → **true** (previously the series scope could filter it out)
- Effect: email/consent/status edits succeed for an MLM-only session on any contact.

### C3 — governance boundary holds

- `can([mlmGrant], "role.assign")` → **false**
- `can([mlmGrant], "membership.write")` → **false**
- Any capability not in the `mailing_list_manager` map → **false**
- Effect: attempts to designate a volunteer, delete a contact, assign a role, or edit membership are
  refused (and logged `authz.refused`).

### C4 — no regression / additive only

- Every other role's `can(...)` outcomes are unchanged.
- `super_user` still allows both capabilities globally (already did).

## Notes

- No request/response schema changes — the endpoints and their payloads are unchanged; only the
  allow/deny decision for this role changes.
- `target` is optional: an unscoped question ("does this role hold the capability anywhere?") returns
  true for a `global` capability without needing a target.
