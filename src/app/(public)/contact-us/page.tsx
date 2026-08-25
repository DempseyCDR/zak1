import { db } from "@/server/db/client";
import { getContentPageBySlug } from "@/server/domain/content/contentService";
import { renderMarkdown } from "@/server/domain/content/markdown";
import { listContactRoles } from "@/server/domain/org/officerService";
import Container from "../_components/Container";
import ContactList from "../_components/ContactList";
import styles from "./contact-us.module.css";

/**
 * Feature 055 (P7-R12): the public contact directory at /contact-us — every club role with its email alias and,
 * for board seats, the current officer's name (the former /board page is merged in). Followed by an optional
 * curated block authored in the 051 content CMS (slug `contact-info`; omitted when unpublished). `contact-us` is
 * a reserved slug so a CMS page can't shadow this dedicated route via the 051 `/[slug]` catch-all.
 */
export default async function ContactUsPage() {
  const [entries, block] = await Promise.all([
    listContactRoles(db),
    getContentPageBySlug(db, "contact-info"),
  ]);
  return (
    <Container>
      <h1>Contact Us</h1>
      <p>Reach the right person by their role — these go to the club&rsquo;s role addresses.</p>
      <ContactList entries={entries} />
      {block?.publishedBody ? (
        <div
          className={styles.block}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(block.publishedBody) }}
        />
      ) : null}
    </Container>
  );
}
