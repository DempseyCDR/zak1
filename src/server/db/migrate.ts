import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import postgres from "postgres";
import { resolveDatabaseUrl } from "@/server/validation/env";

/**
 * Minimal SQL migration runner. Applies every *.sql file under ./migrations in
 * lexical order, tracking applied files in a _migrations table. Idempotent.
 */
export async function runMigrations(url: string, log = false): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const dir = join(here, "migrations");
  const sql = postgres(url, { max: 1 });
  try {
    await sql`CREATE TABLE IF NOT EXISTS _migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`;
    const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      const already = await sql`SELECT 1 FROM _migrations WHERE name = ${file}`;
      if (already.length > 0) {
        if (log) console.log(`skip ${file} (already applied)`);
        continue;
      }
      const ddl = await readFile(join(dir, file), "utf8");
      await sql.begin(async (tx) => {
        await tx.unsafe(ddl);
        await tx`INSERT INTO _migrations (name) VALUES (${file})`;
      });
      if (log) console.log(`applied ${file}`);
    }
  } finally {
    await sql.end();
  }
}

// CLI entrypoint
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations(resolveDatabaseUrl(), true)
    .then(() => console.log("migrations complete"))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
