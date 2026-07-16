import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { venueRents } from "@/server/db/schema";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { venueRentCreateSchema } from "@/server/validation/venueRents";
import { createVenueRent } from "@/server/domain/parameters/rentService";

export const GET = withAuth({ requires: "base" }, async (req) => {
  const url = new URL(req.url);
  const venueId = url.searchParams.get("venueId");
  if (!venueId) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "venueId required" } },
      { status: 422 },
    );
  }
  const items = await db
    .select()
    .from(venueRents)
    .where(eq(venueRents.venueId, venueId))
    .orderBy(desc(venueRents.effectiveDate));
  return NextResponse.json({ items });
});

export const POST = withAuth({ requires: "venue.write" }, async (req) => {
  const input = await parseBody(req, venueRentCreateSchema);
  const actor = req.headers.get("x-actor") ?? "admin";
  const row = await createVenueRent(db, input, actor);
  return NextResponse.json(row, { status: 201 });
});
