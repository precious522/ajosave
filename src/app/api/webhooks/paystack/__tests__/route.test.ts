/**
 * @jest-environment node
 */
import { POST } from "@/app/api/webhooks/paystack/route";
import { NextRequest } from "next/server";
import { createHmac } from "crypto";

jest.mock("@/lib/db", () => ({
  query: jest.fn(),
  transaction: jest.fn((cb) => cb(jest.fn())),
}));
jest.mock("@/server/config", () => ({
  serverConfig: { paystack: { secretKey: "test-secret" } },
}));
jest.mock("@/lib/logger", () => ({
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
}));

import * as db from "@/lib/db";
const mockQuery = db.query as jest.MockedFunction<typeof db.query>;
const mockTransaction = db.transaction as jest.MockedFunction<typeof db.transaction>;

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
  id: "evt_123",
  event: "charge.success",
  data: { reference: "ajo-circle-1-member-1-2" },
};

beforeEach(() => jest.clearAllMocks());

describe("POST /api/webhooks/paystack", () => {
  it("returns 401 for invalid signature", async () => {
    const req = makeRequest(CHARGE_SUCCESS, "badsignature");
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 200 and skips non-charge.success events", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // processed_webhooks check
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // record non-success event

    const req = makeRequest({ id: "evt_456", event: "transfer.success", data: {} });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.received).toBe(true);
    
    // Should check if already processed
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("FROM processed_webhooks"),
      ["evt_456"]
    );
    // Should record the non-success event
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO processed_webhooks"),
      ["evt_456", "transfer.success", expect.any(Object)]
    );
  });

  it("returns 400 when reference is missing", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // processed_webhooks check
    const req = makeRequest({ id: "evt_789", event: "charge.success", data: {} });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("confirms contribution on charge.success using paystack_reference", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // processed_webhooks check
    
    const mockTxQuery = jest.fn()
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // insert processed_webhooks
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // update contributions
    
    mockTransaction.mockImplementationOnce(async (cb) => cb(mockTxQuery));

    const req = makeRequest(CHARGE_SUCCESS);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.received).toBe(true);

    // Initial check
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("FROM processed_webhooks"),
      ["evt_123"]
    );

    // Transactional steps
    expect(mockTxQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO processed_webhooks"),
      ["evt_123", "charge.success", expect.any(Object)]
    );
    expect(mockTxQuery).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE contributions"),
      ["ajo-circle-1-member-1-2"]
    );
  });

  it("returns duplicate:true and skips update for already-processed event ID", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "evt_123" }], rowCount: 1 } as any);

    const req = makeRequest(CHARGE_SUCCESS);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.duplicate).toBe(true);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INTERVAL '24 HOURS'"),
      ["evt_123"]
    );
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("marks contribution as failed on charge.failed", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

    const req = makeRequest({ event: "charge.failed", data: { reference: "ajo-circle-1-member-1-2" } });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("status = 'failed'"),
      ["ajo-circle-1-member-1-2"]
    );
  });
});
