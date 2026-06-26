jest.mock("next/server", () => ({
  NextRequest: class {},
  NextResponse: {
    json: jest.fn((body, init) => ({
      status: init?.status ?? 200,
      json: async () => body,
      headers: { set: jest.fn(), get: jest.fn() },
      cookies: { set: jest.fn() },
    })),
  },
}));
jest.mock("@sentry/nextjs", () => ({ captureException: jest.fn() }));
jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/refresh-tokens", () => ({
  verifyRefreshToken: jest.fn().mockResolvedValue("user-123"),
  revokeRefreshToken: jest.fn().mockResolvedValue(undefined),
  generateRefreshToken: jest.fn().mockResolvedValue("new-refresh-token"),
  getTokenExpiries: jest.fn().mockReturnValue({
    accessTokenExpires: Math.floor(Date.now() / 1000) + 900,
    refreshTokenExpires: Math.floor(Date.now() / 1000) + 604800,
  }),
}));
jest.mock("@/lib/db", () => ({
  query: jest.fn().mockResolvedValue({
    rows: [{ id: "user-123", phone: "+2348012345678", display_name: "Test", role: "user" }],
  }),
}));
jest.mock("jose", () => ({
  SignJWT: jest.fn().mockImplementation(() => ({
    setProtectedHeader: jest.fn().mockReturnThis(),
    setIssuedAt: jest.fn().mockReturnThis(),
    setExpirationTime: jest.fn().mockReturnThis(),
    sign: jest.fn().mockResolvedValue("mock-access-token"),
  })),
}));
jest.mock("@/server/config", () => ({ serverConfig: { authSecret: "test-secret", redis: { url: "" } } }));
jest.mock("@/server/middleware", () => ({
  withErrorHandler: (handler: Function) => handler,
  withRateLimit: (handler: Function) => handler,
}));
jest.mock("@/lib/correlation", () => ({ runWithCorrelationId: (_id: string, fn: Function) => fn() }));
jest.mock("@/lib/logger", () => ({ child: () => ({ info: jest.fn(), error: jest.fn() }) }));

import { POST } from "../route";

const makeReq = (body: object) => ({
  json: async () => body,
  url: "http://localhost/api/v1/auth/refresh",
  method: "POST",
  headers: { get: () => null },
});

describe("POST /api/v1/auth/refresh — rate limiting", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 400 if refreshToken missing", async () => {
    const res = await POST(makeReq({}) as any);
    expect(res.status).toBe(400);
  });

  it("returns 401 for invalid token", async () => {
    const { verifyRefreshToken } = require("@/lib/refresh-tokens");
    verifyRefreshToken.mockResolvedValueOnce(null);
    const res = await POST(makeReq({ refreshToken: "bad" }) as any);
    expect(res.status).toBe(401);
  });

  it("returns 200 with new access token", async () => {
    const res = await POST(makeReq({ refreshToken: "valid" }) as any);
    expect(res.status).toBe(200);
    expect((await res.json()).data.accessToken).toBe("mock-access-token");
  });
});
