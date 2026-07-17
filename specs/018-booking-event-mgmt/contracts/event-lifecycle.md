# Contract: Event lifecycle — reschedule / cancel / delete + advertised price (B25, B27)

## `PATCH /api/events/[id]` — extended (field-level auth via `assertFields`)

Route requirement stays `event.public.write` (the weaker capability both roles hold); `assertFields` refuses
a write touching any field the actor does not own, **before** any change is applied.

`EVENT_FIELDS` gains:

| Field | Capability | Meaning |
|---|---|---|
| `eventDate` (`YYYY-MM-DD`) | `event.write` | **Reschedule** — same event row, new date (bookings/history travel with it). |
| `status` (`scheduled`\|`cancelled`) | `event.write` | **Cancel** / revive. |
| `advertisedPriceCents` (`int ≥ 0` \| `null`) | `event.public.write` | **Advertised price** — Webmaster (global) or Booker (scoped). |

```jsonc
{ "eventDate": "2026-07-30", "status": "cancelled", "advertisedPriceCents": 1500 }
```

Behaviour: a Webmaster submitting `eventDate`/`status` is refused (403, `FIELD_NOT_PERMITTED`) exactly as a
non-owner is today; a Booker (scoped to the series) may set all three. Cancelling retains the event; it is
shown marked cancelled on `/whats-on`.

## `DELETE /api/events/[id]` — NEW. Auth: `event.write` (scoped)

Hard-removes the event **only when it has no history**. Refuses with **409** when the event has:

- a `door_records` row, **or**
- ≥ 1 `attendance` row, **or**
- ≥ 1 `bookings` row **with a check number** (`check_number IS NOT NULL` — an actual recorded payment; a
  non-zero booked `pay_cents` alone does **not** block delete).

On refusal the response directs the caller to **cancel** instead. On success the event and its dependent
rows are removed; audited (`event.deleted`).

## Response

PATCH → `200` with the updated event (including `status`, `advertisedPriceCents`). DELETE → `204` on success,
`409` when guarded.

## Public exposure (B25/B27 → `/whats-on`)

The public schedule/detail read model gains `cancelled: boolean` (shown as a marker, event still listed) and
`advertisedPrice` (shown when set). It exposes **only `confirmed` bookings** (proposed/requested/declined are
hidden — FR-022). No status/pay/PII is ever exposed.
