import { connection } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  await connection();

  try {
    const sql = await getDb();
    await sql`SELECT 1`;
    return Response.json({ ok: true });
  } catch (error) {
    console.error("health check failed", error);
    return Response.json({ ok: false }, { status: 503 });
  }
}
