# Contract: Organizer Report (band identifier)

This feature **changes the meaning** of one existing string field and adds a page label. No new endpoint, no
request change, no response-shape change.

## Endpoint (unchanged)

- The organizer report route still returns the assembled `OrganizerReport` for a series + year. The response
  **shape is identical**; only the value of each per-dance row's `band` string (and the identical trend point
  `band`) changes.

## Response — changed field semantics

```jsonc
{
  "perDanceRows": [
    {
      // ...all existing fields UNCHANGED...
      "band": "The Fiddleheads",   // when a named band played (was: "Alice Fiddle, Bob Piano")
      "performers": [              // UNCHANGED — the member roster the detail lists
        { "name": "Alice Fiddle", "type": "lead_musician", "amount": 150 },
        { "name": "Bob Piano",   "type": "musician",       "amount": 150 }
      ]
    }
  ]
  // quarterlySummary + trend numbers unchanged; trend point `band` follows the same rule
}
```

## Guarantees (test contract)

- **Named band** → `band` === the band's `name` (SC-001).
- **Ad-hoc** (musicians with no `band_id`) → `band` === the joined member names, exactly as today (FR-002/SC-002).
- **Open-band only** → `band` === `"Open Band"`; **no musicians** → `band` === `""` (FR-003).
- **Multiple named bands on one dance** → `band` === the bands' names joined (FR-004).
- **Figure parity (FR-005 / SC-004)**: every computed figure (dancers, gross, merchandise, rent, performer total,
  dance net, avg ticket, break-even, quarterly, trend numbers) is **byte-for-byte unchanged** for the same seeded
  data.
- `performers[]` is unchanged (still `{ name, type, amount }`).

## Presentation contract (organizer page — proven by the component test)

- The **band column** shows the band's name for a named-band dance.
- The **per-dance detail expansion** lists each member by **name and role** (type), and shows the **band name**
  (FR-006/FR-007).
- The detail also handles ad-hoc / open-band / caller-only cases (lists whoever performed), consistent with today.

## Out of scope (contract explicitly does NOT change)

- The public `/whats-on` band display and the **bookings** report.
- Substitution / no-show recording or display.
- Any new modal (the existing inline detail expansion is reused).
