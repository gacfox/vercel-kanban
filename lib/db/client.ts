import "server-only";
import { neon } from "@neondatabase/serverless";

type NeonClient = ReturnType<typeof neon>;

let client: NeonClient | null = null;

export function getSql(): NeonClient {
  if (client) return client;

  const connectionString =
    process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? undefined;

  if (!connectionString) {
    throw new Error("DATABASE_URL or POSTGRES_URL is not set");
  }

  client = neon(connectionString);
  return client;
}
