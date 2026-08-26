import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { campaignSchema } from "@/server/validation/campaign";
import { createCampaign, listCampaigns } from "@/server/domain/campaigns/campaignService";

// Feature 057 (P7-R14): the campaign-slot admin API. Default-deny — content.write (Webmaster / super_user) only.
// The PUBLIC read does NOT use this route; the home page calls getShownCampaign(db) server-side.

export const GET = withAuth({ requires: "content.write" }, async () => {
  return NextResponse.json({ items: await listCampaigns(db) });
});

export const POST = withAuth({ requires: "content.write" }, async (req, ctx) => {
  const input = await parseBody(req, campaignSchema);
  const id = await createCampaign(db, input, ctx.staff.contactId);
  return NextResponse.json({ id }, { status: 201 });
});
