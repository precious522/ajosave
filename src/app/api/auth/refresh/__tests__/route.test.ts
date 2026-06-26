import { POST } from "../route";
import { NextRequest } from "next/server";
import * as refreshTokens from "@/lib/refresh-tokens";
import * as db from "@/lib/db";
import { SignJWT } from "jose";

// Mock dependencies
jest.mock("@/lib/refresh-tokens");
jest.mock("@/lib/db");
jest.mock("@/server/middleware", () => ({
  withErrorHandler: (handler: Function) => handler,
}));
jest.mock("jose");

describe("POST /api/auth/refresh", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 400 if refresh token is missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/refresh", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Refresh token is required");
  });

  it("should return 401 if refresh token is invalid", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken: "invalid_token" }),
    });

    (refreshTokens.verifyRefreshToken as jest.Mock).mockResolvedValue(null);

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Invalid or expired refresh token");
  });

  it("should return 401 if user not found", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken: "valid_token" }),
    });

    (refreshTokens.verifyRefreshToken as jest.Mock).mockResolvedValue("user-id");
    (db.query as jest.Mock).mockResolvedValue({ rows: [] });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe("User not found");
  });

  it("should successfully refresh token", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken: "valid_token" }),
    });

    const mockUser = {
      id: "user-123",
      phone: "+234123456789",
      display_name: "Test User",
      role: "user",
    };

    (refreshTokens.verifyRefreshToken as jest.Mock).mockResolvedValue("user-123");
    (db.query as jest.Mock).mockResolvedValue({ rows: [mockUser] });
    (refreshTokens.revokeRefreshToken as jest.Mock).mockResolvedValue(undefined);
    (refreshTokens.generateRefreshToken as jest.Mock).mockResolvedValue("new_refresh_token");
    (refreshTokens.getTokenExpiries as jest.Mock).mockReturnValue({
      accessTokenExpires: Math.floor(Date.now() / 1000) + 900,
      refreshTokenExpires: Math.floor(Date.now() / 1000) + 604800,
    });

    const mockAccessToken = "mock_access_token";
    (SignJWT as jest.Mock).mockImplementation(() => ({
      setProtectedHeader: jest.fn().mockReturnThis(),
      setIssuedAt: jest.fn().mockReturnThis(),
      setExpirationTime: jest.fn().mockReturnThis(),
      sign: jest.fn().mockResolvedValue(mockAccessToken),
    }));

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.accessToken).toBe(mockAccessToken);
    expect(data.data.expiresIn).toBe(900);

    // Verify old token was revoked
    expect(refreshTokens.revokeRefreshToken).toHaveBeenCalledWith("valid_token");

    // Verify new token was generated
    expect(refreshTokens.generateRefreshToken).toHaveBeenCalledWith("user-123");

    // Verify cookie was set
    const setCookieHeader = response.headers.get("set-cookie");
    expect(setCookieHeader).toContain("refreshToken=new_refresh_token");
    expect(setCookieHeader).toContain("HttpOnly");
    expect(setCookieHeader).toContain("SameSite=Lax");
  });

  it("should set secure cookie in production", async () => {
    const originalEnv = process.env.NODE_ENV;
    Object.defineProperty(process.env, "NODE_ENV", { value: "production", configurable: true });

    const req = new NextRequest("http://localhost:3000/api/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken: "valid_token" }),
    });

    const mockUser = {
      id: "user-123",
      phone: "+234123456789",
      display_name: "Test User",
      role: "user",
    };

    (refreshTokens.verifyRefreshToken as jest.Mock).mockResolvedValue("user-123");
    (db.query as jest.Mock).mockResolvedValue({ rows: [mockUser] });
    (refreshTokens.revokeRefreshToken as jest.Mock).mockResolvedValue(undefined);
    (refreshTokens.generateRefreshToken as jest.Mock).mockResolvedValue("new_refresh_token");
    (refreshTokens.getTokenExpiries as jest.Mock).mockReturnValue({
      accessTokenExpires: Math.floor(Date.now() / 1000) + 900,
      refreshTokenExpires: Math.floor(Date.now() / 1000) + 604800,
    });

    (SignJWT as jest.Mock).mockImplementation(() => ({
      setProtectedHeader: jest.fn().mockReturnThis(),
      setIssuedAt: jest.fn().mockReturnThis(),
      setExpirationTime: jest.fn().mockReturnThis(),
      sign: jest.fn().mockResolvedValue("mock_access_token"),
    }));

    const response = await POST(req);

    const setCookieHeader = response.headers.get("set-cookie");
    expect(setCookieHeader).toContain("Secure");

    Object.defineProperty(process.env, "NODE_ENV", { value: originalEnv, configurable: true });
  });
});
