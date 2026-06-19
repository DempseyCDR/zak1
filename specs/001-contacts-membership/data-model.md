# Phase 1 Data Model: Contacts & Membership

Storage: PostgreSQL 16 (`pg_trgm`, `pgcrypto`). All timestamps `timestamptz`. IDs are UUID
(`gen_random_uuid()`), satisfying the spec's "stable unique identifier" requirement.

## Entity: Contact

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | `gen_random_uuid()` |
| display_name | text NOT NULL | shown in UI / search results |
| name_normalized | text NOT NULL | lower/trim/unaccent of display_name; GIN trigram index |
| membership_status | enum NOT NULL | current \| lapsed \| long_lapsed \| never; default never |
| list_member | boolean NOT NULL | derived from status (true unless never); materialized |
| status_recomputed_at | timestamptz | set by service + daily job |
| is_volunteer | boolean NOT NULL default false | a contact who volunteers for the club |
| volunteer_roles | volunteer_role[] NOT NULL default '{}' | non-empty only when is_volunteer; current values: door_attendant, administrator; set extended in later features |
| merged_into_id | uuid NULL FK→Contact.id | non-null = soft-retired into canonical contact |
| created_at / updated_at | timestamptz | |

- **Indexes**: GIN `gin_trgm_ops` on `name_normalized`; partial index `WHERE merged_into_id IS NULL`.
- **Validation**: `display_name` non-empty; `membership_status` ∈ enum.
  `CHECK (is_volunteer OR array_length(volunteer_roles, 1) IS NULL)` — roles only on volunteers; role
  values constrained to the `volunteer_role` enum and de-duplicated by the application before write.
- **Volunteer roles**: `door_attendant` (creates new contacts at the door, feature 002) and
  `administrator` (maintains contacts, confirms merges). The enum is intentionally small now and will
  grow as later features introduce specialized volunteer roles.
- **State (membership_status)**: never → current (on first valid membership); current → lapsed (expiry
  < today); lapsed → long_lapsed (lapsed > long_lapse_cycles cycles); any → current (new membership).

## Entity: ContactEmail

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| contact_id | uuid FK→Contact.id NOT NULL | cascade on merge re-link |
| email | citext NOT NULL | stored case-insensitive |
| purposes | email_purpose[] NOT NULL | non-empty set: personal \| booking \| public_profile \| other; one address may carry several |
| status | enum NOT NULL | active \| transition \| inactive |
| consent_topics | email_consent_topic[] NOT NULL default '{contact_tracing}' | non-exclusive set of message kinds this address opts into; `do_not_contact` overrides all (FR-004) |
| is_login | boolean NOT NULL default false | Phase 1: volunteer/admin only (FR-005) |
| provider_set_date | timestamptz NULL | read-only delivery-provider metadata |
| provider_last_open | timestamptz NULL | read-only |
| provider_last_click | timestamptz NULL | read-only |
| created_at / updated_at | timestamptz | |

- **Constraints**: partial UNIQUE on `lower(trim(email))` `WHERE status IN ('active','transition')`
  (FR-003). `is_login = true` requires the owning Contact to have `is_volunteer = true` (and, in
  practice, an `administrator` role for admin access) — Phase 1 grants login to volunteer/admin only.
  `CHECK (array_length(purposes, 1) >= 1)` — at least one purpose; values constrained to the
  `email_purpose` enum and de-duplicated by the application before write.
  `CHECK (array_length(consent_topics, 1) >= 1)` — at least one consent topic (defaults to
  `{contact_tracing}`); values constrained to the `email_consent_topic` enum.
- **Consent rules**: `consent_topics` is non-exclusive — an address may opt into several kinds. The
  special value `do_not_contact`, when present, overrides every other topic (the address must never be
  emailed); the application MUST treat `do_not_contact` as exclusive at send/export time regardless of
  any other topics stored. Default for a new email is `{contact_tracing}`.
- **Indexes**: GIN index on `purposes` for "all emails with purpose X" queries; GIN index on
  `consent_topics` for export-list segmentation (feature 006).
- **Validation**: RFC-style email format via Zod at the boundary; `purposes` and `consent_topics`
  validated as non-empty sets of enum members; provider_* fields rejected on write from user-facing
  endpoints (read-only).

## Entity: Membership

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| contact_id | uuid FK→Contact.id NOT NULL | the member |
| payer_id | uuid FK→Payer.id NOT NULL | responsible party |
| expiry_date | date NOT NULL | drives status |
| created_at | timestamptz | |

- **Rule**: a Contact's status derives from the **most recent** `expiry_date` across its memberships.

## Entity: Payer

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| contact_id | uuid FK→Contact.id NULL | a payer is usually also a contact |
| name | text NOT NULL | |

## Entity: ClubSettings (single-row, build-1 single tenant)

| Field | Type | Notes |
|---|---|---|
| id | smallint PK = 1 | enforce single row |
| long_lapse_cycles | integer NOT NULL default 3 | boundary lapsed↔long_lapsed (FR-008) |
| cycle_definition | text NOT NULL | how a "cycle" maps to time (e.g., 1 year) |

## Entity: MergeAudit (append-only)

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| canonical_id | uuid NOT NULL | surviving contact |
| merged_id | uuid NOT NULL | retired contact |
| actor | text NOT NULL | admin who confirmed |
| relinked_counts | jsonb | per-table re-link counts |
| created_at | timestamptz | |

## Entity: StatusChangeAudit (append-only)

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| contact_id | uuid NOT NULL | |
| from_status / to_status | enum | |
| reason | text | "membership_change" \| "daily_job" |
| actor | text NULL | null for system job |
| created_at | timestamptz | |

## Relationships

- Contact 1—N ContactEmail
- Contact 1—N Membership; Membership N—1 Payer
- Contact 0..1—1 Payer (a contact may be a payer)
- Contact 0..1 self-reference via `merged_into_id` (soft-retire)
- Contact 1—N StatusChangeAudit; MergeAudit references two Contacts

## Enums

- `email_purpose`: `personal | booking | public_profile | other`
- `email_status`: `active | transition | inactive`
- `membership_status`: `current | lapsed | long_lapsed | never`
- `volunteer_role`: `door_attendant | administrator` (extended by later features)
- `email_consent_topic`: `contra | english | openband | special_events | jane_austen_ball |
  contact_tracing | do_not_contact` (non-exclusive; `do_not_contact` is exclusive/overriding; default
  `contact_tracing`). These are the per-email **opt-in** topics. Reconciled with feature 006: the five
  content topics map 1:1 to that feature's content mailing lists (contra, english, openband,
  specialevents, janeaustenball); `contact_tracing` drives the separate tracing mailing. The remaining
  two feature-006 lists — `member` and `performer` — are **derived audiences** (from membership status
  and performer role), NOT consent topics, so they are intentionally excluded from this enum.

## Derived / non-persisted

- `membership_status` and `list_member` are materialized (recomputed, stored).
- Export-only fields (tracing indicator, membership "through" year) are **not** in this model — they
  belong to feature 006 and are computed at export time.
