import {
  createCircle,
  joinCircle,
  listOpenCircles,
  getCirclesByUser,
  approveJoinRequest,
  _rejectJoinRequest,
  shuffleAndPersistPositions,
  cancelCircle,
} from "@/server/services/circle.service";
import * as db from "@/lib/db";
import * as soroban from "@/lib/soroban";
import * as fx from "@/lib/fx";
import * as stellar from "@/lib/stellar";
import * as redis from "@/lib/redis";

jest.mock("@/lib/db", () => ({
  query: jest.fn(),
  transaction: jest.fn(),
}));
jest.mock("@/lib/soroban");
jest.mock("@/lib/fx");
jest.mock("@/lib/stellar", () => ({
  sendUsdcPayment: jest.fn(),
  validateStellarRecipient: jest.fn(),
}));
jest.mock("@/server/services/notification.service", () => ({
  notifyCircleCancelled: jest.fn().mockResolvedValue(undefined),
}));

const mockRedisGet = jest.fn();
const mockRedisSet = jest.fn();
const mockRedisDel = jest.fn();
const mockRedisKeys = jest.fn();
const mockRedisClient = {
  get: mockRedisGet,
  set: mockRedisSet,
  del: mockRedisDel,
  keys: mockRedisKeys,
};
jest.mock("@/lib/redis", () => ({
  getRedis: jest.fn(),
}));
const mockGetRedis = redis.getRedis as jest.MockedFunction<typeof redis.getRedis>;

const mockQuery = db.query as jest.MockedFunction<typeof db.query>;
const mockTransaction = db.transaction as jest.MockedFunction<typeof db.transaction>;
const mockDeployAjoContract = soroban.deployAjoContract as jest.MockedFunction<
  typeof soroban.deployAjoContract
>;
const mockGetFiatPerUsdc = fx.getFiatPerUsdc as jest.MockedFunction<typeof fx.getFiatPerUsdc>;
const mockSendUsdcPayment = stellar.sendUsdcPayment as jest.MockedFunction<
  typeof stellar.sendUsdcPayment
>;
const mockValidateStellarRecipient = stellar.validateStellarRecipient as jest.MockedFunction<
  typeof stellar.validateStellarRecipient
>;

const CIRCLE_ID = "circle-123";
const USER_ID = "user-456";
const CREATOR_ID = "creator-789";
const STELLAR_PUBLIC_KEY = "GDNIKPB2TPPS2RZG6TDW76YFSPNVEINVTJIPVEPA25Y74TPSLBNOA336";

const MOCK_CIRCLE = {
  id: CIRCLE_ID,
  name: "Test Circle",
  creatorId: CREATOR_ID,
  contributionUsdc: "10.0000000",
  contributionFiat: 16000,
  contributionCurrency: "NGN",
  maxMembers: 3,
  cycleFrequency: "monthly",
  payoutMethod: "fixed",
  circleType: "public",
  status: "open",
  currentCycle: 0,
};

const MOCK_MEMBER = {
  id: "member-1",
  circleId: CIRCLE_ID,
  userId: USER_ID,
  status: "active",
  position: 1,
};

function mockCancelCircleQueries(stellarPublicKey: string | null = STELLAR_PUBLIC_KEY) {
  mockQuery.mockImplementation(async (sql: unknown) => {
    const queryText = String(sql);

    if (queryText.includes("SELECT id, name, creator_id, status, contribution_usdc")) {
      return {
        rows: [
          {
            id: CIRCLE_ID,
            name: "Test Circle",
            creator_id: CREATOR_ID,
            status: "open",
            contribution_usdc: "10.0000000",
          },
        ],
        rowCount: 1,
      } as any;
    }

    if (queryText.includes("UPDATE contributions") && queryText.includes("refund_pending")) {
      return { rows: [], rowCount: 1 } as any;
    }

    if (queryText.includes("UPDATE circles") && queryText.includes("status = 'cancelled'")) {
      return { rows: [{ ...MOCK_CIRCLE, status: "cancelled" }], rowCount: 1 } as any;
    }

    if (queryText.includes("SUM(c.amount_usdc)::text AS total_usdc")) {
      return {
        rows: [
          {
            member_id: "member-1",
            user_id: USER_ID,
            stellar_public_key: stellarPublicKey,
            total_usdc: "10.0000000",
          },
        ],
        rowCount: 1,
      } as any;
    }

    if (queryText.includes("SET status = 'refunded'")) {
      return { rows: [], rowCount: 1 } as any;
    }

    if (queryText.includes("SELECT DISTINCT m.user_id")) {
      return { rows: [], rowCount: 0 } as any;
    }

    return { rows: [], rowCount: 0 } as any;
  });
}

async function flushRefundJobs() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetFiatPerUsdc.mockResolvedValue(1600);
  mockSendUsdcPayment.mockResolvedValue("refund-tx-hash");
  mockValidateStellarRecipient.mockResolvedValue(undefined);
  mockTransaction.mockImplementation(async (cb) => cb(mockQuery));
  // Default: Redis returns no cached value
  mockRedisGet.mockResolvedValue(null);
  mockRedisSet.mockResolvedValue("OK");
  mockRedisKeys.mockResolvedValue([]);
  mockRedisDel.mockResolvedValue(1);
  mockGetRedis.mockResolvedValue(mockRedisClient as any);
});

describe("circle.service", () => {
  describe("createCircle", () => {
    const input = {
      name: "New Circle",
      contributionAmount: 16000,
      contributionCurrency: "NGN" as const,
      maxMembers: 5,
      cycleFrequency: "monthly" as const,
      circleType: "public" as const,
      gracePeriodHours: 24,
      payoutMethod: "fixed" as const,
    };

    it("should create a circle and deploy contract", async () => {
      mockDeployAjoContract.mockResolvedValue("CONTRACT_ID");
      mockQuery.mockResolvedValue({ rows: [MOCK_CIRCLE], rowCount: 1 } as any);

      const result = await createCircle(CREATOR_ID, input);

      expect(mockDeployAjoContract).toHaveBeenCalled();
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO circles"),
        expect.arrayContaining(["CONTRACT_ID"])
      );
      expect(result).toEqual(MOCK_CIRCLE);
    });

    it("should create a circle even if contract deployment fails", async () => {
      mockDeployAjoContract.mockRejectedValue(new Error("Deploy fail"));
      mockQuery.mockResolvedValue({ rows: [MOCK_CIRCLE], rowCount: 1 } as any);

      const result = await createCircle(CREATOR_ID, input);

      expect(result).toEqual(MOCK_CIRCLE);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO circles"),
        expect.arrayContaining([null])
      );
    });
  });

  describe("listOpenCircles", () => {
    it("should return paginated open circles with defaults", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [MOCK_CIRCLE], rowCount: 1 } as any) // data query
        .mockResolvedValueOnce({ rows: [{ count: "1" }], rowCount: 1 } as any); // count query
      const result = await listOpenCircles();
      expect(result).toEqual({ data: [MOCK_CIRCLE], total: 1, page: 1, limit: 20 });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("status = 'open'"),
        expect.anything()
      );
    });

    it("should respect page and limit params", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
        .mockResolvedValueOnce({ rows: [{ count: "50" }], rowCount: 1 } as any);
      const result = await listOpenCircles(3, 10);
      expect(result).toEqual({ data: [], total: 50, page: 3, limit: 10 });
    });

    it("should cap limit at 100", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
        .mockResolvedValueOnce({ rows: [{ count: "0" }], rowCount: 1 } as any);
      const result = await listOpenCircles(1, 999);
      expect(result.limit).toBe(100);
    });
  });

  describe("getCirclesByUser", () => {
    it("should return circles for a user", async () => {
      mockQuery.mockResolvedValue({ rows: [MOCK_CIRCLE], rowCount: 1 } as any);
      const result = await getCirclesByUser(USER_ID);
      expect(result).toEqual([MOCK_CIRCLE]);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("creator_id = $1 OR m.user_id = $1"),
        [USER_ID]
      );
    });
  });

  describe("joinCircle", () => {
    it("should allow a user to join an open public circle", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [MOCK_CIRCLE], rowCount: 1 } as any) // circle lookup
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // existing members
        .mockResolvedValueOnce({ rows: [MOCK_MEMBER], rowCount: 1 } as any); // insert member

      const result = await joinCircle(CIRCLE_ID, USER_ID);

      expect(result).toEqual(MOCK_MEMBER);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO members"),
        expect.anything()
      );
    });

    it("should create a pending member for private circles", async () => {
      const privateCircle = { ...MOCK_CIRCLE, circleType: "private" };
      mockQuery
        .mockResolvedValueOnce({ rows: [privateCircle], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
        .mockResolvedValueOnce({
          rows: [{ ...MOCK_MEMBER, status: "pending" }],
          rowCount: 1,
        } as any);

      const result = await joinCircle(CIRCLE_ID, USER_ID);

      expect(result.status).toBe("pending");
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO members"),
        expect.arrayContaining(["pending"])
      );
    });

    it("should auto-approve invited users for private circles", async () => {
      const privateCircle = { ...MOCK_CIRCLE, circleType: "private" };
      mockQuery
        .mockResolvedValueOnce({ rows: [privateCircle], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
        .mockResolvedValueOnce({
          rows: [{ ...MOCK_MEMBER, status: "active" }],
          rowCount: 1,
        } as any);

      const result = await joinCircle(CIRCLE_ID, USER_ID, true);

      expect(result.status).toBe("active");
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO members"),
        expect.arrayContaining(["active"])
      );
    });

    it("should throw error if circle is full", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [MOCK_CIRCLE], rowCount: 1 } as any)
        .mockResolvedValueOnce({
          rows: [MOCK_MEMBER, MOCK_MEMBER, MOCK_MEMBER],
          rowCount: 3,
        } as any);

      await expect(joinCircle(CIRCLE_ID, USER_ID)).rejects.toThrow("Circle is full");
    });

    it("should throw error if user is already a member", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [MOCK_CIRCLE], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [MOCK_MEMBER], rowCount: 1 } as any);

      await expect(joinCircle(CIRCLE_ID, USER_ID)).rejects.toThrow("Already a member");
    });

    it("should auto-start circle when max members is reached", async () => {
      const circleWithTwoMembers = { ...MOCK_CIRCLE, maxMembers: 2 };
      mockQuery
        .mockResolvedValueOnce({ rows: [circleWithTwoMembers], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [MOCK_MEMBER], rowCount: 1 } as any) // 1 existing
        .mockResolvedValueOnce({ rows: [MOCK_MEMBER], rowCount: 1 } as any) // new member
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // update circle

      await joinCircle(CIRCLE_ID, USER_ID);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE circles SET status='active'"),
        expect.anything()
      );
    });
  });

  describe("approveJoinRequest", () => {
    it("should approve a pending member", async () => {
      const pendingMember = { ...MOCK_MEMBER, status: "pending" };
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ ...MOCK_CIRCLE, circleType: "private" }],
          rowCount: 1,
        } as any)
        .mockResolvedValueOnce({ rows: [pendingMember], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // active count
        .mockResolvedValueOnce({ rows: [MOCK_MEMBER], rowCount: 1 } as any); // update member

      const result = await approveJoinRequest(CIRCLE_ID, "member-1", CREATOR_ID);

      expect(result.status).toBe("active");
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE members SET status = 'active'"),
        expect.anything()
      );
    });

    it("should throw if not creator", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [MOCK_CIRCLE], rowCount: 1 } as any);
      await expect(approveJoinRequest(CIRCLE_ID, "member-1", "wrong-user")).rejects.toThrow(
        "Only the creator can approve join requests"
      );
    });
  });

  describe("shuffleAndPersistPositions", () => {
    it("should shuffle positions deterministically", async () => {
      const members = [
        { ...MOCK_MEMBER, id: "m1", position: 1 },
        { ...MOCK_MEMBER, id: "m2", position: 2 },
      ];
      mockQuery
        .mockResolvedValueOnce({ rows: [MOCK_CIRCLE], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: members, rowCount: 2 } as any)
        .mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await shuffleAndPersistPositions(CIRCLE_ID, "constant-seed");

      expect(result).toHaveLength(2);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE circles SET payout_method = 'randomized'"),
        expect.anything()
      );
    });

    it("should throw if circle already started", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ ...MOCK_CIRCLE, status: "active" }],
        rowCount: 1,
      } as any);
      await expect(shuffleAndPersistPositions(CIRCLE_ID, "seed")).rejects.toThrow(
        "Positions can only be shuffled before the circle starts"
      );
    });
  });

  describe("cancelCircle", () => {
    it("validates the refund recipient before sending USDC", async () => {
      mockCancelCircleQueries();

      const result = await cancelCircle(CIRCLE_ID, CREATOR_ID);
      await flushRefundJobs();

      expect(result.status).toBe("cancelled");
      expect(mockValidateStellarRecipient).toHaveBeenCalledWith(STELLAR_PUBLIC_KEY);
      expect(mockSendUsdcPayment).toHaveBeenCalledWith(STELLAR_PUBLIC_KEY, "10.0000000");
      expect(mockValidateStellarRecipient.mock.invocationCallOrder[0]).toBeLessThan(
        mockSendUsdcPayment.mock.invocationCallOrder[0]
      );
    });

    it("leaves the refund pending when the recipient lacks a USDC trustline", async () => {
      mockCancelCircleQueries();
      mockValidateStellarRecipient.mockRejectedValue(
        new Error(`Recipient account has no USDC trustline: ${STELLAR_PUBLIC_KEY}`)
      );

      await cancelCircle(CIRCLE_ID, CREATOR_ID);
      await flushRefundJobs();

      expect(mockSendUsdcPayment).not.toHaveBeenCalled();
      expect(mockQuery).not.toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'refunded'"),
        expect.anything()
      );
    });
  });

  describe("Redis caching", () => {
    const PAGINATED_RESULT = { data: [MOCK_CIRCLE], total: 1, page: 1, limit: 20 };

    describe("listOpenCircles", () => {
      it("returns cached result on cache hit without querying DB", async () => {
        mockRedisGet.mockResolvedValue(JSON.stringify(PAGINATED_RESULT));

        const result = await listOpenCircles();

        expect(result).toEqual(PAGINATED_RESULT);
        expect(mockQuery).not.toHaveBeenCalled();
      });

      it("queries DB and populates cache on cache miss", async () => {
        mockRedisGet.mockResolvedValue(null);
        mockQuery
          .mockResolvedValueOnce({ rows: [MOCK_CIRCLE], rowCount: 1 } as any)
          .mockResolvedValueOnce({ rows: [{ count: "1" }], rowCount: 1 } as any);

        const result = await listOpenCircles();

        expect(result).toEqual(PAGINATED_RESULT);
        expect(mockQuery).toHaveBeenCalledTimes(2);
        expect(mockRedisSet).toHaveBeenCalledWith(
          expect.stringContaining("circles:open:"),
          JSON.stringify(PAGINATED_RESULT),
          { EX: 30 }
        );
      });

      it("falls through to DB when Redis get throws", async () => {
        mockRedisGet.mockRejectedValue(new Error("Redis unavailable"));
        mockQuery
          .mockResolvedValueOnce({ rows: [MOCK_CIRCLE], rowCount: 1 } as any)
          .mockResolvedValueOnce({ rows: [{ count: "1" }], rowCount: 1 } as any);

        const result = await listOpenCircles();

        expect(result).toEqual(PAGINATED_RESULT);
        expect(mockQuery).toHaveBeenCalledTimes(2);
      });
    });

    describe("cache invalidation", () => {
      it("invalidates cache after createCircle", async () => {
        mockRedisKeys.mockResolvedValue(["circles:open:{}"] as any);
        jest.spyOn(soroban, "deployAjoContract").mockResolvedValue("CONTRACT_ID");
        mockQuery.mockResolvedValue({ rows: [MOCK_CIRCLE], rowCount: 1 } as any);

        await createCircle(CREATOR_ID, {
          name: "New Circle",
          contributionAmount: 16000,
          contributionCurrency: "NGN" as const,
          maxMembers: 5,
          cycleFrequency: "monthly" as const,
          payoutMethod: "fixed" as const,
        });

        expect(mockRedisKeys).toHaveBeenCalledWith("circles:open:*");
        expect(mockRedisDel).toHaveBeenCalledWith(["circles:open:{}"]);
      });

      it("invalidates cache after joinCircle", async () => {
        mockRedisKeys.mockResolvedValue(["circles:open:{}"] as any);
        mockQuery
          .mockResolvedValueOnce({ rows: [MOCK_CIRCLE], rowCount: 1 } as any)
          .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
          .mockResolvedValueOnce({ rows: [MOCK_MEMBER], rowCount: 1 } as any);

        await joinCircle(CIRCLE_ID, USER_ID);

        expect(mockRedisKeys).toHaveBeenCalledWith("circles:open:*");
        expect(mockRedisDel).toHaveBeenCalled();
      });

      it("does not throw when Redis del fails during invalidation", async () => {
        mockRedisKeys.mockResolvedValue(["circles:open:{}"] as any);
        mockRedisDel.mockRejectedValue(new Error("Redis unavailable"));
        mockQuery.mockResolvedValue({ rows: [MOCK_CIRCLE], rowCount: 1 } as any);

        await expect(
          createCircle(CREATOR_ID, {
            name: "New Circle",
            contributionAmount: 16000,
            contributionCurrency: "NGN" as const,
            maxMembers: 5,
            cycleFrequency: "monthly" as const,
            payoutMethod: "fixed" as const,
          })
        ).resolves.toBeDefined();
      });
    });
  });
});
