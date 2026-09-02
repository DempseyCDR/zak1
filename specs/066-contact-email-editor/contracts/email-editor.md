# Contract: Contact Email Editor

Interfaces the email editor uses. Add/patch endpoints exist; this feature makes the address editable,
enriches the collision, adds a delete endpoint, and adds one capability flag. UI contract items describe
the email-row behavior (validated by component tests).

## Endpoints

### POST /api/contacts/[id]/emails  *(existing — unchanged)*

- **Requires**: `contact.mailing.write`. Adds an email (purposes/topics/status/is_login). A collision now
  raises `EMAIL_ACTIVE_ELSEWHERE` (see below) rather than the bare duplicate.

### PATCH /api/contacts/[id]/emails/[emailId]  *(existing — address added)*

- **Requires**: `contact.mailing.write`.
- **NEW**: the body may include **`email`** (the address); `patchEmail` sets it. Purposes/topics still
  collapse per the rules (DNC-exclusive, ≥1 each). Soft-remove is `{ status: "inactive" }`.
- A collision raises `EMAIL_ACTIVE_ELSEWHERE`.

### DELETE /api/contacts/[id]/emails/[emailId]  *(new)*

- **Requires**: `contact.delete.unrestricted` (super-user; reused capability).
- **Effect**: permanently removes the email row; writes an `email.deleted` audit event.

### GET /api/me/capabilities  *(existing — one flag added)*

- **Adds**: `contactMailingWrite` — the editor shows email-edit controls only to holders.

### Error: EMAIL_ACTIVE_ELSEWHERE  *(new)*

- 409, `detail` carries the other contact (`{ contactId, displayName }`). The editor renders "already
  active on [displayName] — review as duplicate" and offers a merge of the current + other contact.

## Contract checks

| ID | Statement | Verified by |
|---|---|---|
| C1 | `patchEmail` / PATCH sets a new **address** on an email | integration |
| C2 | Setting an address active on another contact raises `EMAIL_ACTIVE_ELSEWHERE` naming that contact; nothing changes | integration |
| C3 | Patching `consent_topics` including `do_not_contact` collapses to `{do_not_contact}` (server) | integration |
| C4 | A login email is refused on a non-volunteer (server) | integration |
| C5 | `DELETE …/emails/[emailId]` by a `contact.delete.unrestricted` holder erases the row + writes `email.deleted` | integration |
| C6 | `DELETE` without `contact.delete.unrestricted` is refused | integration |
| C7 | `/api/me/capabilities` returns `contactMailingWrite` per the actor's grants | integration |
| C8 | The editor lists each email as a row with address, purposes, consent topics, status (FR-001) | component |
| C9 | Selecting **do not contact** clears/greys the other topics; the row can't reach zero purposes/topics (FR-003/FR-004) | component |
| C10 | The status control is an Active/Inactive toggle; a `transition` row shows status read-only (FR-005) | component |
| C11 | Add a new email row; **soft-remove** sets it inactive via PATCH (FR-006/FR-007) | component |
| C12 | A **hard-delete** affordance shows only with `contactDeleteUnrestricted` and issues DELETE (FR-008) | component |
| C13 | A collision response shows "already active on [name] — review as duplicate" with a **keep-this / keep-other** choice; the chosen direction merges the pair via `POST /api/dedup/merge` (FR-009) | component |
| C14 | A login email is marked "used for staff sign-in"; changing its address / deactivating requires a confirmation (FR-010) | component |
| C15 | Each row shows a compact read-only telemetry hint; telemetry is never editable (FR-011) | component |
