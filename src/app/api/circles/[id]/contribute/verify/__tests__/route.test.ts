/**
 * @jest-environment node
 */
import { GET } from "@/app/api/circles/[id]/contribute/verify/route";
import { NextRequest } from "next/server";

jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));
jest.mock("@/lib/paystack");
jest.mock("@/server/services/circle.service");
jest.mock("@/server/services/notification.service");
jest.mock("@/server/middleware", () => ({
  withErrorHandler: (fn: Function) => fn,
}));
jest.mock("@/server/config", () => ({
  serverConfig: { paystack: { secretKey: "test" }, stellar: { network: "testnet", sorobanRpcUrl: "http://localhost", ajoContractId: "test" } },
}));

import { getServerSession } from "next-auth";
import { verifyPayment } from "@/lib/paystack";
import { getCircleById } from "@/server/services/circle.service";
import { notifyContributionReceived } from "@/server/services/notification.service";

const mockSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockVerify = verifyPayment as jest.MockedFunction<typeof verifyPayment>;
const mockGetCircle = getCircleById as jest.MockedFunction<typeof getCircleById>;
const mockNotify = notifyContributionReceived as jest.MockedFunction<typeof notifyContributionReceived>;

function makeRequest(params: Record<string, string>) {
  const url = new URL("http://localhost/api/circles/c1/contribute/verify");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockNotify.mockResolvedValue(undefined as any);
});

describe("GET /api/circles/[id]/contribute/verify", () => {
  it("returns 400 when reference is missing", async () => {
    const res = await GET(makeRequest({}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it("returns verified payment data for a successful payment", async () => {
    mockVerify.mockResolvedValue({ status: "success", amount: 500000, currency: "NGN" });
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as any);
    mockGetCircle.mockResolvedValue({ name: "Test Circle", contributionUsdc: "3.0" } as any);

    const res = await GET(makeRequest({ reference: "ajo-c1-m1-2", circleId: "c1", cycleNumber: "2" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.status).toBe("success");
    expect(json.data.amount).toBe(500000);
  });

  it("sends notification on successful payment", async () => {
    mockVerify.mockResolvedValue({ status: "success", amount: 500000, currency: "NGN" });
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as any);
    mockGetCircle.mockResolvedValue({ name: "Test Circle", contributionUsdc: "3.0" } as any);

    await GET(makeRequest({ reference: "ajo-c1-m1-2", circleId: "c1", cycleNumber: "2" }));

    // Allow async notification to fire
    await new Promise((r) => setTimeout(r, 0));
    expect(mockNotify).toHaveBeenCalledWith("user-1", "Test Circle", "3.0", 2);
  });

  it("returns failed status without sending notification", async () => {
    mockVerify.mockResolvedValue({ status: "failed", amount: 500000, currency: "NGN" });
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as any);

    const res = await GET(makeRequest({ reference: "ref-failed", circleId: "c1", cycleNumber: "2" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.status).toBe("failed");
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("returns pending status", async () => {
    mockVerify.mockResolvedValue({ status: "pending", amount: 0, currency: "NGN" });

    const res = await GET(makeRequest({ reference: "ref-pending" }));
    const json = await res.json();

    expect(json.data.status).toBe("pending");
  });

  it("propagates Paystack API errors via error handler", async () => {
    mockVerify.mockRejectedValue(new Error("Paystack down"));
    await expect(GET(makeRequest({ reference: "ref-x" }))).rejects.toThrow("Paystack down");
  });
});
