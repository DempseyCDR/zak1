"use client";
import { useEffect, useState } from "react";
import type { PublicAnnouncement } from "@/server/domain/announcements/announcementService";
import styles from "./AnnouncementBanner.module.css";

// Feature 056 (P7-R13): the site-wide announcement banner. Mounted once in the (public) layout above the
// content, so it shows on every public page and never on admin/door. The TEXT is server-rendered (a no-JS
// visitor sees it, FR-009); DISMISS is a post-hydration progressive enhancement keyed to the announcement id
// (a new/changed announcement has a new id, so a stale dismissal never suppresses a fresh notice, FR-008).

const DISMISS_KEY = "cdr.announcement.dismissed";

export default function AnnouncementBanner({ announcement }: { announcement: PublicAnnouncement }) {
  const [dismissed, setDismissed] = useState(false);

  // On mount only (never during SSR): honor a prior dismissal of THIS announcement.
  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY) === announcement.id) setDismissed(true);
    } catch {
      // Storage unavailable (private mode, etc.) — the banner simply stays shown.
    }
  }, [announcement.id]);

  if (dismissed) return null;

  const urgent = announcement.level === "urgent";

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, announcement.id);
    } catch {
      // Ignore storage failures — dismissal is best-effort.
    }
    setDismissed(true);
  }

  return (
    <div
      className={`${styles.banner} ${urgent ? styles.urgent : styles.info}`}
      role={urgent ? "alert" : "status"}
      {...(urgent ? {} : { "aria-live": "polite" as const })}
    >
      <div className={styles.body}>
        <span className={styles.text}>{announcement.text}</span>
        {announcement.link && (
          <a
            className={styles.link}
            href={announcement.link.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {announcement.link.label}
          </a>
        )}
      </div>
      <button
        type="button"
        className={styles.dismiss}
        onClick={dismiss}
        aria-label="Dismiss announcement"
      >
        ✕
      </button>
    </div>
  );
}
