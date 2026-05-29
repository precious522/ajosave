#!/usr/bin/env ts-node
/**
 * Post-deploy contract verification (Issue #350)
 *
 * Calls get_state() on the deployed Ajo contract and verifies it returns
 * a valid response. Fails with exit code 1 if the contract is unresponsive.
 * Runs for both testnet and mainnet based on STELLAR_NETWORK env var.
 */
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const network = process.env.STELLAR_NETWORK ?? "testnet";
const isTestnet = network !== "mainnet";

const rpcUrl = isTestnet
  ? "https://soroban-testnet.stellar.org"
  : "https://soroban-rpc.stellar.org";
const passphrase = isTestnet
  ? "Test SDF Network ; September 2015"
  : "Public Global Stellar Network ; September 2015";

// Resolve contract ID: prefer env var, fall back to .contract-id file
let contractId = process.env.STELLAR_AJO_CONTRACT_ID ?? "";
if (!contractId) {
  const idFile = path.resolve(__dirname, "../.contract-id");
  if (fs.existsSync(idFile)) {
    contractId = fs.readFileSync(idFile, "utf-8").trim();
  }
}

if (!contractId) {
  console.error("❌ No contract ID found. Set STELLAR_AJO_CONTRACT_ID or run deploy first.");
  process.exit(1);
}

const sourceKey = process.env.STELLAR_SERVER_SECRET_KEY;
if (!sourceKey) {
  console.error("❌ STELLAR_SERVER_SECRET_KEY is not set.");
  process.exit(1);
}

console.log(`\n🔍 Verifying Ajo contract on ${network}`);
console.log(`   Contract ID : ${contractId}`);
console.log(`   RPC URL     : ${rpcUrl}\n`);

try {
  const output = execSync(
    `stellar contract invoke \
      --id ${contractId} \
      --source ${sourceKey} \
      --rpc-url ${rpcUrl} \
      --network-passphrase "${passphrase}" \
      -- get_state`,
    { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
  );

  const raw = output.trim();
  console.log(`   get_state() response: ${raw}`);

  // get_state returns a tuple: (current_cycle, max_members, next_payout_time, completed)
  // Any non-empty response means the contract is alive and responding.
  if (!raw) {
    throw new Error("get_state() returned empty response");
  }

  // Log contract ID to deploy artifacts
  const artifactsDir = path.resolve(__dirname, "../deploy-artifacts");
  if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir, { recursive: true });

  const artifact = {
    contractId,
    network,
    verifiedAt: new Date().toISOString(),
    getStateResponse: raw,
  };
  const artifactPath = path.join(artifactsDir, `contract-${network}.json`);
  fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));

  console.log(`\n✅ Contract verified successfully`);
  console.log(`   Artifact written to: ${artifactPath}`);
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\n❌ Contract verification failed: ${message}`);
  process.exit(1);
}
