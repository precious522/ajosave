import { contract, Keypair, Networks } from "@stellar/stellar-sdk";
import { serverConfig } from "@/server/config";
import { execSync } from "child_process";
import * as path from "path";
import * as fs from "fs";

const networkPassphrase =
  serverConfig.stellar.network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;

const rpcUrl = serverConfig.stellar.sorobanRpcUrl;
const networkFlag =
  serverConfig.stellar.network === "mainnet"
    ? `--network-passphrase "Public Global Stellar Network ; September 2015"`
    : `--network-passphrase "Test SDF Network ; September 2015"`;

/**
 * Deploy a new Ajo contract instance via the Stellar CLI.
 * Returns the deployed contract ID.
 *
 * Estimated deploy cost: ~0.01 XLM in transaction fees on testnet.
 * On mainnet, expect ~0.01–0.05 XLM depending on network congestion.
 */
export async function deployAjoContract(): Promise<string> {
  const wasmPath = path.resolve(
    process.cwd(),
    "contracts/target/wasm32-unknown-unknown/release/ajosave_ajo.wasm"
  );

  if (!fs.existsSync(wasmPath)) {
    throw new Error(
      "Ajo contract WASM not found. Run `npm run contract:build` first."
    );
  }

  const sourceKey = serverConfig.stellar.serverSecretKey;
  if (!sourceKey) {
    throw new Error("STELLAR_SERVER_SECRET_KEY is not set.");
  }

  const output = execSync(
    `stellar contract deploy --wasm ${wasmPath} --source ${sourceKey} --rpc-url ${rpcUrl} ${networkFlag}`,
    { encoding: "utf-8" }
  );

  const contractId = output.trim();
  if (!contractId) {
    throw new Error("Contract deployment returned empty contract ID.");
  }

  console.info(`[Soroban] Deployed new Ajo contract: ${contractId}`);
  return contractId;
}

/**
 * Invoke AjoContract.payout() via Soroban RPC.
 * The contract handles the token transfer; the backend only triggers it.
 *
 * @param contractId - The deployed Ajo contract address for this circle
 * @returns The Soroban transaction hash
 */
export async function invokeContractPayout(contractId: string): Promise<string> {
  const keypair = Keypair.fromSecret(serverConfig.stellar.serverSecretKey);
  const signer = contract.basicNodeSigner(keypair, networkPassphrase);

  const client = await contract.Client.from({
    contractId,
    networkPassphrase,
    rpcUrl: serverConfig.stellar.sorobanRpcUrl,
    publicKey: keypair.publicKey(),
    ...signer,
  });

  // payout() takes no args — admin auth is checked inside the contract
  // @ts-expect-error — method generated from contract ABI at runtime
  const assembled = await client.payout();
  const sent = await assembled.send();
  // SentTransaction exposes the hash via the underlying getTransaction response
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (sent as any).hash ?? (sent as any).sendTransactionResponse?.hash ?? "";
}

/**
 * Invoke AjoContract.set_payout_order() via Soroban RPC.
 * Sets the randomized payout order on the smart contract.
 *
 * @param contractId - The deployed Ajo contract address for this circle
 * @param payoutOrder - Array of member indices in desired payout order
 * @returns The Soroban transaction hash
 */
export async function invokeContractSetPayoutOrder(
  contractId: string,
  payoutOrder: number[]
): Promise<string> {
  const keypair = Keypair.fromSecret(serverConfig.stellar.serverSecretKey);
  const signer = contract.basicNodeSigner(keypair, networkPassphrase);

  const client = await contract.Client.from({
    contractId,
    networkPassphrase,
    rpcUrl: serverConfig.stellar.sorobanRpcUrl,
    publicKey: keypair.publicKey(),
    ...signer,
  });

  // set_payout_order(order: Vec<u32>)
  // @ts-expect-error — method generated from contract ABI at runtime
  const assembled = await client.set_payout_order({ order: payoutOrder });
  const sent = await assembled.send();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (sent as any).hash ?? (sent as any).sendTransactionResponse?.hash ?? "";
}
