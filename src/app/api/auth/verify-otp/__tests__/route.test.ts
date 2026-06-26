import { POST } from "../route";
import { NextRequest } from "next/server";
import * as lockout from "@/lib/lockout";
import * as db from "@/lib/db";
import { getRedis } from "@/lib/redis";

// Mock dependencies
jest.mock("@/lib/lockout");
jest.mock("@/lib/db");
jest.mock("@/lib/redis");
jest.mock("@/server/middleware", () => ({
  withErrorHandler: (handler: Function) => handler,
}));

describe("POST /api/auth/verify-otp", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 400 if phone is missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ otp: "123456" }),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it("should return 400 if OTP is missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ phone: "+234123456789" }),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it("should return 423 if account is locked", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ phone: "+234123456789", otp: "123456" }),
    });

    const mockLockoutStatus = {
      isLocked: true,
      attempts: 5,
      remainingAttempts: 0,
      lockoutExpiresAt: Math.floor(Date.now() / 1000) + 1800,
      lockoutRemainingSeconds: 1800,
    };

    (lockout.getLockoutStatus as jest.Mock).mockResolvedValue(mockLockoutStatus);

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(423);
    expect(data.success).toBe(false);
    expect(data.error).toContain("locked");
    expect(data.data.lockout.isLocked).toBe(true);
  });

  it("should return 401 if OTP is invalid", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ phone: "+234123456789", otp: "000000" }),
    });

    const mockLockoutStatus = {
      isLocked: false,
      attempts: 0,
      remainingAttempts: 5,
    };

    const mockUpdatedStatus = {
      isLocked: false,
      attempts: 1,
      remainingAttempts: 4,
    };

    (lockout.getLockoutStatus as jest.Mock).mockResolvedValue(mockLockoutStatus);
    (lockout.recordFailure as jest.Mock).mockResolvedValue(mockUpdatedStatus);

    const mockRedis = {
      get: jest.fn().mockResolvedValue(null),
    };
    (getRedis as jest.Mock).mockResolvedValue(mockRedis);

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toContain("Invalid or expired OTP");
    expect(data.data.lockout.attempts).toBe(1);
    expect(data.data.lockout.remainingAttempts).toBe(4);
  });

  it("should return 423 if OTP is invalid and account becomes locked", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ phone: "+234123456789", otp: "000000" }),
    });

    const mockLockoutStatus = {
      isLocked: false,
      attempts: 4,
      remainingAttempts: 1,
    };

    const mockUpdatedStatus = {
      isLocked: true,
      attempts: 5,
      remainingAttempts: 0,
      lockoutExpiresAt: Math.floor(Date.now() / 1000) + 1800,
      lockoutRemainingSeconds: 1800,
    };

    (lockout.getLockoutStatus as jest.Mock).mockResolvedValue(mockLockoutStatus);
    (lockout.recordFailure as jest.Mock).mockResolvedValue(mockUpdatedStatus);

    const mockRedis = {
      get: jest.fn().mockResolvedValue(null),
    };
    (getRedis as jest.Mock).mockResolvedValue(mockRedis);

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(423);
    expect(data.success).toBe(false);
    expect(data.error).toContain("locked");
    expect(data.data.lockout.isLocked).toBe(true);
  });

  it("should successfully verify OTP and return user", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ phone: "+234123456789", otp: "123456" }),
    });

    const mockLockoutStatus = {
      isLocked: false,
      attempts: 0,
      remainingAttempts: 5,
    };

    const mockUser = {
      id: "user-123",
      phone: "+234123456789",
      display_name: "Test User",
      role: "user",
    };

    (lockout.getLockoutStatus as jest.Mock).mockResolvedValue(mockLockoutStatus);
    (lockout.resetLockout as jest.Mock).mockResolvedValue(undefined);
    (db.query as jest.Mock).mockResolvedValue({ rows: [mockUser] });

    const mockRedis = {
      get: jest.fn().mockResolvedValue("123456"),
      del: jest.fn().mockResolvedValue(1),
    };
    (getRedis as jest.Mock).mockResolvedValue(mockRedis);

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.user.id).toBe("user-123");
    expect(data.data.user.phone).toBe("+234123456789");

    // Verify lockout was reset
    expect(lockout.resetLockout).toHaveBeenCalledWith("+234123456789");

    // Verify OTP was deleted
    expect(mockRedis.del).toHaveBeenCalledWith("otp:+234123456789");
  });

  it("should create user on first successful OTP verification", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ phone: "+234123456789", otp: "123456" }),
    });

    const mockLockoutStatus = {
      isLocked: false,
      attempts: 0,
      remainingAttempts: 5,
    };

    const mockNewUser = {
      id: "new-user-uuid",
      phone: "+234123456789",
      display_name: "Ajosave User",
      role: "user",
    };

    (lockout.getLockoutStatus as jest.Mock).mockResolvedValue(mockLockoutStatus);
    (lockout.resetLockout as jest.Mock).mockResolvedValue(undefined);

    // First query returns empty (user doesn't exist)
    // Second query returns new user
    (db.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [mockNewUser] });

    const mockRedis = {
      get: jest.fn().mockResolvedValue("123456"),
      del: jest.fn().mockResolvedValue(1),
    };
    (getRedis as jest.Mock).mockResolvedValue(mockRedis);

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.user.id).toBe("new-user-uuid");

    // Verify user was created
    expect(db.query).toHaveBeenCalledTimes(2);
  });
});
