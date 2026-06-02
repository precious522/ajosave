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
jest.mock("@/lib/auth", () => ({ authOptions: {} }));
jest.mock("@/lib/refresh-tokens", () => ({
  revokeAllUserTokens: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/server/middleware", () => ({
  withErrorHandler: (handler: Function) => handler,
  withRateLimit: (handler: Function) => handler,
}));
jest.mock("@/lib/correlation", () => ({ runWithCorrelationId: (_id: string, fn: Function) => fn() }));
jest.mock("@/lib/logger", () => ({ child: () => ({ info: jest.fn(), error: jest.fn() }) }));

import { POST } from "../route";
import { getServerSession } from "next-auth";

const makeReq = () => ({
  json: async () => ({}),
  url: "http://localhost/api/v1/auth/logout",
  method: "POST",
  headers: { get: () => null },
});

describe("POST /api/v1/auth/logout — rate limiting", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 if not authenticated", async () => {
    (getServerSession as jest.Mock).mockResolvedValueOnce(null);
    const res = await POST(makeReq() as any);
    expect(res.status).toBe(401);
  });

  it("returns 200 on successful logout", async () => {
    (getServerSession as jest.Mock).mockResolvedValueOnce({ user: { id: "u1" } });
    const res = await POST(makeReq() as any);
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });
});
