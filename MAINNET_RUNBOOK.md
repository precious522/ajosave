# Ajo Contract — Mainnet Deployment Runbook

> **Audience:** engineers and signers responsible for deploying or upgrading the Ajo contract on Stellar mainnet.  
> **Network:** `mainnet` (Stellar Public Network, passphrase `Public Global Stellar Network ; September 2015`)

---

## Pre-deployment Checklist

Complete every item before touching mainnet. Check off each box.

### Code & Testing
- [ ] All unit tests pass: `cargo test` in `contracts/ajo/`
- [ ] All integration tests pass: `cargo test --test integration_tests`
- [ ] Contract deployed and smoke-tested on **testnet** with the exact WASM being promoted
- [ ] Testnet contract ID and WASM hash recorded and match the build artifact
- [ ] No `#[cfg(test)]` helpers (e.g. `set_payout_lock`) are reachable in production paths
- [ ] `STORAGE_VERSION` constant is correct for this release

### Security
- [ ] M-of-N multisig threshold reviewed — recommend **2-of-3** minimum for mainnet
- [ ] All signer keypairs are hardware wallets or HSMs; no plaintext secret keys on CI
- [ ] Admin signer addresses are distinct from member addresses
- [ ] Contract source matches the WASM hash (reproducible build verified)
- [ ] `APPROVAL_TTL_SECS` is set to a value appropriate for mainnet key-signing latency

### Infrastructure
- [ ] Mainnet RPC endpoint confirmed (e.g. `https://horizon.stellar.org` or a private node)
- [ ] Deployer account funded with sufficient XLM for contract deployment fees
- [ ] All signer accounts funded with XLM for approval transactions
- [ ] Environment variables set (see below)
- [ ] Rollback plan documented (see [Rollback](#rollback))

### Environment Variables (mainnet)
```
STELLAR_NETWORK=mainnet
STELLAR_RPC_URL=https://mainnet.stellar.validationcloud.io/v1/<API_KEY>
STELLAR_AJO_CONTRACT_ID=<set after deploy>
USDC_TOKEN_CONTRACT=GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN
```

---

## Step-by-Step Deployment

### Step 1 — Build a reproducible WASM

```bash
# Clean build to ensure no stale artifacts
cargo clean --manifest-path contracts/ajo/Cargo.toml
cargo build \
  --manifest-path contracts/ajo/Cargo.toml \
  --target wasm32-unknown-unknown \
  --release
```

Record the SHA-256 of the output:
```bash
sha256sum contracts/ajo/target/wasm32-unknown-unknown/release/ajo.wasm
# Save this value — it must match the on-chain WASM hash after upload
```

### Step 2 — Upload the WASM blob to mainnet

Uploading stores the bytecode on-chain without creating a contract instance.

```bash
stellar contract upload \
  --network mainnet \
  --rpc-url "$STELLAR_RPC_URL" \
  --source <DEPLOYER_SECRET_KEY> \
  --wasm contracts/ajo/target/wasm32-unknown-unknown/release/ajo.wasm
```

Output: `<WASM_HASH>` — save this.

Verify the hash matches your local SHA-256 (Stellar encodes it as hex):
```bash
stellar contract info --network mainnet --wasm-hash <WASM_HASH>
```

### Step 3 — Deploy the contract instance

```bash
stellar contract deploy \
  --network mainnet \
  --rpc-url "$STELLAR_RPC_URL" \
  --source <DEPLOYER_SECRET_KEY> \
  --wasm-hash <WASM_HASH>
```

Output: `<CONTRACT_ID>` — set `STELLAR_AJO_CONTRACT_ID=<CONTRACT_ID>` in your environment.

### Step 4 — Initialize the contract

Each signer must be online to co-sign the `initialize` call.

```bash
stellar contract invoke \
  --network mainnet \
  --rpc-url "$STELLAR_RPC_URL" \
  --source <SIGNER_1_SECRET_KEY> \
  --id "$STELLAR_AJO_CONTRACT_ID" \
  -- initialize \
  --signers '["<SIGNER_1_ADDRESS>","<SIGNER_2_ADDRESS>","<SIGNER_3_ADDRESS>"]' \
  --threshold 2 \
  --token "$USDC_TOKEN_CONTRACT" \
  --contribution_amount <AMOUNT_IN_STROOPS> \
  --max_members <N> \
  --cycle_interval_secs <SECONDS>
```

> `initialize` requires auth from **all** signers listed. Coordinate so all signers sign the same transaction.

Verify:
```bash
stellar contract invoke \
  --network mainnet \
  --rpc-url "$STELLAR_RPC_URL" \
  --source <ANY_SIGNER_SECRET_KEY> \
  --id "$STELLAR_AJO_CONTRACT_ID" \
  -- get_state
# Expected: (0, <max_members>, 0, false)
```

### Step 5 — Smoke test

```bash
# Confirm multisig config
stellar contract invoke \
  --network mainnet \
  --rpc-url "$STELLAR_RPC_URL" \
  --source <ANY_SIGNER_SECRET_KEY> \
  --id "$STELLAR_AJO_CONTRACT_ID" \
  -- get_multisig_config

# Confirm member list is empty
stellar contract invoke \
  --network mainnet \
  --rpc-url "$STELLAR_RPC_URL" \
  --source <ANY_SIGNER_SECRET_KEY> \
  --id "$STELLAR_AJO_CONTRACT_ID" \
  -- get_members
```

### Step 6 — Update configuration

Set `STELLAR_AJO_CONTRACT_ID` in all application environments (`.env.production`, CI secrets, etc.) and update `README.md` with the new contract ID and explorer link.

---

## Upgrade Runbook

Use this when deploying a new WASM to an existing mainnet contract.

### Step U1 — Build and upload new WASM

Repeat Steps 1–2 above. Record `<NEW_WASM_HASH>`.

### Step U2 — Collect M-of-N approvals for `upgrade`

Compute the op hash off-chain:
```
op_hash = SHA-256("upgrade:<NEW_WASM_HASH_HEX>")
```

Each signer submits their approval:
```bash
stellar contract invoke \
  --network mainnet \
  --rpc-url "$STELLAR_RPC_URL" \
  --source <SIGNER_N_SECRET_KEY> \
  --id "$STELLAR_AJO_CONTRACT_ID" \
  -- approve_operation \
  --signer <SIGNER_N_ADDRESS> \
  --op_hash <OP_HASH>
```

Confirm approval count reaches threshold:
```bash
stellar contract invoke \
  --network mainnet \
  --rpc-url "$STELLAR_RPC_URL" \
  --source <ANY_SIGNER_SECRET_KEY> \
  --id "$STELLAR_AJO_CONTRACT_ID" \
  -- get_approval_count \
  --op_hash <OP_HASH>
# Must equal or exceed threshold before proceeding
```

### Step U3 — Execute upgrade

```bash
stellar contract invoke \
  --network mainnet \
  --rpc-url "$STELLAR_RPC_URL" \
  --source <SIGNER_1_SECRET_KEY> \
  --id "$STELLAR_AJO_CONTRACT_ID" \
  -- upgrade \
  --caller <SIGNER_1_ADDRESS> \
  --op_hash <OP_HASH> \
  --new_wasm_hash <NEW_WASM_HASH>
```

### Step U4 — Run migration (if storage layout changed)

If `STORAGE_VERSION` was bumped in the new release, call `migrate` immediately after `upgrade`. Collect M-of-N approvals for a separate op hash:

```
migrate_op_hash = SHA-256("migrate:<NEW_WASM_HASH_HEX>")
```

Collect approvals (same process as Step U2), then:
```bash
stellar contract invoke \
  --network mainnet \
  --rpc-url "$STELLAR_RPC_URL" \
  --source <SIGNER_1_SECRET_KEY> \
  --id "$STELLAR_AJO_CONTRACT_ID" \
  -- migrate \
  --caller <SIGNER_1_ADDRESS> \
  --op_hash <MIGRATE_OP_HASH>
```

Verify the `migrated` event was emitted:
```bash
stellar events \
  --network mainnet \
  --contract-id "$STELLAR_AJO_CONTRACT_ID" \
  --topic migrated
# Expected: (from_version, STORAGE_VERSION)
```

### Step U5 — Verify state integrity

```bash
stellar contract invoke \
  --network mainnet \
  --rpc-url "$STELLAR_RPC_URL" \
  --source <ANY_SIGNER_SECRET_KEY> \
  --id "$STELLAR_AJO_CONTRACT_ID" \
  -- get_state
# Confirm cycle, max_members, next_payout_time, completed are unchanged
```

---

## Rollback

Soroban contract upgrades are **not automatically reversible**. To roll back:

1. Keep the previous WASM hash recorded before every upgrade.
2. Repeat the upgrade process (Steps U1–U5) using the previous WASM hash.
3. If the migration wrote new storage keys, write a reverse migration block in the contract before rolling back.

> **Prevention is better than rollback.** Always test on testnet with production data shapes before upgrading mainnet.

---

## Post-deployment Record

Fill this in after each mainnet deployment and commit it to the repo.

| Field | Value |
|-------|-------|
| Date | |
| Contract ID | |
| WASM Hash | |
| STORAGE_VERSION | |
| Deployer address | |
| Signer 1 address | |
| Signer 2 address | |
| Signer 3 address | |
| Threshold (M-of-N) | |
| Testnet contract used for testing | |
| Deployed by | |
| Approved by | |
