import { notFound } from "next/navigation";
import { db } from "@/server/db/client";
import { getPublicEventDetail } from "@/server/domain/public/publicSchedule";

export default async function PublicEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const detail = await getPublicEventDetail(db, eventId);
  if (!detail) notFound();

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1>
        {detail.activity}
        {detail.label ? ` — ${detail.label}` : ""}
      </h1>
      <p style={{ color: "#444" }}>
        {detail.date}
        {detail.startTime ? ` · ${detail.startTime}` : ""}
      </p>

      {detail.description && (
        <p style={{ whiteSpace: "pre-line", margin: "12px 0" }}>{detail.description}</p>
      )}

      {detail.venue && (
        <section style={{ marginBottom: 16 }}>
          <h2>Venue</h2>
          <p>
            {detail.venue.name} — {detail.venue.address}
          </p>
          {/* Map: static image if a maps key is configured, else a link (venueMapUrl). */}
          <p>
            <a href={detail.venue.mapUrl} target="_blank" rel="noreferrer">
              View map
            </a>
          </p>
        </section>
      )}

      <section>
        <h2>Performers</h2>
        {detail.bandBlocks.map((b) => (
          <div key={b.name} style={{ padding: "8px 0", borderBottom: "1px solid #eee" }}>
            <strong>{b.name}</strong>
            {b.bio && <p style={{ margin: "4px 0" }}>{b.bio}</p>}
            {b.photoUrl && <img src={b.photoUrl} alt={b.name} style={{ maxWidth: 200 }} />}
          </div>
        ))}
        {detail.performers.map((p, i) => {
          if (p.kind === "open_band") {
            return (
              <div key={`ob-${i}`} style={{ padding: "8px 0", borderBottom: "1px solid #eee" }}>
                Open Band
              </div>
            );
          }
          if (p.kind === "name_note") {
            return (
              <div key={`nn-${i}`} style={{ padding: "8px 0", borderBottom: "1px solid #eee" }}>
                <strong>{p.name}</strong>
                {p.note && <span> — {p.note}</span>}
              </div>
            );
          }
          return (
            <div key={`fb-${i}`} style={{ padding: "8px 0", borderBottom: "1px solid #eee" }}>
              <strong>{p.name}</strong>
              {p.bio && <p style={{ margin: "4px 0" }}>{p.bio}</p>}
              {p.photoUrl && <img src={p.photoUrl} alt={p.name} style={{ maxWidth: 200 }} />}
            </div>
          );
        })}
      </section>
    </main>
  );
}
