import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { announcementPostSchema } from "@/server/validation/announcement";
import {
  clearAnnouncement,
  getCurrentForAdmin,
  isAnnouncementActive,
  postAnnouncement,
} from "@/server/domain/announcements/announcementService";

// Feature 056 (P7-R13): the announcement-banner admin API. Default-deny — content.write (Webmaster / super_user)
// only. The PUBLIC read does NOT use this route; the (public) layout calls getActiveAnnouncement server-side.

export const GET = withAuth({ requires: "content.write" }, async () => {
  const current = await getCurrentForAdmin(db);
  const active = current ? isAnnouncementActive(current, new Date()) : false;
  return NextResponse.json({ current, active });
});

export const POST = withAuth({ requires: "content.write" }, async (req, ctx) => {
  const input = await parseBody(req, announcementPostSchema);
  await postAnnouncement(db, input, ctx.staff.contactId);
  return NextResponse.json({ ok: true }, { status: 201 });
});

export const DELETE = withAuth({ requires: "content.write" }, async (_req, ctx) => {
  await clearAnnouncement(db, ctx.staff.contactId);
  return NextResponse.json({ ok: true });
});
