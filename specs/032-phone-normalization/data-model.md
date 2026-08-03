# Data Model: Phone number normalization (P5-R6)

**No schema change.** No table, column, index, or type is added. Only the **values** in the existing
`contacts.phone` column are normalized, plus a one-time backfill of existing rows.

## Reused field (values change only)

- **`contacts.phone`** — nullable `text`. After this feature it holds a **canonical** value for a parseable
  number (`+1XXXXXXXXXX` for US, `+<cc>…` for non-US) or the **raw input** when unparseable. Still optional;
  empty/absent stays null.

## Derived (not stored) — display

- **Formatted phone**: `formatPhone(contacts.phone)` produces the dashed display string on demand (US
  `585-555-1234`; non-US `+<cc> …`; raw passthrough). Not persisted; computed where a phone is shown.

## Rules (see [contracts/phone-normalization.md](contracts/phone-normalization.md))

- **Write**: `normalizePhone(input.phone)` applied at every contact-write site before the value is stored.
  Idempotent — a canonical value normalizes to itself.
- **Unparseable → raw**: wrong digit count, letters, or an extension → stored exactly as entered (FR-003).
- **Backfill**: `0030_normalize_contact_phones.sql` re-normalizes existing `contacts.phone` (unparseable left
  unchanged), idempotent, pinned to `normalizePhone` by a parity test.

No relationships, state transitions, or validation-schema changes (phone stays optional; normalization never
rejects).
