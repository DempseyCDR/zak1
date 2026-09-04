import { sql } from "drizzle-orm";

/**
 * Feature 067 (FR-010): resolved export recipients.
 *
 * Every export answers the same question — "what address reaches this contact, and whose is it?" A
 * contact is reached at its OWN active email when it has one, otherwise at the email it REFERENCES
 * (a household address owned by someone else). Four call sites need it (the topic lists, `member`,
 * `performer`, and the separate attendance-driven contact-tracing export), which is why it lives here
 * rather than being pasted into each query.
 *
 * Doing the resolution in SQL keeps every export a single round trip — resolving per contact in
 * application code would be a textbook N+1 — and lets `DISTINCT ON (address)` do the household dedupe
 * in the database.
 *
 * The emitted row carries the OWNER'S name, because the owner is the contact that owns the resolved
 * email row. That is what keeps the provider CSV byte-identical to before this feature: no
 * household-names column is added, and the household roster lives in the app instead (FR-010c).
 */
export const recipientColumns = sql`
  contact_id,
  email_id,
  owner_contact_id,
  address,
  owner_first_name,
  owner_last_name,
  consent_topics
`;

/**
 * A CTE mapping every non-archived, non-merged contact to its resolved recipient row.
 *
 * `own` wins over `ref` (FR-020): the record display follows the same precedence, so the app can never
 * contradict where mail actually goes. A contact with neither contributes no row at all, so it simply
 * falls out of every export (FR-010).
 */
export const resolvedRecipients = sql`
  resolved_recipients AS (
    -- Owned addresses: EVERY active email a contact holds is its own recipient row. A contact with two
    -- qualifying addresses still yields two rows, exactly as before this feature (feature 006).
    SELECT c.id            AS contact_id,
           ce.id           AS email_id,
           ce.contact_id   AS owner_contact_id,
           ce.email        AS address,
           c.first_name    AS owner_first_name,
           c.last_name     AS owner_last_name,
           ce.consent_topics
      FROM contacts c
      JOIN contact_emails ce ON ce.contact_id = c.id AND ce.status = 'active'
     WHERE c.merged_into_id IS NULL
       AND c.archived_at IS NULL

    UNION ALL

    -- Feature 067: the referenced household address, and ONLY for a contact that has no active address
    -- of its own — an owned email always wins over a reference (FR-020), so the record display and the
    -- export can never disagree about where mail goes.
    SELECT c.id, ref.id, ref.contact_id, ref.email,
           owner.first_name, owner.last_name, ref.consent_topics
      FROM contacts c
      JOIN contact_emails ref
        ON ref.id = c.message_recipient_email_id AND ref.status = 'active'
      JOIN contacts owner ON owner.id = ref.contact_id
     WHERE c.merged_into_id IS NULL
       AND c.archived_at IS NULL
       AND NOT EXISTS (
             SELECT 1 FROM contact_emails o
              WHERE o.contact_id = c.id AND o.status = 'active'
           )
  )
`;
