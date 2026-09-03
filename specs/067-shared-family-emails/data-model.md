# Phase 1 Data Model: Shared / Family Emails

## Schema change (the whole of it)

One nullable column on `contacts`. **No** change to `contact_emails`, to
`contact_emails_unique_active`, to `contact_emails_one_login_per_contact`, or to any sign-in query.

```sql
-- Migration 0042_contacts_message_recipient.sql
ALTER TABLE contacts
  ADD COLUMN message_recipient_email_id uuid
    REFERENCES contact_emails(id) ON DELETE SET NULL;

CREATE INDEX contacts_message_recipient
  ON contacts (message_recipient_email_id)
  WHERE message_recipient_email_id IS NOT NULL;
```

| Aspect | Decision |
|---|---|
| Nullability | `NULL` = this contact is not a referrer (owns its address, or has none). |
| `ON DELETE SET NULL` | Structural safety net. `contact_emails.contact_id` already cascades from `contacts`, so deleting an owner must never strand a pointer. The user-visible `needs_review` flagging is done by the service (see R2). |
| Index | Partial, on non-null values only — the only query that needs it is "who references this email?", which runs on deactivate/delete and when rendering an owner's record. |
| Cardinality | Many referrers → one owned email. A contact references **at most one** email (single column). |

## Entities

### Owned email — `contact_emails` (unchanged)

The sole home of an address and its consent. Continues to carry `email` (citext), `purposes`,
`consent_topics`, `status` (`active` / `transition` / `inactive`), `is_login`, and provider telemetry.
Unique among active rows by `lower(trim(email))`; that index is untouched, which is what keeps sign-in
unambiguous (FR-006, FR-007).

### Message-recipient reference — `contacts.message_recipient_email_id` (new)

A pointer from a **referring contact** to another contact's **owned email**, meaning "reach this person at
that address." It carries no address, no consent, no status, and no login capability of its own — all of
those remain properties of the owner's row.

**Invariants** (service-enforced unless noted):

| # | Rule | Source | Enforcement |
|---|---|---|---|
| I1 | The target must be an **active** owned email. | FR-014 | Service check on link; refused with a clear message. |
| I2 | A contact MUST NOT reference an email it owns. | FR-003 | Service check on link (cross-table, so not a CHECK constraint). |
| I3 | A contact references at most one email. | FR-003 | Structural — single column. |
| I4 | A referrer holds no **active** owned email while referencing. | FR-002, FR-011, FR-017 | Gaining an owned address clears the pointer; linking from an address edit retires the edited row first. |
| I5 | A referrer can never hold `is_login`. | FR-008 / M-R25 | Structural — `is_login` lives on `contact_emails`; a referrer has no row. Regression test only. |
| I6 | The pointer never survives its target. | FR-012 | FK `ON DELETE SET NULL` + service clearing on deactivate. |

### Contact (extended)

A contact is now in exactly one of three delivery states:

| State | Condition | Reached at |
|---|---|---|
| **Owner** | has ≥1 active owned email | its own address |
| **Referrer** | no active owned email **and** `message_recipient_email_id IS NOT NULL` | the owner's address |
| **Unreachable** | neither | nothing; contributes no export row (FR-010) |

## State transitions (M-R27 / FR-011, FR-012)

```text
Unreachable ──link as shared──────────────▶ Referrer
Referrer    ──gains own owned email───────▶ Owner        (pointer cleared, FR-011)
Referrer    ──unlink (Mel)────────────────▶ Unreachable  (FR-015)
Referrer    ──target deactivated/deleted──▶ Unreachable + needs_review = true   (FR-012)
Owner       ──owner merged into survivor──▶ Referrer unaffected (FR-013)
```

**On FR-013**: `mergeService` re-points email rows by setting `contact_emails.contact_id`; the row's `id`
is unchanged, so every pointer still resolves — to the survivor's now-owned email. The merge needs **no**
new code for references, only a test proving referrers are not orphaned.

## Derived read: resolved recipient

Not a stored entity — the shared resolution used by every export (research R3):

```text
resolved_email(contact) :=
     the contact's own active owned email
  ?: the email referenced by contacts.message_recipient_email_id
  ?: none
```

Export rows are then `DISTINCT ON (resolved address)`, each carrying the **owner's** first/last name, so
the CSV column format is unchanged (clarify answer 4). Suppression by the owner's `do_not_contact` is
applied to the resolved row, after resolution and before dedupe (FR-010b).

## API projection additions

`getContact` gains two read-only fields, feeding the record editor (FR-009, FR-010c):

| Field | Shape | Meaning |
|---|---|---|
| `messageRecipient` | `{ emailId, address, ownerContactId, ownerDisplayName } \| null` | "Bridget is reached via David Jones." `address` is nulled for an actor without `contact.pii.read` (FR-016); the owner's name is retained. |
| `sharedWith` | `[{ contactId, displayName }]` | "David's address is also used by Bridget." Empty for most contacts. |

## Derived read: duplicate-suggestion suppression (FR-018)

Also not stored. A suggested pair `(A, B)` is suppressed when either side already references the other's
owned email:

```text
suppressed(A, B) := A.message_recipient_email_id ∈ emails_owned_by(B)
                 ∨ B.message_recipient_email_id ∈ emails_owned_by(A)
```

Computed from the pointer — no dismissal record and no new table. Necessary because suggestions pair on
**name** similarity, and a household shares a surname.
