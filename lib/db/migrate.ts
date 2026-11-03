import "server-only";
import { getSql } from "./client";
import { migrations } from "./migrations";

type VersionRow = { version: number };

let schemaPromise: Promise<void> | null = null;

async function getAppliedVersions(): Promise<Set<number>> {
  try {
    const sql = getSql();
    const rows = (await sql.query(
      "SELECT version FROM vk_schema_migrations"
    )) as unknown as VersionRow[];
    return new Set(rows.map((row) => Number(row.version)));
  } catch {
    return new Set();
  }
}

async function runMigrations(): Promise<void> {
  const applied = await getAppliedVersions();
  const pending = migrations.filter((migration) => !applied.has(migration.version));

  if (pending.length === 0) return;

  const sql = getSql();
  const queries = [
    sql`SELECT pg_advisory_xact_lock(721043)`,
    sql`CREATE TABLE IF NOT EXISTS vk_schema_migrations (
      version integer PRIMARY KEY,
      name text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`,
    ...pending.flatMap((migration) =>
      migration.statements.map((statement) => sql.query(statement))
    ),
    ...pending.map(
      (migration) =>
        sql`INSERT INTO vk_schema_migrations (version, name)
            VALUES (${migration.version}, ${migration.name})
            ON CONFLICT (version) DO NOTHING`
    ),
  ];

  await sql.transaction(queries);
}

export function ensureSchema(): Promise<void> {
  schemaPromise ??= runMigrations().catch((error) => {
    schemaPromise = null;
    throw error;
  });
  return schemaPromise;
}
