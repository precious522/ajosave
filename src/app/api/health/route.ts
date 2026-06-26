import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/server/middleware";
import { getRedis } from "@/lib/redis";
import { query, getPoolStats } from "@/lib/db";

export const GET = withErrorHandler(async (_req: NextRequest) => {
  const start = Date.now();
  const health: any = { timestamp: new Date().toISOString() };

  // DB check
  try {
    const dbStart = Date.now();
    await query("SELECT 1");
    const dbMs = Date.now() - dbStart;
    health.db = dbMs < 500 ? "ok" : "degraded";
    health.dbMs = dbMs;
    const stats = getPoolStats();
    if (stats) health.dbPool = stats;
  } catch (err) {
    health.db = "error";
    health.dbError = (err as Error).message;
  }

  // Redis check
  try {
    const redisStart = Date.now();
    const redis = await getRedis();
    // ping returns "PONG" on success
    const pong = await (redis as any).ping();
    const redisMs = Date.now() - redisStart;
    health.redis = pong === "PONG" ? (redisMs < 500 ? "ok" : "degraded") : "error";
    health.redisMs = redisMs;
  } catch (err) {
    health.redis = "error";
    health.redisError = (err as Error).message;
  }

  const totalMs = Date.now() - start;
  health.status = health.db === "ok" && health.redis === "ok" ? "ok" : "degraded";
  health.totalMs = totalMs;

  return NextResponse.json(health);
});

