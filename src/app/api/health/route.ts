import { NextResponse } from "next/server";
import { query, getPoolStats } from "@/lib/db";
import { serverConfig } from "@/server/config";

async function checkDb(): Promise<boolean> {
  try {
    await query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

async function checkRedis(): Promise<boolean> {
  try {
    const { createClient } = await import("redis");
    const client = createClient({ url: serverConfig.redis.url });
    await client.connect();
    await client.ping();
    await client.disconnect();
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const [db, redis] = await Promise.all([checkDb(), checkRedis()]);

  const healthy = db && redis;
  const poolStats = getPoolStats();

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      db: db ? "ok" : "error",
      redis: redis ? "ok" : "error",
      pool: poolStats
        ? {
            total: poolStats.totalCount,
            idle: poolStats.idleCount,
            waiting: poolStats.waitingCount,
          }
        : null,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 }
  );
}
