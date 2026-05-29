import { Worker, QueueScheduler } from "bullmq";
import { serverConfig } from "@/server/config";
import { processCyclePayout } from "@/server/services/payout.service";
import { query } from "@/lib/db";

const connection = { connection: { url: serverConfig.redis.url } };

// Ensure stalled jobs are reprocessed and repeatable jobs work correctly
new QueueScheduler("payouts", connection);

const worker = new Worker(
  "payouts",
  async (job) => {
    const { circleId, cycleNumber } = job.data as { circleId: string; cycleNumber: number };
    console.log(`[payout-worker] Starting job ${job.id} for ${circleId}:${cycleNumber}`);

    // Resolve recipient Stellar key if needed (Horizon path)
    const { rows } = await query<{ stellar_public_key: string | null }>(
      `SELECT u.stellar_public_key
       FROM members m
       JOIN users u ON u.id = m.user_id
       WHERE m.circle_id = $1 AND m.position = $2 LIMIT 1`,
      [circleId, cycleNumber]
    );
    const stellarKey = rows[0]?.stellar_public_key ?? "";

    try {
      await processCyclePayout(circleId, stellarKey);
      console.log(`[payout-worker] Completed job ${job.id} for ${circleId}:${cycleNumber}`);
      return { success: true };
    } catch (err) {
      console.error(`[payout-worker] Failed job ${job.id} for ${circleId}:${cycleNumber}:`, err);
      throw err;
    }
  },
  { connection, concurrency: 1 }
);

worker.on("active", (job) => {
  console.log(`[payout-worker] Job ${job.id} is active for ${job.data.circleId}:${job.data.cycleNumber}`);
});

worker.on("completed", (job) => {
  console.log(`[payout-worker] Job ${job.id} completed for ${job.data.circleId}:${job.data.cycleNumber}`);
});

worker.on("failed", (job, err) => {
  console.error(`[payout-worker] Job ${job?.id} failed for ${job?.data?.circleId}:${job?.data?.cycleNumber}`, err);
});

export default worker;
