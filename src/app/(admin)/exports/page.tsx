"use client";

import { useCallback, useEffect, useState } from "react";

type ListItem = {
  listId: string;
  filename: string;
  kind: "topic" | "derived";
  note: string | null;
  lastExport: { actor: string | null; rowCount: number; createdAt: string } | null;
};

type EventOption = { id: string; eventDate: string };

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExportsPage() {
  const [items, setItems] = useState<ListItem[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [eventId, setEventId] = useState("");
  const [tracingMessage, setTracingMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/exports");
    const data = await res.json();
    setItems(data.items ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    // Purge-aware dropdown (FR-006b): only offer events within the 90-day retention window.
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const from = cutoff.toISOString().slice(0, 10);
    void fetch(`/api/events?from=${from}`)
      .then((r) => r.json())
      .then((d) => setEvents(d.items ?? []));
  }, []);

  async function downloadContactTracing() {
    if (!eventId) return;
    setTracingMessage(null);
    const res = await fetch(`/api/exports/contact-tracing?eventId=${eventId}`);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setTracingMessage(body?.error?.message ?? "Failed to generate export");
      return;
    }
    if ((res.headers.get("content-type") ?? "").includes("application/json")) {
      const body = await res.json();
      setTracingMessage(`${body.count} attendees recorded — no export generated.`);
      return;
    }
    const disposition = res.headers.get("content-disposition") ?? "";
    const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? "contact_tracing.csv";
    downloadBlob(await res.blob(), filename);
  }

  return (
    <main style={{ padding: 24, maxWidth: 800 }}>
      <h1>Mailing list exports</h1>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: 8 }}>List</th>
            <th style={{ textAlign: "left", padding: 8 }}>Last exported</th>
            <th style={{ textAlign: "left", padding: 8 }}></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.listId}>
              <td style={{ padding: 8 }}>
                {item.filename}
                {item.note && <div style={{ color: "#666", fontSize: 12 }}>{item.note}</div>}
              </td>
              <td style={{ padding: 8 }}>
                {item.lastExport
                  ? `${item.lastExport.rowCount} rows — ${new Date(item.lastExport.createdAt).toLocaleString()}`
                  : "never"}
              </td>
              <td style={{ padding: 8 }}>
                <a href={`/api/exports/${item.listId}`} download onClick={() => setTimeout(load, 500)}>
                  Download
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ marginTop: 32 }}>Contact tracing</h2>
      <p style={{ color: "#666" }}>
        Export the recorded attendees of one dance who have consented to contact-tracing outreach.
        Events older than 90 days are not listed (attendance is purged by then).
      </p>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
          <option value="">— select an event —</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.eventDate}
            </option>
          ))}
        </select>
        <button onClick={downloadContactTracing} disabled={!eventId}>
          Download
        </button>
      </div>
      {tracingMessage && <p>{tracingMessage}</p>}
    </main>
  );
}
