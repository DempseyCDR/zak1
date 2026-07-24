# Contract: PayPal Webhook (US3)

⚠️ **Unauthenticated route** (research R2). Declares `withPublic`; enumerated in the route-inventory
allowlist. Authenticity comes from **signature verification**, never from a session or a URL secret.

---

## `POST /api/webhooks/paypal`

**Request headers** (PayPal-supplied, all required for verification):

`paypal-transmission-id` · `paypal-transmission-time` · `paypal-transmission-sig` · `paypal-cert-url` ·
`paypal-auth-algo`

**Body**: PayPal notification JSON. Zod-parsed **before any field is trusted**, including before
verification — a malformed body is rejected without a verification round-trip.

Fields consumed: `id` (→ `provider_event_id`), `event_type`, payer email, and the capture amount. The exact
paths are confirmed against a real sandbox notification at implementation (spec Clarifications; research R1).

---

## Processing order — the order is the contract

1. **Parse** with Zod. Malformed → `400`, nothing stored.
2. **Verify** the signature via PayPal's verification endpoint. Fails → `401`, **nothing stored** (FR-011.3).
   Logged with full context: an unverifiable notification is either a bug or an attack, and both need
   investigating.
3. **Insert** into `paypal_notifications`. A duplicate `provider_event_id` violates the UNIQUE constraint →
   respond `200`, do nothing further. **The database constraint is the idempotency mechanism** (FR-013), not
   an application-level "have I seen this?" check, which races under concurrent redelivery.
4. **Match** `payer_email` (case-insensitive) against `membership_captures` in `awaiting_payment`.
   - **Match** → create/renew the membership via the shared path (FR-012), capture → `matched`,
     notification → `matched`.
   - **No match** → notification → `parked`. **Still `200`.**
5. **Respond `200`** for every verified notification, matched or parked.

**Why parked still returns 200**: a non-2xx tells PayPal to retry. A payment we cannot match will never
become matchable by redelivering the identical payload — retrying would just re-park it on a schedule. `200`
means *received and durably recorded*, which is true. Money that arrived is never dropped; it sits in the
parking lot for the admin screen.

**Steps 3–4 are one transaction.** A membership must not exist without its notification row, and a
notification must not be marked `matched` without its membership.

---

## Response summary

| Status | When | Stored |
|---|---|---|
| `400` | Malformed payload | Nothing |
| `401` | Signature verification failed | Nothing |
| `200` | Verified — matched, parked, or duplicate | Notification (+ membership if matched) |

Bodies are minimal and uninformative by design. A webhook endpoint is unauthenticated; its responses should
tell a prober nothing about club members. In particular a `200` must not distinguish *matched* from *parked*
to the caller.

---

## Testing (Constitution v1.2.0 §Technology Standards)

PayPal is a third-party service the project does not operate, so automated tests **must not** call its
endpoints — the same carve-out feature 015 uses for Google.

- **Boundary**: verification is a single injectable seam. Tests supply verified / unverified outcomes and
  fixture payloads reproducing PayPal's documented contract.
- **Everything behind the seam is integration-tested against real Postgres**: parse, insert, unique-violation
  idempotency, case-insensitive matching, parking, membership creation, transactional rollback.
- **Explicit required cases**: duplicate `provider_event_id` creates exactly one membership (FR-013 / SC-005);
  a failed verification leaves both tables empty (FR-011.3); a parked payment linked later by an admin
  produces a membership identical to the auto-matched one.
- The verification call itself is **never** exercised against production. What is tested is that a `false`
  outcome stops processing dead.
