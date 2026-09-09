# Mel contact maintenance — what is left

Close-out companion to [mel-contact-maintenance.md](./mel-contact-maintenance.md). **Every requirement
M-R1–M-R27 in that document is implemented** as of feature 070:

| Requirements | Feature |
|---|---|
| M-R1, M-R2 — capability catalog | 059 |
| M-R3, M-R4 — maintenance search + two-section results | 062 |
| M-R5–M-R8 — record mode, name control, governance fields | 063 |
| M-R9–M-R12 — archive, safe delete, unrestricted delete | 065 |
| M-R13–M-R17 — per-contact email editor | 066 |
| M-R23–M-R27 — shared / family emails (pointer model) | 067 |
| — membership accounts (households, levels, derived status) | 068 |
| M-R18–M-R22 — triage worklists, rejections, held merges | 069 |
| — drop the retired `memberships` / `payers` tables | 070 |

Two of §7's four open items were resolved along the way: `contact.email.delete` **folded into**
`contact.delete.unrestricted` (feature 066), and primary-email designation (**B3**) was always out of
scope. What follows is everything still outstanding.

---

## 1. A merge does not relink `staff_identities` or `role_grants`

This is §7's M-R21 open item, still open. Feature 069 shipped the *choice* of surviving sign-in and the
held-merge machinery around it, but `mergeService` touches neither table.

### 1a. A merged or archived volunteer keeps their access — **FIXED in 071**

`readSession` checked `is_volunteer` but never `merged_into_id` or `archived_at`, so a retired contact
with a live session kept working and their Google sign-in still resolved. Latent when found — no merged
or archived contact held an identity — but **3 merged contacts still carried `is_volunteer = true`**, so
the one check that existed had already stopped catching them.

Feature 071 rejects both at session read, the same way withdrawn volunteer access is rejected. The stale
`is_volunteer` flags on already-merged contacts are a separate data cleanup.

### 1b. The relinking itself — **still open**

Deferred because the collisions are real and need specifying, not because the work is large:

- **`staff_identities` is UNIQUE on `contact_id`.** Merging two staff contacts cannot simply move the
  identity — this is a third structural collision, the same shape as the two feature 069 already holds
  for (`two_logins`, `two_accounts`). It plausibly wants a third `held_merge_reason`.
- **`role_grants_unique` is `(contact_id, role, series_id, group_id)` with `NULLS NOT DISTINCT`.** Both
  contacts holding the same role at the same scope collide on relink.

Until this lands, merging a volunteer leaves their identity and grants stranded on the retired shell.

## 2. There is no unmerge

`merge_audit.relinked_counts` records **counts, not identifiers**, so the table says a merge happened but
not what moved. Clearing `contacts.merged_into_id` restores the contact row — names, phone, pronouns and
timestamps are untouched — but the re-pointed emails and memberships cannot be told apart from the
survivor's own. Two paths are also destructive: a colliding `membership_members` row is deleted, as is
the unchosen account when a `two_accounts` hold is resolved.

**Recovery from a mistaken merge is a database restore.** The proposed shape of a fix — moved row ids,
marking instead of deleting, an unmerge service, and a retention decision — is written up in
[specs/069-triage-worklists/tasks.md](../069-triage-worklists/tasks.md).

## 3. Smaller items

- **Held-merge resolution chooser (UI).** The service and endpoints are complete and tested for both
  `two_logins` and `two_accounts`; the needs-review queue's **Resolve** currently just opens the record.
- **Feature 069 quickstart manual pass**, including the two-role check with and without `role.assign`.
  Needs a signed-in staff session.
- **M-R16 provider telemetry** is built into the email editor; §7 asks only that it be **confirmed on the
  mobile layout**.

---

## Sequencing note

Items 1b, 2 and 3's chooser all touch `mergeService` and the held-merge model, so they make **one coherent
feature** rather than three. Item 1a was separable and did not wait for them — it shipped as 071.
