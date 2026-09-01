import type { ReactNode } from "react";
import styles from "./AdminPage.module.css";

// Feature 060 (X-R1): the mobile-first admin page shell. Replaces the ad-hoc `<main style={{ padding,
// maxWidth }}>` scaffolds with a single token-driven container carrying the page's one <h1> landmark —
// the admin counterpart to the public `Container`.
export default function AdminPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>{title}</h1>
      {children}
    </main>
  );
}
