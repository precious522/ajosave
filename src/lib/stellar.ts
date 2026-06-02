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

function makeServer(url: string) { return new Horizon.Server(url); }

const primaryServer = makeServer(serverConfig.stellar.horizonUrl);
const fallbackServer = serverConfig.stellar.horizonFallbackUrl
  ? makeServer(serverConfig.stellar.horizonFallbackUrl)
  : null;

/** Returns the active Horizon server, failing over to secondary on error. */
async function withFallback<T>(fn: (s: Horizon.Server) => Promise<T>): Promise<T> {
  try {
    return await fn(primaryServer);
  } catch (err) {
    if (!fallbackServer) throw err;
    logger.warn({ err, fallback: serverConfig.stellar.horizonFallbackUrl }, "[stellar] Primary Horizon failed, switching to fallback");
    return fn(fallbackServer);
  }
}

export async function checkHorizonHealth(): Promise<boolean> {
  try { await withFallback((s) => s.loadAccount("GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN")); return true; }
  catch { return false; }
}

const USDC = new Asset(serverConfig.usdc.assetCode, serverConfig.usdc.issuer);
const networkPassphrase =
  serverConfig.stellar.network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;

// Keep backward-compat export
const server = primaryServer;

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

export async function getCurrentBaseFee(): Promise<number> {
  try {
    const fees = await server.feeStats();
    const candidate = Number(
      fees.fee_charged?.mode ?? fees.fee_charged?.min ?? fees.fee_charged?.p50 ?? BASE_FEE
    );
    if (Number.isFinite(candidate) && candidate > 0) {
      return candidate;
    }
  } catch (err) {
    logger.warn({ err }, "[stellar] failed to fetch current base fee from Horizon; using default");
  }
  return Number(BASE_FEE);
}

export function calculatePriorityFee(baseFee: number): number {
  const cap = Number.isFinite(serverConfig.stellar.maxFeeCap)
    ? serverConfig.stellar.maxFeeCap
    : Number.MAX_SAFE_INTEGER;
  const desired = baseFee * 2;
  const fee = Math.min(desired, cap);
  return fee < baseFee ? baseFee : fee;
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
    // tx_bad_seq is retryable because we fetch a fresh sequence number on each attempt
    if (resultCodes.transaction === "tx_bad_seq") return true;
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
  const MAX_ATTEMPTS = 4;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const account = await withFallback((s) => s.loadAccount(keypair.publicKey()));

      const tx = new TransactionBuilder(account, { fee, networkPassphrase })
        .addOperation(Operation.payment({ destination, asset: USDC, amount }))
        .setTimeout(30)
        .build();

      tx.sign(keypair);
      const result = await withFallback((s) => s.submitTransaction(tx));
      
      if (attempt > 1) {
        logger.info({ attempt, destination, hash: result.hash, baseFee, fee }, "[stellar] sendUsdcPayment succeeded after retry");
      } else {
        logger.info({ destination, hash: result.hash, baseFee, fee }, "[stellar] sendUsdcPayment succeeded");
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
    const account = await withFallback((s) => s.loadAccount(publicKey));
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
    account = await withFallback((s) => s.loadAccount(publicKey));
  } catch {
    throw new Error(`Stellar account not found on-chain: ${publicKey}`);
  }

  if (!hasUsdcTrustline(account)) {
    throw new Error(`Recipient account has no USDC trustline: ${publicKey}`);
  }
}

export { server as horizonServer, USDC, networkPassphrase };

// ─── Concurrent transaction queue ─────────────────────────────────────────────
// Serialises outbound transactions from the server keypair so concurrent callers
// never race on the same sequence number.
let _txQueue: Promise<unknown> = Promise.resolve();

export function enqueueStellarTransaction<T>(fn: () => Promise<T>): Promise<T> {
  const next = _txQueue.then(() => fn()).catch(() => fn()); // retry once on queue error
  _txQueue = next.catch(() => {}); // keep queue alive even if fn throws
  return next as Promise<T>;
}
