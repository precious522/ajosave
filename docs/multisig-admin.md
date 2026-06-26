# Multisig Admin Operations

The Ajo contract uses an on-chain M-of-N multisig for all admin operations on mainnet, eliminating the single-admin key as a point of failure.

## How It Works

Admin operations (`payout`, `set_payout_order`, `upgrade`) require **M approvals from N configured signers** before they execute.

### Flow

```
Signer A  ──► approve_operation(op_hash)  ──► contract stores approval
Signer B  ──► approve_operation(op_hash)  ──► approval count = M ✓
Any Signer ──► payout(caller, op_hash)    ──► executes, clears approvals
```

### op_hash

Each operation is identified by a 32-byte hash computed **off-chain**:

| Operation | Hash input |
|-----------|-----------|
| `payout` | `SHA-256("payout:<cycle_number>")` |
| `set_payout_order` | `SHA-256("set_payout_order:<order_csv>")` |
| `upgrade` | `SHA-256("upgrade:<new_wasm_hash_hex>")` |

All signers must use the **same hash** for the same operation. Approvals expire after **1 hour** to prevent stale approvals being replayed.

## Setup

### 1. Choose signers and threshold

Recommended for mainnet: **2-of-3** (tolerates one lost key, requires collusion of 2 to act).

```bash
# Example: 3 signers, threshold = 2
SIGNER_1=GABC...
SIGNER_2=GDEF...
SIGNER_3=GHIJ...
THRESHOLD=2
```

### 2. Initialize the contract

```bash
stellar contract invoke \
  --id $CONTRACT_ID \
  --network mainnet \
  --source $SIGNER_1 \
  -- initialize \
  --signers "[\"$SIGNER_1\",\"$SIGNER_2\",\"$SIGNER_3\"]" \
  --threshold 2 \
  --token $USDC_CONTRACT \
  --contribution_amount 10000000 \
  --max_members 10 \
  --cycle_interval_secs 2592000
```

All N signers must sign the `initialize` transaction.

### 3. Approve and execute a payout

```bash
# Compute op_hash off-chain (Node.js example)
node -e "
const crypto = require('crypto');
const cycle = 1;
const hash = crypto.createHash('sha256').update('payout:' + cycle).digest('hex');
console.log(hash);
"

# Signer 1 approves
stellar contract invoke --id $CONTRACT_ID --source $SIGNER_1 \
  -- approve_operation --signer $SIGNER_1 --op_hash $OP_HASH

# Signer 2 approves (now M=2 reached)
stellar contract invoke --id $CONTRACT_ID --source $SIGNER_2 \
  -- approve_operation --signer $SIGNER_2 --op_hash $OP_HASH

# Any signer executes
stellar contract invoke --id $CONTRACT_ID --source $SIGNER_1 \
  -- payout --caller $SIGNER_1 --op_hash $OP_HASH
```

## Key Rotation

To rotate a compromised key, deploy a new contract version via `upgrade` (itself requiring M-of-N approval) with updated signers in `initialize`.

### Procedure

1. Generate a new keypair: `stellar keys generate new-admin --network mainnet`
2. Compute upgrade op_hash: `SHA-256("upgrade:<new_wasm_hash_hex>")`
3. Collect M approvals from current signers via `approve_operation`
4. Call `upgrade` with the new WASM hash
5. Re-initialize the new contract with updated signers list

> **Important:** Store signer keys in separate hardware wallets or HSMs. Never store all keys on the same machine.

## Checking Approval Status

```bash
stellar contract invoke --id $CONTRACT_ID \
  -- get_approval_count --op_hash $OP_HASH
```

Returns the current number of valid approvals (0 if expired).

## Security Properties

- **No single point of failure** — requires M colluding signers to act
- **Replay protection** — approvals expire after 1 hour
- **Signer-only** — non-signers cannot submit approvals
- **Atomic execution** — approvals are cleared after the operation executes
