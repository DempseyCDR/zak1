"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Access control (feature 016, US2) — the President/VP's screen (matrix row 20).
 *
 * The dormant feature-001 volunteer substrate finally gets a UI writer. Designating volunteers and
 * granting them scoped roles used to require the operator CLI; this is that job, in the product.
 *
 * The refusals here are the server's (403 from the access routes). Non-officers never see this page in
 * the nav (US5), but the routes enforce it regardless — hiding is presentation, not a control.
 */

type Grant = { id: string; role: string; seriesId: string | null; groupId: string | null };
type Volunteer = {
  contactId: string;
  displayName: string;
  grants: Grant[];
  approvedAt: string | null;
  overdue: boolean;
  concentrationOfDuties: boolean;
};

const ROLES = [
  "door_attendant",
  "booker",
  "financial_secretary",
  "treasurer",
  "vice_president",
  "webmaster",
  "mailing_list_manager",
  "secretary",
  "president",
] as const;

function scopeLabel(g: Grant): string {
  if (g.seriesId) return "series-scoped";
  if (g.groupId) return "group-scoped";
  return "club-wide";
}

export default function AccessPage() {
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  // Grant form
  const [subjectContactId, setSubjectContactId] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("booker");
  const [seriesKey, setSeriesKey] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/access/volunteers");
    if (res.status === 403) {
      setMessage("You do not have access to role assignment (President or VP only).");
      return;
    }
    const data = await res.json();
    setVolunteers(data.volunteers ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function grant(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const res = await fetch("/api/access/grants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subjectContactId,
        role,
        ...(seriesKey.trim() ? { seriesKey: seriesKey.trim() } : {}),
      }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      // FR-005a's refusal is the useful case: show the required order (revoke first) rather than a bare
      // error, so a Treasurer-elected-President knows what to do.
      setMessage(body?.error?.message ?? "Grant failed");
      return;
    }
    // FR-029a: the warning is informational — the grant succeeded.
    setMessage(body?.warning ?? "Granted.");
    setSubjectContactId("");
    setSeriesKey("");
    await load();
  }

  async function revoke(grantId: string) {
    setMessage(null);
    const res = await fetch(`/api/access/grants?grantId=${encodeURIComponent(grantId)}`, {
      method: "DELETE",
    });
    if (!res.ok) return setMessage("Revoke failed");
    await load();
  }

  async function approve(contactId: string) {
    setMessage(null);
    const res = await fetch(`/api/access/volunteers/${contactId}/approve`, { method: "POST" });
    if (!res.ok) return setMessage("Approve failed");
    await load();
  }

  // Clear = report-then-confirm (FR-028a). Fetch the grants that WOULD be revoked, show them, and only
  // clear on explicit confirmation.
  async function clearVolunteer(v: Volunteer) {
    setMessage(null);
    const preview = await fetch(
      `/api/access/volunteers?contactId=${encodeURIComponent(v.contactId)}&preview=1`,
      { method: "DELETE" },
    );
    if (!preview.ok) return setMessage("Could not read grants");
    const { willRevoke } = (await preview.json()) as { willRevoke: Grant[] };
    const summary =
      willRevoke.length === 0
        ? "This volunteer holds no grants."
        : `This will revoke ${willRevoke.length} grant(s): ${willRevoke
            .map((g) => `${g.role} (${scopeLabel(g)})`)
            .join(", ")}.`;
    if (!confirm(`${summary}\n\nRemove ${v.displayName} as a volunteer? This cannot be undone.`)) {
      return;
    }
    const res = await fetch(`/api/access/volunteers?contactId=${encodeURIComponent(v.contactId)}`, {
      method: "DELETE",
    });
    if (!res.ok) return setMessage("Clear failed");
    await load();
  }

  return (
    <main style={{ padding: 24, maxWidth: 900 }}>
      <h1>Access control</h1>
      <p>Designate volunteers and assign their roles. President or VP only.</p>
      {message && <p role="status">{message}</p>}

      <section>
        <h2>Grant a role</h2>
        <form onSubmit={grant}>
          <input
            placeholder="Volunteer contact id"
            value={subjectContactId}
            onChange={(e) => setSubjectContactId(e.target.value)}
            required
          />
          <select value={role} onChange={(e) => setRole(e.target.value as (typeof ROLES)[number])}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <input
            placeholder="series key (blank = club-wide)"
            value={seriesKey}
            onChange={(e) => setSeriesKey(e.target.value)}
          />
          <button type="submit">Grant</button>
        </form>
        <p>
          <small>
            Super-user is not grantable here — it is created only from the operator command line.
          </small>
        </p>
      </section>

      <section>
        <h2>Volunteers</h2>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Grants</th>
              <th>Review</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {volunteers.map((v) => (
              <tr key={v.contactId}>
                <td>
                  {v.displayName}
                  {v.concentrationOfDuties && (
                    <span title="Holds an authority office and Financial Secretary (FR-029b)">
                      {" "}
                      ⚠️
                    </span>
                  )}
                </td>
                <td>
                  {v.grants.length === 0 && <em>base only</em>}
                  {v.grants.map((g) => (
                    <span key={g.id} style={{ display: "inline-block", marginRight: 8 }}>
                      {g.role} ({scopeLabel(g)}){" "}
                      <button type="button" onClick={() => revoke(g.id)}>
                        revoke
                      </button>
                    </span>
                  ))}
                </td>
                <td>
                  {v.overdue ? <strong>overdue</strong> : "current"}{" "}
                  <button type="button" onClick={() => approve(v.contactId)}>
                    approve
                  </button>
                </td>
                <td>
                  <button type="button" onClick={() => clearVolunteer(v)}>
                    remove volunteer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
