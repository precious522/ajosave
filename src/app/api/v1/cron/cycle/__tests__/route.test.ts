import { GET } from "../route";
import { NextRequest } from "next/server";
import * as schedulerService from "@/server/services/scheduler.service";
import { serverConfig } from "@/server/config";

jest.mock("@/server/services/scheduler.service");

const mockProcessDueCycles = schedulerService.processDueCycles as jest.MockedFunction<
  typeof schedulerService.processDueCycles
>;

// Cast to allow mutation in tests
const mutableConfig = serverConfig as { cronSecret: string };

function makeRequest(authHeader?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (authHeader !== undefined) {
    headers["authorization"] = authHeader;
  }
  return new NextRequest("http://localhost/api/cron/cycle", { headers });
}

describe("GET /api/cron/cycle", () => {
  const VALID_SECRET = "test-cron-secret-xyz";
  const originalSecret = serverConfig.cronSecret;

  beforeEach(() => {
    jest.clearAllMocks();
    mutableConfig.cronSecret = VALID_SECRET;
    mockProcessDueCycles.mockResolvedValue(undefined);
  });

  afterEach(() => {
    mutableConfig.cronSecret = originalSecret;
  });

  it("processes due cycles when authenticated with valid secret", async () => {
    const req = makeRequest(`Bearer ${VALID_SECRET}`);
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      success: true,
      data: { message: "Cycle check complete" },
    });
    expect(mockProcessDueCycles).toHaveBeenCalledTimes(1);
  });

  it("returns 401 when Authorization header is missing", async () => {
    const req = makeRequest();
    const res = await GET(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ success: false, error: "Unauthorized" });
    expect(mockProcessDueCycles).not.toHaveBeenCalled();
  });

  it("returns 401 when token is incorrect", async () => {
    const req = makeRequest("Bearer wrong-token");
    const res = await GET(req);

    expect(res.status).toBe(401);
    expect(mockProcessDueCycles).not.toHaveBeenCalled();
  });

  it("returns 401 when CRON_SECRET is not configured", async () => {
    mutableConfig.cronSecret = "";
    const req = makeRequest("Bearer anything");
    const res = await GET(req);

    expect(res.status).toBe(401);
    expect(mockProcessDueCycles).not.toHaveBeenCalled();
  });

  it("returns 401 when Authorization header has no Bearer prefix", async () => {
    const req = makeRequest(VALID_SECRET); // missing "Bearer "
    const res = await GET(req);

    expect(res.status).toBe(401);
    expect(mockProcessDueCycles).not.toHaveBeenCalled();
  });
});
