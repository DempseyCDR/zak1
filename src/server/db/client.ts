import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { resolveDatabaseUrl } from "@/server/validation/env";
import * as schema from "@/server/db/schema";

/**
 * Single postgres-js connection pool + Drizzle instance for the process.
 * Tests point at TEST_DATABASE_URL via resolveDatabaseUrl().
 */
const connectionString = resolveDatabaseUrl();

export const sql = postgres(connectionString, { max: 10 });
export const db = drizzle(sql, { schema });

export type Db = typeof db;
