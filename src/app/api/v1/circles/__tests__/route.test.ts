/**
 * @jest-environment node
 */
import { GET, POST } from "@/app/api/circles/route";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { createCircle, listOpenCircles, getCirclesByUser } from "@/server/services/circle.service";

jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));
jest.mock("@/server/services/circle.service");
jest.mock("@/server/middleware", () => ({
  withErrorHandler: (fn: Function) => fn,
}));

const mockSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockCreateCircle = createCircle as jest.MockedFunction<typeof createCircle>;
const mockListOpenCircles = listOpenCircles as jest.MockedFunction<typeof listOpenCircles>;
const mockGetCirclesByUser = getCirclesByUser as jest.MockedFunction<typeof getCirclesByUser>;

const USER_ID = "user-1";

describe("Circles API Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/circles", () => {
    it("returns open circles with pagination", async () => {
      const mockResult = {
        data: [{ id: "1", name: "Circle 1" }],
        total: 1,
        page: 1,
        limit: 10,
      };
      mockListOpenCircles.mockResolvedValue(mockResult as any);

      const req = new NextRequest("http://localhost/api/circles?page=1&limit=10");
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toEqual(mockResult);
      expect(mockListOpenCircles).toHaveBeenCalledWith(1, 10, expect.any(Object));
    });

    it("returns user's circles when filter=mine is provided", async () => {
      mockSession.mockResolvedValue({ user: { id: USER_ID } } as any);
      const mockCircles = [{ id: "1", name: "My Circle" }];
      mockGetCirclesByUser.mockResolvedValue(mockCircles as any);

      const req = new NextRequest("http://localhost/api/circles?filter=mine");
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toEqual(mockCircles);
      expect(mockGetCirclesByUser).toHaveBeenCalledWith(USER_ID);
    });

    it("returns 401 for filter=mine when unauthenticated", async () => {
      mockSession.mockResolvedValue(null);

      const req = new NextRequest("http://localhost/api/circles?filter=mine");
      const res = await GET(req);

      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/circles", () => {
    const validBody = {
      name: "Test Circle",
      contributionAmount: 5000,
      contributionCurrency: "NGN",
      maxMembers: 10,
      cycleFrequency: "monthly",
      payoutMethod: "fixed",
    };

    it("creates a new circle when authenticated and valid data", async () => {
      mockSession.mockResolvedValue({ user: { id: USER_ID } } as any);
      const mockCircle = { id: "new-circle", ...validBody };
      mockCreateCircle.mockResolvedValue(mockCircle as any);

      const req = new NextRequest("http://localhost/api/circles", {
        method: "POST",
        body: JSON.stringify(validBody),
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.success).toBe(true);
      expect(json.data).toEqual(mockCircle);
      expect(mockCreateCircle).toHaveBeenCalledWith(USER_ID, expect.objectContaining({ name: "Test Circle" }));
    });

    it("returns 401 when unauthenticated", async () => {
      mockSession.mockResolvedValue(null);

      const req = new NextRequest("http://localhost/api/circles", {
        method: "POST",
        body: JSON.stringify(validBody),
      });
      const res = await POST(req);

      expect(res.status).toBe(401);
    });

    it("returns 400 when validation fails", async () => {
      mockSession.mockResolvedValue({ user: { id: USER_ID } } as any);
      const invalidBody = { ...validBody, name: "" }; // Name too short

      const req = new NextRequest("http://localhost/api/circles", {
        method: "POST",
        body: JSON.stringify(invalidBody),
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toBeDefined();
    });
  });
});
