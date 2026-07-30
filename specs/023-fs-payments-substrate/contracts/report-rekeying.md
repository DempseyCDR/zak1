# Contract: treasurer & organizer report re-keying

No server-endpoint shape is removed; the per-event report **payloads** gain/repurpose fields.

## Treasurer per-event report (QBO view)

Grouped by the **recorded-at** event (`performer_payments.event_id`). Per check:

```text
{
  checkNumber, writtenDate (= event date), payee, total,
  voided: boolean, voidReason?,               // voided checks shown DISTINCTLY
  lines: [ { performer, bookingId, amount, account } ]   // per-line breakdown; incl. cross-event lines
}
```

- Change from today: **one aggregate line per check → the per-line breakdown**; the `bookings.event_id =
  eventId` filter on links is **dropped** so a cross-event check's lines appear.
- Live vs voided are separated so Mike enters both the check and its void into QuickBooks.

## Organizer per-event cost

- **Performer cost** = a **single figure** by incurred date: for each of the event's bookings, its **live
  settled amount** if paid, else its **expected `pay_cents`** (still-outstanding). Summed. Replaces today's
  plain `Σ bookings.pay_cents`.
- **No paid-vs-outstanding breakdown on the organizer view** — that split is for the treasurer/FS (the
  reconciliation delta) and sometimes the booker (R5).
- A delayed check's amount lands on its booking's event; before it is paid, that booking contributes its
  expected amount, so the event total is stable (never on the writing event).

## Unchanged

- Public/confirmed-only schedule, the reconciliation delta concept (now computed from live payments), and the
  event-delete guardrail (still blocks on a recorded payment).
