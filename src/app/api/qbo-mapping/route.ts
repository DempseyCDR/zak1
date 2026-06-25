import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withLogging } from "@/server/lib/withLogging";
import { getMappingConfig } from "@/server/domain/treasurer/mappingService";

export const GET = withLogging(async () => {
  const config = await getMappingConfig(db);
  return NextResponse.json(config);
});
