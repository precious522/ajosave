import { POST } from "@/app/api/webhooks/paystack/route";
import { NextRequest } from "next/server";
import { createHmac } from "crypto";

jest.mock("@/lib/db");
jest.mock("@/server/config", () => ({
  serverConfig: { paystack: { secretKey: "test-secret" } },
}));

import * as db from "@/lib/db";
const mockQuery = db.query as jest.MockedFunction<typeof db.query>;

const SECRET = "test-secret";

function makeRequest(body: object, signature?: string): NextRequest {
  const raw = JSON.stringify(body);
  const sig =
    signature ??
    createHmac("sha512", SECRET).update(raw).digest("hex");
  return new NextRequest("http://localhost/api/webhooks/paystack", {
    method: "POST",
    headers: { "x-paystack-signature": sig, "content-type": "application/json" },
    body: raw,
  });
}

const CHARGE_SUCCESS = {
  event: "charge.success",
  data: { reference: "ref_abc123" },
};

beforeEach(() => jest.clearAllMocks());

describe("POST /api/webhooks/paystack", () => {
  it("returns 401 for invalid signature", async () => {
    const req = makeRequest(CHARGE_SUCCESS, "badsignature");
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 200 and skips non-charge.success events", async () => {
    const req = makeRequest({ event: "transfer.success", data: {} });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.received).toBe(true);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("returns 400 when reference is missing", async () => {
    const req = makeRequest({ event: "charge.success", data: {} });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("confirms contribution on charge.success", async () => {
    // First query: idempotency check returns no rows
    // Second query: update contribution
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

    const req = makeRequest(CHARGE_SUCCESS);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.received).toBe(true);

    // Idempotency check
    expect(mockQuery).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("SELECT id FROM contributions"),
      ["ref_abc123"]
    );
    // Confirm contribution
    expect(mockQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("UPDATE contributions"),
      ["ref_abc123"]
    );
  });

  it("returns duplicate:true and skips update for already-processed reference", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "contrib-1" }], rowCount: 1 } as any);

    const req = makeRequest(CHARGE_SUCCESS);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.duplicate).toBe(true);
    // Only the idempotency SELECT, no UPDATE
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });
});
