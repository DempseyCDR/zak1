-- Feature 067 (M-R23/FR-002): shared / family emails via an ownership + reference model.
--
-- An email is OWNED by exactly one contact (its contact_emails row). Another household member may
-- REFERENCE that owned email as their message recipient through this single nullable pointer. The
-- pointer lives on `contacts`, NOT on `contact_emails` — which is what keeps the active-email
-- uniqueness index (contact_emails_unique_active), the feature-015 sign-in match, and `is_login`
-- owner-only BY CONSTRUCTION (M-R24/M-R25): all three see only owned rows, so a shared address still
-- resolves to exactly one contact with no change to any of them.
--
-- ON DELETE SET NULL is a structural SAFETY NET only: contact_emails.contact_id already cascades from
-- contacts, so deleting an owner must never strand a pointer. The user-visible half of the lifecycle
-- (clearing the pointer AND flagging the referrer needs_review, including on mere DEACTIVATION, which
-- is not a delete at all) is service-side in referenceService.clearReferencesTo — FR-012.
ALTER TABLE contacts
  ADD COLUMN message_recipient_email_id uuid
    REFERENCES contact_emails(id) ON DELETE SET NULL;

-- Partial: the only query needing it is "who references this email?", run on deactivate/delete and
-- when rendering an owner's record.
CREATE INDEX contacts_message_recipient
  ON contacts (message_recipient_email_id)
  WHERE message_recipient_email_id IS NOT NULL;
