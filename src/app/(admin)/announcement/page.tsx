"use client";
import { apiFetch } from "@/app/apiFetch";
import { useCallback, useEffect, useState } from "react";

// Feature 056 (P7-R13): the announcement-banner admin. content.write only (enforced by the API; nav hides it
// otherwise). Post a short notice (text, urgency, duration, optional link) that shows site-wide without a
// deploy and auto-expires; or clear the current one early.

type Current = {
  id: string;
  text: string;
  level: string;
  linkLabel: string | null;
  linkUrl: string | null;
  durationHours: number;
} | null;

export default function AnnouncementAdminPage() {
  const [current, setCurrent] = useState<Current>(null);
  const [active, setActive] = useState(false);
  const [text, setText] = useState("");
  const [level, setLevel] = useState<"info" | "urgent">("info");
  const [durationHours, setDurationHours] = useState(24);
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch("/api/announcement");
    const data = await res.json();
    setCurrent(data.current ?? null);
    setActive(Boolean(data.active));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function post(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const link = linkLabel.trim() && linkUrl.trim() ? { label: linkLabel, url: linkUrl } : null;
    const res = await apiFetch("/api/announcement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, level, durationHours, link }),
    });
    if (res.ok) {
      setMessage("Posted.");
      setText("");
      setLinkLabel("");
      setLinkUrl("");
      void load();
    } else {
      const body = await res.json().catch(() => null);
      setMessage(body?.error?.message ?? "Failed to post (check the text and link).");
    }
  }

  async function clear() {
    setMessage(null);
    const res = await apiFetch("/api/announcement", { method: "DELETE" });
    setMessage(res.ok ? "Cleared." : "Failed to clear");
    if (res.ok) void load();
  }

  return (
    <main style={{ padding: 24, maxWidth: 640 }}>
      <h1>Announcement banner</h1>
      <p style={{ color: "#555" }}>
        A short site-wide notice (e.g. a cancellation or weather alert) shown above the content on
        every public page. It auto-expires after its duration; you can also clear it early. Only one
        is current at a time — posting a new one replaces the previous.
      </p>

      <section style={{ margin: "16px 0", padding: 12, background: "#f6f6f6", borderRadius: 6 }}>
        <strong>Current:</strong>{" "}
        {current ? (
          <>
            {active ? (
              <span style={{ color: "green" }}>active</span>
            ) : (
              <span style={{ color: "#888" }}>inactive (expired or cleared)</span>
            )}
            <div style={{ marginTop: 6 }}>
              “{current.text}” <em>({current.level})</em>
              {current.linkUrl && (
                <>
                  {" "}
                  · link: {current.linkLabel} → {current.linkUrl}
                </>
              )}
            </div>
            {active && (
              <button type="button" onClick={clear} style={{ marginTop: 8 }}>
                Clear now
              </button>
            )}
          </>
        ) : (
          <em style={{ color: "#888" }}>none</em>
        )}
      </section>

      <form onSubmit={post}>
        <h2>Post a new announcement</h2>
        <label style={{ display: "block", margin: "8px 0" }}>
          Text
          <br />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
            rows={2}
            style={{ width: "100%" }}
          />
        </label>
        <fieldset style={{ margin: "8px 0", border: "1px solid #ddd", padding: 8 }}>
          <legend>Urgency</legend>
          <label style={{ marginRight: 16 }}>
            <input
              type="radio"
              name="level"
              checked={level === "info"}
              onChange={() => setLevel("info")}
            />{" "}
            Info
          </label>
          <label>
            <input
              type="radio"
              name="level"
              checked={level === "urgent"}
              onChange={() => setLevel("urgent")}
            />{" "}
            Urgent
          </label>
        </fieldset>
        <label style={{ display: "block", margin: "8px 0" }}>
          Active for (hours)
          <br />
          <input
            type="number"
            min={1}
            max={720}
            value={durationHours}
            onChange={(e) => setDurationHours(Number(e.target.value))}
          />
        </label>
        <label style={{ display: "block", margin: "8px 0" }}>
          Link label (optional)
          <br />
          <input
            value={linkLabel}
            onChange={(e) => setLinkLabel(e.target.value)}
            style={{ width: "100%" }}
          />
        </label>
        <label style={{ display: "block", margin: "8px 0" }}>
          Link URL (optional, http(s) only)
          <br />
          <input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            style={{ width: "100%" }}
          />
        </label>
        <button type="submit">Post announcement</button>
      </form>

      {message && (
        <p style={{ color: /fail|check/i.test(message) ? "crimson" : "green" }}>{message}</p>
      )}
    </main>
  );
}
