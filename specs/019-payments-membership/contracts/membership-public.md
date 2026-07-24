# Contract: Public Membership Capture (US3)

⚠️ **This is one of the project's two first unauthenticated `/api/*` routes.** See research R2 before
changing anything here. It declares `withPublic` — deliberate publicity, not a forgotten `withAuth` — and is
enumerated in the route-inventory allowlist.

---

## `POST /api/public/membership`

Capture a prospective member's details before they are sent to PayPal's hosted button. **Public — no session.**

**Request:**

```jsonc
{
  "name": "Jane Dancer",
  "email": "jane@example.org"   // the match key for the webhook (FR-011)
}
```

**Responses:**

| Status | Body | When |
|---|---|---|
| `201` | `{ "captureId": "uuid" }` | Captured, awaiting payment |
| `400` | `VALIDATION_ERROR` | Zod failure — malformed email, missing name |
| `429` | `RATE_LIMITED` | See abuse note below |

**Abuse surface — this endpoint is an unauthenticated write.** It is the only one in the project, and it
accepts free text. Three mitigations are part of the contract, not optional hardening:

1. **The capture confers nothing.** A row in `membership_captures` is inert — it is not a contact, not a
   membership, and appears in no staff surface except the parked-payment admin screen. Only a *verified
   PayPal notification* can turn it into a membership. Flooding the table costs an attacker nothing and
   gains them nothing.
2. **Rate limiting by IP**, returning `429`. Modest limits, in-memory (single-tenant, one server — no shared
   store needed) — this is a club website; a human fills this form once. Resubmitting is fine: when several
   captures share an email, the **latest wins** and older ones are expired.
3. **Retention**: captures in `awaiting_payment` past the retention window are swept to `expired` (the spec's
   "member enters info but never pays" edge case), bounding table growth.

**Privacy**: the response body carries **only** the capture id — never contact data, never whether the email
matched an existing contact. Echoing "you're already a member" to an unauthenticated caller would make this
endpoint a membership oracle for arbitrary email addresses. FR-016 requires the public flow expose only what
a member needs; the capture id is the whole of that.

---

## `GET /join` (public page)

Server-rendered under `(public)`. Renders the capture form, then the club's existing **PayPal hosted button
`Z5FUDMVGE6CVQ`** as-is.

The button is fully PayPal-hosted and gives **no callback** to the club's site — the page cannot know whether
payment succeeded. It must therefore say so honestly: after submitting details and being handed to PayPal,
the member is told their membership activates once payment is confirmed, not that it is active. Claiming
success at this point would be a lie the site cannot back up.

**No staff or finance data** appears on this page or in its payload (FR-016 / SC-006).

---

## Admin: parked payments

## `GET /api/membership-captures/parked` · `POST /api/membership-captures/[id]/link`

`requires: 'membership.write'` (existing capability; FS and Treasurer hold it). Capture data (name, payer
email) is **pre-contact** information — deliberately gated by `membership.write`, not `contact.pii.read`,
because a capture is not yet a contact and the people who must act on parked money are exactly the
membership-writers. Lists verified-but-unmatched notifications and links one to a contact, creating/renewing the membership through the same shared path
(FR-011, FR-012). This is the manual fallback that makes "parked, not dropped" real — without this screen the
parking lot is a table nobody reads.
