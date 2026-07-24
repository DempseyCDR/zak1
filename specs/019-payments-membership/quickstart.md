# Quickstart: Validating Feature 019

**Date**: 2026-07-21 · **Plan**: [plan.md](plan.md) · **Contracts**: [contracts/](contracts/)

How to run and prove this feature works. Details live in [data-model.md](data-model.md) and the contracts;
this is the run guide.

---

## Prerequisites

```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 24 >/dev/null 2>&1   # ALWAYS first
pnpm run db:migrate      # applies 0024_payments_membership.sql
```

⚠️ **Never run `pnpm run db:seed`** — it TRUNCATEs `zak1_dev`, which holds the demo data. It is not a
migration rollback.

⚠️ **Migration 0024 contains an intentional backfill** (research R7): existing paid bookings become
`performer_payments` rows so the treasurer report does not regress. Take a snapshot first if `zak1_dev`
matters to you:

```bash
set -a; . ./.env; set +a
pg_dump -Fc "$DATABASE_URL" -f ~/zak1_pre_0024.dump
```

---

## Automated suite

```bash
pnpm test                      # baseline 450 tests must stay green, plus this feature's
pnpm exec tsc --noEmit
pnpm run lint                  # eslint + markdownlint
pnpm exec prettier --check .
pnpm build
```

### Tests that must exist before implementation (Constitution I)

Unit first — the four pure functions carry the subtle logic:

| Test | Asserts |
|---|---|
| `membershipTerm` | Next boundary on/after payment date; payment **on** the boundary; Feb-29 |
| `isEmptyDoorRecord` | All-zero → empty; any non-zero field → not empty; **non-default seed float alone → still empty**; one gate sale → not empty |
| `reconcilePayments` | Expected/actual/delta, including negative delta |
| `paypal/verify` | A `false` verification stops processing |

Then integration against real Postgres:

| Test | Asserts |
|---|---|
| Door enrollment atomicity | Named line → membership + status recompute in one transaction; forced failure leaves **neither** |
| **Gate re-save idempotency** | Saving identical gate sales twice creates **one** membership (research R5 — the trap) |
| Anonymous line | Money recorded, no membership |
| Payment substitution/aggregation | Substitute payee; one check across bookings; `bookings.pay_cents` **unchanged** |
| Treasurer report parity | Post-backfill, a historical event's report is byte-identical to pre-cutover |
| Webhook idempotency | Duplicate `provider_event_id` → exactly one membership |
| Webhook rejection | Failed verification → both tables empty |
| Parked → linked | Admin-linked payment yields a membership identical to auto-matched |
| Delete guardrail | Empty door record deletes; one gate sale refuses; confirm flag does **not** override a real blocker |
| Route inventory | The public allowlist is exactly two routes (research R2) |

---

## Manual validation

```bash
pnpm dev      # Next 16.2.10, port 3000 — GOOGLE_REDIRECT_URI must match exactly
```

Sign in as `rcd@cdrochester.org` (Super-user) unless a story names another role.

### US1 — Door membership enrollment

1. `/gate` for an event → add a **named** membership line for a contact → save.
2. That contact's membership status updates; expiry is the configured year-end.
3. **Save the same lines again** → still exactly one membership. *(The replace-all trap — check this.)*
4. Add an **anonymous** membership line → money recorded, no membership.

### US2 — Performer payment override

1. `/payments` for an event with several bookings.
2. Record a payment to a **substitute** payee → payment shows the substitute; the booking is untouched.
3. Record **one check** covering several bookings.
4. `/treasurer-report` → actual payments listed, reconciliation delta shown.
5. Confirm the bookings' rates are unchanged.

### US3 — Online membership

1. Public `/join` (signed out) → submit name + email → handed to the PayPal button.
2. Confirm the page says membership activates **on payment confirmation**, not that it is active.
3. Simulate a verified notification (fixture) → membership created for that email.
4. Replay it → still one membership.
5. Send a verified notification with an unmatched email → parked, visible on the admin screen; link it → the
   membership appears.

### US4 — Delete a never-held event

The two `tnc` 2026-07-16 events in `zak1_dev` are the real-world case (Project Context v1.9 §9):

1. `/events` → delete one → it has an empty door record and a stray attendance row → **prompt shows the
   attendee count** → confirm → deleted.
2. Try an event with a real gate sale → refused, and the message **names the blocker**.

### US5 — Configurable seed float

1. Set a `door`/`seed_float` parameter of $20 for a series.
2. Open a door record for a **new** event in that series → seed float is $20 on the record and pre-filled on
   `/gate`.
3. Override to $25 on that record → applies there only; the parameter still reads $20.
4. Confirm a **pre-existing** door record still shows its original float (FR-025).
5. A series with no parameter configured → $15 default.

---

## Success criteria mapping

| SC | Validated by |
|---|---|
| SC-001 | US1 steps 1–4 + atomicity/idempotency integration tests |
| SC-002 | US2 steps 2–4 |
| SC-003 | US2 step 5 + `pay_cents` unchanged test |
| SC-004 | US3 steps 3, 5 + rejection test |
| SC-005 | US3 step 4 + duplicate-notification test |
| SC-006 | `/join` signed out exposes no staff/finance data; route-inventory test |
| SC-007 | US4 steps 1–2 |
| SC-008 | US5 steps 1–5 |

---

## Before rollout — operational, not code

- **Set the real membership-year-end.** `club_settings.membership_year_end` ships defaulted to `08-31` as a
  **placeholder**; CDR must confirm the actual boundary. Every membership created before it is corrected gets
  the wrong expiry (research R3).
- **Confirm the PayPal event type and payload** against a real sandbox notification before freezing the Zod
  schema (research R1).
- **Publish the Google consent screen** — still in Testing; unrelated to this feature but blocks rollout.
