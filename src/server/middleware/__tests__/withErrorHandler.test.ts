jest.mock("@/lib/logger", () => ({
  __esModule: true,
  default: { child: jest.fn(() => ({ info: jest.fn(), error: jest.fn() })) },
}));

jest.mock("next/server", () => ({
  NextRequest: class {},
  NextResponse: {
    json: jest.fn((body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      body,
      headers: { set: jest.fn(), get: jest.fn() },
    })),
  },
}));
jest.mock("@sentry/nextjs", () => ({ captureException: jest.fn() }));
jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));
jest.mock("@/lib/redis", () => ({ getRedis: jest.fn() }));

import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { withErrorHandler } from "../index";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockLogger = jest.requireMock("@/lib/logger").default as { child: jest.Mock };

function makeReq(
  overrides: Partial<{ url: string; method: string; headers: Record<string, string | null> }> = {}
) {
  return {
    url: overrides.url ?? "http://localhost/api/test",
    method: overrides.method ?? "GET",
    headers: { get: (key: string) => overrides.headers?.[key] ?? null },
  } as unknown as import("next/server").NextRequest;
}

function makeOkResponse(status = 200) {
  return {
    status,
    headers: { set: jest.fn(), get: jest.fn() },
  } as unknown as import("next/server").NextResponse;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLogger.child.mockImplementation(() => ({ info: jest.fn(), error: jest.fn() }));
});

describe("withErrorHandler", () => {
  it("returns the handler response and sets x-request-id header", async () => {
    const okRes = makeOkResponse();
    const handler = jest.fn().mockResolvedValue(okRes);

    const res = await withErrorHandler(handler)(makeReq(), undefined);

    expect(res).toBe(okRes);
    expect((okRes.headers.set as jest.Mock)).toHaveBeenCalledWith(
      "x-request-id",
      expect.any(String)
    );
  });

  it("propagates the incoming x-request-id to the response header", async () => {
    const okRes = makeOkResponse();
    const handler = jest.fn().mockResolvedValue(okRes);

    await withErrorHandler(handler)(
      makeReq({ headers: { "x-request-id": "my-trace-id" } }),
      undefined
    );

    expect((okRes.headers.set as jest.Mock)).toHaveBeenCalledWith("x-request-id", "my-trace-id");
  });

  it("logs method, path, statusCode, durationMs on success", async () => {
    const childLogger = { info: jest.fn(), error: jest.fn() };
    mockLogger.child.mockReturnValue(childLogger);

    const okRes = makeOkResponse(201);
    await withErrorHandler(jest.fn().mockResolvedValue(okRes))(
      makeReq({ method: "POST", url: "http://localhost/api/circles" }),
      undefined
    );

    expect(childLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/api/circles",
        statusCode: 201,
        durationMs: expect.any(Number),
      })
    );
  });

  it("returns 500 and logs error fields when handler throws", async () => {
    const childLogger = { info: jest.fn(), error: jest.fn() };
    mockLogger.child.mockReturnValue(childLogger);
    const error = new Error("boom");

    const res = await withErrorHandler(jest.fn().mockRejectedValue(error))(makeReq(), undefined);

    expect(res.status).toBe(500);
    expect(childLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/api/test",
        statusCode: 500,
        durationMs: expect.any(Number),
        err: error,
      })
    );
  });

  it("captures exception in Sentry with requestId on error", async () => {
    const error = new Error("sentry-test");

    await withErrorHandler(jest.fn().mockRejectedValue(error))(makeReq(), undefined);

    expect(Sentry.captureException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        extra: expect.objectContaining({ requestId: expect.any(String) }),
      })
    );
  });

  it("sets x-request-id on the error response", async () => {
    const res = await withErrorHandler(jest.fn().mockRejectedValue(new Error("fail")))(
      makeReq({ headers: { "x-request-id": "err-trace" } }),
      undefined
    );

    expect((res.headers.set as jest.Mock)).toHaveBeenCalledWith("x-request-id", "err-trace");
  });

  it("generates a UUID requestId when none is provided", async () => {
    const okRes = makeOkResponse();
    await withErrorHandler(jest.fn().mockResolvedValue(okRes))(makeReq(), undefined);

    const [[, id]] = (okRes.headers.set as jest.Mock).mock.calls.filter(
      ([k]: [string]) => k === "x-request-id"
    );
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("passes requestId to logger.child", async () => {
    const okRes = makeOkResponse();
    await withErrorHandler(jest.fn().mockResolvedValue(okRes))(
      makeReq({ headers: { "x-request-id": "trace-123" } }),
      undefined
    );

    expect(mockLogger.child).toHaveBeenCalledWith({ requestId: "trace-123" });
  });
});

// Suppress NextResponse.json mock output noise
afterAll(() => {
  (NextResponse.json as jest.Mock).mockReset();
});
