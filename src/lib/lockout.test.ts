import { getLockoutStatus, recordFailure, resetLockout, isLockedOut, MAX_FAILURES, FAILURE_WINDOW, LOCKOUT_DURATION } from "./lockout";
import { getRedis } from "./redis";

jest.mock("./redis");

describe("Lockout System", () => {
  const testPhone = "+234123456789";
  let mockRedis: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedis = {
      get: jest.fn(),
      incr: jest.fn(),
      expire: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      ttl: jest.fn(),
    };
    (getRedis as jest.Mock).mockResolvedValue(mockRedis);
  });

  describe("getLockoutStatus", () => {
    it("should return unlocked status when no lockout exists", async () => {
      mockRedis.get.mockResolvedValueOnce(null); // lockout check
      mockRedis.get.mockResolvedValueOnce(null); // attempts check

      const status = await getLockoutStatus(testPhone);

      expect(status.isLocked).toBe(false);
      expect(status.attempts).toBe(0);
      expect(status.remainingAttempts).toBe(MAX_FAILURES);
    });

    it("should return locked status when lockout exists", async () => {
      const ttl = 1800; // 30 minutes
      mockRedis.get.mockResolvedValueOnce("1"); // lockout exists
      mockRedis.ttl.mockResolvedValueOnce(ttl);

      const status = await getLockoutStatus(testPhone);

      expect(status.isLocked).toBe(true);
      expect(status.attempts).toBe(MAX_FAILURES);
      expect(status.remainingAttempts).toBe(0);
      expect(status.lockoutRemainingSeconds).toBe(ttl);
    });

    it("should return correct remaining attempts", async () => {
      mockRedis.get.mockResolvedValueOnce(null); // lockout check
      mockRedis.get.mockResolvedValueOnce("3"); // 3 attempts made

      const status = await getLockoutStatus(testPhone);

      expect(status.isLocked).toBe(false);
      expect(status.attempts).toBe(3);
      expect(status.remainingAttempts).toBe(2);
    });
  });

  describe("recordFailure", () => {
    it("should increment failure count on first failure", async () => {
      mockRedis.incr.mockResolvedValueOnce(1);

      const status = await recordFailure(testPhone);

      expect(mockRedis.incr).toHaveBeenCalledWith(`otp_failures:${testPhone}`);
      expect(mockRedis.expire).toHaveBeenCalledWith(`otp_failures:${testPhone}`, FAILURE_WINDOW);
      expect(status.isLocked).toBe(false);
      expect(status.attempts).toBe(1);
      expect(status.remainingAttempts).toBe(4);
    });

    it("should not set expiry on subsequent failures", async () => {
      mockRedis.incr.mockResolvedValueOnce(2);

      await recordFailure(testPhone);

      expect(mockRedis.expire).not.toHaveBeenCalled();
    });

    it("should lock account after MAX_FAILURES", async () => {
      mockRedis.incr.mockResolvedValueOnce(MAX_FAILURES);

      const status = await recordFailure(testPhone);

      expect(mockRedis.set).toHaveBeenCalledWith(
        `lockout:${testPhone}`,
        "1",
        { EX: LOCKOUT_DURATION }
      );
      expect(mockRedis.del).toHaveBeenCalledWith(`otp_failures:${testPhone}`);
      expect(status.isLocked).toBe(true);
      expect(status.attempts).toBe(MAX_FAILURES);
      expect(status.remainingAttempts).toBe(0);
    });

    it("should return lockout expiry time when locked", async () => {
      mockRedis.incr.mockResolvedValueOnce(MAX_FAILURES);

      const status = await recordFailure(testPhone);

      expect(status.lockoutExpiresAt).toBeDefined();
      expect(status.lockoutRemainingSeconds).toBe(LOCKOUT_DURATION);
    });
  });

  describe("resetLockout", () => {
    it("should delete both failure and lockout keys", async () => {
      await resetLockout(testPhone);

      expect(mockRedis.del).toHaveBeenCalledWith(`otp_failures:${testPhone}`);
      expect(mockRedis.del).toHaveBeenCalledWith(`lockout:${testPhone}`);
    });
  });

  describe("isLockedOut", () => {
    it("should return true when account is locked", async () => {
      mockRedis.get.mockResolvedValueOnce("1"); // lockout exists
      mockRedis.ttl.mockResolvedValueOnce(1800);

      const locked = await isLockedOut(testPhone);

      expect(locked).toBe(true);
    });

    it("should return false when account is not locked", async () => {
      mockRedis.get.mockResolvedValueOnce(null); // no lockout
      mockRedis.get.mockResolvedValueOnce(null); // no attempts

      const locked = await isLockedOut(testPhone);

      expect(locked).toBe(false);
    });
  });

  describe("Brute-Force Protection Scenarios", () => {
    it("should allow 5 attempts before locking", async () => {
      for (let i = 1; i <= 5; i++) {
        mockRedis.incr.mockResolvedValueOnce(i);
        const status = await recordFailure(testPhone);

        if (i < 5) {
          expect(status.isLocked).toBe(false);
        } else {
          expect(status.isLocked).toBe(true);
        }
      }
    });

    it("should prevent attempts after lockout", async () => {
      mockRedis.get.mockResolvedValueOnce("1"); // lockout exists
      mockRedis.ttl.mockResolvedValueOnce(1800);

      const status = await getLockoutStatus(testPhone);

      expect(status.isLocked).toBe(true);
      expect(status.remainingAttempts).toBe(0);
    });

    it("should reset attempts after successful verification", async () => {
      // Simulate 3 failed attempts
      mockRedis.get.mockResolvedValueOnce(null);
      mockRedis.get.mockResolvedValueOnce("3");

      let status = await getLockoutStatus(testPhone);
      expect(status.attempts).toBe(3);

      // Reset after successful verification
      await resetLockout(testPhone);

      // Check status after reset
      mockRedis.get.mockResolvedValueOnce(null);
      mockRedis.get.mockResolvedValueOnce(null);

      status = await getLockoutStatus(testPhone);
      expect(status.attempts).toBe(0);
      expect(status.remainingAttempts).toBe(MAX_FAILURES);
    });
  });
});
