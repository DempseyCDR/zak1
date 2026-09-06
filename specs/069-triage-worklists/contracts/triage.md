# Contract: Triage Mode — Worklists

Working the queues uses **`dedup.write`**, which Mel already holds globally. Choosing a surviving sign-in
uses **`role.assign`** (Vice-President, President, Super-user). **No new capability.**

## 1. Duplicate suggestions (extended)

```http
GET /api/dedup/suggestions?q=&includeRejected=
```

Unchanged in what it proposes — **name similarity alone**, 0.4 threshold over `dedup_normalized`. Each
candidate gains what the row needs to decide from (FR-001):

```jsonc
{
  "pairs": [{
    "a": {
      "id": "…", "displayName": "Robert Jones", "membershipStatus": "current",
      "phone": "+1585…", "emails": ["rob@…"],
      "createdAt": "2019-04-02", "updatedAt": "2026-08-14",     // record age — the common tell
      "membershipLevel": "family"
    },
    "b": { "…": "…" },
    "similarity": 0.64,
    "sharedHousehold": { "email": false, "account": true },      // 067 / 068 — evidence AGAINST a merge
    "safeToReject": true,                                        // FR-005: derived from what is shown
    "rejected": null                                             // present only with includeRejected
  }]
}
```

`sharedHousehold` reports facts that did not exist when this row was designed. A pair already **linked** by
a shared address is excluded entirely (067) and never appears; `email` here means *both hold addresses that
resolve to the same household*, which is evidence, not exclusion.

`includeRejected=1` additionally returns suppressed pairs, each with who rejected it and when — this is
what makes a mistaken rejection findable from the queue itself (FR-004a).

## 2. Reject / un-reject a pair

Vocabulary: Mel's action is **"not duplicates"**; the record it leaves is a **rejection**. The endpoints
below use the data noun.

```http
POST   /api/dedup/rejections   { "contactAId": "…", "contactBId": "…" }
DELETE /api/dedup/rejections   { "contactAId": "…", "contactBId": "…" }
```

**Capability**: `dedup.write`.

`POST` records the judgement **with the two `dedup_normalized` values as they currently stand**; the pair
is suppressed only while both still match (FR-003a). Idempotent. `DELETE` un-rejects, returning the pair to
the queue if it still meets the criteria.

| Status | Code | When |
|---|---|---|
| `404` | `CONTACT_NOT_FOUND` | either contact does not exist |
| `422` | `SAME_CONTACT` | the two ids are equal |

Ids may be supplied in either order; they are normalised so one unordered pair has one row.

## 3. Merge — three outcomes

```http
POST /api/dedup/merge   { "canonicalId": "…", "mergedId": "…", "survivingLoginEmailId": "…?" }
```

**Capability**: `dedup.write`. `survivingLoginEmailId` additionally requires `role.assign`.

**Response `200`** — a discriminated outcome, replacing today's "complete or throw":

```jsonc
{ "outcome": "completed", "canonicalId": "…", "moved": { "contact_emails": 3, "membership_accounts": 1, "membership_members": 2 } }
{ "outcome": "held", "reason": "two_logins", "heldMergeId": "…", "candidates": [ { "emailId": "…", "email": "…", "contactDisplayName": "…" } ] }
{ "outcome": "held", "reason": "two_accounts", "heldMergeId": "…", "candidates": [ { "accountId": "…", "level": "family", "expiryDate": "2027-08-31", "payerDisplayName": "…" } ] }
```

**A held merge changes nothing** (FR-013) — the transaction rolls back before any write, and only the
`held_merges` row is recorded.

| Status | Code | When |
|---|---|---|
| `409` | `ALREADY_MERGED` | either contact is already merged |
| `422` | `SAME_CONTACT` | the two ids are equal |
| `403` | `UNAUTHORIZED` | `survivingLoginEmailId` supplied without `role.assign` |

**What a completed merge moves** — the corrected set. `membership_accounts` and `membership_members` are
**new**: feature 068 retired `memberships`/`payers` but left the merge relinking them, so an account owner
merged today would strand that household's account on a retired contact.

## 4. Held merges

```http
GET  /api/dedup/held
POST /api/dedup/held/{id}/resolve   { "survivingLoginEmailId": "…" | "survivingAccountId": "…" }
```

`GET` requires `dedup.write` and feeds the **needs-review queue**, which therefore renders two kinds of
task (FR-014). Each held merge names both contacts and its reason, and must be visibly not-ordinary
clean-up — Mel can see it, and can see it is not hers to finish.

`POST …/resolve` requires the authority for the reason: `role.assign` for `two_logins`, `dedup.write` for
`two_accounts`. It applies the choice and completes the merge.

A hold is closed automatically, without merging, when its cause disappears — either contact merged away,
archived, or no longer holding the colliding thing.

## 5. What is retired

`/dedup` (the page) is **deleted**. Its API is not: `/api/dedup/suggestions` and `/api/dedup/merge` are
already what the contacts-view queue calls.

Two things travel with the page and are easy to miss. `src/server/auth/nav.ts` hand-maintains a
`{ href: "/dedup", … }` entry, and feature 035's completeness guard **fails CI** on a nav entry with no
page; `bootstrapOfficer` also names `/dedup` in an operator message. And two component suites import the
page — one of them the only coverage of the 067 guard below — so their behaviours move to the pair rather
than being deleted with it.

Its one unique contribution — feature 067's **link as shared** — moves onto the pair, with its safeguards
intact (FR-015b): the action names the address the contact would adopt, and confirms before retiring an
address that contact already owns. A name-similar pair is not evidence of a household.

## 6. A pair's three resolutions

One question — "are these one person?" — with three answers, all offered on the pair (FR-015a):

| Resolution | Effect | Destructive? |
|---|---|---|
| **Merge** | Survivor inherits everything; other contact retired | **Yes** — and must not be presented as an equal-weight peer of the others |
| **Link as shared** | Two people, one household address; pair leaves the queue thereafter | No |
| **Reject** | Two unrelated people; suppressed until a name changes | No |
