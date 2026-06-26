import { addPayoutJob, payoutQueue } from "../payoutQueue";

// Mock IORedis and BullMQ so tests run without a real Redis instance
jest.mock("ioredis", () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    quit: jest.fn(),
  }));
});

jest.mock("bullmq", () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({ id: "mock-job-id" }),
  })),
  Worker: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
  })),
}));

jest.mock("@/server/config", () => ({
  serverConfig: { redis: { url: "redis://localhost:6379" } },
}));

describe("payoutQueue", () => {
  beforeEach(() => jest.clearAllMocks());

  it("adds a payout job with correct data and options", async () => {
    const job = await addPayoutJob("circle-1", 2);

    expect(payoutQueue.add).toHaveBeenCalledWith(
      "payout",
      { circleId: "circle-1", cycleNumber: 2 },
      {
        jobId: "circle-1:2",
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
      }
    );
    expect(job).toEqual({ id: "mock-job-id" });
  });

  it("uses circleId:cycleNumber as jobId for deduplication", async () => {
    await addPayoutJob("abc", 5);
    expect(payoutQueue.add).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({ jobId: "abc:5" })
    );
  });

  it("configures max 3 attempts with exponential backoff", async () => {
    await addPayoutJob("circle-2", 1);
    expect(payoutQueue.add).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
      })
    );
  });
});
