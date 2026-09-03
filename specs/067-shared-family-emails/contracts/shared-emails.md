# Contract: Shared / Family Emails

Two new endpoints, two extended projections, one extended collision payload, and the export behavior
change. Everything is gated by capabilities that already exist (research R6).

## 1. Link a shared address

```http
PUT /api/contacts/{id}/message-recipient
```

**Capability**: `contact.mailing.write` (global for `mailing_list_manager` since feature 059; `super_user`
via superset). **No new capability.**

**Request** body:

```jsonc
{
  "emailId": "uuid-of-an-owned-active-email",
  "retireEmailId": "uuid-of-one-of-this-contact's-own-rows"  // optional; see below
}
```

**Response `200`** — the updated contact projection, including the new `messageRecipient` block.

**Errors** returned:

| Status | Code | When |
|---|---|---|
| `404` | `CONTACT_NOT_FOUND` | `{id}` does not exist |
| `404` | `EMAIL_NOT_FOUND` | `emailId` does not exist |
| `422` | `REFERENCE_SELF` | the email is owned by `{id}` itself (I2 / FR-003) |
| `422` | `REFERENCE_TARGET_NOT_ACTIVE` | the target email is `inactive` (I1 / FR-014) |
| `409` | `REFERRER_OWNS_EMAIL` | `{id}` retains an active owned email and none is being retired — a contact with a working address of its own is not a referrer (FR-017) |

Optional `retireEmailId` names one of `{id}`'s **own** email rows to set inactive in the same
transaction — the address-edit collision path (FR-017), where the row being edited is the address being
replaced. With it, `REFERRER_OWNS_EMAIL` is evaluated **after** the retirement, so the edit path links
cleanly while a contact with an unrelated working address is still refused.

Idempotent: linking to the email already referenced returns `200` unchanged.

## 2. Unlink

```http
DELETE /api/contacts/{id}/message-recipient
```

**Capability**: `contact.mailing.write`. **Response `200`** with `messageRecipient: null` (FR-015).
Unlinking a contact that references nothing is a no-op `200`. Unlinking does **not** by itself set
`needs_review` — that flag is reserved for the involuntary case (FR-012), so a deliberate edit by Mel is
not mistaken for a lifecycle break.

## 3. Contact projection (extended)

`GET /api/contacts/{id}` gains two read-only fields (FR-009, FR-010c):

```jsonc
{
  "id": "…", "displayName": "Bridget Jones", "emails": [],
  "messageRecipient": {
    "emailId": "…", "address": "shared@jones.com",
    "ownerContactId": "…", "ownerDisplayName": "David Jones"
  },
  "sharedWith": []
}
```

For the **owner** the mirror holds: `messageRecipient: null` and
`sharedWith: [{ "contactId": "…", "displayName": "Bridget Jones" }]`.

**PII (FR-016)**: `projectContact` is a **denylist** (`{ ...contact, phone: null, emails: [] }`), so a new
field is exposed by default — it does **not** inherit protection. For an actor without
`contact.pii.read`, `messageRecipient.address` MUST be nulled while `ownerDisplayName` is retained.
`sharedWith` needs no redaction (ids and display names only). Two constraints keep this sufficient:

- The resolved address appears **only** on this projection. `GET /api/contacts` deliberately does not call
  `projectContact` — it is safe today because `SEARCH_COLS` is a narrow allowlist with no PII, so the
  resolved address MUST NOT be added there.
- The email routes expose no `GET`, so `emailId` cannot be resolved to an address by another path; the raw
  `messageRecipientEmailId` UUID is therefore not itself PII.

## 4. Collision payload (extends feature 066)

`EMAIL_ACTIVE_ELSEWHERE` already returns `error.other = { contactId, displayName }`. That payload is
**unchanged**; what changes is the UI contract — the collision now offers a third resolution beside
keep-this / keep-other merge:

| Action | Effect |
|---|---|
| Keep this contact | `POST /api/dedup/merge` `{ canonicalId: this, mergedId: other }` |
| Keep *other* | `POST /api/dedup/merge` `{ canonicalId: other, mergedId: this }` |
| **Different people — link as shared** | `PUT /api/contacts/{this}/message-recipient` `{ emailId: <the other's owned email> }`, plus `retireEmailId` when the collision came from **editing** an existing row |

The same three-way choice is offered on the `/dedup` pair view (M-R26: a same-email hit is no longer
automatically a merge candidate).

## 5. Export behavior (no format change)

Applies to **all six mailing lists** (`/api/exports/{listId}`) **and** the separate contact-tracing export
(`/api/exports/contact-tracing`) — the latter is a distinct service driven by attendance, not one of the
six lists.

| Guarantee | Detail |
|---|---|
| Resolution | A contact with no active owned email resolves to its referenced address (FR-010). |
| Dedupe | Output is distinct by **resolved address**; a household appears exactly once (FR-010). |
| Row shape | One row per resolved address carrying the **owner's** `first_name` / `last_name`. **Columns are unchanged** — no household-names column is added (clarify answer 4). |
| Qualification | A referrer's own qualification (`list_member`, performer link, attendance) pulls the resolved address in, even when the owner does not qualify (FR-010a). |
| Topic lists | Unchanged in practice: a referrer holds no consent topics and so can never pull an address onto a topic list (FR-010a). |
| Suppression | The owner's `do_not_contact` suppresses the address absolutely, beating any referrer's qualification (FR-010b). |
| Unreachable | A contact with neither an owned nor a referenced address contributes no row. |

## 6. Invariants this contract must NOT change

Regression guards, not new behavior (FR-006–FR-008; M-R24/M-R25 marked VERIFIED in the source doc):

- `contact_emails_unique_active` is untouched; a shared address still resolves to exactly one owning
  contact.
- Sign-in still matches an active **owned** email and still treats `> 1` match as `ambiguous_match`; a
  referrer is never a sign-in match.
- `is_login` remains owner-only **by construction** — a referrer has no email row to carry it.

## 7. Duplicate suggestions (FR-018)

`getMergeSuggestions` pairs contacts by **name** similarity (`dedup_normalized`), not by email — so a
linked household, which shares a surname, would otherwise be re-suggested on every pass. The pair MUST be
suppressed when either side's `message_recipient_email_id` points at an email owned by the other.

This is derived from the pointer itself: no dismissal record, flag, or new table. It is narrower than, and
does not conflict with, the general "not a duplicate" dismissal planned as M-R18.
