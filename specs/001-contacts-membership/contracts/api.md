# API Contracts: Contacts & Membership

Internal HTTP API exposed by Next.js route handlers under `/api`. All requests/responses JSON.
Request bodies validated with Zod; all mutations emit structured logs and (where noted) audit entries.
Errors use a consistent shape: `{ "error": { "code": string, "message": string } }`.

## Contacts

### GET /api/contacts

Query: `q?` (name search), `status?` (membership filter), `page?`, `pageSize?`.

- When `q` present → fuzzy ranked results (trigram) ordered by similarity.
- 200 → `{ items: ContactSummary[], total: number }`.
- **Perf contract**: with `q`, p95 ≤ 300 ms at ~1,300 contacts.

### POST /api/contacts

Body: `{ displayName: string, email: { address: string, purposes?: EmailPurpose[], consentTopics?: EmailConsentTopic[] } }`.
`purposes` must be a non-empty array (defaults to `["personal"]`). `consentTopics` must be a non-empty
array (defaults to `["contact_tracing"]`); if it contains `do_not_contact` that topic overrides all others.

- 201 → `Contact` (status defaults `never`).
- 409 `EMAIL_DUPLICATE` if email active/transition elsewhere.

### GET /api/contacts/:id

- 200 → `Contact` with `emails: ContactEmail[]` and `memberships: MembershipSummary[]`.
- 404 `CONTACT_NOT_FOUND`.

### PATCH /api/contacts/:id

Body: subset of `{ displayName, isVolunteer, volunteerRoles }`. (Membership status is system-managed,
not settable.) `volunteerRoles` may be non-empty only when `isVolunteer` is true → else 422
`ROLES_REQUIRE_VOLUNTEER`.

- 200 → `Contact`.

## Contact Emails

### POST /api/contacts/:id/emails

Body: `{ address, purposes?: EmailPurpose[], consentTopics?: EmailConsentTopic[], status?, isLogin? }`.
`purposes` and `consentTopics` non-empty (defaults `["personal"]` / `["contact_tracing"]`); `provider_*`
fields rejected if present.

- 201 → `ContactEmail`.
- 409 `EMAIL_DUPLICATE`; 422 `LOGIN_NOT_PERMITTED` if `isLogin` on a non-volunteer contact;
  422 `PURPOSES_REQUIRED` / `CONSENT_TOPICS_REQUIRED` if the respective set is empty.

### PATCH /api/contacts/:id/emails/:emailId

Body: subset of `{ purposes, consentTopics, status, isLogin }`. A supplied `purposes` or `consentTopics`
replaces that set and must be non-empty. `provider_*` immutable → 422 `READ_ONLY_FIELD`.

- 200 → `ContactEmail`.

## Memberships

### POST /api/memberships

Body: `{ contactId: string, payerId: string, expiryDate: string (date) }`.

- 201 → `Membership`; triggers synchronous status recompute for the contact.
- Side effect: writes `StatusChangeAudit` if status changes.

### GET /api/contacts/:id/membership-status

- 200 → `{ status: MembershipStatus, listMember: boolean, recomputedAt: string }`.

## Deduplication

### GET /api/dedup/suggestions

Query: `threshold?`, `page?`.

- 200 → `{ pairs: { a: ContactSummary, b: ContactSummary, similarity: number }[] }`.

### POST /api/dedup/merge

Body: `{ canonicalId: string, mergedId: string }`.

- 200 → `{ canonicalId, relinkedCounts: Record<string, number> }`.
- Transactional; re-links all related records; soft-retires `mergedId`; writes `MergeAudit`.
- 409 `ALREADY_MERGED` if either id already retired.
- **No automatic merges** — this endpoint is the only merge path and requires explicit actor.

## Enums

- `EmailPurpose`: `personal | booking | public_profile | other` (an email carries a non-empty set)
- `EmailConsentTopic`: `contra | english | openband | special_events | jane_austen_ball |
  contact_tracing | do_not_contact` (non-exclusive set; `do_not_contact` overrides all; default
  `contact_tracing`). `member`/`performer` are derived audiences in feature 006, not consent topics.
- `VolunteerRole`: `door_attendant | administrator` (set assignable only to volunteer contacts)
- `EmailStatus`: `active | transition | inactive`
- `MembershipStatus`: `current | lapsed | long_lapsed | never`

## Internal job contract

`POST` not exposed; `src/jobs/membership-refresh.ts` runs daily, idempotent, recomputes time-based
status transitions and writes `StatusChangeAudit` (actor = null/system) for any changes.
