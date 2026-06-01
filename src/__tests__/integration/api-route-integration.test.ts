/**
 * @jest-environment node
 */
import * as request from "supertest";
import { getServerSession } from "next-auth";
import { createTestServer } from "./supertest-app";
import {
  closeTestDatabase,
  resetIntegrationDatabase,
  seedCircle,
  seedMember,
  seedUser,
} from "./test-db";

jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const app = createTestServer();

beforeEach(async () => {
  await resetIntegrationDatabase();
});

afterAll(async () => {
  await closeTestDatabase();
});

describe("API route integration", () => {
  it("returns 401 for profile GET without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await request(app).get("/api/v1/profile");

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ success: false, error: "Unauthorized" });
  });

  it("returns authenticated profile data and updates user profile", async () => {
    const userId = await seedUser({ phone: "+15551234567", displayName: "Integration User" });
    mockGetServerSession.mockResolvedValue({ user: { id: userId } });

    const readResponse = await request(app).get("/api/v1/profile");
    expect(readResponse.status).toBe(200);
    expect(readResponse.body).toMatchObject({
      success: true,
      data: {
        id: userId,
        phone: "+15551234567",
        displayName: "Integration User",
        reputationScore: 0,
        contributionStats: { total: 0, confirmed: 0, missed: 0 },
      },
    });

    const updateResponse = await request(app)
      .patch("/api/v1/profile")
      .send({ displayName: "Updated Name" })
      .set("Content-Type", "application/json");

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body).toMatchObject({ success: true, data: { updated: true } });

    const verifyResponse = await request(app).get("/api/v1/profile");
    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.body.data.displayName).toBe("Updated Name");
  });

  it("returns 401 for waitlist actions without auth and handles create/read/delete when authenticated", async () => {
    const creatorId = await seedUser({ phone: "+15550000001", displayName: "Creator User" });
    const memberId = await seedUser({ phone: "+15550000002", displayName: "First Member" });
    const waitlistUserId = await seedUser({ phone: "+15550000003", displayName: "Waitlist User" });
    const circleId = await seedCircle({ creatorId, maxMembers: 1, status: "open" });
    await seedMember(circleId, memberId, { position: 1, status: "active" });

    mockGetServerSession.mockResolvedValue(null);
    const unauthorizedGet = await request(app).get(`/api/v1/circles/${circleId}/waitlist`);
    expect(unauthorizedGet.status).toBe(401);

    mockGetServerSession.mockResolvedValue({ user: { id: waitlistUserId } });

    const createResponse = await request(app)
      .post(`/api/v1/circles/${circleId}/waitlist`)
      .send({})
      .set("Content-Type", "application/json");

    expect(createResponse.status).toBe(200);
    expect(createResponse.body).toMatchObject({ success: true, data: { isOnWaitlist: true, position: 1 } });

    const readResponse = await request(app).get(`/api/v1/circles/${circleId}/waitlist`);
    expect(readResponse.status).toBe(200);
    expect(readResponse.body).toMatchObject({ success: true, data: { isOnWaitlist: true, position: 1 } });

    const deleteResponse = await request(app).delete(`/api/v1/circles/${circleId}/waitlist`);
    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body).toMatchObject({ success: true, data: { isOnWaitlist: false, position: null } });

    const afterDelete = await request(app).get(`/api/v1/circles/${circleId}/waitlist`);
    expect(afterDelete.status).toBe(200);
    expect(afterDelete.body.data).toMatchObject({ isOnWaitlist: false, position: null });
  });
});
