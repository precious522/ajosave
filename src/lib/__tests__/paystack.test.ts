/**
 * @jest-environment node
 */

jest.mock("axios", () => ({
  create: jest.fn(() => ({
    post: jest.fn(),
    get: jest.fn(),
    interceptors: { request: { use: jest.fn() } },
  })),
}));
jest.mock("@/server/config", () => ({
  serverConfig: { paystack: { secretKey: "sk_test_secret" } },
}));

import axios from "axios";
import { initializePayment, verifyPayment } from "@/lib/paystack";

// The axios client created at module load time
const mockClient = (axios.create as jest.Mock).mock.results[0].value as {
  post: jest.Mock;
  get: jest.Mock;
};

beforeEach(() => jest.clearAllMocks());

describe("initializePayment", () => {
  const params = {
    email: "user@test.com",
    amount: 5000,
    currency: "NGN" as const,
    reference: "ajo-circle-1-member-1-2",
    callbackUrl: "https://ajosave.app/callback",
  };

  it("calls Paystack initialize endpoint and returns authorizationUrl + reference", async () => {
    mockClient.post.mockResolvedValue({
      data: {
        data: {
          authorization_url: "https://paystack.com/pay/abc123",
          reference: params.reference,
        },
      },
    });

    const result = await initializePayment(params);

    expect(mockClient.post).toHaveBeenCalledWith(
      "/transaction/initialize",
      expect.objectContaining({
        email: params.email,
        amount: 500000, // 5000 NGN → kobo
        currency: "NGN",
        reference: params.reference,
        callback_url: params.callbackUrl,
      })
    );
    expect(result).toEqual({
      authorizationUrl: "https://paystack.com/pay/abc123",
      reference: params.reference,
    });
  });

  it("converts amount to smallest unit (kobo for NGN)", async () => {
    mockClient.post.mockResolvedValue({
      data: { data: { authorization_url: "https://paystack.com/pay/x", reference: "ref" } },
    });

    await initializePayment({ ...params, amount: 1000, currency: "NGN" });

    expect(mockClient.post).toHaveBeenCalledWith(
      "/transaction/initialize",
      expect.objectContaining({ amount: 100000 }) // 1000 * 100
    );
  });

  it("propagates Paystack API errors", async () => {
    mockClient.post.mockRejectedValue(new Error("Network error"));
    await expect(initializePayment(params)).rejects.toThrow("Network error");
  });
});

describe("verifyPayment", () => {
  it("returns success status and amount for a successful payment", async () => {
    mockClient.get.mockResolvedValue({
      data: {
        data: { status: "success", amount: 500000, currency: "NGN" },
      },
    });

    const result = await verifyPayment("ajo-circle-1-member-1-2");

    expect(mockClient.get).toHaveBeenCalledWith(
      "/transaction/verify/ajo-circle-1-member-1-2"
    );
    expect(result).toEqual({ status: "success", amount: 500000, currency: "NGN" });
  });

  it("returns failed status for a failed payment", async () => {
    mockClient.get.mockResolvedValue({
      data: { data: { status: "failed", amount: 500000, currency: "NGN" } },
    });

    const result = await verifyPayment("ref-failed");
    expect(result.status).toBe("failed");
  });

  it("propagates Paystack API errors", async () => {
    mockClient.get.mockRejectedValue(new Error("Unauthorized"));
    await expect(verifyPayment("bad-ref")).rejects.toThrow("Unauthorized");
  });
});
