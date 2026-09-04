# Phase 1 Data Model: Membership Accounts

## Schema change

Two tables in, two out — but **in three steps, not one**.

A single migration that created the new tables, moved the data and dropped the old ones would break every
read path the instant it ran: the test suite applies all migrations via `ensureSchema`, so the whole suite
would go red until all ten files reading `memberships` were re-pointed. That makes incremental,
independently-testable phases impossible and leaves no safe intermediate state.

| Step | What | When |
|---|---|---|
| **0043** | DDL only — create the two tables, add `gate_sales.membership_level`. Old tables untouched. | Setup |
| **`migrateToAccounts`** | The data move, as a callable, testable routine (the pattern feature 044 used for the contact load). Run once per environment. | Setup |
| *(follow-up)* | Drop `memberships` and `payers`. **Not in this feature** — the migration test seeds them, and `ensureSchema` applies every migration, so dropping here would delete the guard on the data move (research R9). | A later feature |

After 0043 both models exist and the original rows are intact, which is also the rollback position; they
stay that way until the follow-up. Putting the data move in code rather than SQL is what makes it testable at all: the test database
starts empty, so a move written inside a migration could never be exercised against realistic input.

```sql
CREATE TABLE membership_accounts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payer_contact_id  uuid NOT NULL REFERENCES contacts(id),   -- NOT ON DELETE SET NULL: see FR-009
  level             membership_level NOT NULL,
  expiry_date       date NOT NULL,
  last_payment_date date,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX membership_accounts_payer ON membership_accounts (payer_contact_id);

CREATE TABLE membership_members (
  account_id  uuid NOT NULL REFERENCES membership_accounts(id) ON DELETE CASCADE,
  contact_id  uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  attached_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, contact_id)
);
CREATE INDEX membership_members_contact ON membership_members (contact_id);

-- gate dues lines record what was bought, independently of the amount (FR-003, FR-005)
ALTER TABLE gate_sales ADD COLUMN membership_level membership_level;

```

The legacy tables are left in place — see research R9.

| Decision | Why |
|---|---|
| `payer_contact_id` **has no `ON DELETE` clause** | Deleting a payer's contact must be *refused*, not silently absorbed (FR-009). The default `NO ACTION` makes the database the backstop; the safe-delete blocker gives the human-readable refusal. This is the exact opposite of the old `payers.contact_id ON DELETE SET NULL`, which is how ownerless payers arose. |
| **Unique** on `payer_contact_id` | FR-004: a payer has at most one durable account. Renewal moves `expiry_date`; it never inserts. |
| `membership_members` cascades from both sides | An account's attachments die with it; a deleted member contact simply detaches. Neither can strand a row. |
| No `source_gate_sale_id` / `source_notification_id` | A durable account cannot key on one payment. Idempotency is unaffected — see research R2. |
| `membership_level` nullable on `gate_sales` | Meaningless on the other six categories; required by validation on `membership` lines. |

## Entities

### Membership account

What a household bought. Owned by a **payer contact**, carrying the **level** (the payer's attribute) and
the **expiry** (everyone's). Durable: a further payment moves the expiry forward and may change the level.

**Invariants**:

| # | Rule | Source | Enforcement |
|---|---|---|---|
| I1 | One account per payer. | FR-004 | Unique index. |
| I2 | The payer is always attached as a member. | FR-007 | Service, on create. |
| I3 | `individual` and `student` admit the payer alone; `family` and `supporter` may cover others. | FR-003a | Service, on attach **and** on level change; cross-row, so not a CHECK. |
| I4 | An account always has a contact as owner. | FR-009 | FK + delete blocker. |
| I5 | Expiry derives from the payment date via the year-end boundary and 2-month grace. | FR-002 | Service; the existing `grantedMembershipExpiry` unchanged. |

### Attachment (`membership_members`)

The fact that makes a contact a member. Created for the payer automatically, added for the rest of the
household, and untouched by renewal. **This is what the member mailing list is built from** (FR-011) —
replacing `contacts.list_member` as the definition.

### Contact (unchanged columns, changed meaning)

`membership_status` and `list_member` remain as a **cache**: backfilled once (FR-015a) and refreshed on
write, but no longer the source of truth. Authoritative answers come from the derivation below.

## Derived read: contact membership

Not stored. One SQL fragment in `membershipStatus.ts`, used by every read path:

```text
coverage(contact) := accounts where contact ∈ members(account)
status(contact)   := classify(MAX(expiry) over coverage)      -- never / current / lapsed / long_lapsed
level(contact)    := level of the account the contact PAYS FOR, else none   -- FR-013
is_member(contact):= coverage is non-empty                                  -- FR-011
```

Status uses the **most generous** covering account (FR-010). Level is *not* arbitrated: it belongs to the
payer, so a contact has at most one (research R3, clarification Q3).

## State transitions

```text
no account ──record dues──▶ account (level L, expiry E), payer attached
account    ──record dues──▶ expiry moves forward; level MAY change (FR-024)
account    ──attach─────▶ member added        (refused if level admits no more — I3)
account    ──detach─────▶ member removed      (the payer cannot be detached — I2/FR-009)
account    ──change level▶ new level          (refused if it would displace members — I3)
account    ──payer contact deleted──▶ REFUSED (FR-009)
```

Status is not a transition — it is a function of expiry and today, so the 1 September rollover changes
every reader's answer with no write at all.

## Migration (from 154 rows)

```text
per payer group in memberships:
  account   := { payer: payer.contact_id ?? resolve(payer.name),   -- FR-021
                 level: the group's single level,
                 expiry: MAX(expiry_date) }
  members   := every distinct contact_id in the group, plus the payer
```

`resolve(name)` matches an existing contact by name; failing that it **creates** one and flags it
`needs_review` (FR-021). Measured inputs: 154 rows, 115 payer groups, 152 distinct member contacts, 31
groups with more than one member, **0** level or expiry conflicts, **0** capacity violations, 17 payers
needing `resolve`.
