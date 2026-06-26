/**
 * @jest-environment node
 */
import { POST } from "@/app/api/v1/webhooks/paystack/route";
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
  return new NextRequest("http://localhost/api/v1/webhooks/paystack", {
    method: "POST",
    headers: { "x-paystack-signature": sig, "content-type": "application/json" },
    body: raw,
  });
}

const CHARGE_SUCCESS = {
  id: "evt_123",
  event: "charge.success",
  data: {
    reference: "ajo-circle-1-member-1-2",
  },
};

beforeEach(() => jest.clearAllMocks());

describe("POST /api/v1/webhooks/paystack", () => {
  it("returns 401 for invalid signature", async () => {
    const req = makeRequest(CHARGE_SUCCESS, "badsignature");
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when event ID is missing", async () => {
    const req = makeRequest({ event: "charge.success", data: {} });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 200 and skips non-charge.success events", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // processed_webhooks check
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // insert non-success event

    const req = makeRequest({ id: "evt_456", event: "transfer.success", data: {} });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.received).toBe(true);

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("FROM processed_webhooks"),
      ["evt_456"]
    );
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

  it("returns duplicate:true and skips update for already-processed event ID", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "evt_123" }], rowCount: 1 } as any);

    const req = makeRequest(CHARGE_SUCCESS);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.duplicate).toBe(true);
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("confirms contribution on charge.success (full payment)", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // processed_webhooks check

    const mockTxQuery = jest.fn()
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // insert processed_webhooks
      .mockResolvedValueOnce({
        rows: [{ id: "contrib-1", amount_usdc: "10.0000000", amount_paid_usdc: "0.0000000", is_partial: false }],
        rowCount: 1,
      } as any) // SELECT contribution
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // UPDATE contribution

    mockTransaction.mockImplementationOnce(async (cb) => cb(mockTxQuery));

    const req = makeRequest(CHARGE_SUCCESS);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.received).toBe(true);

    expect(mockTxQuery).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("INSERT INTO processed_webhooks"),
      ["evt_123", "charge.success", expect.any(Object)]
    );
    expect(mockTxQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("FROM contributions WHERE"),
      ["ajo-circle-1-member-1-2"]
    );
    expect(mockTxQuery).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("UPDATE contributions"),
      ["10.0000000", "confirmed", "ajo-circle-1-member-1-2", "contrib-1"]
    );
  });

  it("updates contribution but remains pending on partial payment", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // processed_webhooks check

    const mockTxQuery = jest.fn()
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // insert processed_webhooks
      .mockResolvedValueOnce({
        rows: [{ id: "contrib-1", amount_usdc: "10.0000000", amount_paid_usdc: "2.0000000", is_partial: true }],
        rowCount: 1,
      } as any) // SELECT contribution
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // UPDATE contribution

    mockTransaction.mockImplementationOnce(async (cb) => cb(mockTxQuery));

    const payload = {
      ...CHARGE_SUCCESS,
      data: {
        ...CHARGE_SUCCESS.data,
        metadata: {
          payUsdc: "3.5000000",
        },
      },
    };

    const req = makeRequest(payload);
    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockTxQuery).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("UPDATE contributions"),
      ["5.5000000", "pending", "ajo-circle-1-member-1-2", "contrib-1"]
    );
  });

  it("caps at full amount on overpayment", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // processed_webhooks check

    const mockTxQuery = jest.fn()
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // insert processed_webhooks
      .mockResolvedValueOnce({
        rows: [{ id: "contrib-1", amount_usdc: "10.0000000", amount_paid_usdc: "8.0000000", is_partial: true }],
        rowCount: 1,
      } as any) // SELECT contribution
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // UPDATE contribution

    mockTransaction.mockImplementationOnce(async (cb) => cb(mockTxQuery));

    const payload = {
      ...CHARGE_SUCCESS,
      data: {
        ...CHARGE_SUCCESS.data,
        metadata: {
          payUsdc: "5.0000000",
        },
      },
    };

    const req = makeRequest(payload);
    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockTxQuery).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("UPDATE contributions"),
      ["10.0000000", "confirmed", "ajo-circle-1-member-1-2", "contrib-1"]
    );
  });
});
