# Phase 0 Research: Feature 019 — Payments, Membership Acquisition & Door-Record Fixes

**Date**: 2026-07-21 · **Plan**: [plan.md](plan.md) · **Spec**: [spec.md](spec.md)

Eight decisions. R1–R3 and R5–R7 serve the payment/membership stories; R4 and R8 serve the two small fixes.
Several were forced by reading the existing code rather than by the spec — those are flagged, because they
are where an implementer would otherwise be surprised.

---

## R1 — PayPal webhook verification

**Decision**: Verify each notification by calling PayPal's `verify-webhook-signature` endpoint from the
server, with the webhook id held in environment configuration alongside the existing Google secrets. Parse
the payload with Zod **before** trusting any field, including before the verification call.

**Rationale**: FR-011 mandates authenticity verification. PayPal's own verification API is the contract they
document and support; reimplementing certificate-chain validation locally means owning their cert rotation
forever. The verification call is a plain HTTPS request — no SDK, hence no new runtime dependency and no
supply-chain surface for a single endpoint.

**Constitution fit**: Constitution v1.2.0 §Technology Standards carves out exactly this case — a third-party
service the project does not operate, which automated tests must not call in production. The precedent is
feature 015 (Google). Tests therefore use **fixtures reproducing the provider's verified contract**: a
captured payload shape plus stubbed verification outcomes at the seam. Everything on our side of the seam —
payload parsing, payer-email matching, parking, idempotency, membership creation — is integration-tested
against real Postgres.

**Alternatives considered**: (a) Local signature/cert verification — rejected, ongoing rotation burden for no
gain. (b) Trusting the payload unverified and reconciling later in QBO — rejected, FR-011 is explicit and an
unverified webhook is an open door to forged memberships. (c) Polling PayPal for transactions instead of
receiving webhooks — rejected as a larger, slower, and equally external design.

**Open at implementation** (as the spec anticipated): the exact event type. `PAYMENT.CAPTURE.COMPLETED` is
the expected one for a hosted button, but the payload must be confirmed against a real sandbox notification
before the Zod schema is frozen.

---

## R2 — Unauthenticated API routes ⚠️ *architectural*

**Decision**: Introduce a `withPublic` wrapper and an **explicitly enumerated** allowlist of public routes —
`/api/public/membership` and `/api/webhooks/paypal` — extending the route-inventory guard that today exempts
only `/api/auth/*`. `withPublic` wraps `withLogging` exactly as `withAuth` does, so public routes are
logged and audited identically; it exists to make "this route is deliberately unauthenticated" a **declared,
greppable, test-asserted fact** rather than an omission.

**Rationale**: This is the sharpest decision in the feature. `/api/*` is default-deny today, and
`auth.routeInventory.test.ts` enforces it by asserting every non-auth route's wrapper is literally
`withAuth`. US3 needs two endpoints that cannot possibly carry a staff session: a public capture form, and a
webhook from PayPal. Rather than weaken the guard into "some routes may declare nothing," the guard gains a
second permitted wrapper and an explicit route list — so the invariant becomes "every route declares either
authentication or deliberate publicity," which is *stronger* than what a silent exemption would leave.

**Why this matters beyond this feature**: it is the first crack in default-deny. Keeping the allowlist
enumerated in code means a future third public route is a visible, reviewable diff, not a quiet addition. The
existing test is the enforcement mechanism and must be extended, not relaxed.

**Alternatives considered**: (a) A shared secret in the webhook URL — rejected: a credential in a query
string, unrotatable in practice, and strictly weaker than the signature verification FR-011 already requires.
(b) Making the guard tolerate any unwrapped route under `/api/public/` by path convention — rejected: path
conventions are not enforced by the type system, and a typo'd path would silently become unguarded. (c)
Handling the capture form as a server action rather than an endpoint — viable for the form, but the webhook
still needs a route, so it would leave two mechanisms where one suffices.

---

## R3 — Membership-year-end boundary

**Decision**: Add a `membership_year_end` column (a month-day value, e.g. `08-31`) to the **existing**
`club_settings` singleton (`id = 1`). Expiry resolution is a pure function: given a payment date and the
boundary, return the next occurrence of that boundary on or after the payment date.

**Rationale**: This corrects an assumption carried in the spec. `club_settings` already exists — it holds
`long_lapse_cycles` and `cycle_definition`, is already read by `membershipService.getSettings()`, and already
has a `club_settings.write` capability in the catalog. FR-003a's "new club configuration" therefore needs
**no new mechanism**: one column, one existing settings surface, one existing capability. The spec's
Assumptions section warned of "two configuration scopes"; in the code there is one pre-existing club-wide
settings home and one pre-existing per-series one, and this feature uses each for what it already does.

**Purity matters**: the boundary resolution must be a standalone pure function (`membershipTerm.ts`) with no
DB access, because it is the piece most likely to be wrong at year boundaries and leap days, and it is used
identically by both acquisition channels.

**Alternatives considered**: (a) A new `membership_config` table — rejected, YAGNI given the singleton exists.
(b) Storing a full date and rolling it annually — rejected, requires a job and drifts; a month-day is
year-agnostic by construction. (c) Deriving the boundary from `cycle_definition` — rejected, that field means
something else (lapse classification) and overloading it would couple two unrelated rules.

**Operational input still required**: the actual boundary date is a CDR decision, not a code decision. The
migration must ship a default; the club confirms the real value before rollout.

---

## R4 — Seed float as a series parameter ⚠️ *forced by code reading*

**Decision**: Add `door` to `parameter_category` and `seed_float` to `parameter_kind`, and add a **sibling
resolver** `resolveParameterCentsOrNull` that returns `null` when no row is configured. `createDoorRecord` /
`ensureDoorRecord` resolve the series' seed float for the event date and fall back to a documented club
default when the resolver returns `null`.

**Rationale**: The existing `resolveParameterCents` returns `0` when nothing is configured. For rates and
expenses that is correct and harmless — an unconfigured caller rate genuinely is zero. For the seed float it
is actively wrong: it collapses **"no seed float configured"** (FR-024 → apply the documented default) and
**"seed float deliberately set to $0"** (a series that runs no float at all) into the same answer. A door
record would silently open with a $0 float and the deposit calculation would over-report cash. Hence a
sibling resolver rather than a changed one — the existing callers keep their correct behaviour untouched.

**Why the existing mechanism at all**: `series_parameters` already provides per-series scoping,
effective-dating, an audit table, and the `parameter.write` capability. FR-025 (changing the value must not
alter existing door records) falls out for free, because the float is **copied onto the door record at
creation** and never re-resolved.

**Alternatives considered**: (a) A new `door_settings` table — rejected, duplicates an existing mechanism.
(b) A club-wide setting on `club_settings` — rejected by the user's clarification (per-series was chosen
deliberately). (c) Changing `resolveParameterCents` to return `null` and updating all callers — rejected as a
wider blast radius across working code for one new caller's benefit.

---

## R5 — B31 idempotency against replace-all gate saves ⚠️ *forced by code reading*

**Decision**: Membership creation from the gate is a **reconcile**, not an insert-on-write. After a gate-sales
save, ensure exactly **one** membership per `(door_record, contact)` for named `membership` lines, keyed by a
new `memberships.source_gate_sale_id`. Re-saving identical lines is a no-op; removing a line is surfaced, not
silently reversed.

**Rationale**: This is the trap in the feature. `putGateSales` is **replace-all** — it deletes every gate-sale
row for the door record and reinserts them (`doorRecordService.ts`). A naive "on membership line insert,
create membership" would create a **new membership every time the FS saves the gate page**, and the FS saves
repeatedly through an evening. FR-004 ("a renewal MUST NOT create a confusingly duplicated active
membership") would be violated by the mechanism meant to implement it. Keying membership rows to their
originating gate-sale identity makes the operation naturally idempotent under replace-all.

**Deliberate asymmetry**: deleting a membership gate-sale line does **not** auto-delete the membership.
Revoking someone's membership because a line was retyped is a destructive surprise; the spec's edge cases do
not ask for it, and an admin can remove it explicitly. The reconcile creates and updates, never revokes.

**Alternatives considered**: (a) Unique constraint on `(contact_id, expiry_date)` — rejected, it would also
block a legitimate second payment and encodes policy in a constraint. (b) Making `putGateSales` a diff
instead of replace-all — a larger refactor of working code, and the origin FK is needed for audit anyway.

---

## R6 — Transaction-capable `createMembership`

**Decision**: Change `createMembership(db: Db, …)` to accept `DbOrTx`, opening its own transaction only when
handed a plain `Db`. `recomputeContactStatus` already takes `DbOrTx`, so the pattern is established.

**Rationale**: FR-001 requires the membership to commit **atomically with the gate sale**, and FR-015
requires both acquisition channels through one shared path. Today `createMembership` opens its own
transaction, so calling it from inside the gate-sale transaction would either nest or split the commit. This
is a small, mechanical, well-precedented change — but it is a signature change on a routine feature 001 owns,
so it needs its own test coverage proving the rollback case (FR-001 scenario 4).

**Alternatives considered**: (a) Duplicating the creation logic inside the gate flow — rejected outright,
FR-015 exists precisely to prevent two divergent membership paths. (b) Committing the gate sale first and the
membership after — rejected, that is the non-atomic behaviour FR-001 forbids.

---

## R7 — Treasurer report cutover and backfill

**Decision**: Switch the report's `performerPayments` lines from `bookings` to `performer_payments`, and
**backfill** `performer_payments` in migration 0024 from every existing booking with a non-zero `pay_cents`,
creating one payment per booking plus its join row. Add a reconciliation delta (expected − actual) to the
report.

**Rationale**: Without the backfill, every historical event's treasurer report would lose its performer lines
the moment the cutover lands — a silent regression in financial reporting. Feature 018's migration 0023 set
the precedent for exactly this move (backfilling bookings to `confirmed` so the public display did not
regress). The backfill is one-for-one and lossless: existing bookings already carry payee, amount, and check
number, which is precisely the new table's shape.

**Alternatives considered**: (a) Reading from both tables and merging — rejected, permanent dual-source
complexity for a one-time migration problem. (b) No backfill, accepting history loss — rejected, this is the
club's financial record.

---

## R8 — Delete guardrail predicate and confirmation

**Decision**: Extract a pure `isEmptyDoorRecord(row, gateSaleCount)` predicate into `door/calc.ts`.
`deleteEvent` refuses only on: a non-empty door record, a booking with a check number, or a recorded
performer payment. Attendance never blocks. When attendance rows exist, deletion requires an explicit
confirmation parameter, and the refusal-without-confirmation response carries the attendee count.

**Rationale**: FR-017's "empty" must be one testable predicate, not a condition spread across a service
method — it is the whole guardrail now, so it deserves isolated unit tests (all-zero, one non-zero field,
non-default seed float only, one gate sale). Excluding `seed_float_cents` from the emptiness test is the
subtle part and the one most likely to be "fixed" later by someone who does not know why: the float is a
**pre-filled default, not takings**, and after US5 it is a configured value, so a non-$15 float proves even
less about whether the night happened.

**Note the new dependency**: FR-019 adds performer payments to the blocking set, so US4 cannot be implemented
before US2's table exists. This is the ordering constraint recorded in the spec's Dependencies.

**Alternatives considered**: (a) Inline conditions in `deleteEvent` — rejected, untestable in isolation and
the emptiness rule is now load-bearing. (b) A two-call confirm flow (`DELETE` returns a token, second call
spends it) — rejected as ceremony disproportionate to a single-tenant admin screen; an explicit query
parameter is honest and testable.
