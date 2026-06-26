jest.mock("axios");
jest.mock("@/lib/redis");

import { getFiatPerUsdc } from "@/lib/fx";
import axios from "axios";
import { getRedis } from "@/lib/redis";

const mockAxiosGet = axios.get as jest.MockedFunction<typeof axios.get>;
const mockGetRedis = getRedis as jest.MockedFunction<typeof getRedis>;

function makeRedis(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    get: jest.fn().mockResolvedValue(null),
    setEx: jest.fn().mockResolvedValue("OK"),
    set: jest.fn().mockResolvedValue("OK"),
    ...overrides,
  };
}

beforeEach(() => jest.clearAllMocks());

describe("getFiatPerUsdc", () => {
  it("returns cached rate when available", async () => {
    const redis = makeRedis({ get: jest.fn().mockResolvedValue("1750") });
    mockGetRedis.mockResolvedValue(redis as any);

    const rate = await getFiatPerUsdc("NGN");

    expect(rate).toBe(1750);
    expect(mockAxiosGet).not.toHaveBeenCalled();
    expect(redis.get).toHaveBeenCalledWith("fx:per_usdc:NGN");
  });

  it("fetches live rate, caches it, and returns it", async () => {
    const redis = makeRedis();
    mockGetRedis.mockResolvedValue(redis as any);
    mockAxiosGet.mockResolvedValue({ data: { rates: { GBP: 0.78 } } } as any);

    const rate = await getFiatPerUsdc("GBP");

    expect(rate).toBe(0.78);
    // Cached with 5-minute TTL
    expect(redis.setEx).toHaveBeenCalledWith("fx:per_usdc:GBP", 300, "0.78");
    // Persisted as last-known fallback
    expect(redis.set).toHaveBeenCalledWith("fx:per_usdc:last_known:GBP", "0.78");
  });

  it("falls back to last known rate when API fails", async () => {
    const redis = makeRedis({
      get: jest.fn()
        .mockResolvedValueOnce(null)           // cache miss
        .mockResolvedValueOnce("0.92"),         // last known
    });
    mockGetRedis.mockResolvedValue(redis as any);
    mockAxiosGet.mockRejectedValue(new Error("Network error"));

    const rate = await getFiatPerUsdc("EUR");

    expect(rate).toBe(0.92);
  });

  it("falls back to hardcoded value when API fails and no last-known rate exists", async () => {
    const redis = makeRedis({ get: jest.fn().mockResolvedValue(null) });
    mockGetRedis.mockResolvedValue(redis as any);
    mockAxiosGet.mockRejectedValue(new Error("Network error"));

    const rate = await getFiatPerUsdc("NGN");

    expect(rate).toBe(1600);
  });

  it("defaults to 1.0 for unknown currencies when everything fails", async () => {
    const redis = makeRedis({ get: jest.fn().mockResolvedValue(null) });
    mockGetRedis.mockResolvedValue(redis as any);
    mockAxiosGet.mockRejectedValue(new Error("Network error"));

    const rate = await getFiatPerUsdc("XYZ");

    expect(rate).toBe(1.0);
  });
});
