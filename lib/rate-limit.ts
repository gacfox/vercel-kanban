import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { Redis } from "@upstash/redis";

let redisClient: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient;

  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  redisClient = url && token ? new Redis({ url, token }) : null;
  return redisClient;
}

export function hashIdentifier(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

export async function rateLimit(options: {
  name: string;
  identifier: string;
  limit: number;
  windowSeconds: number;
}): Promise<{ allowed: boolean; remaining: number }> {
  const redis = getRedis();
  if (!redis) return { allowed: true, remaining: options.limit };

  const key = `vk:rl:${options.name}:${hashIdentifier(options.identifier)}`;

  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, options.windowSeconds);
    }
    return {
      allowed: count <= options.limit,
      remaining: Math.max(0, options.limit - count),
    };
  } catch (error) {
    console.warn("Rate limit unavailable, allowing request", error);
    return { allowed: true, remaining: options.limit };
  }
}

export async function getClientIp(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return headerList.get("x-real-ip") ?? "unknown";
}
