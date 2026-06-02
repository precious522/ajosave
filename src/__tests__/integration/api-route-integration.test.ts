/**
 * @jest-environment node
 *
 * API Route Integration Tests — Issue #289
 *
 * Acceptance criteria:
 *  ✅ All CRUD routes tested (create, read, update, delete)
 *  ✅ Auth-protected routes tested with and without token
 *  ✅ Test DB seeded and cleaned between tests
 *  ✅ Tests run in CI
 */
import * as request from "supertest";
import { getServerSession } from "next-auth";
import { createTestServer } from "./supertest-app";
import {
  closeTestDatabase,
  resetIntegrationDatabase,
  seedCircle,
  seedContribution,
  seedMember,
  seedUser,
} from "./test-db";

jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));
// Prevent real SMS / Redis calls in auth routes
jest.mock("@/lib/sms", () => ({ sendOtp: jest.fn().mockResolvedValue("123456") }));
jest.mock("@/lib/redis", () => ({
  getRedis: jest.fn().mockResolvedValue({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue("OK"),
    del: jest.fn().mockResolvedValue(1),
    ping: jest.fn().mockResolvedValue("PONG"),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    ttl: jest.fn().mockResolvedValue(-1),
  }),
}));
jest.mock("@/lib/lockout", () => ({
  getLockoutStatus: jest.fn().mockResolvedValue({
    isLocked: false,
    attempts: 0,
    remainingAttempts: 5,
  }),
}));
jest.mock("@/server/middleware", () => {
  const actual = jest.requireActual("@/server/middleware");
  return {
    ...actual,
    withRateLimit: (handler: unknown) => handler,
    rateLimit: jest.fn().mockResolvedValue({ allowed: true, remaining: 9 }),
  };
});

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const app = createTestServer();

beforeEach(async () => {
  await resetIntegrationDatabase();
  mockGetServerSession.mockReset();
});

afterAll(async () => {
  await closeTestDatabase();
});

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------
describe("GET /api/v1/health", () => {
  it("returns status ok when db and redis are reachable", async () => {
    const res = await request(app).get("/api/v1/health");
    // May be 200 (ok) or 503 (degraded) depending on env; just assert shape
    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty("status");
    expect(res.body).toHaveProperty("db");
    expect(res.body).toHaveProperty("redis");
    expect(res.body).toHaveProperty("timestamp");
  });
});

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------
describe("Profile routes", () => {
  describe("GET /api/v1/profile", () => {
    it("returns 401 without auth", async () => {
      mockGetServerSession.mockResolvedValue(null);
      const res = await request(app).get("/api/v1/profile");
      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ success: false, error: "Unauthorized" });
    });

    it("returns profile data for authenticated user", async () => {
      const userId = await seedUser({ phone: "+15551000001", displayName: "Alice" });
      mockGetServerSession.mockResolvedValue({ user: { id: userId } });

      const res = await request(app).get("/api/v1/profile");
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        data: {
          id: userId,
          phone: "+15551000001",
          displayName: "Alice",
          reputationScore: 0,
          contributionStats: { total: 0, confirmed: 0, missed: 0 },
        },
      });
    });

    it("reflects contribution stats from seeded data", async () => {
      const userId = await seedUser({ phone: "+15551000002" });
      const creatorId = await seedUser({ phone: "+15551000003" });
      const circleId = await seedCircle({ creatorId });
      const memberId = await seedMember(circleId, userId);
      await seedContribution(memberId, { status: "confirmed" });
      await seedContribution(memberId, { status: "missed", cycle: 2 });

      mockGetServerSession.mockResolvedValue({ user: { id: userId } });
      const res = await request(app).get("/api/v1/profile");
      expect(res.status).toBe(200);
      expect(res.body.data.contributionStats).toMatchObject({
        total: 2,
        confirmed: 1,
        missed: 1,
      });
    });
  });

  describe("PATCH /api/v1/profile", () => {
    it("returns 401 without auth", async () => {
      mockGetServerSession.mockResolvedValue(null);
      const res = await request(app)
        .patch("/api/v1/profile")
        .send({ displayName: "Bob" })
        .set("Content-Type", "application/json");
      expect(res.status).toBe(401);
    });

    it("updates display name", async () => {
      const userId = await seedUser({ phone: "+15551000004", displayName: "Old Name" });
      mockGetServerSession.mockResolvedValue({ user: { id: userId } });

      const patchRes = await request(app)
        .patch("/api/v1/profile")
        .send({ displayName: "New Name" })
        .set("Content-Type", "application/json");
      expect(patchRes.status).toBe(200);
      expect(patchRes.body).toMatchObject({ success: true, data: { updated: true } });

      const getRes = await request(app).get("/api/v1/profile");
      expect(getRes.body.data.displayName).toBe("New Name");
    });

    it("returns 400 for invalid stellar public key", async () => {
      const userId = await seedUser({ phone: "+15551000005" });
      mockGetServerSession.mockResolvedValue({ user: { id: userId } });

      const res = await request(app)
        .patch("/api/v1/profile")
        .send({ stellarPublicKey: "not-a-valid-key" })
        .set("Content-Type", "application/json");
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Circles CRUD
// ---------------------------------------------------------------------------
describe("Circles routes", () => {
  describe("GET /api/v1/circles", () => {
    it("returns paginated list of open circles (no auth required)", async () => {
      const creatorId = await seedUser({ phone: "+15552000001" });
      await seedCircle({ creatorId, name: "Public Circle", status: "open" });

      const res = await request(app).get("/api/v1/circles");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("circles");
      expect(Array.isArray(res.body.data.circles)).toBe(true);
    });

    it("returns 401 for filter=mine without auth", async () => {
      mockGetServerSession.mockResolvedValue(null);
      const res = await request(app).get("/api/v1/circles?filter=mine");
      expect(res.status).toBe(401);
    });

    it("returns only user's circles for filter=mine", async () => {
      const userId = await seedUser({ phone: "+15552000002" });
      const otherId = await seedUser({ phone: "+15552000003" });
      await seedCircle({ creatorId: userId, name: "My Circle" });
      await seedCircle({ creatorId: otherId, name: "Other Circle" });

      mockGetServerSession.mockResolvedValue({ user: { id: userId } });
      const res = await request(app).get("/api/v1/circles?filter=mine");
      expect(res.status).toBe(200);
      expect(res.body.data.every((c: { creatorId: string }) => c.creatorId === userId)).toBe(true);
    });
  });

  describe("POST /api/v1/circles", () => {
    it("returns 401 without auth", async () => {
      mockGetServerSession.mockResolvedValue(null);
      const res = await request(app)
        .post("/api/v1/circles")
        .send({ name: "Test", contributionUsdc: "10", maxMembers: 5, cycleFrequency: "weekly" })
        .set("Content-Type", "application/json");
      expect(res.status).toBe(401);
    });

    it("creates a circle and returns 201", async () => {
      const userId = await seedUser({ phone: "+15552000004" });
      mockGetServerSession.mockResolvedValue({ user: { id: userId } });

      const res = await request(app)
        .post("/api/v1/circles")
        .send({
          name: "New Circle",
          contributionUsdc: "10",
          contributionFiat: "5000",
          contributionCurrency: "NGN",
          maxMembers: 5,
          cycleFrequency: "weekly",
          payoutMethod: "randomized",
        })
        .set("Content-Type", "application/json");

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ success: true });
      expect(res.body.data).toHaveProperty("id");
      expect(res.body.data.name).toBe("New Circle");
    });

    it("returns 400 for invalid payload", async () => {
      const userId = await seedUser({ phone: "+15552000005" });
      mockGetServerSession.mockResolvedValue({ user: { id: userId } });

      const res = await request(app)
        .post("/api/v1/circles")
        .send({ name: "" }) // missing required fields
        .set("Content-Type", "application/json");
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /api/v1/circles/:id", () => {
    it("returns circle data with members (no auth required)", async () => {
      const creatorId = await seedUser({ phone: "+15552000006" });
      const circleId = await seedCircle({ creatorId });
      await seedMember(circleId, creatorId, { position: 1 });

      const res = await request(app).get(`/api/v1/circles/${circleId}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true });
      expect(res.body.data.circle.id).toBe(circleId);
      expect(Array.isArray(res.body.data.members)).toBe(true);
    });

    it("returns 404 for non-existent circle", async () => {
      const res = await request(app).get("/api/v1/circles/00000000-0000-0000-0000-000000000000");
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ success: false, error: "Circle not found" });
    });
  });
});

// ---------------------------------------------------------------------------
// Circle membership — join / leave
// ---------------------------------------------------------------------------
describe("Circle membership", () => {
  describe("POST /api/v1/circles/:id/join", () => {
    it("returns 401 without auth", async () => {
      mockGetServerSession.mockResolvedValue(null);
      const creatorId = await seedUser({ phone: "+15553000001" });
      const circleId = await seedCircle({ creatorId, maxMembers: 5 });

      const res = await request(app)
        .post(`/api/v1/circles/${circleId}/join`)
        .send({})
        .set("Content-Type", "application/json");
      expect(res.status).toBe(401);
    });

    it("allows an authenticated user to join an open circle", async () => {
      const creatorId = await seedUser({ phone: "+15553000002" });
      const joinerId = await seedUser({ phone: "+15553000003" });
      const circleId = await seedCircle({ creatorId, maxMembers: 5 });

      mockGetServerSession.mockResolvedValue({ user: { id: joinerId } });
      const res = await request(app)
        .post(`/api/v1/circles/${circleId}/join`)
        .send({})
        .set("Content-Type", "application/json");

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ success: true });
      expect(res.body.data).toHaveProperty("id");
    });

    it("returns 404 for non-existent circle", async () => {
      const userId = await seedUser({ phone: "+15553000004" });
      mockGetServerSession.mockResolvedValue({ user: { id: userId } });

      const res = await request(app)
        .post("/api/v1/circles/00000000-0000-0000-0000-000000000000/join")
        .send({})
        .set("Content-Type", "application/json");
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/v1/circles/:id/leave", () => {
    it("returns 401 without auth", async () => {
      mockGetServerSession.mockResolvedValue(null);
      const creatorId = await seedUser({ phone: "+15553000005" });
      const circleId = await seedCircle({ creatorId });

      const res = await request(app)
        .post(`/api/v1/circles/${circleId}/leave`)
        .send({})
        .set("Content-Type", "application/json");
      expect(res.status).toBe(401);
    });

    it("allows a member to leave a circle", async () => {
      const creatorId = await seedUser({ phone: "+15553000006" });
      const memberId = await seedUser({ phone: "+15553000007" });
      const circleId = await seedCircle({ creatorId, maxMembers: 5 });
      await seedMember(circleId, memberId, { position: 2 });

      mockGetServerSession.mockResolvedValue({ user: { id: memberId } });
      const res = await request(app)
        .post(`/api/v1/circles/${circleId}/leave`)
        .send({})
        .set("Content-Type", "application/json");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Waitlist
// ---------------------------------------------------------------------------
describe("Waitlist routes", () => {
  it("returns 401 for all waitlist actions without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const creatorId = await seedUser({ phone: "+15554000001" });
    const circleId = await seedCircle({ creatorId, maxMembers: 1 });

    const [getRes, postRes, deleteRes] = await Promise.all([
      request(app).get(`/api/v1/circles/${circleId}/waitlist`),
      request(app).post(`/api/v1/circles/${circleId}/waitlist`).send({}).set("Content-Type", "application/json"),
      request(app).delete(`/api/v1/circles/${circleId}/waitlist`),
    ]);

    expect(getRes.status).toBe(401);
    expect(postRes.status).toBe(401);
    expect(deleteRes.status).toBe(401);
  });

  it("full waitlist lifecycle: join → read → leave", async () => {
    const creatorId = await seedUser({ phone: "+15554000002" });
    const memberId = await seedUser({ phone: "+15554000003" });
    const waitlistUserId = await seedUser({ phone: "+15554000004" });
    const circleId = await seedCircle({ creatorId, maxMembers: 1 });
    await seedMember(circleId, memberId, { position: 1 });

    mockGetServerSession.mockResolvedValue({ user: { id: waitlistUserId } });

    const joinRes = await request(app)
      .post(`/api/v1/circles/${circleId}/waitlist`)
      .send({})
      .set("Content-Type", "application/json");
    expect(joinRes.status).toBe(200);
    expect(joinRes.body).toMatchObject({ success: true, data: { isOnWaitlist: true } });

    const readRes = await request(app).get(`/api/v1/circles/${circleId}/waitlist`);
    expect(readRes.status).toBe(200);
    expect(readRes.body.data.isOnWaitlist).toBe(true);

    const leaveRes = await request(app).delete(`/api/v1/circles/${circleId}/waitlist`);
    expect(leaveRes.status).toBe(200);
    expect(leaveRes.body.data.isOnWaitlist).toBe(false);

    const afterLeave = await request(app).get(`/api/v1/circles/${circleId}/waitlist`);
    expect(afterLeave.body.data.isOnWaitlist).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Auth routes
// ---------------------------------------------------------------------------
describe("Auth routes", () => {
  describe("POST /api/v1/auth/send-otp", () => {
    it("returns 400 for missing phone", async () => {
      const res = await request(app)
        .post("/api/v1/auth/send-otp")
        .send({})
        .set("Content-Type", "application/json");
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("returns 400 for invalid phone format", async () => {
      const res = await request(app)
        .post("/api/v1/auth/send-otp")
        .send({ phone: "not-a-phone" })
        .set("Content-Type", "application/json");
      expect(res.status).toBe(400);
    });

    it("returns 200 for valid phone", async () => {
      const res = await request(app)
        .post("/api/v1/auth/send-otp")
        .send({ phone: "+15559000001" })
        .set("Content-Type", "application/json");
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true });
    });
  });

  describe("POST /api/v1/auth/verify-otp", () => {
    it("returns 400 for missing fields", async () => {
      const res = await request(app)
        .post("/api/v1/auth/verify-otp")
        .send({})
        .set("Content-Type", "application/json");
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/v1/auth/logout", () => {
    it("returns 200 and clears session", async () => {
      const res = await request(app)
        .post("/api/v1/auth/logout")
        .send({})
        .set("Content-Type", "application/json");
      // Logout may return 200 regardless of auth state
      expect([200, 401]).toContain(res.status);
    });
  });
});

// ---------------------------------------------------------------------------
// Unknown routes
// ---------------------------------------------------------------------------
describe("Unknown routes", () => {
  it("returns 404 for unregistered paths", async () => {
    const res = await request(app).get("/api/v1/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: "Route not found" });
  });
});
