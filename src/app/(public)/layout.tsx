import type { ReactNode } from "react";
import styles from "./public.module.css";
import Footer from "./_components/Footer";
import AnnouncementBanner from "./_components/AnnouncementBanner";
import { db } from "@/server/db/client";
import { getActiveAnnouncement } from "@/server/domain/announcements/announcementService";

/**
 * Public route-group layout.
 *
 * The site header/wordmark lives in the root-layout <PublicNav/> (feature 034, P6-R1). Feature 045 (P7-R1):
 * this layout applies the design-token *visual* layer — brand ground, fonts, headings, links — scoped to
 * the public group via a wrapper class, so admin/door/volunteer surfaces stay unchanged (SC-007). Feature
 * 047 (P7-R3): the site-wide public footer renders here, so it appears on every public page and never on
 * admin/door. Feature 056 (P7-R13): the announcement banner mounts here too — one site-wide mount point that
 * is never on admin/door — server-rendered above the content when an announcement is active.
 */
export default async function PublicLayout({ children }: { children: ReactNode }) {
  const announcement = await getActiveAnnouncement(db);
  return (
    <div className={styles.public}>
      {announcement && <AnnouncementBanner announcement={announcement} />}
      {children}
      <Footer />
    </div>
  );
}
