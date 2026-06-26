/**
 * @jest-environment node
 */
import { GET } from "@/app/api/stellar/fee/route";
import { NextRequest } from "next/server";

jest.mock("@/lib/stellar", () => ({
  getCurrentBaseFee: jest.fn().mockResolvedValue(100),
  calculatePriorityFee: jest.fn().mockReturnValue(200),
}));

jest.mock("@/server/config", () => ({
  serverConfig: {
    stellar: { maxFeeCap: 200 },
  },
}));

describe("GET /api/stellar/fee", () => {
  it("returns current base fee and priority fee", async () => {
    const request = new NextRequest("http://localhost/api/stellar/fee");
    const response = await GET(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({
      success: true,
      data: {
        baseFee: 100,
        priorityFee: 200,
        maxFeeCap: 200,
      },
    });
  });
});
