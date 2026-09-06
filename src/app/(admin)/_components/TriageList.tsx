import type { ReactNode } from "react";
import styles from "./TriageList.module.css";

// Feature 060 (X-R2): Triage mode — a worklist of pending items. Each row renders the caller's primary
// content and, when `onOpen` is given, is a full-width button that opens the record/detail view (the
// Triage→Record bridge, FR-007). An empty list renders the provided empty state, never a blank region.
// Presentation only: the pattern itself performs no data mutation (FR-009); the consumer wires actions.
export default function TriageList<T>({
  items,
  getKey,
  renderRow,
  onOpen,
  rowActions,
  rowLabel,
  emptyState,
}: {
  items: readonly T[];
  getKey: (item: T) => string;
  renderRow: (item: T) => ReactNode;
  onOpen?: (item: T) => void;
  /**
   * Feature 069 (FR-005): the row's one resolution, beside the open-the-record body. Still presentation
   * only — the consumer supplies the control and owns what it does.
   */
  rowActions?: (item: T) => ReactNode;
  /** Names the row for assistive tech, so an action can be found within the row it belongs to. */
  rowLabel?: (item: T) => string;
  emptyState: ReactNode;
}) {
  if (items.length === 0) {
    return <div className={styles.empty}>{emptyState}</div>;
  }
  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={getKey(item)} className={styles.row} aria-label={rowLabel?.(item)}>
          {onOpen ? (
            <button type="button" className={styles.open} onClick={() => onOpen(item)}>
              {renderRow(item)}
            </button>
          ) : (
            <div className={styles.rowContent}>{renderRow(item)}</div>
          )}
          {rowActions && <span className={styles.rowActions}>{rowActions(item)}</span>}
        </li>
      ))}
    </ul>
  );
}
