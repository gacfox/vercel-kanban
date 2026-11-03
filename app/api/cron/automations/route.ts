import { timingSafeEqual } from "node:crypto";
import { Redis } from "@upstash/redis";
import { connection } from "next/server";
import { getDb } from "@/lib/db";
import { runDailyAutomations } from "@/lib/automation/engine";

export const maxDuration = 60;

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

async function acquireLock(): Promise<boolean> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return true;

  try {
    const redis = new Redis({ url, token });
    const result = await redis.set("vk:cron:automations:lock", "1", {
      nx: true,
      ex: 300,
    });
    return result === "OK";
  } catch (error) {
    console.warn("Cron lock unavailable, continuing", error);
    return true;
  }
}

export async function GET(request: Request) {
  await connection();

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ error: "CRON_SECRET is not set" }, { status: 500 });
  }

  const authorization = request.headers.get("authorization") ?? "";
  if (!safeEqual(authorization, `Bearer ${secret}`)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await acquireLock())) {
    return Response.json({ ok: true, skipped: true, reason: "locked" });
  }

  try {
    const result = await runDailyAutomations();
    const sql = await getDb();
    await sql.transaction([
      sql`DELETE FROM vk_sessions WHERE expires_at < now()`,
      sql`DELETE FROM vk_automation_runs WHERE created_at < now() - interval '30 days'`,
    ]);

    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error("cron automations failed", error);
    return Response.json({ ok: false }, { status: 500 });
  }
}
