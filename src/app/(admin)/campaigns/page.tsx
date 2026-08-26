"use client";
import { apiFetch } from "@/app/apiFetch";
import { useCallback, useEffect, useState } from "react";

// Feature 057 (P7-R14): the campaign-slot admin. content.write only (enforced by the API; nav hides it
// otherwise). Manage a queue of home-page campaigns — see each one's status and which is currently shown, create
// or edit one (heading, blurb, image URL + alt, CTA, dates), and remove it. Publishing shows on the home page
// without a deploy.

type Row = {
  id: string;
  heading: string;
  blurb: string;
  imageUrl: string | null;
  imageAlt: string | null;
  ctaLabel: string;
  ctaUrl: string;
  startDate: string;
  endDate: string;
  status: "upcoming" | "active" | "ended";
  shown: boolean;
};

const EMPTY = {
  heading: "",
  blurb: "",
  imageUrl: "",
  imageAlt: "",
  ctaLabel: "",
  ctaUrl: "",
  startDate: "",
  endDate: "",
};

export default function CampaignsAdminPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState({ ...EMPTY });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch("/api/campaigns");
    const data = await res.json();
    setRows(data.items ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function set<K extends keyof typeof EMPTY>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function editRow(r: Row) {
    setEditingId(r.id);
    setForm({
      heading: r.heading,
      blurb: r.blurb,
      imageUrl: r.imageUrl ?? "",
      imageAlt: r.imageAlt ?? "",
      ctaLabel: r.ctaLabel,
      ctaUrl: r.ctaUrl,
      startDate: r.startDate,
      endDate: r.endDate,
    });
    setMessage(null);
  }

  function resetForm() {
    setEditingId(null);
    setForm({ ...EMPTY });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const image =
      form.imageUrl.trim() && form.imageAlt.trim()
        ? { url: form.imageUrl, alt: form.imageAlt }
        : null;
    const payload = {
      heading: form.heading,
      blurb: form.blurb,
      image,
      cta: { label: form.ctaLabel, url: form.ctaUrl },
      startDate: form.startDate,
      endDate: form.endDate,
    };
    const res = await apiFetch(editingId ? `/api/campaigns/${editingId}` : "/api/campaigns", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setMessage(editingId ? "Saved." : "Created.");
      resetForm();
      void load();
    } else {
      const body = await res.json().catch(() => null);
      setMessage(body?.error?.message ?? "Failed (check the fields, links, and dates).");
    }
  }

  async function remove(id: string) {
    setMessage(null);
    const res = await apiFetch(`/api/campaigns/${id}`, { method: "DELETE" });
    setMessage(res.ok ? "Removed." : "Failed to remove");
    if (res.ok) {
      if (editingId === id) resetForm();
      void load();
    }
  }

  const statusColor = (s: Row["status"]) =>
    s === "active" ? "green" : s === "upcoming" ? "#946" : "#888";

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1>Campaign slot</h1>
      <p style={{ color: "#555" }}>
        A promotional slot on the public home page for the club&apos;s headline event. Campaigns
        form a queue: while several are active, the home page shows the one that{" "}
        <strong>ends soonest</strong>, then the next. Publishing shows on the home page without a
        deploy.
      </p>

      <section style={{ margin: "16px 0" }}>
        <h2>Campaigns</h2>
        {rows.length === 0 && <p style={{ color: "#888" }}>None yet.</p>}
        <ul style={{ listStyle: "none", padding: 0 }}>
          {rows.map((r) => (
            <li key={r.id} style={{ padding: "10px 0", borderBottom: "1px solid #eee" }}>
              <strong>{r.heading}</strong>{" "}
              <span style={{ color: statusColor(r.status) }}>({r.status})</span>
              {r.shown && <span style={{ color: "green", fontWeight: 600 }}> · shown now</span>}
              <div style={{ color: "#666", fontSize: 13 }}>
                {r.startDate} → {r.endDate} · CTA: {r.ctaLabel} ({r.ctaUrl})
                {r.imageUrl ? " · has image" : " · text-only"}
              </div>
              <div style={{ marginTop: 4 }}>
                <button type="button" onClick={() => editRow(r)}>
                  Edit
                </button>{" "}
                <button type="button" onClick={() => remove(r.id)}>
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <form onSubmit={submit}>
        <h2>{editingId ? "Edit campaign" : "New campaign"}</h2>
        <label style={{ display: "block", margin: "8px 0" }}>
          Heading
          <br />
          <input
            value={form.heading}
            onChange={(e) => set("heading", e.target.value)}
            required
            style={{ width: "100%" }}
          />
        </label>
        <label style={{ display: "block", margin: "8px 0" }}>
          Blurb
          <br />
          <textarea
            value={form.blurb}
            onChange={(e) => set("blurb", e.target.value)}
            required
            rows={2}
            style={{ width: "100%" }}
          />
        </label>
        <label style={{ display: "block", margin: "8px 0" }}>
          Image URL (optional, http(s))
          <br />
          <input
            value={form.imageUrl}
            onChange={(e) => set("imageUrl", e.target.value)}
            style={{ width: "100%" }}
          />
        </label>
        <label style={{ display: "block", margin: "8px 0" }}>
          Image alt text (required if an image is set)
          <br />
          <input
            value={form.imageAlt}
            onChange={(e) => set("imageAlt", e.target.value)}
            style={{ width: "100%" }}
          />
        </label>
        <label style={{ display: "block", margin: "8px 0" }}>
          CTA label
          <br />
          <input
            value={form.ctaLabel}
            onChange={(e) => set("ctaLabel", e.target.value)}
            required
            style={{ width: "100%" }}
          />
        </label>
        <label style={{ display: "block", margin: "8px 0" }}>
          CTA link (internal path like /page, or http(s) URL)
          <br />
          <input
            value={form.ctaUrl}
            onChange={(e) => set("ctaUrl", e.target.value)}
            required
            style={{ width: "100%" }}
          />
        </label>
        <label style={{ display: "inline-block", margin: "8px 16px 8px 0" }}>
          Start date
          <br />
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => set("startDate", e.target.value)}
            required
          />
        </label>
        <label style={{ display: "inline-block", margin: "8px 0" }}>
          End date
          <br />
          <input
            type="date"
            value={form.endDate}
            onChange={(e) => set("endDate", e.target.value)}
            required
          />
        </label>
        <div style={{ marginTop: 12 }}>
          <button type="submit">{editingId ? "Save changes" : "Create campaign"}</button>{" "}
          {editingId && (
            <button type="button" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {message && (
        <p style={{ color: /fail|check/i.test(message) ? "crimson" : "green" }}>{message}</p>
      )}
    </main>
  );
}
