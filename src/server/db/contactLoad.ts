import { readFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { loadEnv } from "@/server/lib/loadEnv";
import { resolveDatabaseUrl } from "@/server/validation/env";
import { db, sql } from "@/server/db/client";
import {
  parseIcontact,
  parseMemberSheet,
  parsePayerSheet,
  executeContactLoad,
  formatSummary,
} from "@/server/domain/contactLoad";

/**
 * Feature 044 — operator CLI: replace the contact roster from an iContact CSV export + the CDR membership
 * workbook (Member + Payer sheets, exported to CSV). Retains role-grant holders and merge parties; hard-
 * resets the rest. See specs/044-contact-load and contracts/contact-load-cli.md.
 *
 * Dry-run is the DEFAULT. `--commit` performs a pg_dump backup, then applies the load in one transaction.
 * Deliberately NOT an HTTP route (FR-017).
 */

type Args = {
  icontact: string;
  members: string;
  payers: string;
  commit: boolean;
  backupDir: string;
};

const EXIT = { validation: 1, backup: 2, transaction: 3 } as const;

function parseArgs(argv: string[]): Args {
  const map = new Map<string, string>();
  const flags = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      map.set(key, next);
      i++;
    } else {
      flags.add(key);
    }
  }
  const require = (k: string): string => {
    const v = map.get(k);
    if (!v) throw new Error(`missing required --${k} <path>`);
    return v;
  };
  return {
    icontact: require("icontact"),
    members: require("members"),
    payers: require("payers"),
    commit: flags.has("commit"),
    backupDir: map.get("backup-dir") ?? "tmp",
  };
}

function backup(backupDir: string): string {
  mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = join(backupDir, `contact-load-${stamp}.dump`);
  // pg_dump accepts the connection URI as its final argument.
  execFileSync("pg_dump", ["--format=custom", `--file=${path}`, resolveDatabaseUrl()], {
    stdio: ["ignore", "ignore", "inherit"],
  });
  return path;
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));

  // 1. Parse + validate all three files BEFORE any write (validation errors stop the run).
  let input;
  try {
    input = {
      icontact: parseIcontact(readFileSync(args.icontact, "utf8")),
      members: parseMemberSheet(readFileSync(args.members, "utf8")),
      payers: parsePayerSheet(readFileSync(args.payers, "utf8")),
    };
  } catch (err) {
    console.error(`✗ validation failed: ${(err as Error).message}`);
    return EXIT.validation;
  }

  // 2. Backup before any write, on commit only.
  let backupPath: string | null = null;
  if (args.commit) {
    try {
      backupPath = backup(args.backupDir);
      console.log(`✓ backup written: ${backupPath}`);
    } catch (err) {
      console.error(`✗ backup failed (is pg_dump on PATH?): ${(err as Error).message}`);
      return EXIT.backup;
    }
  }

  // 3. Load (single transaction; dry-run computes-then-rolls-back).
  try {
    const { counts, resolution } = await executeContactLoad(db, input, { dryRun: !args.commit });
    console.log(formatSummary(counts, resolution, { committed: args.commit, backupPath }));
    return 0;
  } catch (err) {
    console.error(`✗ load failed and rolled back: ${(err as Error).message}`);
    return EXIT.transaction;
  }
}

// CLI entrypoint.
if (import.meta.url === `file://${process.argv[1]}`) {
  loadEnv();
  main()
    .then(async (code) => {
      await sql.end();
      process.exit(code);
    })
    .catch(async (err) => {
      console.error(err);
      await sql.end();
      process.exit(1);
    });
}
