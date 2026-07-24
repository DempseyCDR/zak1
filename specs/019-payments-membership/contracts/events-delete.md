# Contract: Event Deletion Guardrail (US4)

Modifies the existing `DELETE /api/events/[id]` (feature 018). `requires: 'event.write'`; the service still
calls `assertEventScope`. Authorization is unchanged (FR-020) — only *what counts as history* changes.

---

## `DELETE /api/events/[id]?confirmDiscardAttendance=true`

**The history test is now a single predicate.** Deletion is refused when **any** of:

| Blocker | Check |
|---|---|
| Non-empty door record | `!isEmptyDoorRecord(row, gateSaleCount)` — any gate sale, or any non-zero money field or count |
| Paid booking | A booking with a non-null `check_number` |
| Performer payment | Any `performer_payments` row for the event — **new in this feature** (FR-019) |

**Attendance never blocks** (FR-018).

`isEmptyDoorRecord` **excludes `seed_float_cents`**. The float is a pre-filled default, not takings — and
after US5 it is a *configured* value, so a non-$15 float says even less about whether the night happened.
This exclusion is the crux of the whole fix: it is what makes an event whose check-in page was merely opened
deletable again.

---

## Responses

| Status | Code | When |
|---|---|---|
| `204` | — | Deleted (door record, attendance, and proposed bookings cascade) |
| `409` | `EVENT_HAS_HISTORY` | A real blocker above. **`detail` names which one** (FR-019) |
| `409` | `EVENT_HAS_ATTENDANCE` | No real blocker, but attendance rows exist and `confirmDiscardAttendance` was not passed. Body carries `attendeeCount` (FR-018a) |
| `403` | `UNAUTHORIZED` | Out of scope for this actor |
| `404` | `EVENT_NOT_FOUND` | |

```jsonc
// 409 EVENT_HAS_ATTENDANCE
{ "error": { "code": "EVENT_HAS_ATTENDANCE", "attendeeCount": 3 } }
```

**`confirmDiscardAttendance` is not a general override.** It suppresses `EVENT_HAS_ATTENDANCE` and nothing
else — an event with takings, a check, or a payment stays refused however it is called. This is spec scenario
4, and it is the failure mode most worth an explicit test: a confirm flag that quietly became a force-delete
would destroy financial records.

Two new `ApiError` codes are added to `apiError.ts`: `EVENT_HAS_ATTENDANCE`, and the `detail` payload on the
existing `EVENT_HAS_HISTORY`.

---

## UI (`/events`)

`deleteEvent` in [`page.tsx:64`](../../../src/app/(admin)/events/page.tsx) currently shows a fixed string —
*"Could not delete — cancel it instead if it has history."* That message is now wrong twice over: it does not
say *what* blocks deletion, and it fires for the attendance case which is no longer a refusal but a question.

New behaviour:

- `EVENT_HAS_HISTORY` → show the specific blocker from `detail`.
- `EVENT_HAS_ATTENDANCE` → prompt with the count ("This event has 3 checked-in attendees. Delete anyway?"),
  and on confirmation retry with `confirmDiscardAttendance=true`.
- `204` → remove from the list as today.

The count must appear **before** the destructive action, never as an after-the-fact notice — surfacing it
afterwards would satisfy the letter of FR-018a and none of its purpose.

---

## Migration/data note

The two never-held `tnc` 2026-07-16 events in `zak1_dev` (Project Context v1.9 §9) become deletable once this
ships: empty door records, one stray attendance row, five checkless bookings. **Clearing them is an
operational step, not part of this feature** (spec Out of Scope) — but they are the natural manual
verification that the fix works on real data.
