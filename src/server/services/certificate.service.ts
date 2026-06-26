import { contract, Keypair, Networks } from "@stellar/stellar-sdk";
import { query } from "@/lib/db";
import { serverConfig } from "@/server/config";
import logger from "@/lib/logger";

export interface Certificate {
  circleId: string;
  circleName: string;
  memberAddress: string;
  cyclesCompleted: number;
  totalSavedUsdc: string;
  txHash: string;
  issuedAt: Date;
}

const networkPassphrase =
  serverConfig.stellar.network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;

/**
 * Mint a completion certificate on-chain via the Soroban certificate contract,
 * then persist the record to PostgreSQL for fast profile queries.
 *
 * Idempotent: the contract ignores duplicate mints; the DB upsert is also safe.
 */
export async function mintCertificate(params: {
  memberStellarKey: string;
  circleId: string;
  circleName: string;
  cyclesCompleted: number;
  totalSavedUsdc: string;
}): Promise<void> {
  const contractId = serverConfig.stellar.certificateContractId;
  if (!contractId) {
    logger.warn("STELLAR_CERTIFICATE_CONTRACT_ID not set — skipping certificate mint");
    return;
  }

  const keypair = Keypair.fromSecret(serverConfig.stellar.serverSecretKey);
  const signer = contract.basicNodeSigner(keypair, networkPassphrase);

  const client = await contract.Client.from({
    contractId,
    networkPassphrase,
    rpcUrl: serverConfig.stellar.sorobanRpcUrl,
    publicKey: keypair.publicKey(),
    ...signer,
  });

  // circle_id on-chain is BytesN<32> — pad/hash the UUID to 32 bytes
  const circleIdBytes = Buffer.alloc(32);
  Buffer.from(params.circleId.replace(/-/g, ""), "hex").copy(circleIdBytes);

  // total_saved_usdc in stroops (multiply by 10^7)
  const totalSavedStroops = BigInt(
    Math.round(parseFloat(params.totalSavedUsdc) * 10_000_000)
  );

  let txHash = "";
  try {
    // @ts-expect-error — method generated from contract ABI at runtime
    const assembled = await client.mint({
      member: params.memberStellarKey,
      circle_id: circleIdBytes,
      circle_name: params.circleName,
      cycles_completed: params.cyclesCompleted,
      total_saved_usdc: totalSavedStroops,
    });
    const sent = await assembled.send();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    txHash = (sent as any).hash ?? (sent as any).sendTransactionResponse?.hash ?? "";
    logger.info({ txHash, ...params }, "certificate minted on-chain");
  } catch (err) {
    logger.error({ err, ...params }, "certificate mint failed — persisting DB record only");
  }

  // Persist to DB regardless of on-chain result (allows retry / display without RPC)
  await query(
    `INSERT INTO certificates
       (circle_id, circle_name, member_stellar_key, cycles_completed, total_saved_usdc, tx_hash, issued_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (circle_id, member_stellar_key) DO NOTHING`,
    [
      params.circleId,
      params.circleName,
      params.memberStellarKey,
      params.cyclesCompleted,
      params.totalSavedUsdc,
      txHash || null,
    ]
  );
}

/**
 * Fetch all certificates for a user by their Stellar public key.
 */
export async function getCertificatesByUser(stellarPublicKey: string): Promise<Certificate[]> {
  const { rows } = await query<{
    circle_id: string;
    circle_name: string;
    member_stellar_key: string;
    cycles_completed: number;
    total_saved_usdc: string;
    tx_hash: string;
    issued_at: Date;
  }>(
    `SELECT circle_id, circle_name, member_stellar_key, cycles_completed,
            total_saved_usdc, tx_hash, issued_at
     FROM certificates
     WHERE member_stellar_key = $1
     ORDER BY issued_at DESC`,
    [stellarPublicKey]
  );

  return rows.map((r) => ({
    circleId: r.circle_id,
    circleName: r.circle_name,
    memberAddress: r.member_stellar_key,
    cyclesCompleted: r.cycles_completed,
    totalSavedUsdc: r.total_saved_usdc,
    txHash: r.tx_hash,
    issuedAt: r.issued_at,
  }));
}
