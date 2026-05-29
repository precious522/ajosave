import { Queue } from "bullmq";
import { serverConfig } from "@/server/config";

const connection = { connection: { url: serverConfig.redis.url } };

export const payoutQueue = new Queue("payouts", connection);

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
