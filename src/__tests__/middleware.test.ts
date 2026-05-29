/**
 * @jest-environment node
 */
/// <reference types="jest" />
import { NextRequest, NextResponse } from "next/server";
import { middleware } from "../middleware";

// Set environment variable for CORS testing
process.env.ALLOWED_ORIGINS = "https://trusted-partner.com,https://another-trusted.org";

describe("CORS Policy Middleware", () => {
  const originalEnv = process.env.ALLOWED_ORIGINS;

  beforeAll(() => {
    process.env.ALLOWED_ORIGINS = "https://trusted-partner.com,https://another-trusted.org";
  });

  afterAll(() => {
    process.env.ALLOWED_ORIGINS = originalEnv;
  });

  function createMockRequest(urlPath: string, method: string, origin: string | null): NextRequest {
    const headers = new Headers();
    if (origin) {
      headers.set("origin", origin);
    }
    return new NextRequest(new URL(`http://localhost:3000${urlPath}`), {
      method,
      headers,
    });
  }

  it("should allow and configure CORS headers for a default allowed origin", () => {
    const req = createMockRequest("/api/v1/health", "GET", "https://ajosave.app");
    const res = middleware(req);

    expect(res).toBeDefined();
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://ajosave.app");
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });

  it("should allow and configure CORS headers for a dynamically configured origin from env", () => {
    const req = createMockRequest("/api/v1/profile", "GET", "https://trusted-partner.com");
    const res = middleware(req);

    expect(res).toBeDefined();
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://trusted-partner.com");
  });

  it("should block requests from unauthorized origins with 403 Forbidden", async () => {
    const req = createMockRequest("/api/v1/profile", "GET", "https://malicious-site.com");
    const res = middleware(req);

    expect(res).toBeDefined();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Origin not allowed by CORS policy");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("should handle allowed OPTIONS preflight requests successfully (204 No Content)", () => {
    const req = createMockRequest("/api/v1/circles", "OPTIONS", "https://ajosave.app");
    const res = middleware(req);

    expect(res).toBeDefined();
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://ajosave.app");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("GET");
    expect(res.headers.get("Access-Control-Max-Age")).toBe("86400");
  });

  it("should block preflight OPTIONS requests from unauthorized origins with 403 Forbidden", () => {
    const req = createMockRequest("/api/v1/circles", "OPTIONS", "https://malicious-site.com");
    const res = middleware(req);

    expect(res).toBeDefined();
    expect(res.status).toBe(403);
  });

  it("should allow non-CORS requests (no origin header) to pass through normally", () => {
    const req = createMockRequest("/api/v1/health", "GET", null);
    const res = middleware(req);

    expect(res).toBeDefined();
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
