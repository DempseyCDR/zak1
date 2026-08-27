import { Fragment } from "react";
import Link from "next/link";
import {
  formatCalendarDate,
  type PrintableCalendar,
} from "@/server/domain/public/printableCalendar";
import styles from "./PrintableCalendar.module.css";

// Feature 058 (P7-R15): the presentational printable calendar. Server-rendered, no client behavior. The
// screen-only start-date form sits OUTSIDE [data-printable-calendar] so the print CSS hides it; the printable
// region holds the header, the events table (rows clamped to ≤2 lines via CSS), and the footer (standing
// schedule + prices). Split from the async page so it is unit-testable in jsdom.

/** Column 3: "<band> w/<caller>" — band alone if no caller, the caller alone if no band, else a dash. */
function lineup(band: string | null, caller: string | null): string {
  if (band) return caller ? `${band} w/${caller}` : band;
  return caller ?? "—";
}

export default function PrintableCalendarView({ calendar }: { calendar: PrintableCalendar }) {
  const { startISO, rows, truncated, seriesSchedules } = calendar;
  const start = formatCalendarDate(startISO);

  return (
    <div className={styles.page}>
      {/* Screen-only: choose the start date (a plain GET form → ?start=…). Hidden in print. */}
      <form method="get" className={styles.controls}>
        <label>
          Start date
          <input type="date" name="start" defaultValue={startISO} />
        </label>
        <button type="submit">Show</button>
      </form>

      <div data-printable-calendar="">
        <h1 className={styles.header}>Country Dancers of Rochester — Dance Schedule</h1>
        <p className={styles.asOf}>
          Upcoming dances from {start.weekday}, {start.dateDisplay}
        </p>

        {rows.length === 0 ? (
          <p className={styles.empty}>No dances currently scheduled.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Series</th>
                  <th scope="col">Band / Caller</th>
                  <th scope="col">Venue</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const rowCancelled = r.cancelled ? styles.cancelled : "";
                  return (
                    <Fragment key={r.dateISO + r.series}>
                      <tr className={`${rowCancelled} ${r.description ? "" : styles.sep}`}>
                        <td>{r.dateDisplay}</td>
                        <td>
                          {r.series}
                          {r.cancelled && <span className={styles.cancelledTag}> — Cancelled</span>}
                        </td>
                        <td>
                          <span className={styles.clamp}>{lineup(r.band, r.caller)}</span>
                        </td>
                        <td>
                          <span className={styles.clamp}>{r.venue ?? "—"}</span>
                        </td>
                      </tr>
                      {r.description && (
                        <tr className={`${rowCancelled} ${styles.sep}`}>
                          <td colSpan={4} className={styles.desc}>
                            <div className={styles.descText}>{r.description}</div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {truncated && (
          <p className={styles.more}>
            …and more — <Link href="/whats-on">see the full schedule online</Link>.
          </p>
        )}

        {seriesSchedules.length > 0 && (
          <section className={styles.footer} aria-label="Standing schedule and prices">
            <h2>Standing weekly schedule</h2>
            <ul>
              {seriesSchedules.map((s) => (
                <li key={s.seriesKey}>
                  <span className={styles.seriesName}>{s.name}</span>:{" "}
                  <span className={styles.sentence}>{s.sentence}</span>
                  {s.price && (
                    <>
                      {" · "}
                      <span className={styles.price}>{s.price}</span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
