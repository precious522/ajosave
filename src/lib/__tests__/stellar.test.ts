import { sendUsdcPayment, horizonServer } from "../stellar";
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
    },
  },
}));

describe("sendUsdcPayment retry logic", () => {
  const destination = "GCBVPTGYLOELZOOOLS4W765VOL3CCXWCTTTGWIYSAFPRLJLRG6VWAEB5";
  const amount = "10.0000000";

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
    };
    (horizonServer.loadAccount as jest.Mock) = jest.fn().mockResolvedValue(mockAccount);
    
    // First attempt fails with 503
    const error503: any = new Error("Service Unavailable");
    error503.response = { status: 503 };
    
    (horizonServer.submitTransaction as jest.Mock) = jest.fn()
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
    };
    (horizonServer.loadAccount as jest.Mock) = jest.fn().mockResolvedValue(mockAccount);
    
    const errorBadSeq: any = new Error("Transaction Failed");
    errorBadSeq.response = { 
      status: 400,
      data: { extras: { result_codes: { transaction: "tx_bad_seq" } } }
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
