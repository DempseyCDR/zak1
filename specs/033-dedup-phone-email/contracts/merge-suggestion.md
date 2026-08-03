# Contract: extended merge-suggestion payload (phone + active emails)

`GET /api/dedup/suggestions` (`getMergeSuggestions`, `base`-gated) — response shape gains phone + emails per
candidate. **No new endpoint; no request change.**

## Response (unchanged wrapper `{ pairs: MergeSuggestion[] }`)

Each `MergeSuggestion`:

```text
{
  a: { id, displayName, membershipStatus, phone, emails },
  b: { id, displayName, membershipStatus, phone, emails },
  similarity
}
```

- **`phone`**: `string | null` — the candidate's canonical `contacts.phone` (feature 032), or null.
- **`emails`**: `string[]` — the candidate's **active** email addresses (`contact_emails.status = 'active'`),
  login/primary first; `[]` when none.
- `id` / `displayName` / `membershipStatus` / `similarity`: **unchanged**.

## Matching (unchanged — FR-004)

The pair set and order are identical to before: same `dedup_normalized` similarity JOIN/WHERE/ORDER/LIMIT.
Only additive SELECT columns (`a.phone`, `b.phone`, and the two active-email `ARRAY(...)` subqueries) are
added. No matching on phone/email (deferred).

## Display (page — FR-002/003)

- Phone rendered via `formatPhone` (feature 032): US → `585-555-1234`; non-US keeps its `+cc`; raw/unparseable
  passthrough. No phone → "no phone".
- Emails rendered as a list; no active email → "no email".
- Merge controls, similarity, and empty state unchanged (FR-006).
