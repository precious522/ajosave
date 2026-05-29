import { verifyCronSecret } from "@/lib/cron-auth";
import { serverConfig } from "@/server/config";
import { NextRequest } from "next/server";

// Cast to allow mutation in tests
const mutableConfig = serverConfig as { cronSecret: string };

function makeRequest(authHeader?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (authHeader !== undefined) {
    headers["authorization"] = authHeader;
  }
  return new NextRequest("http://localhost/api/cron/cycle", { headers });
}

describe("verifyCronSecret", () => {
  const VALID_SECRET = "test-cron-secret-abc123";
  const originalSecret = serverConfig.cronSecret;

  beforeEach(() => {
    mutableConfig.cronSecret = VALID_SECRET;
  });

  afterEach(() => {
    mutableConfig.cronSecret = originalSecret;
  });

  it("returns null (authenticated) when token matches secret", () => {
    const req = makeRequest(`Bearer ${VALID_SECRET}`);
    expect(verifyCronSecret(req)).toBeNull();
  });

  it("returns 401 when Authorization header is missing", async () => {
    const req = makeRequest();
    const res = verifyCronSecret(req);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
    const body = await res!.json();
    expect(body).toEqual({ success: false, error: "Unauthorized" });
  });

  it("returns 401 when token is wrong", async () => {
    const req = makeRequest("Bearer wrong-secret");
    const res = verifyCronSecret(req);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
    const body = await res!.json();
    expect(body).toEqual({ success: false, error: "Unauthorized" });
  });

  it("returns 401 when Authorization header has no Bearer prefix", async () => {
    const req = makeRequest(VALID_SECRET); // missing "Bearer " prefix
    const res = verifyCronSecret(req);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
  });

  it("returns 401 when CRON_SECRET env var is not configured (empty string)", async () => {
    mutableConfig.cronSecret = ""; // simulate missing env var
    const req = makeRequest("Bearer "); // attacker sends empty token
    const res = verifyCronSecret(req);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
  });

  it("returns 401 when CRON_SECRET is not configured even with a valid-looking token", async () => {
    mutableConfig.cronSecret = "";
    const req = makeRequest(`Bearer ${VALID_SECRET}`);
    const res = verifyCronSecret(req);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
  });

  it("returns 401 when Authorization header is 'Bearer ' with empty token", async () => {
    const req = makeRequest("Bearer ");
    const res = verifyCronSecret(req);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
  });
});
