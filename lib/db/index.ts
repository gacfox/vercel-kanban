import "server-only";
import { getSql } from "./client";
import { ensureSchema } from "./migrate";

export async function getDb() {
  await ensureSchema();
  return getSql();
}

export { getSql };
