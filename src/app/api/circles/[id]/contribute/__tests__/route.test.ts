/**
 * @jest-environment node
 */
import { POST } from "@/app/api/circles/[id]/contribute/route";
import { NextRequest } from "next/server";

jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));
jest.mock("@/server/services/circle.service");
jest.mock("@/lib/paystack");
jest.mock("@/lib/db");
jest.mock("@/server/config", () => ({
  serverConfig: {
    app: { url: "http://localhost:3000" },
    paystack: { secretKey: "test" },
    stellar: { network: "testnet", sorobanRpcUrl: "http://localhost", ajoContractId: "test" },
  },
}));
jest.mock("@/server/middleware", () => ({
  withErrorHandler: (fn: Function) => fn,
}));

import { getServerSession } from "next-auth";
import { getCircleById, getMembersByCircle } from "@/server/services/circle.service";
import { initializePayment } from "@/lib/paystack";
import * as db from "@/lib/db";

const mockSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockGetCircle = getCircleById as jest.MockedFunction<typeof getCircleById>;
const mockGetMembers = getMembersByCircle as jest.MockedFunction<typeof getMembersByCircle>;
const mockInitPayment = initializePayment as jest.MockedFunction<typeof initializePayment>;
const mockQuery = db.query as jest.MockedFunction<typeof db.query>;

const CIRCLE_ID = "circle-1";
const MEMBER_ID = "member-1";
const USER_ID = "user-1";
const CYCLE = 2;

const circle = {
  id: CIRCLE_ID,
  status: "active",
  currentCycle: CYCLE,
  contributionFiat: 5000,
  contributionCurrency: "NGN",
  contributionUsdc: "3.0000000",
} as any;

const member = { id: MEMBER_ID, userId: USER_ID } as any;

function makeRequest() {
  return new NextRequest(`http://localhost/api/circles/${CIRCLE_ID}/contribute`, { method: "POST" });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSession.mockResolvedValue({ user: { id: USER_ID, email: "user@test.com" } } as any);
  mockGetCircle.mockResolvedValue(circle);
  mockGetMembers.mockResolvedValue([member]);
});

describe("POST /api/circles/[id]/contribute", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession.mockResolvedValue(null);
    const res = await POST(makeRequest(), { params: { id: CIRCLE_ID } });
    expect(res.status).toBe(401);
  });

  it("returns 404 when circle not found", async () => {
    mockGetCircle.mockResolvedValue(null);
    const res = await POST(makeRequest(), { params: { id: CIRCLE_ID } });
    expect(res.status).toBe(404);
  });

  it("returns 400 when circle is not active", async () => {
    mockGetCircle.mockResolvedValue({ ...circle, status: "open" } as any);
    const res = await POST(makeRequest(), { params: { id: CIRCLE_ID } });
    expect(res.status).toBe(400);
  });

  it("returns 403 when user is not a member", async () => {
    mockGetMembers.mockResolvedValue([]);
    const res = await POST(makeRequest(), { params: { id: CIRCLE_ID } });
    expect(res.status).toBe(403);
  });

  it("returns existing authorizationUrl on duplicate (idempotent)", async () => {
    const existingUrl = "https://paystack.com/pay/existing";
    mockQuery.mockResolvedValueOnce({
      rows: [{ paystack_reference: `ajo-${CIRCLE_ID}-${MEMBER_ID}-${CYCLE}`, authorization_url: existingUrl }],
      rowCount: 1,
    } as any);

    const res = await POST(makeRequest(), { params: { id: CIRCLE_ID } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.authorizationUrl).toBe(existingUrl);
    expect(json.data.reference).toBe(`ajo-${CIRCLE_ID}-${MEMBER_ID}-${CYCLE}`);
    expect(mockInitPayment).not.toHaveBeenCalled();
  });

  it("initializes payment and upserts contribution for new request", async () => {
    const authUrl = "https://paystack.com/pay/new";
    // No existing pending contribution
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
    // Upsert insert
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
    mockInitPayment.mockResolvedValue({ authorizationUrl: authUrl, reference: `ajo-${CIRCLE_ID}-${MEMBER_ID}-${CYCLE}` });

    const res = await POST(makeRequest(), { params: { id: CIRCLE_ID } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.authorizationUrl).toBe(authUrl);
    expect(json.data.reference).toBe(`ajo-${CIRCLE_ID}-${MEMBER_ID}-${CYCLE}`);

    expect(mockInitPayment).toHaveBeenCalledWith(
      expect.objectContaining({ reference: `ajo-${CIRCLE_ID}-${MEMBER_ID}-${CYCLE}` })
    );
    // Upsert query
    expect(mockQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("ON CONFLICT (member_id, cycle_number)"),
      expect.arrayContaining([`ajo-${CIRCLE_ID}-${MEMBER_ID}-${CYCLE}`, authUrl])
    );
  });
});
