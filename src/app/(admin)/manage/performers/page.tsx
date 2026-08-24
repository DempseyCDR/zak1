"use client";
import { apiFetch } from "@/app/apiFetch";

import { useCallback, useEffect, useState } from "react";
import { PROMO_LINK_TYPES, STYLE_TAGS, type PromoLink } from "@/server/domain/public/promoLinks";

type Performer = {
  id: string;
  displayName: string;
  bio: string | null;
  isPublic?: boolean;
  isCaller?: boolean;
  styles?: string[];
  links?: PromoLink[];
};

export default function PerformersPage() {
  const [items, setItems] = useState<Performer[]>([]);
  // Feature 026: capture structured names (first/last/optional display) like the directory/check-in flows.
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayNameOverride, setDisplayNameOverride] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  // Feature 053 (P7-R9): per-performer public-profile editor state.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [isCaller, setIsCaller] = useState(false);
  const [styleTags, setStyleTags] = useState<string[]>([]);
  const [links, setLinks] = useState<PromoLink[]>([]);
  const [editMessage, setEditMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch("/api/performers");
    const data = await res.json();
    setItems(data.items ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setWarning(null);
    const hasContactInfo = email.trim() || phone.trim();
    const res = await apiFetch("/api/performers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: firstName.trim(),
        ...(lastName.trim() ? { lastName: lastName.trim() } : {}),
        ...(displayNameOverride.trim() ? { displayNameOverride: displayNameOverride.trim() } : {}),
        ...(bio ? { bio } : {}),
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
      }),
    });
    if (!res.ok) {
      setError("Failed to create performer");
      return;
    }
    if (!hasContactInfo) {
      setWarning("Performer created with no email or phone on file — flagged for follow-up.");
    }
    setFirstName("");
    setLastName("");
    setDisplayNameOverride("");
    setEmail("");
    setPhone("");
    setBio("");
    void load();
  }

  function editProfile(p: Performer) {
    setEditingId(p.id);
    setIsPublic(p.isPublic ?? false);
    setIsCaller(p.isCaller ?? false);
    setStyleTags(p.styles ?? []);
    setLinks(p.links ?? []);
    setEditMessage(null);
  }

  function toggleStyle(s: string) {
    setStyleTags((t) => (t.includes(s) ? t.filter((x) => x !== s) : [...t, s]));
  }
  function addLink() {
    setLinks((l) => [...l, { type: "website", url: "" }]);
  }
  function setLink(i: number, patch: Partial<PromoLink>) {
    setLinks((l) => l.map((link, idx) => (idx === i ? { ...link, ...patch } : link)));
  }
  function removeLink(i: number) {
    setLinks((l) => l.filter((_, idx) => idx !== i));
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setEditMessage(null);
    const res = await apiFetch(`/api/performers/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        isPublic,
        isCaller,
        styles: styleTags,
        links: links.filter((l) => l.url.trim() !== ""),
      }),
    });
    if (!res.ok) {
      setEditMessage(
        (await res.json().catch(() => null))?.error?.message ??
          "Failed to save (check the link URLs are http(s))",
      );
      return;
    }
    setEditingId(null);
    void load();
  }

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1>Performers</h1>
      <ul>
        {items.map((p) => (
          <li key={p.id}>
            {p.displayName}
            {p.isPublic ? " · public" : ""}
            {p.isCaller ? " · caller" : ""}{" "}
            <button onClick={() => editProfile(p)}>Edit public profile</button>
          </li>
        ))}
        {items.length === 0 && <li style={{ color: "#888" }}>No performers</li>}
      </ul>

      {editingId && (
        <>
          <h2>Public profile</h2>
          <form onSubmit={saveProfile} style={{ display: "grid", gap: 6, maxWidth: 420 }}>
            <label>
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />{" "}
              Show on the public /performers roster
            </label>
            <label>
              <input
                type="checkbox"
                checked={isCaller}
                onChange={(e) => setIsCaller(e.target.checked)}
              />{" "}
              List individually as a caller
            </label>
            <div>
              Styles:{" "}
              {STYLE_TAGS.map((s) => (
                <label key={s} style={{ marginRight: 8 }}>
                  <input
                    type="checkbox"
                    checked={styleTags.includes(s)}
                    onChange={() => toggleStyle(s)}
                  />{" "}
                  {s}
                </label>
              ))}
            </div>
            <div>
              <div>Promotional links:</div>
              {links.map((l, i) => (
                <div key={i} style={{ display: "flex", gap: 4, marginTop: 4 }}>
                  <select
                    aria-label={`link ${i + 1} type`}
                    value={l.type}
                    onChange={(e) => setLink(i, { type: e.target.value as PromoLink["type"] })}
                  >
                    {PROMO_LINK_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <input
                    placeholder="https://…"
                    aria-label={`link ${i + 1} url`}
                    value={l.url}
                    onChange={(e) => setLink(i, { url: e.target.value })}
                  />
                  <button type="button" onClick={() => removeLink(i)}>
                    ×
                  </button>
                </div>
              ))}
              <button type="button" onClick={addLink} style={{ marginTop: 4 }}>
                + Add link
              </button>
            </div>
            <div>
              <button type="submit">Save profile</button>{" "}
              <button type="button" onClick={() => setEditingId(null)}>
                Cancel
              </button>
            </div>
            {editMessage && <p style={{ color: "crimson" }}>{editMessage}</p>}
          </form>
        </>
      )}

      <h2>Add performer</h2>
      <form onSubmit={create} style={{ display: "grid", gap: 6, maxWidth: 420 }}>
        <input
          placeholder="First name"
          aria-label="First name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
        />
        <input
          placeholder="Last name (optional)"
          aria-label="Last name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
        />
        <input
          placeholder="Display name (optional — a stage name)"
          aria-label="Display name"
          value={displayNameOverride}
          onChange={(e) => setDisplayNameOverride(e.target.value)}
        />
        <input
          placeholder="Email (optional)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          placeholder="Phone (optional)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <textarea
          placeholder="Bio (optional)"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />
        <button type="submit" disabled={!firstName.trim()}>
          Create
        </button>
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        {warning && <p style={{ color: "#a15c00" }}>{warning}</p>}
      </form>
    </main>
  );
}
