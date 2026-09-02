# Data Model: Contact Email Editor

**No schema change, no migration.** All fields already exist on `contact_emails`. This documents how each
participates in the editor.

## Entity: Contact email (`contact_emails`)

| Field | Type | Role in the editor |
|---|---|---|
| `email` | citext, unique among active/transition across contacts | Editable address (FR-002). **New**: `patchEmail` now sets it (and `emailPatchSchema` accepts it). |
| `purposes` | enum[] (`personal`/`booking`/`public_profile`/`other`), ≥1 | Editable; control prevents zero (FR-004). |
| `consent_topics` | enum[] incl. `do_not_contact`, ≥1 | Editable; **do-not-contact exclusive** — `effectiveConsentTopics` collapses to `{do_not_contact}` on add **and** patch (FR-003). |
| `status` | enum `active` / `transition` / `inactive` | **Active/Inactive** toggle (FR-005). `transition` shown **read-only** (system-managed). Soft-remove = set `inactive` (FR-007). |
| `is_login` | boolean | Marks the staff sign-in identity; allowed only on a volunteer (`isLoginAllowed`). Address-change / deactivation requires a **confirmation** (FR-010). |
| `provider_set_date` / `provider_last_open` / `provider_last_click` | timestamptz | **Read-only** telemetry hint per row (FR-011); never writable (`noProviderFields`). |

### Uniqueness / collision (FR-009)

Active/transition addresses are unique across contacts. On a collision (add or patch), the service looks
up the other contact holding that address and raises **`EMAIL_ACTIVE_ELSEWHERE`** carrying
`{ contactId, displayName }` — nothing is written. The editor turns that into a **"review as duplicate"**
action that merges the two via the existing `POST /api/dedup/merge`.

### Lifecycle

```text
add ──▶ active ──toggle──▶ inactive        (soft remove; kept, drops from active scope)
active ◀──toggle── inactive
(provider) ──▶ transition                  (system-managed; status shown read-only)
any ──hard delete (contact.delete.unrestricted)──▶ (row erased, email.deleted audit)
```

## Authorization

| Capability | Held by | Role here |
|---|---|---|
| `contact.mailing.write` | mailing_list_manager (global), door_attendant, super_user | add / edit / soft-remove an email |
| `contact.pii.read` | mailing_list_manager, super_user | see the addresses (unchanged 016) |
| `contact.delete.unrestricted` | super_user | **hard-delete** an email row (reused; no new capability) |
| `dedup.write` | mailing_list_manager (global), super_user | merge from "review as duplicate" (unchanged) |

`GET /api/me/capabilities` gains **`contactMailingWrite`** so the editor shows email-edit controls only to
holders; the server still enforces on every write.

## Audit

An email **hard delete** writes an `email.deleted` audit row (permanent erasure — observability, mirrors
065). Add / patch / soft-remove are ordinary mailing writes.
