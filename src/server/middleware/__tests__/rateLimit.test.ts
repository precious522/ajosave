jest.mock("next/server", () => ({
  NextRequest: class {},
  NextResponse: { json: jest.fn() },
}));
jest.mock("@sentry/nextjs", () => ({ captureException: jest.fn() }));
jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));

// In-memory sorted-set store shared between mock and tests
const store = new Map<string, { score: number; value: string }[]>();

jest.mock("@/lib/redis", () => ({
  getRedis: jest.fn(() =>
    Promise.resolve({
      zRemRangeByScore: (_key: string, _min: number, max: number) => {
        const entries = store.get(_key) ?? [];
        store.set(_key, entries.filter((e) => e.score > max));
        return Promise.resolve();
      },
      zCard: (_key: string) => Promise.resolve((store.get(_key) ?? []).length),
      zAdd: (_key: string, entry: { score: number; value: string }) => {
        const entries = store.get(_key) ?? [];
        entries.push(entry);
        store.set(_key, entries);
        return Promise.resolve();
      },
      zRange: (_key: string) => {
        const entries = store.get(_key) ?? [];
        return Promise.resolve(entries.length ? [entries[0].value] : []);
      },
      pExpire: () => Promise.resolve(),
    })
  ),
}));

import { rateLimit } from "../index";

beforeEach(() => {
  store.clear();
});

describe("rateLimit", () => {
  it("allows requests within the limit", async () => {
    const key = `test-within-${Math.random()}`;
    expect((await rateLimit(key, 3, 60_000)).allowed).toBe(true);
    expect((await rateLimit(key, 3, 60_000)).allowed).toBe(true);
    expect((await rateLimit(key, 3, 60_000)).allowed).toBe(true);
  });

  it("blocks requests that exceed the limit", async () => {
    const key = `test-exceed-${Math.random()}`;
    await rateLimit(key, 2, 60_000);
    await rateLimit(key, 2, 60_000);
    expect((await rateLimit(key, 2, 60_000)).allowed).toBe(false);
  });

  it("returns correct remaining count", async () => {
    const key = `test-remaining-${Math.random()}`;
    const first = await rateLimit(key, 3, 60_000);
    expect(first.remaining).toBe(2);
  });

  it("allows requests again after the window resets", async () => {
    const key = `test-reset-${Math.random()}`;
    await rateLimit(key, 1, 60_000);
    expect((await rateLimit(key, 1, 60_000)).allowed).toBe(false);

    // Simulate window expiry by clearing the store
    store.clear();

    expect((await rateLimit(key, 1, 60_000)).allowed).toBe(true);
  });

  it("tracks different keys independently", async () => {
    const keyA = `test-keyA-${Math.random()}`;
    const keyB = `test-keyB-${Math.random()}`;
    await rateLimit(keyA, 1, 60_000);
    expect((await rateLimit(keyA, 1, 60_000)).allowed).toBe(false);
    expect((await rateLimit(keyB, 1, 60_000)).allowed).toBe(true);
  });
});
