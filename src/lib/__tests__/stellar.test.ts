import { Account } from "@stellar/stellar-sdk";
import {
  getUsdcBalance,
  hasUsdcTrustline,
  horizonServer,
  sendUsdcPayment,
  validateStellarRecipient,
  getCurrentBaseFee,
  calculatePriorityFee,
} from "../stellar";
import logger from "../logger";

// Mock the logger to keep test output clean
jest.mock("../logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// Mock the serverConfig
jest.mock("@/server/config", () => ({
  serverConfig: {
    stellar: {
      horizonUrl: "https://horizon-testnet.stellar.org",
      network: "testnet",
      serverSecretKey: "SA3JUJWMEM6TJAAFUZDARKE4WFJHWJKEDU6CW4AULPRNU6VL7PPXKVMZ", // Mock key
    },
    usdc: {
      assetCode: "USDC",
      issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
      slippageTolerancePercent: 0.5,
    },
  },
}));

describe("sendUsdcPayment retry logic", () => {
  const destination = "GCBVPTGYLOELZOOOLS4W765VOL3CCXWCTTTGWIYSAFPRLJLRG6VWAEB5";
  const amount = "10.0000000";
  const _mockAccountFn = () => new Account(destination, "1");

  beforeEach(() => {
    jest.clearAllMocks();
    // Shorten the timeout for tests
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("succeeds on the first attempt", async () => {
    const mockAccount = {
      sequenceNumber: () => "1",
      accountId: () => "GCBVPTGYLOELZOOOLS4W765VOL3CCXWCTTTGWIYSAFPRLJLRG6VWAEB5",
      incrementSequenceNumber: () => {},
      balances: [{ asset_type: "credit_alphanum4", asset_code: "USDC", asset_issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5", balance: "100.0000000" }],
    };
    (horizonServer.loadAccount as jest.Mock) = jest.fn().mockResolvedValue(mockAccount);
    (horizonServer.submitTransaction as jest.Mock) = jest.fn().mockResolvedValue({ hash: "success-hash" });

    const promise = sendUsdcPayment(destination, amount);
    const hash = await promise;

    expect(hash).toBe("success-hash");
    expect(horizonServer.loadAccount).toHaveBeenCalledTimes(1);
    expect(horizonServer.submitTransaction).toHaveBeenCalledTimes(1);
  });

  it("retries on transient failure and eventually succeeds", async () => {
    const mockAccount = {
      sequenceNumber: () => "1",
      accountId: () => "GCBVPTGYLOELZOOOLS4W765VOL3CCXWCTTTGWIYSAFPRLJLRG6VWAEB5",
      incrementSequenceNumber: () => {},
      balances: [{ asset_type: "credit_alphanum4", asset_code: "USDC", asset_issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5", balance: "100.0000000" }],
    };
    (horizonServer.loadAccount as jest.Mock) = jest.fn().mockResolvedValue(mockAccount);
    
    // First attempt fails with 503
    const error503: any = new Error("Service Unavailable");
    error503.response = { status: 503 };

    (horizonServer.submitTransaction as jest.Mock) = jest
      .fn()
      .mockRejectedValueOnce(error503)
      .mockResolvedValueOnce({ hash: "retry-success-hash" });

    const promise = sendUsdcPayment(destination, amount);

    // Fast-forward through the backoff
    await jest.runAllTimersAsync();

    const hash = await promise;

    expect(hash).toBe("retry-success-hash");
    expect(horizonServer.loadAccount).toHaveBeenCalledTimes(2);
    expect(horizonServer.submitTransaction).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ attempt: 1, delay: 500 }),
      expect.stringContaining("retrying in 500ms")
    );
  });

  it("stops retrying on fatal error (tx_bad_seq)", async () => {
    const mockAccount = {
      sequenceNumber: () => "1",
      accountId: () => "GCBVPTGYLOELZOOOLS4W765VOL3CCXWCTTTGWIYSAFPRLJLRG6VWAEB5",
      incrementSequenceNumber: () => {},
      balances: [{ asset_type: "credit_alphanum4", asset_code: "USDC", asset_issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5", balance: "100.0000000" }],
    };
    (horizonServer.loadAccount as jest.Mock) = jest.fn().mockResolvedValue(mockAccount);
    
    const errorBadSeq: any = new Error("Transaction Failed");
    errorBadSeq.response = {
      status: 400,
      data: { extras: { result_codes: { transaction: "tx_bad_seq" } } },
    };

    (horizonServer.submitTransaction as jest.Mock) = jest.fn().mockRejectedValue(errorBadSeq);

    await expect(sendUsdcPayment(destination, amount)).rejects.toThrow("Transaction Failed");

    // Should NOT retry fatal errors
    expect(horizonServer.loadAccount).toHaveBeenCalledTimes(1);
    expect(horizonServer.submitTransaction).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ fatal: true }),
      expect.stringContaining("failed permanently")
    );
  });

  it("exhausts retries on persistent transient failures", async () => {
    const mockAccount = {
      sequenceNumber: () => "1",
      accountId: () => "GCBVPTGYLOELZOOOLS4W765VOL3CCXWCTTTGWIYSAFPRLJLRG6VWAEB5",
      incrementSequenceNumber: () => {},
      balances: [{ asset_type: "credit_alphanum4", asset_code: "USDC", asset_issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5", balance: "100.0000000" }],
    };
    (horizonServer.loadAccount as jest.Mock) = jest.fn().mockResolvedValue(mockAccount);
    
    const errorTimeout: any = new Error("Network timeout");
    errorTimeout.response = { status: 504 };

    (horizonServer.submitTransaction as jest.Mock) = jest.fn().mockRejectedValue(errorTimeout);

    const promise = sendUsdcPayment(destination, amount);
    const assertion = expect(promise).rejects.toThrow("Network timeout");
    
    // Run all retries
    for (let i = 0; i < 3; i++) {
      await jest.runAllTimersAsync();
    }
    
    await assertion;
    
    // Initial + 3 retries = 4 attempts
    expect(horizonServer.loadAccount).toHaveBeenCalledTimes(4);
    expect(horizonServer.submitTransaction).toHaveBeenCalledTimes(4);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ attempt: 4, fatal: false }),
      expect.stringContaining("failed permanently")
    );
  });
});

describe("USDC trustline checks", () => {
  const publicKey = "GDNIKPB2TPPS2RZG6TDW76YFSPNVEINVTJIPVEPA25Y74TPSLBNOA336";
  const usdcBalance = {
    asset_type: "credit_alphanum4",
    asset_code: "USDC",
    asset_issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    balance: "42.0000000",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("detects the configured USDC trustline", () => {
    expect(
      hasUsdcTrustline({ balances: [{ asset_type: "native", balance: "5" }, usdcBalance] })
    ).toBe(true);
    expect(hasUsdcTrustline({ balances: [{ asset_type: "native", balance: "5" }] })).toBe(false);
  });

  it("returns balance and trustline status for a funded USDC account", async () => {
    (horizonServer.loadAccount as jest.Mock) = jest
      .fn()
      .mockResolvedValue({ balances: [usdcBalance] });

    await expect(getUsdcBalance(publicKey)).resolves.toEqual({
      balance: "42.0000000",
      hasTrustline: true,
    });
  });

  it("returns a zero balance and no trustline for missing accounts", async () => {
    (horizonServer.loadAccount as jest.Mock) = jest.fn().mockRejectedValue(new Error("not found"));

    await expect(getUsdcBalance(publicKey)).resolves.toEqual({
      balance: "0",
      hasTrustline: false,
    });
  });

  it("validates a Stellar recipient before payouts", async () => {
    (horizonServer.loadAccount as jest.Mock) = jest
      .fn()
      .mockResolvedValue({ balances: [usdcBalance] });

    await expect(validateStellarRecipient(publicKey)).resolves.toBeUndefined();
    expect(horizonServer.loadAccount).toHaveBeenCalledWith(publicKey);
  });

  it("rejects recipients that have no configured USDC trustline", async () => {
    (horizonServer.loadAccount as jest.Mock) = jest.fn().mockResolvedValue({
      balances: [{ asset_type: "native", balance: "5" }],
    });

    await expect(validateStellarRecipient(publicKey)).rejects.toThrow(
      "Recipient account has no USDC trustline"
    );
  });

  it("rejects invalid Stellar public keys before Horizon lookup", async () => {
    (horizonServer.loadAccount as jest.Mock) = jest.fn();

    await expect(validateStellarRecipient("not-a-stellar-key")).rejects.toThrow(
      "Invalid Stellar public key"
    );
    expect(horizonServer.loadAccount).not.toHaveBeenCalled();
  });

  it("calculates a capped priority fee correctly", () => {
    expect(calculatePriorityFee(100)).toBe(200);
    expect(calculatePriorityFee(150)).toBe(300);
  });

  it("uses the configured cap when lower than priority fee", () => {
    const { serverConfig } = require("@/server/config");
    const originalCap = serverConfig.stellar.maxFeeCap;
    serverConfig.stellar.maxFeeCap = 120;

    expect(calculatePriorityFee(100)).toBe(120);

    serverConfig.stellar.maxFeeCap = originalCap;
  });

  it("fetches base fee from Horizon fee stats", async () => {
    (horizonServer.feeStats as jest.Mock) = jest.fn().mockResolvedValue({
      fee_charged: { mode: "123", min: "100", p50: "110" },
    });

    await expect(getCurrentBaseFee()).resolves.toBe(123);
  });

  it("falls back to BASE_FEE on fee stats failures", async () => {
    (horizonServer.feeStats as jest.Mock) = jest.fn().mockRejectedValue(new Error("Horizon down"));
    await expect(getCurrentBaseFee()).resolves.toBe(100);
  });
});

describe("sendUsdcPayment pathfinding fallback", () => {
  const destination = "GCBVPTGYLOELZOOOLS4W765VOL3CCXWCTTTGWIYSAFPRLJLRG6VWAEB5";
  const amount = "10.0000000";

  const mockAccountWithBalance = (usdcBalance: string) => ({
    sequenceNumber: () => "1",
    accountId: () => destination,
    incrementSequenceNumber: () => {},
    balances: [
      {
        asset_type: "credit_alphanum4",
        asset_code: "USDC",
        asset_issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
        balance: usdcBalance,
      },
    ],
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("uses direct payment when USDC balance is sufficient", async () => {
    (horizonServer.loadAccount as jest.Mock) = jest
      .fn()
      .mockResolvedValue(mockAccountWithBalance("50.0000000"));
    (horizonServer.submitTransaction as jest.Mock) = jest
      .fn()
      .mockResolvedValue({ hash: "direct-hash" });

    const hash = await sendUsdcPayment(destination, amount);

    expect(hash).toBe("direct-hash");
    const tx = (horizonServer.submitTransaction as jest.Mock).mock.calls[0][0];
    const op = tx.operations[0];
    expect(op.type).toBe("payment");
  });

  it("falls back to pathPaymentStrictSend when USDC balance is insufficient", async () => {
    (horizonServer.loadAccount as jest.Mock) = jest
      .fn()
      .mockResolvedValue(mockAccountWithBalance("1.0000000")); // less than 10
    (horizonServer.submitTransaction as jest.Mock) = jest
      .fn()
      .mockResolvedValue({ hash: "path-hash" });

    const hash = await sendUsdcPayment(destination, amount);

    expect(hash).toBe("path-hash");
    const tx = (horizonServer.submitTransaction as jest.Mock).mock.calls[0][0];
    const op = tx.operations[0];
    expect(op.type).toBe("pathPaymentStrictSend");
    expect(op.destAsset.code).toBe("USDC");
    // destMin should be amount * (1 - 0.005) = 9.9500000
    expect(parseFloat(op.destMin)).toBeCloseTo(9.95, 4);
  });

  it("logs a low liquidity warning when balance < 2x amount", async () => {
    (horizonServer.loadAccount as jest.Mock) = jest
      .fn()
      .mockResolvedValue(mockAccountWithBalance("15.0000000")); // < 20 (2x10)
    (horizonServer.submitTransaction as jest.Mock) = jest
      .fn()
      .mockResolvedValue({ hash: "low-liq-hash" });

    await sendUsdcPayment(destination, amount);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ balance: 15, amount }),
      expect.stringContaining("Low USDC liquidity")
    );
  });

  it("logs a warning and uses path payment when balance is zero", async () => {
    (horizonServer.loadAccount as jest.Mock) = jest
      .fn()
      .mockResolvedValue(mockAccountWithBalance("0.0000000"));
    (horizonServer.submitTransaction as jest.Mock) = jest
      .fn()
      .mockResolvedValue({ hash: "zero-path-hash" });

    const hash = await sendUsdcPayment(destination, amount);

    expect(hash).toBe("zero-path-hash");
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ balance: 0 }),
      expect.stringContaining("Insufficient USDC")
    );
  });
});
