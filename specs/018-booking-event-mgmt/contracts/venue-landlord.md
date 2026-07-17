# Contract: Venue landlord contact (B22)

`PATCH /api/venues/[id]` — extended (`venuePatchSchema`). Auth: `venue.write` (Booker scoped / Treasurer /
Super-user), unchanged.

## Request body (addition)

```jsonc
{ "landlordContactId": "<uuid>" }   // set the landlord; null clears it
```

## Behaviour

- `landlordContactId` references an existing contact (chosen via the contact search picker, B39 convention —
  never a typed UUID in the UI). Setting it records the venue's landlord; `null` clears it (optional link).
- The FK is `ON DELETE SET NULL` — if the landlord contact is later deleted/merged, the venue's link clears
  gracefully rather than dangling.
- Audited via the existing venue update path.

## Response

`200` with the venue, including `landlordContactId`. The venue admin page shows the landlord's **name**
(resolved from the directory); no PII beyond what the directory already governs.
