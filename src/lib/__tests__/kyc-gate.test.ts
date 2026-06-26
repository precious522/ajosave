/**
 * Unit tests for KYC gate logic — Issue #129
 *
 * Tests the core decision logic: given a circle's contribution amount and a
 * user's KYC status, should the join be blocked?
 */

// ── Inline the gate logic so we can test it without DB/network ───────────────

type KycStatus = "none" | "pending" | "approved" | "rejected";

function shouldBlockJoin(params: {
  contributionNgn: number;
  effectiveThreshold: number;
  kycStatus: KycStatus;
}): boolean {
  const { contributionNgn, effectiveThreshold, kycStatus } = params;
  if (contributionNgn < effectiveThreshold) return false;
  return kycStatus !== "approved";
}

function resolveThreshold(
  circleThreshold: number | null | undefined,
  globalThreshold: number
): number {
  return circleThreshold ?? globalThreshold;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("KYC gate — shouldBlockJoin", () => {
  const threshold = 100_000;

  it("allows verified users on high-value circles", () => {
    expect(shouldBlockJoin({ contributionNgn: 150_000, effectiveThreshold: threshold, kycStatus: "approved" })).toBe(false);
  });

  it("blocks unverified (none) users on high-value circles", () => {
    expect(shouldBlockJoin({ contributionNgn: 150_000, effectiveThreshold: threshold, kycStatus: "none" })).toBe(true);
  });

  it("blocks pending users on high-value circles", () => {
    expect(shouldBlockJoin({ contributionNgn: 100_000, effectiveThreshold: threshold, kycStatus: "pending" })).toBe(true);
  });

  it("blocks rejected users on high-value circles", () => {
    expect(shouldBlockJoin({ contributionNgn: 200_000, effectiveThreshold: threshold, kycStatus: "rejected" })).toBe(true);
  });

  it("allows unverified users below the threshold", () => {
    expect(shouldBlockJoin({ contributionNgn: 50_000, effectiveThreshold: threshold, kycStatus: "none" })).toBe(false);
  });

  it("blocks at exactly the threshold amount", () => {
    expect(shouldBlockJoin({ contributionNgn: 100_000, effectiveThreshold: threshold, kycStatus: "none" })).toBe(true);
  });

  it("allows verified users below the threshold", () => {
    expect(shouldBlockJoin({ contributionNgn: 99_999, effectiveThreshold: threshold, kycStatus: "approved" })).toBe(false);
  });
});

describe("KYC gate — resolveThreshold", () => {
  const global = 100_000;

  it("uses per-circle threshold when set", () => {
    expect(resolveThreshold(50_000, global)).toBe(50_000);
  });

  it("falls back to global threshold when circle has no override", () => {
    expect(resolveThreshold(null, global)).toBe(global);
    expect(resolveThreshold(undefined, global)).toBe(global);
  });

  it("respects a zero per-circle threshold (always require KYC)", () => {
    expect(resolveThreshold(0, global)).toBe(0);
  });
});
