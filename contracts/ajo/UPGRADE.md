# Contract Upgrade Guide

The Ajo contract exposes an admin-only `upgrade(new_wasm_hash)` function that replaces the running WASM in-place using Soroban's `update_current_contract_wasm`. All storage (members, cycles, balances) is preserved across upgrades.

## Prerequisites

- Stellar CLI installed (`stellar --version`)
- Admin keypair available
- New contract code compiled to WASM

## Steps

### 1. Build the new WASM

```bash
npm run contract:build
# Output: contracts/ajo/target/wasm32-unknown-unknown/release/ajo.wasm
```

### 2. Upload the WASM blob (does not deploy a new contract)

```bash
stellar contract upload \
  --network testnet \
  --source <ADMIN_SECRET_KEY> \
  --wasm contracts/ajo/target/wasm32-unknown-unknown/release/ajo.wasm
# Prints: <NEW_WASM_HASH>
```

### 3. Call `upgrade` on the existing contract

```bash
stellar contract invoke \
  --network testnet \
  --source <ADMIN_SECRET_KEY> \
  --id <CONTRACT_ID> \
  -- upgrade \
  --new_wasm_hash <NEW_WASM_HASH>
```

The contract emits an `upgraded` event containing the new WASM hash. Verify it in Stellar Explorer or via:

```bash
stellar events --contract-id <CONTRACT_ID> --topic upgraded
```

### 4. Verify

```bash
stellar contract invoke \
  --network testnet \
  --source <ADMIN_SECRET_KEY> \
  --id <CONTRACT_ID> \
  -- get_state
```

Confirm the circle state is intact and the new logic is active.

## Notes

- Only the `admin` address set during `initialize` can call `upgrade`.
- No data migration is needed unless the new version changes storage key layouts — in that case add a `migrate()` function before calling `upgrade`.
- For mainnet upgrades, test on testnet first and have the admin multisig approve the transaction.
