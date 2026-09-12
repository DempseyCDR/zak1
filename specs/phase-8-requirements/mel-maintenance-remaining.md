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

### 1b. The relinking itself — **CLOSED by feature 072**

Shipped in feature 072. The collisions were real and were specified rather than guessed:

- **`staff_identities` is UNIQUE on `contact_id`.** Merging two staff contacts cannot simply move the
  identity — this is a third structural collision, the same shape as the two feature 069 already holds
  for (`two_logins`, `two_accounts`). It plausibly wants a third `held_merge_reason`.
- **`role_grants_unique` is `(contact_id, role, series_id, group_id)` with `NULLS NOT DISTINCT`.** Both
  contacts holding the same role at the same scope collide on relink.

Until this lands, merging a volunteer leaves their identity and grants stranded on the retired shell.

## 2. There is no unmerge — CLOSED by feature 074 (2026-09-12)

`merge_audit.relinked_counts` recorded **counts, not identifiers**, so the table said a merge happened
but not what moved, and the re-pointed emails and memberships could not be told apart from the
survivor's own. Recovery from a mistaken merge was a database restore.

A merge now also writes a **`reversal_manifest`**: every re-linked row's primary key, the full prior
content of every row it destroys, the prior value of every field it overwrites, and the identity of
every row it creates. `POST /api/dedup/merges/{id}/undo` replays it, and the contact record shows the
merges that produced it with an honest verdict on each.

Feature 074 also found and recorded **five** destructive paths where this section named two. The fifth
had no statement of its own anywhere in the merge: `membership_members.account_id` is
`ON DELETE CASCADE`, so deleting the unchosen account silently destroyed every household row on it —
including the ones `ON CONFLICT DO NOTHING` never copied because that person was already on the
surviving account.

**Two limits, both deliberate, both permanent:**

- Merges recorded **before** 074 have no manifest and can never be undone. There is no backfill; the
  information was never written down. They are reconstructed by hand, accepting some loss of history,
  and the UI says so rather than offering an action that would fail.
- A merge is reversible only while its survivor is still live and neither contact has been archived, so
  **chains unwind most-recent-first or not at all**. There is no time limit — age is shown as
  information, never enforced as a cut-off.

See [specs/074-undo-merge/](../074-undo-merge/).

## 2a. A merge can silently revoke a volunteer's access (FOUND 2026-09-12, NOT FIXED)

Found walking feature 074's §4 manual pass: `dempsey.peggy@gmail.com` (mailing list manager) merged into
`peggy@cdrochester.org`. The merge completed. Afterwards **neither address could sign in**, with no
message explaining why.

**Cause.** `contacts.is_volunteer` is an attribute of the PERSON, but it is not a foreign key, so it sits
entirely outside the `CONTACT_REFERENCES` classification and no merge has ever considered it. Merging a
volunteer into a non-volunteer therefore moves the role grants and the sign-in binding onto a contact
that is not a volunteer, and `resolveSignIn` requires `is_volunteer`. Both addresses then fail, because
the merged contact's email moved to the survivor and now resolves there too.

**It produces a state the system otherwise forbids.** `grantService` refuses to grant a role to a
non-volunteer (`grantRequiresVolunteer`, `grantService.ts:84`), but the merge relinks grants in raw SQL
and bypasses it — **the same class of bug as feature 072's `EXCLUSIVE_ROLES` finding**: a service-layer
invariant with no constraint behind it, walked past by a SQL relink. 072 caught exclusivity and missed
this one.

**Recovery is not automatic.** The known-`google_sub` branch of `resolveSignIn` wins before enrolment is
reached, so the person cannot simply sign in again — while the binding points at a non-volunteer, the
attempt is refused. Undoing the merge fixes it, but the undo's sign-in portion needs `role.assign`.

**The likely fix** — for its own feature, not a patch: treat `is_volunteer` as something a merge carries,
so the survivor becomes a volunteer if either side was. That wants a deliberate decision, because it
GRANTS access rather than separating records, and it is the one direction the merge has so far never
taken.

## 2b. Retired contacts still appear on the access page (FOUND 2026-09-12, NOT FIXED)

`listVolunteers` (`grantService.ts:275`) selects `contacts.is_volunteer = true` with **no merged or
archived filter**, so a contact that has been merged away is still listed as a volunteer — showing with
no roles, because its grants moved to the survivor. Same family as the `matchPerformers` and
`resolveSignIn` enrolment holes feature 072 closed; this one was missed because it is a read path.

Small and self-contained: add the active-contact predicate.

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
