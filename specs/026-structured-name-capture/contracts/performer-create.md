# Contract: create a performer (structured names)

One existing endpoint changes its **input shape**; behavior and status codes are otherwise unchanged. No new
endpoint.

## `POST /api/performers` (existing, `performer.write`)

**Input (changed):**

```jsonc
{
  // Create a NEW contact for the performer (structured):
  "firstName": "Chuck",            // required on the create path
  "lastName": "Abell",             // optional (mononym → omit)
  "displayNameOverride": "…",      // optional (stage name)
  // …OR link an EXISTING contact instead of creating one:
  "contactId": "<uuid>",           // when present, no name is captured
  // unchanged optionals (seed the created contact):
  "email": "…", "emailPurpose": "personal|booking|public_profile|other",
  "phone": "…", "bio": "…", "photoUrl": "…"
}
```

**Validation:** `contactId` present (link) **XOR** `firstName` present (create). `lastName` optional.
The old required single **`displayName` is removed.** A request with neither `contactId` nor `firstName` is
**rejected** (validation error).

**Behavior:**

- **Create path** (`firstName`, no `contactId`): create a contact with `first_name` / `last_name` /
  `display_name_override` and the derived `display_name` (via the shared structured-name derivation); the
  performer's `display_name` is that derived value. Seed email/phone as today; `needs_review` unchanged (set
  when neither email nor phone is given).
- **Link path** (`contactId`): no contact is created and the existing contact's names are untouched; the
  performer's `display_name` is read from the linked contact.

**Response:** the created performer (unchanged shape / 201).

## Unchanged

- `GET /api/performers` (list / `?q=` search) is unaffected.
- Existing contacts, bookings, reports, dedup, and the door/directory creation flows are unaffected — this
  only corrects the performer-create capture.
- No back-fill of existing records (R5-P2).
