# Data Model: Contact Record Editor — Scalar Fields

**No schema change, no migration.** Every field below already exists on the `contacts` table. This
document records how each field participates in the record editor.

## Entity: Contact (`contacts`)

### Editable here (via `PATCH /api/contacts/[id]`, `contactPatchSchema`)

| Field | Type | Editing rule |
|---|---|---|
| `first_name` | text, non-empty | Plain edit. Min 1 char (control prevents blank). |
| `last_name` | text, nullable | Plain edit; may be cleared to null. |
| `display_name_override` | text, nullable | The Custom pinned name. Non-blank ⇒ Custom; `null`/blank ⇒ Automatic (reset, never an error). |
| `pronouns` | text, nullable | Plain edit. |
| `phone` | text, nullable | Displayed formatted (`formatPhone` → `585-555-1234`); **normalized on save** (`normalizePhone`, feature 032) back to `+15855551234`. Every field carries a visible label. |

`is_volunteer` is **not** editable here — see Read-only context. (The PATCH endpoint still strips it for
callers without `role.assign` as endpoint defense; the editor simply never sends it.)

### Derived on save (never edited directly — recomputed by `patchContact`)

| Field | Derivation |
|---|---|
| `display_name` | `display_name_override` if set, else "first last" (`deriveContactNames`). |
| `name_normalized` | normalized search key from the effective name. |
| `dedup_normalized` | normalized "first last" dedup key (ignores override). |

Recompute is triggered when `first_name`, `last_name`, or `display_name_override` is present in the
patch (existing service behavior).

### Read-only context (shown, never edited here)

| Field | Notes |
|---|---|
| `is_volunteer` | Display only. Governance-owned — designate/clear (with grant-cascade + approval) is on the access screen. |
| `membership_status` | Materialized from `memberships`. Display only. |
| `list_member` | Materialized. Display only; no editor. |
| `needs_review` | Display only (the door/upload worklist flag). |
| `volunteer_approved_at` | Display only. |
| `volunteer_approved_by` | Display only. |

### Not surfaced

| Field | Reason |
|---|---|
| `source` | Internal provenance; hidden (M-R8). |
| `name_normalized` / `dedup_normalized` | Machine keys; hidden from Mel (super-user diagnostic at most). |

## Authorization inputs

| Capability | Held by | Role in this feature |
|---|---|---|
| `contact.write` | `mailing_list_manager` (global, feat 059), door_attendant, super_user | Gates the whole PATCH; drives all scalar edits. Broadly held — hence the endpoint defense on `is_volunteer`. |
| `role.assign` | President, VP, super_user | The only authority the PATCH endpoint permits to change `is_volunteer`. The editor does not edit the flag; designate/clear is on the access screen. |
| `contact.pii.read` | `mailing_list_manager`, super_user | Whether the record read returns `phone` (unchanged 016 gating). |

## State: Automatic ⇄ Custom display name

```text
Automatic (override = null)
  │  Set custom name  → field prefilled with effective name, becomes editable
  ▼
Custom (override = non-blank)
  │  Reset to automatic (button)   → override := null
  │  Save with blank custom field  → override := null  (treated as reset, not error)
  ▲
  │  Editing first/last while Custom  → pinned override UNCHANGED
```
