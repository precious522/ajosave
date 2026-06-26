import { computeSignature, signRequest, verifySignature } from "@/lib/cron-auth";
import { serverConfig } from "@/server/config";

const mutableConfig = serverConfig as { cronSecret: string };
const VALID_SECRET = "test-cron-secret-abc123";
const PATH = "/api/v1/cron/cycle";
const METHOD = "GET";
const BASE_URL = `http://localhost${PATH}`;

function makeReq(headers: Record<string, string | undefined> = {}, method = METHOD) {
  return {
    method,
    url: BASE_URL,
    headers: { get: (k: string) => headers[k] ?? null },
  };
}

function makeSignedReq(overrides: { timestamp?: string; signature?: string } = {}) {
  const timestamp = overrides.timestamp ?? Date.now().toString();
  const signature = overrides.signature ?? computeSignature(VALID_SECRET, timestamp, METHOD, PATH);
  return makeReq({ "x-timestamp": timestamp, "x-signature": signature });
}

beforeEach(() => { mutableConfig.cronSecret = VALID_SECRET; });

describe("computeSignature", () => {
  it("returns a 64-char hex string", () => {
    expect(computeSignature(VALID_SECRET, "123", METHOD, PATH)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces different signatures for different timestamps", () => {
    const a = computeSignature(VALID_SECRET, "111", METHOD, PATH);
    const b = computeSignature(VALID_SECRET, "222", METHOD, PATH);
    expect(a).not.toBe(b);
  });
});

describe("verifySignature", () => {
  it("returns null for a valid signed request", () => {
    expect(verifySignature(makeSignedReq())).toBeNull();
  });

  it("returns error when x-timestamp is missing", () => {
    expect(verifySignature(makeReq({ "x-signature": "abc" }))).toBeTruthy();
  });

  it("returns error when x-signature is missing", () => {
    expect(verifySignature(makeReq({ "x-timestamp": Date.now().toString() }))).toBeTruthy();
  });

  it("returns error when signature is wrong", () => {
    expect(verifySignature(makeSignedReq({ signature: "a".repeat(64) }))).toBeTruthy();
  });

  it("returns error when timestamp is outside 5-minute window (replay attack)", () => {
    const oldTs = (Date.now() - 6 * 60 * 1000).toString();
    expect(verifySignature(makeSignedReq({ timestamp: oldTs }))).toBeTruthy();
  });

  it("returns error when CRON_SECRET is not configured", () => {
    mutableConfig.cronSecret = "";
    expect(verifySignature(makeSignedReq())).toBeTruthy();
  });

  it("returns error when signed with wrong secret", () => {
    const ts = Date.now().toString();
    const sig = computeSignature("wrong-secret", ts, METHOD, PATH);
    expect(verifySignature(makeReq({ "x-timestamp": ts, "x-signature": sig }))).toBeTruthy();
  });
});

describe("signRequest", () => {
  it("produces headers that pass verifySignature", () => {
    const headers = signRequest(METHOD, PATH);
    expect(verifySignature(makeReq(headers))).toBeNull();
  });

  it("includes x-timestamp and x-signature", () => {
    const headers = signRequest(METHOD, PATH);
    expect(headers["x-timestamp"]).toBeDefined();
    expect(headers["x-signature"]).toMatch(/^[0-9a-f]{64}$/);
  });

  it("throws when CRON_SECRET is not configured", () => {
    mutableConfig.cronSecret = "";
    expect(() => signRequest(METHOD, PATH)).toThrow("CRON_SECRET is not configured");
  });
});
