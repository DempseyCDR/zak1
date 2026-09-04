# Contract: Membership Accounts

All membership writes require **`membership.write`** — Financial Secretary, Treasurer, Super-user
(FR-017). Unchanged by this feature: **no new capability**, and the mailing-list manager does **not** gain
one. Reads follow the existing contact-record rules.

## 1. Record a dues payment

```http
POST /api/contacts/{id}/membership/payment
```

`{id}` is the **payer**. Opens their account if they have none; otherwise moves the existing account
forward (FR-004).

**Request** body:

```jsonc
{
  "level": "family",          // FR-003: chosen, never derived from an amount
  "paymentDate": "2026-09-04" // FR-002: the expiry is derived from this
}
```

**Response `200`** — the payer's contact record, including the account block (§4).

**Errors** returned:

| Status | Code | When |
|---|---|---|
| `404` | `CONTACT_NOT_FOUND` | no such contact |
| `422` | `LEVEL_CAPACITY_EXCEEDED` | the level would displace existing members (FR-003a/FR-024) — names them |
| `422` | `VALIDATION_ERROR` | missing/unknown level, malformed date |

Recording a payment that does not extend the account beyond its current expiry leaves the expiry unchanged
(FR-004, the renewal no-op) and still succeeds — the money, where money is recorded, is unaffected.

**No financial record is created** (FR-006): the club has no non-event income capability, deliberately
removed in feature 038 and not restored here.

## 2. Attach / detach a member

```http
POST   /api/contacts/{id}/membership/members   { "contactId": "…" }
DELETE /api/contacts/{id}/membership/members   { "contactId": "…" }
```

`{id}` is the **payer**; the body names the contact being covered. Both return the updated record.

| Status | Code | When |
|---|---|---|
| `409` | `LEVEL_ADMITS_NO_MEMBERS` | the account is `individual` or `student` (FR-003a) |
| `409` | `PAYER_NOT_DETACHABLE` | attempting to detach the account's own payer (FR-007/FR-009) |
| `404` | `ACCOUNT_NOT_FOUND` | the contact owns no account |

Attaching is idempotent; detaching someone not attached is a no-op `200`.

## 3. Change the level

```http
PATCH /api/contacts/{id}/membership   { "level": "individual" }
```

Refused `422 LEVEL_CAPACITY_EXCEEDED`, **naming who would be displaced**, when the new level admits fewer
members than the account currently covers (FR-023). The message names people, not table rows.

## 4. Contact record projection

`GET /api/contacts/{id}` gains a `membership` block:

```jsonc
{
  "membership": {
    "status": "current",              // derived, never a stored column (FR-015)
    "expiryDate": "2027-08-31",
    "asPayer": {                      // present when this contact OWNS an account
      "level": "supporter",
      "members": [ { "contactId": "…", "displayName": "Rich Culbert" } ]   // FR-019
    },
    "asMember": {                     // present when covered by someone else's account
      "payerContactId": "…",
      "payerDisplayName": "Cindy Culbert"                                   // FR-018
    }
  }
}
```

Both may be present: a contact can pay for their own account *and* be covered by another. `level` appears
only under `asPayer` — it is the payer's attribute (FR-013).

**Distinct from the shared-email household** (FR-020): feature 067's `messageRecipient` / `sharedWith`
describes who is *reached at an address*; this describes who is *covered by a payment*. They overlap often
and are not the same set, so the two blocks must be separately labelled and never merged.

**PII**: names and ids only — no address or phone — so `projectContact`'s denylist needs no new entry.
(Contrast 067, where a nested address had to be nulled. Confirm this holds if the block ever gains a field.)

## 5. Gate dues line

The membership line in a gate save carries the level:

```jsonc
{ "category": "membership", "contactId": "…", "amount": 40, "membershipLevel": "family" }
```

Required on `membership` lines, exactly as `contactId` already is; rejected on other categories. **The
amount is independent of the level** (FR-003) — tiers change and cheques bundle donations — and the money
reconciliation is untouched.

## 6. Member mailing list export

| Guarantee | Detail |
|---|---|
| Membership | Driven by **attachment** (FR-011), not by `contacts.list_member` or past history. |
| Lapsed included | Members of a lapsed account are still listed, marked lapsed, so the reminder reaches them (FR-012). |
| New column | `membership_level` — the payer's level, blank for a member who pays for nothing (FR-013). |
| Existing columns | `email`, `first_name`, `last_name`, `membership_status`, `membership_through_year` — unchanged. |
| Status | Derived at export time (FR-015), so a year rollover needs no refresh. |
| Suppression | `do_not_contact` still excludes, as today (FR-014). |
| Shared addresses | Feature 067's resolution and dedupe still apply — one row per resolved address. |

## 7. Deleting a payer's contact

Owning an account joins the safe-delete blockers (FR-009). `DELETE /api/contacts/{id}` returns
`409 CONTACT_HAS_REFERENCES` naming *"a membership account"* in the human wording added by the 067
follow-up. The super-user force path is unaffected.
