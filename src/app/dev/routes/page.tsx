import Link from "next/link";

/**
 * TEMPORARY DEVELOPMENT PAGE — route index.
 *
 * Lists every UI page and API endpoint in the app so reviewers can navigate
 * during development before a real UI/navigation exists.
 *
 * ⚠️ MAINTENANCE REQUIREMENT (temporary): whenever a route is added or removed
 * (a `page.tsx` under src/app or a `route.ts` under src/app/api), update the
 * lists below in the same change. This requirement is provisional and will be
 * replaced when the UI is formally designed.
 */

const uiRoutes: { path: string; label: string; feature: string }[] = [
  { path: "/", label: "Home", feature: "—" },
  { path: "/login", label: "Staff sign-in (Google) — PUBLIC", feature: "015" },
  { path: "/contacts", label: "Contacts directory", feature: "001" },
  { path: "/dedup", label: "Duplicate review queue", feature: "001" },
  { path: "/checkin", label: "Door check-in", feature: "002" },
  { path: "/gate", label: "Gate money entry", feature: "002" },
  { path: "/performers", label: "Performer directory", feature: "003" },
  { path: "/bookings", label: "Bookings (incl. book-a-band)", feature: "003/008" },
  { path: "/bands", label: "Band directory & rosters", feature: "008" },
  { path: "/rate-parameters", label: "Standard pay rates", feature: "003" },
  { path: "/events", label: "Events management", feature: "002" },
  { path: "/treasurer/<eventId>", label: "Treasurer report (printable)", feature: "004" },
  { path: "/qbo-mapping", label: "QBO account/class mapping", feature: "004" },
  { path: "/organizer/ecd", label: "Organizer report & analytics", feature: "005" },
  { path: "/organizer/tnc", label: "Organizer report & analytics", feature: "005" },
  { path: "/expense-parameters", label: "Ongoing series charges", feature: "005/011" },
  { path: "/venue-rents", label: "Venue rents (default + series-at-venue)", feature: "011" },
  { path: "/exports", label: "Mailing list + contact-tracing exports", feature: "006" },
  { path: "/whats-on", label: "Public schedule (browse)", feature: "007" },
  {
    path: "/whats-on/<eventId>",
    label: "Public event detail (venue + performers)",
    feature: "007",
  },
  { path: "/venues", label: "Venue management", feature: "007" },
  { path: "/access", label: "Access control — designate volunteers, assign roles", feature: "016" },
  { path: "/dev/routes", label: "Dev route index (this page)", feature: "dev" },
];

const apiRoutes: { methods: string; path: string; feature: string }[] = [
  // Feature 015 — Staff authentication (PUBLIC: these are how one becomes authenticated)
  { methods: "GET", path: "/api/auth/google", feature: "015" },
  { methods: "GET", path: "/api/auth/google/callback", feature: "015" },
  { methods: "POST", path: "/api/auth/signout", feature: "015" },
  // Feature 001 — Contacts & Membership
  { methods: "GET, POST", path: "/api/contacts", feature: "001" },
  { methods: "GET, PATCH", path: "/api/contacts/[id]", feature: "001" },
  { methods: "POST", path: "/api/contacts/[id]/emails", feature: "001" },
  { methods: "PATCH", path: "/api/contacts/[id]/emails/[emailId]", feature: "001" },
  { methods: "GET", path: "/api/contacts/[id]/membership-status", feature: "001" },
  { methods: "POST", path: "/api/memberships", feature: "001" },
  { methods: "GET", path: "/api/dedup/suggestions", feature: "001" },
  { methods: "POST", path: "/api/dedup/merge", feature: "001" },
  // Feature 002 — Door Attendance & Gate Capture
  { methods: "GET, POST", path: "/api/events", feature: "002" },
  { methods: "GET", path: "/api/series", feature: "002" },
  { methods: "GET, POST", path: "/api/event-groups", feature: "002" },
  { methods: "GET, POST", path: "/api/events/[id]/attendance", feature: "002" },
  { methods: "POST", path: "/api/events/[id]/door-record", feature: "002" },
  { methods: "GET", path: "/api/attendance/search", feature: "002" },
  { methods: "POST", path: "/api/door-records", feature: "002" },
  { methods: "GET, PATCH", path: "/api/door-records/[id]", feature: "002" },
  { methods: "PUT", path: "/api/door-records/[id]/gate-sales", feature: "002" },
  // Feature 003 — Performers & Bookings
  { methods: "GET, POST", path: "/api/performers", feature: "003" },
  { methods: "GET, PATCH", path: "/api/performers/[id]", feature: "003" },
  { methods: "GET, POST", path: "/api/rate-parameters", feature: "003" },
  { methods: "GET, POST", path: "/api/events/[id]/bookings", feature: "003" },
  { methods: "PATCH, DELETE", path: "/api/bookings/[id]", feature: "003" },
  // Feature 004 — Treasurer Report & QBO Hand-off
  { methods: "GET", path: "/api/events/[id]/treasurer-report", feature: "004" },
  { methods: "GET, POST", path: "/api/events/[id]/non-dance-income", feature: "004" },
  { methods: "PATCH", path: "/api/bookings/[id]/check", feature: "004" },
  { methods: "GET", path: "/api/qbo-mapping", feature: "004" },
  { methods: "PUT", path: "/api/qbo-mapping/accounts/[lineKey]", feature: "004" },
  { methods: "PUT", path: "/api/qbo-mapping/series/[seriesId]", feature: "004" },
  // Feature 005 — Organizer Report & Analytics
  { methods: "GET", path: "/api/organizer/[seriesKey]/report", feature: "005" },
  { methods: "GET, POST", path: "/api/expense-parameters", feature: "005" },
  { methods: "GET, POST", path: "/api/events/[id]/misc-expenses", feature: "005" },
  // Feature 006 — iContact Export
  { methods: "GET", path: "/api/exports", feature: "006" },
  { methods: "GET", path: "/api/exports/[listId]", feature: "006" },
  { methods: "GET", path: "/api/exports/contact-tracing", feature: "006" },
  // Feature 008 — Reusable Band Roster
  { methods: "GET, POST", path: "/api/bands", feature: "008" },
  { methods: "GET, PATCH, DELETE", path: "/api/bands/[id]", feature: "008" },
  { methods: "POST", path: "/api/events/[id]/book-band", feature: "008" },
  // Feature 007 — Public Website (browse)
  { methods: "GET, POST", path: "/api/venues", feature: "007" },
  { methods: "GET, PATCH", path: "/api/venues/[id]", feature: "007" },
  { methods: "PATCH", path: "/api/events/[id]", feature: "007/011" },
  // Feature 011 — Venue-scoped rent
  { methods: "GET, POST", path: "/api/venue-rents", feature: "011" },
  // Feature 016 — Authorization (access control; President/VP)
  { methods: "GET, POST, DELETE", path: "/api/access/volunteers", feature: "016" },
  { methods: "POST", path: "/api/access/volunteers/[id]/approve", feature: "016" },
  { methods: "POST, DELETE", path: "/api/access/grants", feature: "016" },
];

export default function DevRoutesPage() {
  return (
    <main style={{ padding: 24, maxWidth: 900 }}>
      <div
        style={{
          background: "#fff3cd",
          border: "1px solid #ffe69c",
          padding: 12,
          borderRadius: 6,
          marginBottom: 20,
        }}
      >
        <strong>⚠️ Temporary development page.</strong> Route index for review before a real UI
        exists. <em>Requirement (provisional):</em> update the lists below whenever a route is added
        or removed. This requirement will be replaced when the UI is designed.
      </div>

      <h1>UI pages</h1>
      <table>
        <thead>
          <tr>
            <th align="left">Route</th>
            <th align="left">Label</th>
            <th align="left">Feature</th>
          </tr>
        </thead>
        <tbody>
          {uiRoutes.map((r) => (
            <tr key={r.path}>
              <td>
                <Link href={r.path}>{r.path}</Link>
              </td>
              <td>{r.label}</td>
              <td>{r.feature}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h1 style={{ marginTop: 24 }}>API endpoints</h1>
      <table>
        <thead>
          <tr>
            <th align="left">Methods</th>
            <th align="left">Path</th>
            <th align="left">Feature</th>
          </tr>
        </thead>
        <tbody>
          {apiRoutes.map((r) => (
            <tr key={r.path}>
              <td>
                <code>{r.methods}</code>
              </td>
              <td>
                <code>{r.path}</code>
              </td>
              <td>{r.feature}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
