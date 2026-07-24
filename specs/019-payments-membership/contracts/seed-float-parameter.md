# Contract: Configurable Seed Float (US5)

Reuses the existing series-parameter surface — no new endpoint shape, no new capability. The seed float
becomes one more `(category, kind)` pair alongside rates and expenses.

- **Category** `door` (new enum value), **kind** `seed_float` (new enum value)
- **Capability** `parameter.write` — existing; Treasurer club-wide, FS per series (FR-026)
- Effective-dated and audited via `series_parameter_audit`, like every other parameter

---

## `POST /api/door-parameters`

The existing parameter surface is **split by category** — `/api/rate-parameters` and
`/api/expense-parameters`, each a thin route over `seriesParameterService`. The seed float follows the
pattern with a third sibling route (`requires: 'parameter.write'`):

```jsonc
{ "seriesKey": "tnc", "amount": 20.00, "effectiveDate": "2026-09-01" }
```

(`category`/`kind` are implied by the route, exactly as the two siblings imply theirs. `GET` mirrors the
rate-parameters resolver query.)

## Resolution at door-record creation (FR-022)

`createDoorRecord` / `ensureDoorRecord` resolve the float for the event's series and **event date**, then
write it onto the new row:

```text
resolveParameterCentsOrNull({ category:'door', kind:'seed_float', seriesId, onDate: event.eventDate })
  → null  ⇒ CLUB_DEFAULT_SEED_FLOAT_CENTS (1500)   // FR-024
  → 0     ⇒ 0, deliberately — a series that runs no float
  → n     ⇒ n
```

⚠️ **Use `resolveParameterCentsOrNull`, not the existing `resolveParameterCents`.** The existing resolver
returns `0` for "nothing configured", which for a seed float is not merely imprecise but wrong: it collapses
*unconfigured* (apply the default) with *deliberately zero* (a series with no float), and a door record
opened at $0 would over-report the cash deposit by the float amount. This is research R4 and the single
easiest thing to get wrong in US5.

**Resolved by event date, not today**, so back-filling a door record for a past event uses the float that was
in effect that night.

## Per-record override (FR-023)

Unchanged. `PATCH /api/door-records/[id]` with `seedFloat` still overrides for that record only and never
writes back to the parameter. The existing `updateDoorRecord` code path needs no change at all.

## Immutability of existing records (FR-025)

Falls out for free: the float is **copied onto the door record at creation and never re-resolved**. Changing
the parameter later cannot reach records already open, so historical deposits never silently recompute. Worth
an explicit test regardless, since it is an invariant a future refactor could quietly break by re-resolving
on read.

---

## UI

- **`/gate`** — [`page.tsx:42`](../../../src/app/(door)/gate/page.tsx) has `useState("15")`. The hard-coded
  string goes; the field initialises from the loaded door record's `seedFloat`, which already flows through
  `DoorRecordView`. **No new API call is needed** — the value is already in the payload the page fetches.
- **Parameters admin** — the seed float joins the existing per-series parameter list; no new screen.

## Deposit arithmetic

Unchanged: `deposit = grossCash − seedFloat − cashPaidOut` (`door/calc.ts`). Making the float configurable
changes where the number comes from, never what is done with it — asserted by test so a future refactor
cannot drift.
