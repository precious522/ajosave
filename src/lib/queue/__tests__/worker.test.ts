import { Worker } from "bullmq";

// Capture the worker processor function so we can invoke it directly
let capturedProcessor: ((job: unknown) => Promise<unknown>) | null = null;
const mockWorkerOn = jest.fn();

jest.mock("ioredis", () =>
  jest.fn().mockImplementation(() => ({ on: jest.fn(), quit: jest.fn() }))
);

jest.mock("bullmq", () => ({
  Queue: jest.fn().mockImplementation(() => ({ add: jest.fn() })),
  Worker: jest.fn().mockImplementation((_, processor, __) => {
    capturedProcessor = processor;
    return { on: mockWorkerOn };
  }),
}));

jest.mock("@/server/config", () => ({
  serverConfig: { redis: { url: "redis://localhost:6379" } },
}));

const mockQuery = jest.fn();
jest.mock("@/lib/db", () => ({ query: (...args: unknown[]) => mockQuery(...args) }));

const mockProcessCyclePayout = jest.fn();
jest.mock("@/server/services/payout.service", () => ({
  processCyclePayout: (...args: unknown[]) => mockProcessCyclePayout(...args),
}));

// Import worker after mocks are set up so the module-level Worker() call is captured
import "../worker";

describe("payout worker", () => {
  beforeEach(() => jest.clearAllMocks());

  it("registers active, completed, and failed event listeners", () => {
    expect(mockWorkerOn).toHaveBeenCalledWith("active", expect.any(Function));
    expect(mockWorkerOn).toHaveBeenCalledWith("completed", expect.any(Function));
    expect(mockWorkerOn).toHaveBeenCalledWith("failed", expect.any(Function));
  });

  it("processes a job by resolving the stellar key and calling processCyclePayout", async () => {
    mockQuery.mockResolvedValue({ rows: [{ stellar_public_key: "GABC123" }] });
    mockProcessCyclePayout.mockResolvedValue(undefined);

    const job = { id: "job-1", data: { circleId: "circle-1", cycleNumber: 1 } };
    const result = await capturedProcessor!(job);

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("stellar_public_key"),
      ["circle-1", 1]
    );
    expect(mockProcessCyclePayout).toHaveBeenCalledWith("circle-1", "GABC123");
    expect(result).toEqual({ success: true });
  });

  it("falls back to empty string when no stellar key is found", async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    mockProcessCyclePayout.mockResolvedValue(undefined);

    const job = { id: "job-2", data: { circleId: "circle-2", cycleNumber: 2 } };
    await capturedProcessor!(job);

    expect(mockProcessCyclePayout).toHaveBeenCalledWith("circle-2", "");
  });

  it("re-throws errors so BullMQ can apply retry backoff", async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    mockProcessCyclePayout.mockRejectedValue(new Error("payout failed"));

    const job = { id: "job-3", data: { circleId: "circle-3", cycleNumber: 3 } };
    await expect(capturedProcessor!(job)).rejects.toThrow("payout failed");
  });

  it("creates a Worker with concurrency 1", () => {
    expect(Worker).toHaveBeenCalledWith(
      "payouts",
      expect.any(Function),
      expect.objectContaining({ concurrency: 1 })
    );
  });
});
