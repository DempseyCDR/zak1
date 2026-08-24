"use client";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/app/apiFetch";
import styles from "./content.module.css";

/**
 * Feature 051 (P7-R7): the content-pages editor (Webmaster / content.write). List the pages, edit a page's
 * title + draft Markdown + summary, Preview the draft (rendered through the SAME server sanitizer as the
 * public page), and Publish / Unpublish / Delete. Editing the draft never changes the public page until
 * Publish. Server routes enforce content.write regardless of this presentation.
 */

type ListItem = { id: string; slug: string; title: string; published: boolean };
type Page = {
  id: string;
  slug: string;
  title: string;
  draftBody: string;
  publishedBody: string | null;
  published: boolean;
  summary: string | null;
};

const BLANK = { slug: "", title: "", draftBody: "", summary: "" };

export default function ContentAdminPage() {
  const [pages, setPages] = useState<ListItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null); // null = new page
  const [form, setForm] = useState(BLANK);
  const [published, setPublished] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadList = useCallback(() => {
    void apiFetch("/api/content")
      .then((r) => r.json())
      .then((d: { items: ListItem[] }) => setPages(d.items));
  }, []);

  useEffect(() => loadList(), [loadList]);

  function startNew() {
    setEditingId(null);
    setForm(BLANK);
    setPublished(false);
    setPreview(null);
    setMessage(null);
  }

  const edit = useCallback((id: string) => {
    setPreview(null);
    setMessage(null);
    void apiFetch(`/api/content/${id}`)
      .then((r) => r.json())
      .then((p: Page) => {
        setEditingId(p.id);
        setForm({ slug: p.slug, title: p.title, draftBody: p.draftBody, summary: p.summary ?? "" });
        setPublished(p.published);
      });
  }, []);

  async function save() {
    setMessage(null);
    const body = editingId
      ? { title: form.title, draftBody: form.draftBody, summary: form.summary || null }
      : {
          slug: form.slug,
          title: form.title,
          draftBody: form.draftBody,
          summary: form.summary || undefined,
        };
    const jsonInit = {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    };
    const res = editingId
      ? await apiFetch(`/api/content/${editingId}`, { method: "PATCH", ...jsonInit })
      : await apiFetch("/api/content", { method: "POST", ...jsonInit });
    if (!res.ok) {
      const d = await res.json().catch(() => null);
      setMessage(d?.error?.message ?? "Save failed.");
      return;
    }
    const saved: Page = await res.json();
    setEditingId(saved.id);
    setPublished(saved.published);
    setMessage("Draft saved.");
    loadList();
  }

  async function act(path: string, ok: string) {
    if (!editingId) return;
    const res = await apiFetch(`/api/content/${editingId}${path}`, { method: "POST" });
    if (!res.ok) {
      setMessage("Action failed.");
      return;
    }
    const p: Page = await res.json();
    setPublished(p.published);
    setMessage(ok);
    loadList();
  }

  async function remove() {
    if (!editingId) return;
    const res = await apiFetch(`/api/content/${editingId}`, { method: "DELETE" });
    if (!res.ok) {
      setMessage("Delete failed.");
      return;
    }
    startNew();
    setMessage("Page deleted.");
    loadList();
  }

  async function doPreview() {
    const res = await apiFetch("/api/content/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown: form.draftBody }),
    });
    const d: { html: string } = await res.json();
    setPreview(d.html);
  }

  return (
    <div className={styles.wrap}>
      <h1>Content pages</h1>

      <div className={styles.layout}>
        <aside className={styles.list}>
          <button type="button" onClick={startNew} className={styles.newBtn}>
            + New page
          </button>
          <ul>
            {pages.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => edit(p.id)} className={styles.listItem}>
                  <span>{p.title}</span>
                  <span className={styles.state}>{p.published ? "published" : "draft"}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className={styles.editor}>
          {message ? <p className={styles.message}>{message}</p> : null}

          {!editingId ? (
            <label className={styles.field}>
              Slug (the public URL, /&lt;slug&gt;) — cannot be changed later
              <input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="mission"
              />
            </label>
          ) : (
            <p className={styles.slugLine}>
              URL: <code>/{form.slug}</code> · {published ? "published" : "not published"}
            </p>
          )}

          <label className={styles.field}>
            Title
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>

          <label className={styles.field}>
            Body (Markdown)
            <textarea
              rows={16}
              value={form.draftBody}
              onChange={(e) => setForm({ ...form, draftBody: e.target.value })}
            />
          </label>

          <label className={styles.field}>
            Summary (optional, for search engines)
            <input
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
            />
          </label>

          <div className={styles.actions}>
            <button type="button" onClick={save}>
              Save draft
            </button>
            <button type="button" onClick={doPreview}>
              Preview
            </button>
            {editingId ? (
              <>
                <button type="button" onClick={() => act("/publish", "Published.")}>
                  Publish
                </button>
                {published ? (
                  <button type="button" onClick={() => act("/unpublish", "Unpublished.")}>
                    Unpublish
                  </button>
                ) : null}
                <button type="button" onClick={remove} className={styles.delete}>
                  Delete
                </button>
              </>
            ) : null}
          </div>

          {preview !== null ? (
            <div className={styles.previewBox}>
              <h2>Preview</h2>
              {/* Server-sanitized (renderMarkdown) before it reached the client. */}
              <div dangerouslySetInnerHTML={{ __html: preview }} />
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
