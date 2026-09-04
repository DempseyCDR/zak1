"use client";
import { apiFetch } from "@/app/apiFetch";
import styles from "../contacts.module.css";

// Feature 067 (M-R23): the household view — where this contact is reached, and who rides its address.
export type MessageRecipientRow = {
  emailId: string;
  /** Null when the viewer may not read contact PII (FR-016); the owner's name still shows. */
  address: string | null;
  ownerContactId: string;
  ownerDisplayName: string;
};

export default function MessageRecipient({
  contactId,
  messageRecipient,
  sharedWith,
  hasOwnActiveEmail,
  canWrite,
  onChanged,
}: {
  contactId: string;
  messageRecipient: MessageRecipientRow | null;
  sharedWith: { contactId: string; displayName: string }[];
  /** Feature 067 (FR-020): an owned address WINS over a reference, matching the export resolver. */
  hasOwnActiveEmail: boolean;
  canWrite: boolean;
  onChanged: () => void | Promise<void>;
}) {
  if (!messageRecipient && sharedWith.length === 0) return null;

  async function unlink() {
    const res = await apiFetch(`/api/contacts/${contactId}/message-recipient`, {
      method: "DELETE",
    });
    if (res.ok) void onChanged();
  }

  // A pointer that survives alongside an owned address is stale — mail already goes to her own address
  // (FR-011 clears it on capture, but a record may be read before that lifecycle step is deployed).
  const stale = Boolean(messageRecipient) && hasOwnActiveEmail;

  return (
    <section className={styles.sharedSection} aria-label="Shared email">
      <h3 className={styles.emailHeading}>Shared email</h3>

      {messageRecipient && !stale && (
        <p className={styles.rowMeta}>
          Reached via <strong>{messageRecipient.ownerDisplayName}</strong>
          {messageRecipient.address ? (
            <>
              {" — "}
              <strong>{messageRecipient.address}</strong>
            </>
          ) : null}
          . This contact has no address of their own.
        </p>
      )}

      {stale && (
        <p className={styles.rowMeta}>
          Reached at their own address; the shared link to {messageRecipient!.ownerDisplayName} is
          no longer used.
        </p>
      )}

      {messageRecipient && canWrite && (
        <button type="button" className={styles.button} onClick={unlink}>
          {stale ? "Clear the unused shared link" : "Stop sharing"}
        </button>
      )}

      {sharedWith.length > 0 && (
        <>
          <p className={styles.rowMeta}>Also reached at this address:</p>
          <ul className={styles.sharedNames}>
            {sharedWith.map((c) => (
              <li key={c.contactId}>{c.displayName}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
