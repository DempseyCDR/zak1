import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { getMappingConfig } from "@/server/domain/treasurer/mappingService";

export const GET = withAuth(async () => {
  const config = await getMappingConfig(db);
  return NextResponse.json(config);
});
