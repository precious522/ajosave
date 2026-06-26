/**
 * BullMQ worker process — runs as a separate container in production.
 * Processes payout jobs queued by the scheduler / cron route.
 *
 * Start: node dist/lib/queue/worker.js
 */

import { Worker, Job } from "bullmq";
import { processCyclePayout } from "@/server/services/payout.service";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const QUEUE_NAME = "payouts";

const worker = new Worker(
  QUEUE_NAME,
  async (job: Job) => {
    const { circleId, recipientStellarKey } = job.data as {
      circleId: string;
      recipientStellarKey: string;
    };
    console.log(`[worker] processing job ${job.id} — circle ${circleId}`);
    await processCyclePayout(circleId, recipientStellarKey);
    console.log(`[worker] job ${job.id} completed`);
  },
  {
    connection: { url: REDIS_URL },
    concurrency: 5,
  }
);

worker.on("failed", (job, err) => {
  console.error(`[worker] job ${job?.id} failed:`, err.message);
});

worker.on("ready", () => {
  console.log(`[worker] listening on queue "${QUEUE_NAME}" (${REDIS_URL})`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  await worker.close();
  process.exit(0);
});
