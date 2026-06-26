/**
 * @jest-environment node
 */
import { POST } from "@/app/api/circles/[id]/join/route";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { getCircleById, joinCircle } from "@/server/services/circle.service";
import { verifyInviteToken } from "@/lib/tokens";

jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));
jest.mock("@/server/services/circle.service");
jest.mock("@/lib/tokens");
jest.mock("@/server/middleware", () => ({
  withErrorHandler: (fn: Function) => fn,
}));

const mockSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockGetCircle = getCircleById as jest.MockedFunction<typeof getCircleById>;
const mockJoinCircle = joinCircle as jest.MockedFunction<typeof joinCircle>;
const mockVerifyToken = verifyInviteToken as jest.MockedFunction<typeof verifyInviteToken>;

const USER_ID = "user-1";
const CIRCLE_ID = "circle-1";

describe("POST /api/circles/[id]/join", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const makeRequest = (body: any = {}) => {
    return new NextRequest(`http://localhost/api/circles/${CIRCLE_ID}/join`, {
      method: "POST",
      body: JSON.stringify({
        stellarPublicKey: "GDZ74K6L3R5S6N4X3P6Q5W4E3R2T1Y0U9I8O7P6A5S4D3F2G1H0J9K8L",
        ...body,
      }),
    });
  };

  it("joins a public circle successfully", async () => {
    mockSession.mockResolvedValue({ user: { id: USER_ID } } as any);
    mockGetCircle.mockResolvedValue({ id: CIRCLE_ID, circleType: "public" } as any);
    const mockMember = { id: "member-1", circleId: CIRCLE_ID, userId: USER_ID };
    mockJoinCircle.mockResolvedValue(mockMember as any);

    const res = await POST(makeRequest(), { params: { id: CIRCLE_ID } });
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.success).toBe(true);
    expect(json.data).toEqual(mockMember);
    expect(mockJoinCircle).toHaveBeenCalledWith(CIRCLE_ID, USER_ID, false);
  });

  it("joins a private circle successfully with valid token", async () => {
    const token = "valid-token";
    mockSession.mockResolvedValue({ user: { id: USER_ID } } as any);
    mockGetCircle.mockResolvedValue({ id: CIRCLE_ID, circleType: "private" } as any);
    mockVerifyToken.mockResolvedValue({ circleId: CIRCLE_ID } as any);
    const mockMember = { id: "member-1", circleId: CIRCLE_ID, userId: USER_ID };
    mockJoinCircle.mockResolvedValue(mockMember as any);

    const res = await POST(makeRequest({ token }), { params: { id: CIRCLE_ID } });
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.success).toBe(true);
    expect(mockJoinCircle).toHaveBeenCalledWith(CIRCLE_ID, USER_ID, true);
  });

  it("returns 401 when unauthenticated", async () => {
    mockSession.mockResolvedValue(null);
    const res = await POST(makeRequest(), { params: { id: CIRCLE_ID } });
    expect(res.status).toBe(401);
  });

  it("returns 404 when circle not found", async () => {
    mockSession.mockResolvedValue({ user: { id: USER_ID } } as any);
    mockGetCircle.mockResolvedValue(null);
    const res = await POST(makeRequest(), { params: { id: CIRCLE_ID } });
    expect(res.status).toBe(404);
  });

  it("returns 403 when joining private circle without token", async () => {
    mockSession.mockResolvedValue({ user: { id: USER_ID } } as any);
    mockGetCircle.mockResolvedValue({ id: CIRCLE_ID, circleType: "private" } as any);
    const res = await POST(makeRequest(), { params: { id: CIRCLE_ID } });
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toContain("Invite token is required");
  });

  it("returns 403 with invalid token for private circle", async () => {
    const token = "invalid-token";
    mockSession.mockResolvedValue({ user: { id: USER_ID } } as any);
    mockGetCircle.mockResolvedValue({ id: CIRCLE_ID, circleType: "private" } as any);
    mockVerifyToken.mockResolvedValue(null);

    const res = await POST(makeRequest({ token }), { params: { id: CIRCLE_ID } });
    expect(res.status).toBe(403);
  });
});
