import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/server/db/client";
import { getContentPageBySlug } from "@/server/domain/content/contentService";
import { renderMarkdown } from "@/server/domain/content/markdown";
import Container from "../_components/Container";
import styles from "./contentPage.module.css";

/**
 * Feature 051 (P7-R7): a public content page (`/<slug>`). Renders a **published** page's title as the single
 * `<h1>` and its Markdown body as **sanitized** HTML. Unknown / unpublished / reserved slugs → not-found (the
 * static/dynamic siblings — /whats-on, /dances, … — resolve first). The `dangerouslySetInnerHTML` here is the
 * app's first, and is safe ONLY because `renderMarkdown` sanitizes.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getContentPageBySlug(db, slug);
  if (!page) return {};
  return { title: page.title, ...(page.summary ? { description: page.summary } : {}) };
}

export default async function ContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getContentPageBySlug(db, slug);
  if (!page) notFound();

  const html = renderMarkdown(page.publishedBody ?? "");
  return (
    <Container>
      <article>
        <h1 className={styles.title}>{page.title}</h1>
        {/* Sanitized by renderMarkdown (marked → sanitize-html allowlist) — never trusts raw stored Markdown. */}
        <div className={styles.prose} dangerouslySetInnerHTML={{ __html: html }} />
      </article>
    </Container>
  );
}
