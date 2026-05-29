import {
  Horizon,
  Keypair,
  Asset,
  TransactionBuilder,
  Operation,
  BASE_FEE,
  Networks,
  StrKey,
} from "@stellar/stellar-sdk";
import { serverConfig } from "@/server/config";
import logger from "@/lib/logger";


const server = new Horizon.Server(serverConfig.stellar.horizonUrl);
const USDC = new Asset(serverConfig.usdc.assetCode, serverConfig.usdc.issuer);
const networkPassphrase =
  serverConfig.stellar.network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;

type StellarBalance = {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  balance: string;
};

type StellarAccountWithBalances = {
  balances: StellarBalance[];
};

export function hasUsdcTrustline(account: StellarAccountWithBalances): boolean {
  return account.balances.some(
    (balance) =>
      balance.asset_type !== "native" &&
      balance.asset_code === USDC.getCode() &&
      balance.asset_issuer === USDC.getIssuer()
  );
}

/** Error codes that are safe to retry (transient). */
function isRetryable(err: any): boolean {
  // 1. Check Horizon response status codes
  const status = err.response?.status;
  if (status === 429 || (status >= 500 && status <= 504)) {
    return true;
  }

  // 2. Check for specific Stellar transaction result codes
  const resultCodes = err.response?.data?.extras?.result_codes;
  if (resultCodes) {
    // tx_bad_seq is explicitly NOT retryable as per requirements (fatal sequence mismatch)
    if (resultCodes.transaction === "tx_bad_seq") return false;

    // Most other transaction/operation failures (underfunded, etc.) are fatal
    // and shouldn't be retried blindly.
  }

  // 3. Fallback to message checking for network-level errors (no response)
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (
      msg.includes("network") ||
      msg.includes("503") ||
      msg.includes("timeout") ||
      msg.includes("deadline") ||
      msg.includes("connection")
    ) {
      return true;
    }
  }

  return false;
}


/**
 * Send USDC to `destination`.
 *
 * Issue #19: retries up to 3 times with exponential backoff on transient errors.
 * Issue #20: `loadAccount` is called inside the retry loop so each attempt uses
 *            a fresh sequence number — preventing tx_bad_seq on concurrent payouts.
 */
export async function sendUsdcPayment(destination: string, amount: string): Promise<string> {
  const keypair = Keypair.fromSecret(serverConfig.stellar.serverSecretKey);
  const MAX_ATTEMPTS = 4; // Initial attempt + 3 retries

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      // Fetch fresh account (and sequence number) on every attempt to prevent stale sequences
      const account = await server.loadAccount(keypair.publicKey());

      const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase })
        .addOperation(Operation.payment({ destination, asset: USDC, amount }))
        .setTimeout(30)
        .build();

      tx.sign(keypair);
      const result = await server.submitTransaction(tx);
      
      if (attempt > 1) {
        logger.info({ attempt, destination, hash: result.hash }, "[stellar] sendUsdcPayment succeeded after retry");
      }
      
      return result.hash;
    } catch (err) {
      const retryable = isRetryable(err);
      const willRetry = retryable && attempt < MAX_ATTEMPTS;

      if (!willRetry) {
        logger.error(
          { err, destination, amount, attempt, fatal: !retryable },
          "[stellar] sendUsdcPayment failed permanently"
        );
        throw err;
      }

      const delay = 500 * 2 ** (attempt - 1);
      logger.warn(
        { err, attempt, delay, destination },
        `[stellar] sendUsdcPayment attempt ${attempt} failed; retrying in ${delay}ms...`
      );

      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw new Error("sendUsdcPayment: exhausted retries");
}


/**
 * Issue #17: Returns balance AND trustline existence for USDC on the given account.
 */
export async function getUsdcBalance(
  publicKey: string
): Promise<{ balance: string; hasTrustline: boolean }> {
  try {
    const account = await server.loadAccount(publicKey);
    const bal = account.balances.find(
      (b) =>
        b.asset_type !== "native" &&
        (b as { asset_code: string; asset_issuer: string }).asset_code === USDC.getCode() &&
        (b as { asset_code: string; asset_issuer: string }).asset_issuer === USDC.getIssuer()
    );
    return { balance: bal?.balance ?? "0", hasTrustline: !!bal };
  } catch {
    return { balance: "0", hasTrustline: false };
  }
}

/**
 * Validate a Stellar public key, on-chain account existence, and configured USDC trustline.
 */
export async function validateStellarRecipient(publicKey: string): Promise<void> {
  if (!StrKey.isValidEd25519PublicKey(publicKey)) {
    throw new Error(`Invalid Stellar public key: ${publicKey}`);
  }

  let account: StellarAccountWithBalances;
  try {
    account = await server.loadAccount(publicKey);
  } catch {
    throw new Error(`Stellar account not found on-chain: ${publicKey}`);
  }

  if (!hasUsdcTrustline(account)) {
    throw new Error(`Recipient account has no USDC trustline: ${publicKey}`);
  }
}

export { server as horizonServer, USDC, networkPassphrase };
