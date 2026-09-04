"use client";
import { apiFetch } from "@/app/apiFetch";

import { useCallback, useEffect, useRef, useState } from "react";
import AdminPage from "@/app/(admin)/_components/AdminPage";
import TriageList from "@/app/(admin)/_components/TriageList";
import RecordView from "@/app/(admin)/_components/RecordView";
import EmailEditor, { type EmailRow } from "./_components/EmailEditor";
import MessageRecipient, { type MessageRecipientRow } from "./_components/MessageRecipient";
import MembershipAccount, { type MembershipBlock } from "./_components/MembershipAccount";
import { formatPhone } from "@/server/domain/contacts/phone";
import styles from "./contacts.module.css";

type ContactSummary = {
  id: string;
  displayName: string;
  membershipStatus: string;
  listMember: boolean;
  pronouns: string | null;
  archivedAt: string | null;
};

// Feature 065: which archive/delete controls this viewer may use (from /api/me/capabilities).
type Caps = {
  contactWrite: boolean;
  contactDelete: boolean;
  contactDeleteUnrestricted: boolean;
  contactMailingWrite: boolean;
  membershipWrite: boolean; // feature 068 (FR-017): FS/Treasurer/Super-user
};

// Feature 063 (M-R5..M-R8): the full record behind an opened contact, fed by GET /api/contacts/:id.
type EditorRecord = {
  id: string;
  firstName: string;
  lastName: string | null;
  displayName: string;
  displayNameOverride: string | null;
  pronouns: string | null;
  phone: string | null;
  isVolunteer: boolean;
  membershipStatus: string;
  listMember: boolean;
  needsReview: boolean;
  archivedAt: string | null;
  emails: EmailRow[]; // feature 066
  // Feature 067: the household view — where this contact is reached, and who rides its address.
  messageRecipient?: MessageRecipientRow | null;
  sharedWith?: { contactId: string; displayName: string }[];
  // Feature 068: the MEMBERSHIP household — distinct from the email household above (FR-020).
  membership?: MembershipBlock;
};

// Feature 062 (M-R4): a likely-duplicate pair from the dedup engine (shape of MergeSuggestion).
type DupContact = { id: string; displayName: string };
type DupPair = { a: DupContact; b: DupContact; similarity: number };

// Feature 064: which task is active. `none` = the uncluttered launcher (header + search + buttons only).
type View = "none" | "search" | "review" | "duplicates";

const PURPOSES = ["personal", "booking", "public_profile", "other"] as const;
const TOPICS = [
  "contra",
  "english",
  "openband",
  "special_events",
  "jane_austen_ball",
  "contact_tracing",
  "do_not_contact",
] as const;

export default function ContactsPage() {
  const [q, setQ] = useState("");
  const [view, setView] = useState<View>("none");
  const [items, setItems] = useState<ContactSummary[]>([]);
  const [searchTruncated, setSearchTruncated] = useState(false);
  const [dupPairs, setDupPairs] = useState<DupPair[]>([]);
  const [counts, setCounts] = useState<{ needsReview: number; duplicates: number }>({
    needsReview: 0,
    duplicates: 0,
  });
  const [caps, setCaps] = useState<Caps>({
    contactWrite: false,
    contactDelete: false,
    contactDeleteUnrestricted: false,
    contactMailingWrite: false,
    membershipWrite: false,
  });
  const [includeArchived, setIncludeArchived] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false); // second-step guard for the destructive action
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  // Feature 063: the opened record editor. `eOverride === ""` means Automatic (no custom name).
  const [record, setRecord] = useState<EditorRecord | null>(null);
  const [eFirst, setEFirst] = useState("");
  const [eLast, setELast] = useState("");
  const [eOverride, setEOverride] = useState("");
  const [ePronouns, setEPronouns] = useState("");
  const [ePhone, setEPhone] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  // Feature 064: the Add-contact create modal + its form state.
  const [showCreate, setShowCreate] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayNameOverride, setDisplayNameOverride] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [purposes, setPurposes] = useState<string[]>(["personal"]);
  const [topics, setTopics] = useState<string[]>(["contact_tracing"]);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  // Feature 064 (F1): one shared refresh so the button counts stay correct after ANY mutation, whatever
  // view triggered it.
  const refreshCounts = useCallback(async () => {
    const res = await apiFetch("/api/contacts/launcher-counts");
    if (res.ok) {
      const c = await res.json();
      setCounts({ needsReview: c.needsReview ?? 0, duplicates: c.duplicates ?? 0 });
    }
  }, []);

  const runSearch = useCallback(async (query: string, archived: boolean) => {
    // Feature 065: the "+ archived" toggle includes archived contacts (marked) in the results.
    const res = await apiFetch(
      `/api/contacts?q=${encodeURIComponent(query)}${archived ? "&archived=1" : ""}`,
    );
    const data = await res.json();
    setItems(data.items ?? []);
    setSearchTruncated(!!data.truncated);
    // Feature 062 (M-R4): query-scoped duplicate pairs alongside the results (the near-dup heads-up).
    const dres = await apiFetch(`/api/dedup/suggestions?q=${encodeURIComponent(query)}`);
    const ddata = await dres.json();
    setDupPairs(ddata.pairs ?? []);
  }, []);

  // Typing drives the search view; clearing the box with no active task returns to the launcher (FR-007).
  useEffect(() => {
    if (q.trim()) {
      setView("search");
      void runSearch(q, includeArchived);
    } else {
      setView((v) => (v === "search" ? "none" : v));
      setItems([]);
      setDupPairs([]);
    }
  }, [q, includeArchived, runSearch]);

  // Feature 062 (M-R3): focus-to-search on load. Feature 064: fetch only the counts on mount (no lists).
  // Feature 065: also learn which archive/delete controls to offer.
  useEffect(() => {
    searchRef.current?.focus();
    void refreshCounts();
    void (async () => {
      const res = await apiFetch("/api/me/capabilities");
      if (res.ok) {
        const c = await res.json();
        setCaps({
          contactWrite: !!c.contactWrite,
          contactDelete: !!c.contactDelete,
          contactDeleteUnrestricted: !!c.contactDeleteUnrestricted,
          contactMailingWrite: !!c.contactMailingWrite,
          membershipWrite: !!c.membershipWrite,
        });
      }
    })();
  }, [refreshCounts]);

  // Feature 063 (FR-020): move focus into the record modal when it opens.
  useEffect(() => {
    if (record) firstFieldRef.current?.focus();
  }, [record]);

  async function openReviewQueue() {
    setQ("");
    const res = await apiFetch("/api/contacts?needsReview=1");
    const data = await res.json();
    setItems(data.items ?? []);
    setSearchTruncated(!!data.truncated);
    setDupPairs([]);
    setView("review");
  }

  async function openDuplicates() {
    setQ("");
    const res = await apiFetch("/api/dedup/suggestions");
    const data = await res.json();
    setDupPairs(data.pairs ?? []);
    setItems([]);
    setView("duplicates");
  }

  // Re-fetch whichever list is showing, so an action's effect (a cleared flag, a merged pair) is visible.
  const refreshView = useCallback(async () => {
    if (view === "search") await runSearch(q, includeArchived);
    else if (view === "review") await openReviewQueue();
    else if (view === "duplicates") await openDuplicates();
  }, [view, q, includeArchived, runSearch]);

  async function openRecord(id: string) {
    const res = await apiFetch(`/api/contacts/${id}`);
    if (!res.ok) return;
    const r = (await res.json()) as EditorRecord;
    setRecord(r);
    setEFirst(r.firstName);
    setELast(r.lastName ?? "");
    setEOverride(r.displayNameOverride ?? "");
    setEPronouns(r.pronouns ?? "");
    // Feature 063 (FR-019): show the human-readable phone; Save re-canonicalizes via normalizePhone.
    setEPhone(r.phone ? formatPhone(r.phone) : "");
    setSaveError(null);
    setConfirmDelete(false);
    setDeleteError(null);
  }

  // Feature 065: archive / restore / delete, all closing the editor and refreshing the view + counts.
  async function archiveOrRestore(path: "archive" | "restore") {
    if (!record) return;
    const res = await apiFetch(`/api/contacts/${record.id}/${path}`, { method: "POST" });
    if (!res.ok) return;
    setRecord(null);
    await refreshView();
    await refreshCounts();
    searchRef.current?.focus();
  }

  async function deleteRecord(force: boolean) {
    if (!record) return;
    setDeleteError(null);
    const res = await apiFetch(`/api/contacts/${record.id}${force ? "?force=1" : ""}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const b = await res.json().catch(() => null);
      setDeleteError(b?.error?.message ?? "Could not delete contact.");
      setConfirmDelete(false);
      return; // refusal (e.g. has references) — the reason is shown; the record stays open
    }
    setRecord(null);
    await refreshView();
    await refreshCounts();
    searchRef.current?.focus();
  }

  function closeRecord() {
    setRecord(null);
    searchRef.current?.focus();
  }

  async function saveRecord(e: React.FormEvent) {
    e.preventDefault();
    if (!record) return;
    setSaveError(null);
    if (!eFirst.trim()) {
      setSaveError("First name is required.");
      return;
    }
    const body: Record<string, unknown> = {
      firstName: eFirst.trim(),
      lastName: eLast.trim() ? eLast.trim() : null,
      displayNameOverride: eOverride.trim() ? eOverride.trim() : null,
      pronouns: ePronouns.trim() ? ePronouns.trim() : null,
      phone: ePhone.trim() ? ePhone.trim() : null,
    };
    // is_volunteer is NOT edited here (M-R7); the endpoint guards it. `needs_review` may auto-clear
    // server-side when the record now has contact data (feature 064 / FR-012).
    const res = await apiFetch(`/api/contacts/${record.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => null);
      setSaveError(b?.error?.message ?? "Failed to save contact");
      return;
    }
    setRecord(null);
    await refreshView(); // reflect an auto-cleared review flag (F2) etc.
    await refreshCounts(); // F1
    searchRef.current?.focus();
  }

  async function markReviewed() {
    if (!record) return;
    const res = await apiFetch(`/api/contacts/${record.id}/reviewed`, { method: "POST" });
    if (!res.ok) return;
    setRecord(null);
    await refreshView(); // the contact leaves the review queue (F2)
    await refreshCounts(); // F1
    searchRef.current?.focus();
  }

  async function merge(canonicalId: string, mergedId: string) {
    const res = await apiFetch("/api/dedup/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ canonicalId, mergedId }),
    });
    if (res.ok) {
      await refreshView(); // the pair leaves the current list
      await refreshCounts(); // F1 — from search OR duplicates view
      searchRef.current?.focus();
    }
  }

  async function createContact(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setWarning(null);
    const hasContactInfo = address.trim() || phone.trim();
    const res = await apiFetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName,
        ...(lastName.trim() ? { lastName: lastName.trim() } : {}),
        ...(displayNameOverride.trim() ? { displayNameOverride: displayNameOverride.trim() } : {}),
        ...(pronouns.trim() ? { pronouns: pronouns.trim() } : {}),
        ...(address.trim() ? { email: { address, purposes, consentTopics: topics } } : {}),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error?.message ?? "Failed to create contact");
      return;
    }
    if (!hasContactInfo) {
      setWarning("Contact created with no email or phone on file — flagged for follow-up.");
    }
    setFirstName("");
    setLastName("");
    setDisplayNameOverride("");
    setPronouns("");
    setAddress("");
    setPhone("");
    setPurposes(["personal"]);
    setTopics(["contact_tracing"]);
    setShowCreate(false);
    await refreshView(); // FR-008
    await refreshCounts(); // F1 — a no-info contact raises the needs-review count
  }

  function toggle(list: string[], value: string, set: (v: string[]) => void) {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  const showList = view === "search" || view === "review";
  // Search shows pairs only when there are some (a quiet heads-up); the duplicates task always shows the
  // section (with an empty state) since that IS the task.
  const showPairs = view === "duplicates" || (view === "search" && dupPairs.length > 0);

  return (
    <AdminPage title="Contacts">
      {/* Launcher: search + a row of task buttons with live counts. Nothing else until Mel chooses. */}
      <section className={styles.section}>
        <input
          ref={searchRef}
          className={styles.search}
          placeholder="Search by name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className={styles.taskRow}>
          <button type="button" className={styles.button} onClick={() => setShowCreate(true)}>
            Add contact
          </button>
          <button type="button" className={styles.taskButton} onClick={openReviewQueue}>
            Review queue ({counts.needsReview})
          </button>
          <button type="button" className={styles.taskButton} onClick={openDuplicates}>
            Review duplicates ({counts.duplicates})
          </button>
          {/* Feature 065: compact toggle to include archived contacts in the search results. */}
          <button
            type="button"
            className={styles.taskButton}
            aria-pressed={includeArchived}
            onClick={() => setIncludeArchived((v) => !v)}
          >
            + archived
          </button>
        </div>
      </section>

      {/* Single-contact list — the search results or the needs-review queue. Rows open the editor. */}
      {showList && (
        <section className={styles.section}>
          <TriageList
            items={items}
            getKey={(c) => c.id}
            onOpen={(c) => void openRecord(c.id)}
            renderRow={(c) => (
              <span className={styles.rowText}>
                <span className={styles.rowName}>
                  {c.displayName}
                  {c.pronouns ? ` (${c.pronouns})` : ""}
                </span>
                <span className={styles.rowMeta}>
                  {c.membershipStatus}
                  {c.archivedAt ? " · archived" : ""}
                </span>
              </span>
            )}
            emptyState={
              <span className={styles.empty}>
                {view === "review" ? "No contacts need review" : "No contacts"}
              </span>
            }
          />
          {searchTruncated && (
            <p className={styles.hint}>More matches — refine your search to narrow the list.</p>
          )}
        </section>
      )}

      {/* Potential duplicates — query-scoped alongside search, or the global queue via the button. */}
      {showPairs && (
        <section className={styles.section}>
          <h2 className={styles.h2}>Potential duplicates</h2>
          {dupPairs.length === 0 ? (
            <p className={styles.empty}>No potential duplicates</p>
          ) : (
            <ul className={styles.dupList}>
              {dupPairs.map((p) => (
                <li key={`${p.a.id}-${p.b.id}`} className={styles.dupRow}>
                  <span className={styles.dupPair}>
                    {p.a.displayName} ↔ {p.b.displayName}
                  </span>
                  <span className={styles.dupActions}>
                    <button
                      type="button"
                      className={styles.dupButton}
                      onClick={() => merge(p.a.id, p.b.id)}
                    >
                      Keep {p.a.displayName}
                    </button>
                    <button
                      type="button"
                      className={styles.dupButton}
                      onClick={() => merge(p.b.id, p.a.id)}
                    >
                      Keep {p.b.displayName}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Record editor modal (feature 063) — opened from a result/queue row. */}
      {record && (
        <div className={styles.backdrop}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={record.displayName}
            className={styles.modalPanel}
            onKeyDown={(e) => {
              if (e.key === "Escape") closeRecord();
            }}
          >
            <RecordView
              title={record.displayName}
              actions={
                <>
                  {record.needsReview && (
                    <button type="button" className={styles.button} onClick={markReviewed}>
                      Mark reviewed
                    </button>
                  )}
                  {/* Feature 065: archive/restore (reversible) and delete (confirmed, gated). */}
                  {caps.contactWrite &&
                    (record.archivedAt ? (
                      <button
                        type="button"
                        className={styles.button}
                        onClick={() => archiveOrRestore("restore")}
                      >
                        Restore
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={styles.button}
                        onClick={() => archiveOrRestore("archive")}
                      >
                        Archive
                      </button>
                    ))}
                  {caps.contactDelete &&
                    (confirmDelete ? (
                      <button
                        type="button"
                        className={styles.dangerButton}
                        onClick={() => deleteRecord(false)}
                      >
                        Confirm delete
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={styles.dangerButton}
                        onClick={() => setConfirmDelete(true)}
                      >
                        Delete
                      </button>
                    ))}
                  <button type="button" className={styles.button} onClick={closeRecord}>
                    Cancel
                  </button>
                </>
              }
            >
              {/* Feature 065: a refused safe delete explains why (references) and, for a super-user,
                  offers the unrestricted override. Rendered FIRST, directly under the action row — it
                  used to sit below the read-only context list, i.e. below the fold on a scrolling
                  modal, so Mel pressed Confirm delete and appeared to get no response at all. */}
              {deleteError && (
                <div className={styles.error}>
                  <p>{deleteError}</p>
                  {caps.contactDeleteUnrestricted && (
                    <button
                      type="button"
                      className={styles.dangerButton}
                      onClick={() => deleteRecord(true)}
                    >
                      Force delete (super-user)
                    </button>
                  )}
                </div>
              )}
              <form onSubmit={saveRecord} className={styles.form}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>First name</span>
                  <input
                    ref={firstFieldRef}
                    className={styles.input}
                    value={eFirst}
                    onChange={(e) => setEFirst(e.target.value)}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Last name</span>
                  <input
                    className={styles.input}
                    value={eLast}
                    onChange={(e) => setELast(e.target.value)}
                  />
                </label>
                {(() => {
                  const isCustom = eOverride.trim() !== "";
                  const autoName = `${eFirst.trim()} ${eLast.trim()}`.trim();
                  return (
                    <div className={styles.field}>
                      <label className={styles.fieldLabel} htmlFor="edit-display-name">
                        Display name
                      </label>
                      <div className={styles.nameControl}>
                        <input
                          id="edit-display-name"
                          className={styles.input}
                          value={isCustom ? eOverride : autoName}
                          readOnly={!isCustom}
                          onChange={(e) => setEOverride(e.target.value)}
                        />
                        <button
                          type="button"
                          className={styles.button}
                          onClick={() => setEOverride(isCustom ? "" : autoName)}
                        >
                          {isCustom ? "Reset to automatic" : "Set custom name"}
                        </button>
                      </div>
                    </div>
                  );
                })()}
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Pronouns</span>
                  <input
                    className={styles.input}
                    value={ePronouns}
                    onChange={(e) => setEPronouns(e.target.value)}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Phone</span>
                  <input
                    className={styles.input}
                    value={ePhone}
                    onChange={(e) => setEPhone(e.target.value)}
                  />
                </label>
                <button type="submit" className={styles.button}>
                  Save
                </button>
                {saveError && <p className={styles.error}>{saveError}</p>}
              </form>
              <div className={styles.flags}>
                <span className={styles.flag}>
                  Volunteer: <strong>{record.isVolunteer ? "Yes" : "No"}</strong>
                </span>
                <span className={styles.flag}>
                  On mailing list: <strong>{record.listMember ? "Yes" : "No"}</strong>
                </span>
                <span className={styles.flag}>
                  Needs review: <strong>{record.needsReview ? "Yes" : "No"}</strong>
                </span>
              </div>
              <dl className={styles.context}>
                <div>
                  <dt>Membership</dt>
                  <dd>{record.membershipStatus}</dd>
                </div>
              </dl>
              {/* Feature 066: the contact's emails, editable below the scalar fields. */}
              {caps.contactMailingWrite && (
                <EmailEditor
                  key={record.id}
                  contactId={record.id}
                  emails={record.emails ?? []}
                  canDeleteUnrestricted={caps.contactDeleteUnrestricted}
                  onChanged={() => openRecord(record.id)}
                />
              )}
              {/* Feature 068 (FR-018/FR-019/FR-020): the MEMBERSHIP household. Rendered as its own block,
                  labelled and styled apart from the shared-email block below — they overlap often and are
                  different facts. Write controls need membership authority (FR-017), which Mel lacks. */}
              {record.membership && (
                <MembershipAccount
                  key={`ma-${record.id}`}
                  contactId={record.id}
                  membership={record.membership}
                  canWrite={caps.membershipWrite}
                  onChanged={() => openRecord(record.id)}
                />
              )}
              {(record.messageRecipient || (record.sharedWith ?? []).length > 0) && (
                <MessageRecipient
                  key={`mr-${record.id}`}
                  contactId={record.id}
                  messageRecipient={record.messageRecipient ?? null}
                  sharedWith={record.sharedWith ?? []}
                  hasOwnActiveEmail={(record.emails ?? []).some((e) => e.status === "active")}
                  canWrite={caps.contactMailingWrite}
                  onChanged={() => openRecord(record.id)}
                />
              )}
            </RecordView>
          </div>
        </div>
      )}

      {/* Add-contact modal (feature 064) — the create form, no longer always-visible. */}
      {showCreate && (
        <div className={styles.backdrop}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Add contact"
            className={styles.modalPanel}
            onKeyDown={(e) => {
              if (e.key === "Escape") setShowCreate(false);
            }}
          >
            <RecordView
              title="Add contact"
              actions={
                <button
                  type="button"
                  className={styles.button}
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </button>
              }
            >
              <form onSubmit={createContact} className={styles.form}>
                <input
                  className={styles.input}
                  placeholder="First name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
                <input
                  className={styles.input}
                  placeholder="Last name (optional)"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
                <input
                  className={styles.input}
                  placeholder="Display name override (optional)"
                  value={displayNameOverride}
                  onChange={(e) => setDisplayNameOverride(e.target.value)}
                />
                <input
                  className={styles.input}
                  placeholder="Pronouns (optional)"
                  value={pronouns}
                  onChange={(e) => setPronouns(e.target.value)}
                />
                <input
                  className={styles.input}
                  placeholder="Email address (optional)"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
                <input
                  className={styles.input}
                  placeholder="Phone (optional)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <fieldset className={styles.fieldset}>
                  <legend>Purposes</legend>
                  {PURPOSES.map((p) => (
                    <label key={p} className={styles.check}>
                      <input
                        type="checkbox"
                        checked={purposes.includes(p)}
                        onChange={() => toggle(purposes, p, setPurposes)}
                      />{" "}
                      {p}
                    </label>
                  ))}
                </fieldset>
                <fieldset className={styles.fieldset}>
                  <legend>Consent topics</legend>
                  {TOPICS.map((t) => (
                    <label key={t} className={styles.check}>
                      <input
                        type="checkbox"
                        checked={topics.includes(t)}
                        onChange={() => toggle(topics, t, setTopics)}
                      />{" "}
                      {t}
                    </label>
                  ))}
                </fieldset>
                <button type="submit" className={styles.button}>
                  Create
                </button>
                {error && <p className={styles.error}>{error}</p>}
                {warning && <p className={styles.warning}>{warning}</p>}
              </form>
            </RecordView>
          </div>
        </div>
      )}
    </AdminPage>
  );
}
