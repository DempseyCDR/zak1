# Contract: `normalizePhone` / `formatPhone` (pure functions)

Two pure `(string) → string` helpers in `src/server/domain/contacts/phone.ts` (beside the 012 name
normalizer). No I/O; safe to import server-side (write path, backfill parity test) and client-side (display).

## `normalizePhone(raw: string): string`

Produce the canonical stored form. **Never throws; never rejects.**

| Input example | Stored result | Rule |
|---|---|---|
| `(585) 555-1234` | `+15855551234` | strip → 10 digits → assume `+1` |
| `585.555.1234` | `+15855551234` | same number, any punctuation → identical |
| `5855551234` | `+15855551234` | 10 digits → `+1` |
| `1-585-555-1234` | `+15855551234` | 11 digits leading `1` → `+1` + last 10 |
| `+1 585 555 1234` | `+15855551234` | explicit `+1` |
| `+15855551234` | `+15855551234` | already canonical → **no-op (idempotent)** |
| `+44 20 7946 0958` | `+442079460958` | non-US `+` → keep country code, strip punctuation |
| `555-1234` | `555-1234` | 7 digits → **unparseable → raw (unchanged)** |
| `585-555-1234 x89` | `585-555-1234 x89` | extension → **unparseable → raw** |
| `call Mary` | `call Mary` | letters → **unparseable → raw** |
| `` / whitespace | `` (empty/absent) | no phone |

Rule (identical in TS and in the `0030` SQL): trim; keep leading `+` and digits; a 10-digit (or `+?1`+10)
number → `+1`+10 digits; an existing `+`-prefixed number with ≥ 11 digits → keep as-is; else → the **original
raw** input.

## `formatPhone(stored: string): string`

Produce the dashed display form. **Never throws.**

| Stored | Display |
|---|---|
| `+15855551234` | `585-555-1234` |
| `+442079460958` | `+44 2079460958` (country code preserved; national part best-effort) |
| `585-1234 x89` (raw) | `585-1234 x89` (passthrough) |
| `` / null | `` (nothing) |

## Application

- **Write** (FR-007): `normalizePhone` runs at `contactService.createContact` + `patchContact`,
  `attendanceService` (check-in new-contact), and `performerService` (performer-create) — every site that
  writes `contacts.phone`.
- **Backfill** (FR-006): `0030_normalize_contact_phones.sql` applies the same rule to existing rows
  (unparseable unchanged), idempotent, pinned to `normalizePhone` by a parity test.
- **Display** (FR-005): `formatPhone` is applied wherever a phone is shown. No live surface renders a phone
  today; the P5-R7 dedup page is its first consumer.
