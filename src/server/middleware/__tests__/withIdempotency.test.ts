jest.mock("next/server", () => ({
  NextRequest: class {},
  NextResponse: { json: jest.fn((body, init) => ({ status: init?.status ?? 200, json: async () => body, clone: () => ({ json: async () => body }), headers: { set: jest.fn() } })) },
}));
jest.mock("@sentry/nextjs", () => ({ captureException: jest.fn() }));
jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/correlation", () => ({ runWithCorrelationId: (_id: string, fn: Function) => fn() }));
jest.mock("@/lib/logger", () => ({ child: () => ({ info: jest.fn(), error: jest.fn() }) }));

const store = new Map<string, string>();

jest.mock("@/lib/redis", () => ({
  getRedis: jest.fn(() =>
    Promise.resolve({
      get: (key: string) => Promise.resolve(store.get(key) ?? null),
      set: (key: string, value: string) => { store.set(key, value); return Promise.resolve("OK"); },
    })
  ),
}));

import { withIdempotency } from "../index";
import { NextResponse } from "next/server";

beforeEach(() => store.clear());

const makeReq = (idempotencyKey?: string) => ({
  headers: { get: (h: string) => (h === "x-idempotency-key" ? idempotencyKey ?? null : null) },
  url: "http://localhost/test",
  method: "POST",
});

const makeHandler = (status = 200, body = { success: true }) =>
  jest.fn().mockResolvedValue(
    NextResponse.json(body, { status })
  );

describe("withIdempotency", () => {
  it("passes through when no X-Idempotency-Key header", async () => {
    const handler = makeHandler();
    const wrapped = withIdempotency(handler);
    await wrapped(makeReq() as any);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("calls handler and caches response on first request", async () => {
    const handler = makeHandler(200, { success: true, data: { ref: "abc" } });
    const wrapped = withIdempotency(handler);
    await wrapped(makeReq("key-1") as any);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(store.has("idempotency:key-1")).toBe(true);
  });

  it("returns cached response on duplicate request without calling handler", async () => {
    const handler = makeHandler(201, { success: true, data: { ref: "xyz" } });
    const wrapped = withIdempotency(handler);

    // First request — populates cache
    await wrapped(makeReq("key-2") as any);
    expect(handler).toHaveBeenCalledTimes(1);

    // Second request — should hit cache
    const res = await wrapped(makeReq("key-2") as any);
    expect(handler).toHaveBeenCalledTimes(1); // not called again
    expect(res.status).toBe(201);
  });

  it("different keys are cached independently", async () => {
    const handler = makeHandler();
    const wrapped = withIdempotency(handler);
    await wrapped(makeReq("key-a") as any);
    await wrapped(makeReq("key-b") as any);
    expect(handler).toHaveBeenCalledTimes(2);
    expect(store.has("idempotency:key-a")).toBe(true);
    expect(store.has("idempotency:key-b")).toBe(true);
  });
});
