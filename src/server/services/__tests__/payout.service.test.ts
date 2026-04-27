import { processCyclePayout, getPayoutsByCircle } from "@/server/services/payout.service";
import * as circleService from "@/server/services/circle.service";
import * as db from "@/lib/db";
import type { Circle, Member, Payout } from "@/types";

jest.mock("@/server/services/circle.service");
jest.mock("@/lib/db");

const mockGetCircleById = circleService.getCircleById as jest.MockedFunction<typeof circleService.getCircleById>;
const mockGetMembersByCircle = circleService.getMembersByCircle as jest.MockedFunction<typeof circleService.getMembersByCircle>;
const mockUpdateCircleStatus = circleService.updateCircleStatus as jest.MockedFunction<typeof circleService.updateCircleStatus>;
const mockQuery = db.query as jest.MockedFunction<typeof db.query>;

// Mock horizonServer.loadAccount and USDC for validation tests
const mockLoadAccount = jest.fn();
const mockSendUsdcPayment = jest.fn();

jest.mock("@/lib/stellar", () => ({
  sendUsdcPayment: (...args: unknown[]) => mockSendUsdcPayment(...args),
  horizonServer: { loadAccount: (...args: unknown[]) => mockLoadAccount(...args) },
  USDC: { getCode: () => "USDC", getIssuer: () => "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5" },
}));

jest.mock("@/lib/soroban", () => ({
  invokeContractPayout: jest.fn().mockResolvedValue("soroban-tx-hash"),
}));

jest.mock("@/server/services/notification.service", () => ({
  notifyPayoutProcessed: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/server/services/payout-lock", () => ({
  withPayoutLock: jest.fn((_id: string, fn: () => unknown) => fn()),
  PayoutLockError: class PayoutLockError extends Error {},
}));

const CIRCLE_ID = "circle-1";
// Valid Stellar Ed25519 public key
const RECIPIENT_KEY = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";
const TX_HASH = "abc123txhash";

const USDC_BALANCE = {
  asset_type: "credit_alphanum4",
  asset_code: "USDC",
  asset_issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  balance: "100.0000000",
};

function makeCircle(overrides: Partial<Circle> = {}): Circle {
  return {
    id: CIRCLE_ID,
    name: "Test Circle",
    creatorId: "user-1",
    contributionUsdc: "10.0000000",
    contributionNgn: 16000,
    maxMembers: 3,
    cycleFrequency: "monthly",
    payoutMethod: "fixed",
    status: "active",
    currentCycle: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeMembers(count: number): Member[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `member-${i + 1}`,
    circleId: CIRCLE_ID,
    userId: `user-${i + 1}`,
    position: i + 1,
    status: "active" as const,
    hasReceivedPayout: false,
    joinedAt: new Date(),
  }));
}

function makePayout(overrides: Partial<Payout> = {}): Payout {
  return {
    id: "payout-1",
    circleId: CIRCLE_ID,
    recipientMemberId: "member-1",
    cycleNumber: 1,
    amountUsdc: "30.0000000",
    txHash: TX_HASH,
    paidAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdateCircleStatus.mockResolvedValue(undefined);
  mockSendUsdcPayment.mockResolvedValue(TX_HASH);
  // Default: account exists with USDC trustline
  mockLoadAccount.mockResolvedValue({ balances: [USDC_BALANCE] });
  // Default: user query for notifications
  mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);
});

describe("processCyclePayout", () => {
  describe("happy path", () => {
    it("sends payment for the correct total pot and returns a payout record", async () => {
      const members = makeMembers(3);
      const payoutRecord = makePayout();
      mockGetCircleById.mockResolvedValue(makeCircle({ currentCycle: 1 }));
      mockGetMembersByCircle.mockResolvedValue(members);
      mockQuery.mockResolvedValue({ rows: [payoutRecord], rowCount: 1 } as any);

      const payout = await processCyclePayout(CIRCLE_ID, RECIPIENT_KEY);

      // Total pot = 10 USDC × 3 members = 30.0000000
      expect(mockSendUsdcPayment).toHaveBeenCalledWith(RECIPIENT_KEY, "30.0000000");
      expect(payout.circleId).toBe(CIRCLE_ID);
      expect(payout.amountUsdc).toBe("30.0000000");
      expect(payout.txHash).toBe(TX_HASH);
      expect(payout.cycleNumber).toBe(1);
      expect(payout.recipientMemberId).toBe(members[0].id);
      expect(payout.id).toBeDefined();
      expect(payout.paidAt).toBeInstanceOf(Date);
    });

    it("does NOT mark circle completed when cycles remain", async () => {
      mockGetCircleById.mockResolvedValue(makeCircle({ currentCycle: 1 }));
      mockGetMembersByCircle.mockResolvedValue(makeMembers(3));
      mockQuery.mockResolvedValue({ rows: [makePayout()], rowCount: 1 } as any);

      await processCyclePayout(CIRCLE_ID, RECIPIENT_KEY);

      expect(mockUpdateCircleStatus).not.toHaveBeenCalled();
    });

    it("marks circle completed when last member is paid", async () => {
      const members = makeMembers(3);
      mockGetCircleById.mockResolvedValue(makeCircle({ currentCycle: 3 }));
      mockGetMembersByCircle.mockResolvedValue(members);
      mockQuery.mockResolvedValue({ rows: [makePayout({ cycleNumber: 3 })], rowCount: 1 } as any);

      await processCyclePayout(CIRCLE_ID, RECIPIENT_KEY);

      expect(mockUpdateCircleStatus).toHaveBeenCalledWith(CIRCLE_ID, "completed");
    });

    it("returns payout record from database query", async () => {
      mockGetCircleById.mockResolvedValue(makeCircle());
      mockGetMembersByCircle.mockResolvedValue(makeMembers(2));
      const payoutRecord = makePayout();
      mockQuery.mockResolvedValue({ rows: [payoutRecord], rowCount: 1 } as any);

      const payout = await processCyclePayout(CIRCLE_ID, RECIPIENT_KEY);

      expect(payout).toEqual(payoutRecord);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO payouts"),
        expect.any(Array)
      );
    });

    it("retrieves payouts from database for a circle", async () => {
      const payoutsRecord = [makePayout({ cycleNumber: 1 }), makePayout({ cycleNumber: 2, id: "payout-2" })];
      mockQuery.mockResolvedValue({ rows: payoutsRecord, rowCount: 2 } as any);

      const payouts = await getPayoutsByCircle(CIRCLE_ID);

      expect(payouts).toEqual(payoutsRecord);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("SELECT id, circle_id"),
        [CIRCLE_ID]
      );
    });
  });

  describe("Stellar key validation", () => {
    it("throws on invalid key format", async () => {
      mockGetCircleById.mockResolvedValue(makeCircle());
      mockGetMembersByCircle.mockResolvedValue(makeMembers(2));

      await expect(processCyclePayout(CIRCLE_ID, "not-a-stellar-key")).rejects.toThrow(
        "Invalid Stellar public key"
      );
      expect(mockSendUsdcPayment).not.toHaveBeenCalled();
    });

    it("throws when account does not exist on-chain", async () => {
      mockGetCircleById.mockResolvedValue(makeCircle());
      mockGetMembersByCircle.mockResolvedValue(makeMembers(2));
      mockLoadAccount.mockRejectedValue(new Error("Not Found"));

      await expect(processCyclePayout(CIRCLE_ID, RECIPIENT_KEY)).rejects.toThrow(
        "Stellar account not found on-chain"
      );
      expect(mockSendUsdcPayment).not.toHaveBeenCalled();
    });

    it("throws when account has no USDC trustline", async () => {
      mockGetCircleById.mockResolvedValue(makeCircle());
      mockGetMembersByCircle.mockResolvedValue(makeMembers(2));
      mockLoadAccount.mockResolvedValue({ balances: [{ asset_type: "native", balance: "100" }] });

      await expect(processCyclePayout(CIRCLE_ID, RECIPIENT_KEY)).rejects.toThrow(
        "Recipient account has no USDC trustline"
      );
      expect(mockSendUsdcPayment).not.toHaveBeenCalled();
    });

    it("skips Horizon validation on Soroban path (contractId present)", async () => {
      mockGetCircleById.mockResolvedValue(makeCircle({ contractId: "CTEST123" }));
      mockGetMembersByCircle.mockResolvedValue(makeMembers(2));
      mockQuery.mockResolvedValue({ rows: [makePayout()], rowCount: 1 } as any);

      await processCyclePayout(CIRCLE_ID, RECIPIENT_KEY);

      // loadAccount should NOT be called on the Soroban path
      expect(mockLoadAccount).not.toHaveBeenCalled();
      expect(mockSendUsdcPayment).not.toHaveBeenCalled();
    });
  });

  describe("error cases", () => {
    it("throws 'Circle not found' when circle does not exist", async () => {
      mockGetCircleById.mockResolvedValue(null);

      await expect(processCyclePayout(CIRCLE_ID, RECIPIENT_KEY)).rejects.toThrow(
        "Circle not found"
      );
      expect(mockSendUsdcPayment).not.toHaveBeenCalled();
    });

    it("throws 'Circle is not active' when circle status is 'open'", async () => {
      mockGetCircleById.mockResolvedValue(makeCircle({ status: "open" }));

      await expect(processCyclePayout(CIRCLE_ID, RECIPIENT_KEY)).rejects.toThrow(
        "Circle is not active"
      );
      expect(mockSendUsdcPayment).not.toHaveBeenCalled();
    });

    it("throws 'Circle is not active' when circle status is 'completed'", async () => {
      mockGetCircleById.mockResolvedValue(makeCircle({ status: "completed" }));

      await expect(processCyclePayout(CIRCLE_ID, RECIPIENT_KEY)).rejects.toThrow(
        "Circle is not active"
      );
    });

    it("throws 'Circle is not active' when circle status is 'cancelled'", async () => {
      mockGetCircleById.mockResolvedValue(makeCircle({ status: "cancelled" }));

      await expect(processCyclePayout(CIRCLE_ID, RECIPIENT_KEY)).rejects.toThrow(
        "Circle is not active"
      );
    });

    it("propagates Stellar SDK errors", async () => {
      mockGetCircleById.mockResolvedValue(makeCircle());
      mockGetMembersByCircle.mockResolvedValue(makeMembers(2));
      mockSendUsdcPayment.mockRejectedValue(new Error("Stellar network error"));

      await expect(processCyclePayout(CIRCLE_ID, RECIPIENT_KEY)).rejects.toThrow(
        "Stellar network error"
      );
    });
  });
});

describe("getPayoutsByCircle", () => {
  it("returns empty array for a circle with no payouts", async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);
    const result = await getPayoutsByCircle("unknown-circle");
    expect(result).toEqual([]);
  });
});
