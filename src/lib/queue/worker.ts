import { Worker } from "bullmq";
import { redisConnection } from "./payoutQueue";
import { processCyclePayout } from "@/server/services/payout.service";
import { query } from "@/lib/db";

const worker = new Worker(
  "payouts",
  async (job) => {
    const { circleId, cycleNumber } = job.data as { circleId: string; cycleNumber: number };
    console.log(`[payout-worker] Starting job ${job.id} for ${circleId}:${cycleNumber}`);

    const { rows } = await query<{ stellar_public_key: string | null }>(
      `SELECT u.stellar_public_key
       FROM members m
       JOIN users u ON u.id = m.user_id
       WHERE m.circle_id = $1 AND m.position = $2 LIMIT 1`,
      [circleId, cycleNumber]
    );
    const stellarKey = rows[0]?.stellar_public_key ?? "";

    await processCyclePayout(circleId, stellarKey);
    console.log(`[payout-worker] Completed job ${job.id} for ${circleId}:${cycleNumber}`);
    return { success: true };
  },
  { connection: redisConnection, concurrency: 1 }
);

worker.on("active", (job) => {
  console.log(`[payout-worker] Job ${job.id} active: ${job.data.circleId}:${job.data.cycleNumber}`);
});

worker.on("completed", (job) => {
  console.log(`[payout-worker] Job ${job.id} completed: ${job.data.circleId}:${job.data.cycleNumber}`);
});

worker.on("failed", (job, err) => {
  console.error(`[payout-worker] Job ${job?.id} failed: ${job?.data?.circleId}:${job?.data?.cycleNumber}`, err);
});

export default worker;
