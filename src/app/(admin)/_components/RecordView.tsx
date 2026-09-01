import type { ReactNode } from "react";
import styles from "./RecordView.module.css";

// Feature 060 (X-R2): Record mode — a focused single-entity view/editor shell. Presentation only: it
// renders a titled region (a landmark named by the entity), an optional actions slot, and the caller's
// fields/sections stacked vertically. It performs no data fetching, mutation, or authorization (FR-009);
// the consuming feature supplies the content.
export default function RecordView({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={styles.record} aria-label={title}>
      <header className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </header>
      <div className={styles.body}>{children}</div>
    </section>
  );
}
