import { Queue } from "bullmq";
import IORedis from "ioredis";
import { serverConfig } from "@/server/config";

export const redisConnection = new IORedis(serverConfig.redis.url, {
  maxRetriesPerRequest: null,
});

export const payoutQueue = new Queue("payouts", { connection: redisConnection });

export async function addPayoutJob(circleId: string, cycleNumber: number) {
  return payoutQueue.add(
    "payout",
    { circleId, cycleNumber },
    {
      jobId: `${circleId}:${cycleNumber}`,
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
    }
  );
}

export default payoutQueue;
