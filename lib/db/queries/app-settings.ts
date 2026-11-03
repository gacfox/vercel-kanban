import "server-only";
import { getDb } from "@/lib/db";
import { parseJson } from "@/lib/db/serialize";

export type AppSettings = {
  siteName: string;
  allowRegistration: boolean;
};

export async function getAppSettings(): Promise<AppSettings> {
  const sql = await getDb();
  const rows = (await sql`
    SELECT key, value FROM vk_app_settings
    WHERE key IN ('site_name', 'allow_registration')
  `) as unknown as Array<{ key: string; value: unknown }>;

  const map = new Map(rows.map((row) => [row.key, row.value]));

  return {
    siteName: parseJson<string>(map.get("site_name"), "Kanban") || "Kanban",
    allowRegistration: parseJson<boolean>(map.get("allow_registration"), false) === true,
  };
}

export async function updateAppSettings(input: {
  siteName?: string;
  allowRegistration?: boolean;
}): Promise<void> {
  const sql = await getDb();
  const queries = [];

  if (input.siteName !== undefined) {
    queries.push(
      sql`INSERT INTO vk_app_settings (key, value)
          VALUES ('site_name', ${JSON.stringify(input.siteName)}::jsonb)
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`
    );
  }

  if (input.allowRegistration !== undefined) {
    queries.push(
      sql`INSERT INTO vk_app_settings (key, value)
          VALUES ('allow_registration', ${JSON.stringify(input.allowRegistration)}::jsonb)
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`
    );
  }

  if (queries.length > 0) {
    await sql.transaction(queries);
  }
}
