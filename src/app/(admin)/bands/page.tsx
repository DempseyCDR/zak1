"use client";

import { useCallback, useEffect, useState } from "react";

type BandSummary = {
  id: string;
  name: string;
  memberCount: number;
  leadPerformerName: string | null;
};
type Performer = { id: string; displayName: string };
type RosterEntry = { performerId: string; isLead: boolean };

export default function BandsPage() {
  const [bands, setBands] = useState<BandSummary[]>([]);
  const [performers, setPerformers] = useState<Performer[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/bands");
    setBands((await res.json()).items ?? []);
  }, []);

  useEffect(() => {
    void load();
    void fetch("/api/performers")
      .then((r) => r.json())
      .then((d) => setPerformers(d.items ?? []));
  }, [load]);

  function resetForm() {
    setEditingId(null);
    setName("");
    setBio("");
    setPhotoUrl("");
    setRoster([]);
  }

  async function edit(id: string) {
    const res = await fetch(`/api/bands/${id}`);
    const b = await res.json();
    setEditingId(id);
    setName(b.name);
    setBio(b.bio ?? "");
    setPhotoUrl(b.photoUrl ?? "");
    setRoster(
      b.members.map((m: RosterEntry) => ({ performerId: m.performerId, isLead: m.isLead })),
    );
  }

  function toggleMember(performerId: string) {
    setRoster((r) =>
      r.some((m) => m.performerId === performerId)
        ? r.filter((m) => m.performerId !== performerId)
        : [...r, { performerId, isLead: r.length === 0 }],
    );
  }

  function setLead(performerId: string) {
    setRoster((r) => r.map((m) => ({ ...m, isLead: m.performerId === performerId })));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const body = { name, bio: bio || undefined, photoUrl: photoUrl || undefined, members: roster };
    const res = await fetch(editingId ? `/api/bands/${editingId}` : "/api/bands", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      setMessage(
        (await res.json().catch(() => null))?.error?.message ??
          "Failed (need a name and exactly one lead)",
      );
      return;
    }
    resetForm();
    void load();
  }

  async function archive(id: string) {
    await fetch(`/api/bands/${id}`, { method: "DELETE" });
    if (editingId === id) resetForm();
    void load();
  }

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1>Bands</h1>
      <ul>
        {bands.map((b) => (
          <li key={b.id}>
            {b.name} — {b.memberCount} member(s), lead: {b.leadPerformerName ?? "—"}{" "}
            <button onClick={() => edit(b.id)}>Edit</button>{" "}
            <button onClick={() => archive(b.id)}>Archive</button>
          </li>
        ))}
        {bands.length === 0 && <li style={{ color: "#888" }}>No bands</li>}
      </ul>

      <h2>{editingId ? "Edit band" : "New band"}</h2>
      <form onSubmit={save} style={{ display: "grid", gap: 6, maxWidth: 420 }}>
        <input placeholder="Band name" value={name} onChange={(e) => setName(e.target.value)} />
        <textarea
          placeholder="Bio (optional)"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />
        <input
          placeholder="Photo URL (optional)"
          value={photoUrl}
          onChange={(e) => setPhotoUrl(e.target.value)}
        />
        <fieldset>
          <legend>Roster (check members, pick one lead)</legend>
          {performers.map((p) => {
            const entry = roster.find((m) => m.performerId === p.id);
            return (
              <div key={p.id}>
                <label>
                  <input type="checkbox" checked={!!entry} onChange={() => toggleMember(p.id)} />{" "}
                  {p.displayName}
                </label>
                {entry && (
                  <label style={{ marginLeft: 8 }}>
                    <input
                      type="radio"
                      name="lead"
                      checked={entry.isLead}
                      onChange={() => setLead(p.id)}
                    />{" "}
                    lead
                  </label>
                )}
              </div>
            );
          })}
        </fieldset>
        <div>
          <button type="submit">{editingId ? "Save changes" : "Create band"}</button>{" "}
          {editingId && (
            <button type="button" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
        {message && <p style={{ color: "crimson" }}>{message}</p>}
      </form>
    </main>
  );
}
