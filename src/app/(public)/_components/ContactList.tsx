import type { PublicOfficer } from "@/server/domain/org/officerService";
import styles from "./ContactList.module.css";

/**
 * Feature 055 (P7-R12): the public contact directory — every club role with its email alias (mailto) and, for a
 * board-seat role with a designated officer, the officer's name. PII-gated upstream: entries carry only name +
 * role + alias. Board officers and function aliases live together here (the board page was merged in).
 */
export default function ContactList({ entries }: { entries: PublicOfficer[] }) {
  return (
    <ul className={styles.list}>
      {entries.map((e) => (
        <li key={e.roleName} className={styles.row}>
          <span className={styles.role}>{e.roleName}</span>
          {e.name ? <span className={styles.name}>{e.name}</span> : null}
          <a className={styles.alias} href={`mailto:${e.emailAlias}`}>
            {e.emailAlias}
          </a>
        </li>
      ))}
    </ul>
  );
}
