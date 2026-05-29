/**
 * On-chain reputation service
 * Interacts with Soroban contract to fetch and verify reputation scores
 */

import { contract, Keypair, Networks, Address } from "@stellar/stellar-sdk";
import { serverConfig } from "@/server/config";

const networkPassphrase =
  serverConfig.stellar.network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;

export interface ReputationStats {
  score: number; // 0-100
  circlesCompleted: number;
  onTimeContributions: number;
  totalContributions: number;
}

/**
 * Fetch reputation score from Soroban contract
 * @param stellarAddress - User's Stellar public key
 * @param contractId - Optional specific contract ID (defaults to platform contract)
 * @returns Reputation score (0-100)
 */
export async function getOnChainReputation(
  stellarAddress: string,
  contractId?: string
): Promise<number> {
  try {
    const cid = contractId ?? serverConfig.stellar.ajoContractId;
    if (!cid) {
      console.warn("[reputation] No contract ID configured, returning 0");
      return 0;
    }

    const keypair = Keypair.fromSecret(serverConfig.stellar.serverSecretKey);
    const signer = contract.basicNodeSigner(keypair, networkPassphrase);

    const client = await contract.Client.from({
      contractId: cid,
      networkPassphrase,
      rpcUrl: serverConfig.stellar.sorobanRpcUrl,
      publicKey: keypair.publicKey(),
      ...signer,
    });

    const memberAddress = Address.fromString(stellarAddress);

    // @ts-expect-error — method generated from contract ABI at runtime
    const result = await client.get_reputation({ member: memberAddress });
    return Number(result);
  } catch (error) {
    console.error("[reputation] Failed to fetch on-chain reputation:", error);
    return 0;
  }
}

/**
 * Fetch detailed reputation statistics from Soroban contract
 * @param stellarAddress - User's Stellar public key
 * @param contractId - Optional specific contract ID
 * @returns Detailed reputation stats
 */
export async function getReputationStats(
  stellarAddress: string,
  contractId?: string
): Promise<ReputationStats> {
  try {
    const cid = contractId ?? serverConfig.stellar.ajoContractId;
    if (!cid) {
      return {
        score: 0,
        circlesCompleted: 0,
        onTimeContributions: 0,
        totalContributions: 0,
      };
    }

    const keypair = Keypair.fromSecret(serverConfig.stellar.serverSecretKey);
    const signer = contract.basicNodeSigner(keypair, networkPassphrase);

    const client = await contract.Client.from({
      contractId: cid,
      networkPassphrase,
      rpcUrl: serverConfig.stellar.sorobanRpcUrl,
      publicKey: keypair.publicKey(),
      ...signer,
    });

    const memberAddress = Address.fromString(stellarAddress);

    // @ts-expect-error — method generated from contract ABI at runtime
    const result = await client.get_reputation_stats({ member: memberAddress });

    // Result is a tuple: (reputation, circles_completed, on_time, total)
    return {
      score: Number(result[0]),
      circlesCompleted: Number(result[1]),
      onTimeContributions: Number(result[2]),
      totalContributions: Number(result[3]),
    };
  } catch (error) {
    console.error("[reputation] Failed to fetch reputation stats:", error);
    return {
      score: 0,
      circlesCompleted: 0,
      onTimeContributions: 0,
      totalContributions: 0,
    };
  }
}

/**
 * Sync on-chain reputation to database
 * This should be called periodically or after circle completion
 * @param userId - User ID in database
 * @param stellarAddress - User's Stellar public key
 */
export async function syncReputationToDb(
  userId: string,
  stellarAddress: string
): Promise<void> {
  const { query } = await import("@/lib/db");
  const score = await getOnChainReputation(stellarAddress);

  await query(
    "UPDATE users SET reputation_score = $1 WHERE id = $2",
    [score, userId]
  );
}

/**
 * Verify reputation score matches on-chain data
 * Used for trustless verification
 * @param userId - User ID in database
 * @param stellarAddress - User's Stellar public key
 * @returns true if DB score matches on-chain score
 */
export async function verifyReputation(
  userId: string,
  stellarAddress: string
): Promise<boolean> {
  const { query } = await import("@/lib/db");
  const { rows } = await query<{ reputation_score: number }>(
    "SELECT reputation_score FROM users WHERE id = $1",
    [userId]
  );

  if (rows.length === 0) return false;

  const dbScore = rows[0].reputation_score;
  const onChainScore = await getOnChainReputation(stellarAddress);

  return dbScore === onChainScore;
}
