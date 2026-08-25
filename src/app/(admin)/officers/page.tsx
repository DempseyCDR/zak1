"use client";
import { apiFetch } from "@/app/apiFetch";
import ContactPicker from "@/app/ContactPicker";

import { useCallback, useEffect, useState } from "react";

type Role = { key: string; roleName: string; emailAlias: string };
type Assignment = { roleKey: string; contactId: string; name: string };

export default function OfficersPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch("/api/officers");
    const data = await res.json();
    setRoles(data.roles ?? []);
    setAssignments(data.assignments ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function setOfficer(roleKey: string, contactId: string | null) {
    setMessage(null);
    const res = await apiFetch("/api/officers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roleKey, contactId }),
    });
    setMessage(res.ok ? "Saved." : "Failed to save");
    if (res.ok) void load();
  }

  const holderOf = (roleKey: string) => assignments.find((a) => a.roleKey === roleKey);

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1>Board officers</h1>
      <p style={{ color: "#555" }}>
        Assign the contact who holds each board role. Shown on the public board page as name + role
        + the role alias — never their personal contact details. Order is fixed by the role
        registry.
      </p>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {roles.map((r) => {
          const holder = holderOf(r.key);
          return (
            <li key={r.key} style={{ padding: "12px 0", borderBottom: "1px solid #eee" }}>
              <strong>{r.roleName}</strong> <span style={{ color: "#888" }}>({r.emailAlias})</span>
              <div style={{ margin: "6px 0" }}>
                Current: {holder ? holder.name : <em style={{ color: "#888" }}>vacant</em>}{" "}
                {holder && (
                  <button type="button" onClick={() => setOfficer(r.key, null)}>
                    Clear
                  </button>
                )}
              </div>
              <ContactPicker
                placeholder={`Assign ${r.roleName}…`}
                onSelect={(c) => c && setOfficer(r.key, c.id)}
              />
            </li>
          );
        })}
        {roles.length === 0 && <li style={{ color: "#888" }}>No board roles.</li>}
      </ul>
      {message && <p style={{ color: message === "Saved." ? "green" : "crimson" }}>{message}</p>}
    </main>
  );
}
