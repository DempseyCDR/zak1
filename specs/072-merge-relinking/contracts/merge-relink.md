# Contract: Merge relinking

Merging continues to require **`dedup.write`** (FR-005). Resolving a hold requires the authority its
reason demands. **No new capability is introduced.**

## 1. Merge — the outcome shape

```http
POST /api/dedup/merge   { "canonicalId": "…", "mergedId": "…" }
```

The discriminated outcome from feature 069 is unchanged in shape. What changes is what `moved` reports and
which reasons can appear:

```jsonc
{
  "outcome": "completed",
  "canonicalId": "…",
  "moved": {                          // now covers every `move` reference, not three
    "contact_emails": 2,
    "membership_accounts": 0,
    "membership_members": 1,
    "attendance": 3,
    "gate_sales": 1,
    "membership_captures": 0,
    "performers": 1,
    "officers": 0,
    "venues": 0,
    "role_grants": 2,
    "staff_identities": 1
  }
}
```

```jsonc
{ "outcome": "held", "reason": "two_accounts",  "heldMergeId": "…", "candidates": [ … ] }
{ "outcome": "held", "reason": "two_logins",    "heldMergeId": "…", "candidates": [ … ] }
{ "outcome": "held", "reason": "role_conflict", "heldMergeId": "…",
  "candidates": [ { "grantId": "…", "role": "treasurer", "scope": null,
                    "heldBy": "merged", "conflict": "exclusive" },
                  { "grantId": "…", "role": "vice_president", "scope": null,
                    "heldBy": "merged", "conflict": "role_assign" } ] }
```

**A held merge changes nothing** (FR-016). Both new collisions are detected **before** the transaction
opens, as the two existing ones already are — so a hold writes only its own row.

`role_conflict` candidates name the grants that triggered the hold and why, so the resolver can see whether
they are looking at an escalation, an exclusivity clash, or both. `heldBy` distinguishes a grant the
survivor already holds from one the merged record brings, because the exclusivity trigger can arise from
the survivor's side alone.

## 2. Resolving a hold

```http
POST /api/dedup/held/{id}/resolve
```

| Reason | Authority | Body |
|---|---|---|
| `two_accounts` | `dedup.write` | `{ "survivingAccountId": "…" }` |
| `two_logins` | `role.assign` | `{ "survivingIdentityId": "…", "survivingLoginEmailId": "…" }` |
| `role_conflict` | `role.assign` | `{ "keepGrantIds": ["…"] }` — possibly empty |

**`two_logins` is a corrected contract.** Feature 069 accepted `survivingLoginEmailId` alone, which set the
login label and left the account binding untouched — so the answer did not determine who could sign in.
Both fields are now required together (FR-012a), and the pair must be consistent: the surviving identity
and the surviving address must belong to the same one of the two contacts.

| Status | Code | When |
|---|---|---|
| `404` | `HELD_MERGE_NOT_FOUND` | no open hold with that id |
| `422` | `HELD_MERGE_REASON_MISMATCH` | the choice does not answer the reason held — including `survivingLoginEmailId` without `survivingIdentityId` |
| `403` | `UNAUTHORIZED` | the caller lacks the reason's authority |

`keepGrantIds` names the subset of the **merged** record's grants to move. An empty array is valid and
means "move none" — the survivor keeps only what it already had. Grants not named are simply not moved;
they remain on the retired contact, where nothing reads them.

## 3. Auto-close

A hold closes itself, merging nothing, when its cause is gone (FR-010a). This is the route by which a hold
is resolved without a resolution screen: an authorised person removes the cause where that decision
already lives — the access screen for a role, the membership screen for an account — and the merge then
succeeds on a second attempt.

| Reason | Closes when |
|---|---|
| any | either contact is merged away or archived |
| `two_accounts` | fewer than two accounts remain across the pair |
| `two_logins` | fewer than two sign-ins remain across the pair |
| `role_conflict` | the union no longer triggers either condition |

## 4. Sign-in

Not an HTTP contract change — a behavioural one. `resolveSignIn` refuses a **retired** contact by both
routes (FR-013):

- the **known account** route, where a Google account is already bound to a contact since merged or
  archived;
- the **first-time enrolment** route, where a verified address matches an active email on a retired
  contact.

The refusal is the existing generic one — it does not say why (feature 015 chose that deliberately, so no
Google user can probe club membership). The change is that refusal now happens **at sign-in**, rather than
a session being minted that feature 071 then rejects on every request.

## 5. What is unchanged

`GET /api/dedup/suggestions`, the rejections endpoints, and the needs-review queue are untouched. Held
merges appear in that queue exactly as the existing two reasons do, with explanatory text for the new one.
The resolution **screen** remains unbuilt for all three reasons — out of scope here, tracked separately.
