import type { ReactNode, ElementType } from "react";
import styles from "./Container.module.css";

// Feature 045 (P7-R1): the mobile-first content wrapper for public pages — replaces the ad-hoc inline
// `<main style={{ padding, maxWidth }}>`. Renders <main> by default so each public page keeps a single
// top-level landmark containing its one <h1>. `width="narrow"` matches the tighter forms (e.g. /join).
export default function Container({
  children,
  as: As = "main",
  width = "default",
}: {
  children: ReactNode;
  as?: ElementType;
  width?: "default" | "narrow";
}) {
  const className = width === "narrow" ? `${styles.container} ${styles.narrow}` : styles.container;
  return <As className={className}>{children}</As>;
}
