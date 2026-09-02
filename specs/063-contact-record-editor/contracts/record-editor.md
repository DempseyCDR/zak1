# Contract: Contact Record Editor

Interfaces the record editor uses. Both endpoints already exist; this feature adds one authorization
rule to the PATCH (endpoint defense on `is_volunteer`). UI contract items describe the record form's
observable behavior (validated by component tests). `is_volunteer` is **read-only** in the editor; its
designate/clear lives on the access screen.

## Endpoints

### GET /api/contacts/[id]  *(existing — unchanged)*

- **Requires**: `base`.
- **Returns**: the full contact record (+ emails). PII (`phone`, `emails`) is nulled/emptied for a
  viewer without `contact.pii.read` (`projectContact`), and a disclosure is audited when unprojected PII
  is returned. Used to populate the editor on open.

### PATCH /api/contacts/[id]  *(existing — ONE rule added)*

- **Requires**: `contact.write`.
- **Body** (`contactPatchSchema`, all optional): `firstName`, `lastName` (nullable), `displayNameOverride`
  (nullable), `pronouns` (nullable), `phone` (nullable), `isVolunteer` (boolean).
- **NEW rule (C1)**: when the actor does **not** hold `role.assign`, the route MUST strip `isVolunteer`
  from the input before persisting (endpoint defense — `contact.write` is broadly held). The response is
  200, the other fields save, and the stored `is_volunteer` is unchanged. When the actor holds
  `role.assign`, `isVolunteer` is honored (C2).
- **Returns**: the updated contact row.

*(No change to `/api/me/capabilities` — the editor shows `is_volunteer` read-only, so no client
capability check is needed.)*

## Contract checks

| ID | Statement | Verified by |
|---|---|---|
| C1 | PATCH by a `contact.write`-only actor with `isVolunteer` changed → 200, other edits saved, `is_volunteer` unchanged | integration |
| C2 | PATCH by a `role.assign` actor (who also holds `contact.write`) with `isVolunteer` changed → 200, `is_volunteer` persisted | integration |
| C4 | Opening a record fetches the full contact and pre-fills first/last/pronouns/phone/override | component |
| C5 | Editing first/last/pronouns/phone + Save issues one `PATCH /api/contacts/:id` with those fields | component |
| C6 | Automatic mode: display-name field read-only, previews "first last"; button reads "Set custom name" | component |
| C7 | Set custom name → field editable, prefilled with effective name; Save sends non-blank `displayNameOverride` | component |
| C8 | Custom mode + Save with blank custom field → PATCH sends `displayNameOverride: null` (reset) | component |
| C12 | Custom mode: editing first/last does not change the pinned name, and Save does not send a replacement `displayNameOverride` for it | component |
| C13 | Custom mode + **Reset to automatic** button → PATCH sends `displayNameOverride: null` | component |
| C9 | `is_volunteer` shows read-only with no toggle (no checkbox), and Save never carries `is_volunteer` | component |
| C10 | Read-only context shows volunteer / membership status / needs-review / volunteer-approval (yes/no flags in one compact wrapping row); `source` is not rendered | component |
| C11 | Cancel/Close discards uncommitted edits without a PATCH | component |
| C14 | Every editable field (first/last/display/pronouns/phone) has a **visible** label (rendered text, not placeholder-only) | component |
| C15 | The phone field displays the human-readable form (`585-555-1234`) from the stored canonical `+15855551234` | component |
| C16 | Opening a record renders a `role="dialog"` `aria-modal="true"` labeled by the contact, containing the edit form | component |
| C17 | Pressing **Escape** closes the modal with no PATCH | component |
| C18 | On open, focus moves into the dialog (the first field) | component |
