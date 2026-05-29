#!/usr/bin/env ts-node
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

const wasmPath = path.resolve(
  __dirname,
  "../contracts/target/wasm32-unknown-unknown/release/ajosave_ajo.wasm"
);

if (!fs.existsSync(wasmPath)) {
  console.error("WASM not found. Run `npm run contract:build` first.");
  process.exit(1);
}

const sourceKey = process.env.STELLAR_SERVER_SECRET_KEY;
if (!sourceKey) {
  console.error("STELLAR_SERVER_SECRET_KEY is not set.");
  process.exit(1);
}

console.log(`Deploying Ajo contract to ${network}…`);
console.log(`RPC: ${rpcUrl}`);

const result = execSync(
  `stellar contract deploy \
    --wasm ${wasmPath} \
    --source ${sourceKey} \
    --rpc-url ${rpcUrl} \
    --network-passphrase "${passphrase}"`,
  { encoding: "utf-8" }
);

const contractId = result.trim();
console.log(`\n✅ Contract deployed: ${contractId}`);
console.log(`\nAdd to .env.local:\n  STELLAR_AJO_CONTRACT_ID=${contractId}`);

// Write contract ID to a file for CI to pick up
const outFile = path.resolve(__dirname, "../.contract-id");
fs.writeFileSync(outFile, contractId);
console.log(`\nContract ID written to .contract-id`);
