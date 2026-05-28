//! Ajosave Ajo Contract
//!
//! A trustless rotating savings circle (Ajo/Esusu) on Stellar Soroban.
//!
//! ## Lifecycle
//! 1. `initialize` — admin signers set up the circle parameters
//! 2. `join`       — members join by locking their first contribution
//! 3. `contribute` — members pay each cycle
//! 4. `payout`     — M-of-N admin signers approve then trigger payout
//! 5. Circle completes when all members have received their payout
//!
//! ## Multisig (M-of-N)
//! Admin operations (`payout`, `set_payout_order`, `upgrade`) require M-of-N
//! signatures from the configured admin signers. Each signer calls
//! `approve_operation` with an operation hash; once M approvals are collected
//! the operation executes. Approvals expire after `APPROVAL_TTL_SECS`.

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, token, vec, Address, BytesN, Env, Symbol, Vec,
};

// ─── Constants ────────────────────────────────────────────────────────────────

/// Approvals expire after 1 hour (prevents stale approvals being replayed).
const APPROVAL_TTL_SECS: u64 = 3600;

// ─── Storage keys ─────────────────────────────────────────────────────────────

#[contracttype]
pub enum DataKey {
    // Multisig config
    MultisigSigners,              // Vec<Address> — authorised admin signers
    MultisigThreshold,            // u32 — M (minimum approvals required)
    // Per-operation approval tracking
    Approvals(BytesN<32>),        // op_hash → Vec<Address> of approvers
    ApprovalExpiry(BytesN<32>),   // op_hash → expiry timestamp
    // Circle state
    Token,
    ContributionAmount,
    MaxMembers,
    CycleIntervalSecs,
    Members,
    PayoutOrder,                  // Vec<u32> — indices into Members for payout order
    CurrentCycle,
    NextPayoutTime,
    Contributions(Address, u32),  // (member, cycle) → bool
    Completed,
}

// ─── Contract ─────────────────────────────────────────────────────────────────

#[contract]
pub struct AjoContract;

#[contractimpl]
impl AjoContract {
    // ── Initialisation ────────────────────────────────────────────────────────

    /// Initialize the circle with M-of-N multisig admin.
    ///
    /// * `signers`             – Vec of admin addresses (N signers)
    /// * `threshold`           – M, minimum approvals required for admin operations
    /// * `token`               – USDC token contract address
    /// * `contribution_amount` – USDC amount per member per cycle (in stroops)
    /// * `max_members`         – total number of members (= total cycles)
    /// * `cycle_interval_secs` – seconds between payouts (e.g. 2592000 = 30 days)
    pub fn initialize(
        env: Env,
        signers: Vec<Address>,
        threshold: u32,
        token: Address,
        contribution_amount: i128,
        max_members: u32,
        cycle_interval_secs: u64,
    ) {
        if env.storage().instance().has(&DataKey::MultisigSigners) {
            panic!("already initialized");
        }
        if signers.is_empty() || threshold == 0 || threshold > signers.len() {
            panic!("invalid multisig config: threshold must be 1..=N");
        }
        if max_members < 2 || max_members > 20 {
            panic!("max_members must be between 2 and 20");
        }
        if contribution_amount <= 0 {
            panic!("contribution_amount must be positive");
        }

        // Each signer must authorise the initialisation
        for signer in signers.iter() {
            signer.require_auth();
        }

        env.storage().instance().set(&DataKey::MultisigSigners, &signers);
        env.storage().instance().set(&DataKey::MultisigThreshold, &threshold);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::ContributionAmount, &contribution_amount);
        env.storage().instance().set(&DataKey::MaxMembers, &max_members);
        env.storage().instance().set(&DataKey::CycleIntervalSecs, &cycle_interval_secs);
        env.storage().instance().set(&DataKey::Members, &Vec::<Address>::new(&env));
        env.storage().instance().set(&DataKey::PayoutOrder, &Vec::<u32>::new(&env));
        env.storage().instance().set(&DataKey::CurrentCycle, &0u32);
        env.storage().instance().set(&DataKey::Completed, &false);

        env.events().publish(
            (Symbol::new(&env, "initialized"),),
            (signers, threshold, max_members, contribution_amount),
        );
    }

    // ── Multisig ──────────────────────────────────────────────────────────────

    /// A signer submits their approval for an operation identified by `op_hash`.
    ///
    /// `op_hash` is a 32-byte value computed off-chain as:
    ///   SHA-256("<op_tag>:<params>")
    ///
    /// Returns the current approval count.
    pub fn approve_operation(env: Env, signer: Address, op_hash: BytesN<32>) -> u32 {
        signer.require_auth();
        Self::assert_is_signer(&env, &signer);

        let now = env.ledger().timestamp();
        let expiry: u64 = env
            .storage()
            .instance()
            .get(&DataKey::ApprovalExpiry(op_hash.clone()))
            .unwrap_or(0);

        let mut approvals: Vec<Address> = if expiry == 0 || now > expiry {
            // First approval or expired — reset
            env.storage()
                .instance()
                .set(&DataKey::ApprovalExpiry(op_hash.clone()), &(now + APPROVAL_TTL_SECS));
            Vec::new(&env)
        } else {
            env.storage()
                .instance()
                .get(&DataKey::Approvals(op_hash.clone()))
                .unwrap_or(Vec::new(&env))
        };

        if !approvals.contains(&signer) {
            approvals.push_back(signer.clone());
            env.storage()
                .instance()
                .set(&DataKey::Approvals(op_hash.clone()), &approvals);
        }

        let count = approvals.len();
        env.events()
            .publish((Symbol::new(&env, "approved"),), (signer, op_hash, count));
        count
    }

    /// Returns current approval count for an op_hash (0 if expired/absent).
    pub fn get_approval_count(env: Env, op_hash: BytesN<32>) -> u32 {
        let now = env.ledger().timestamp();
        let expiry: u64 = env
            .storage()
            .instance()
            .get(&DataKey::ApprovalExpiry(op_hash.clone()))
            .unwrap_or(0);
        if expiry == 0 || now > expiry {
            return 0;
        }
        let approvals: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::Approvals(op_hash))
            .unwrap_or(Vec::new(&env));
        approvals.len()
    }

    /// Returns the list of configured signers and threshold (M, N).
    pub fn get_multisig_config(env: Env) -> (Vec<Address>, u32) {
        let signers: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::MultisigSigners)
            .expect("not initialized");
        let threshold: u32 = env
            .storage()
            .instance()
            .get(&DataKey::MultisigThreshold)
            .expect("not initialized");
        (signers, threshold)
    }

    // ── Member operations ─────────────────────────────────────────────────────

    /// Join the circle. Transfers the first contribution into the contract.
    pub fn join(env: Env, member: Address) {
        member.require_auth();

        let max_members: u32 = env.storage().instance().get(&DataKey::MaxMembers).expect("not initialized");
        let mut members: Vec<Address> = env.storage().instance().get(&DataKey::Members).expect("not initialized");
        let current_cycle: u32 = env.storage().instance().get(&DataKey::CurrentCycle).expect("not initialized");

        if current_cycle > 0 {
            panic!("circle already started");
        }
        if members.len() >= max_members {
            panic!("circle is full");
        }
        if members.contains(&member) {
            panic!("already a member");
        }

        let token: Address = env.storage().instance().get(&DataKey::Token).expect("not initialized");
        let amount: i128 = env.storage().instance().get(&DataKey::ContributionAmount).expect("not initialized");

        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&member, &env.current_contract_address(), &amount);

        env.storage().instance().set(&DataKey::Contributions(member.clone(), 1), &true);

        members.push_back(member.clone());
        env.storage().instance().set(&DataKey::Members, &members);

        if members.len() == max_members {
            let interval: u64 = env.storage().instance().get(&DataKey::CycleIntervalSecs).expect("not initialized");
            let next_payout = env.ledger().timestamp() + interval;
            env.storage().instance().set(&DataKey::CurrentCycle, &1u32);
            env.storage().instance().set(&DataKey::NextPayoutTime, &next_payout);
            env.events().publish((Symbol::new(&env, "started"),), (max_members,));
        }

        env.events().publish((Symbol::new(&env, "joined"),), (member,));
    }

    /// Contribute for the current cycle.
    pub fn contribute(env: Env, member: Address) {
        member.require_auth();

        let current_cycle: u32 = env.storage().instance().get(&DataKey::CurrentCycle).expect("not initialized");
        if current_cycle == 0 {
            panic!("circle not started yet");
        }

        let members: Vec<Address> = env.storage().instance().get(&DataKey::Members).expect("not initialized");
        if !members.contains(&member) {
            panic!("not a member");
        }

        let already_paid: bool = env
            .storage()
            .instance()
            .get(&DataKey::Contributions(member.clone(), current_cycle))
            .unwrap_or(false);
        if already_paid {
            panic!("already contributed this cycle");
        }

        let token: Address = env.storage().instance().get(&DataKey::Token).expect("not initialized");
        let amount: i128 = env.storage().instance().get(&DataKey::ContributionAmount).expect("not initialized");

        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&member, &env.current_contract_address(), &amount);

        env.storage().instance().set(&DataKey::Contributions(member.clone(), current_cycle), &true);
        env.events().publish((Symbol::new(&env, "contributed"),), (member, current_cycle));
    }

    // ── Admin operations (require M-of-N approvals) ───────────────────────────

    /// Set payout order. Requires M-of-N approvals.
    ///
    /// `op_hash` = SHA-256("set_payout_order:<order_csv>") computed off-chain.
    pub fn set_payout_order(env: Env, caller: Address, op_hash: BytesN<32>, order: Vec<u32>) {
        caller.require_auth();
        Self::assert_is_signer(&env, &caller);
        Self::assert_approved(&env, &op_hash);

        let current_cycle: u32 = env.storage().instance().get(&DataKey::CurrentCycle).expect("not initialized");
        if current_cycle > 0 {
            panic!("cannot set payout order after circle starts");
        }

        let max_members: u32 = env.storage().instance().get(&DataKey::MaxMembers).expect("not initialized");
        if order.len() != max_members {
            panic!("payout order length must equal max_members");
        }

        env.storage().instance().set(&DataKey::PayoutOrder, &order);
        Self::clear_approvals(&env, &op_hash);
    }

    /// Trigger payout to the current cycle's recipient. Requires M-of-N approvals.
    ///
    /// `op_hash` = SHA-256("payout:<current_cycle>") computed off-chain.
    pub fn payout(env: Env, caller: Address, op_hash: BytesN<32>) {
        caller.require_auth();
        Self::assert_is_signer(&env, &caller);
        Self::assert_approved(&env, &op_hash);

        let completed: bool = env.storage().instance().get(&DataKey::Completed).unwrap_or(false);
        if completed {
            panic!("circle already completed");
        }

        let current_cycle: u32 = env.storage().instance().get(&DataKey::CurrentCycle).expect("not initialized");
        if current_cycle == 0 {
            panic!("circle not started");
        }

        let next_payout_time: u64 = env.storage().instance().get(&DataKey::NextPayoutTime).expect("not initialized");
        if env.ledger().timestamp() < next_payout_time {
            panic!("payout time not reached");
        }

        let members: Vec<Address> = env.storage().instance().get(&DataKey::Members).expect("not initialized");
        let max_members: u32 = env.storage().instance().get(&DataKey::MaxMembers).expect("not initialized");
        let payout_order: Vec<u32> = env
            .storage()
            .instance()
            .get(&DataKey::PayoutOrder)
            .unwrap_or_else(|_| {
                let mut default_order = Vec::new(&env);
                for i in 0..max_members {
                    default_order.push_back(i);
                }
                default_order
            });

        let recipient_idx = payout_order.get(current_cycle - 1).expect("invalid cycle");
        let recipient = members.get(recipient_idx).expect("invalid member index");

        let token: Address = env.storage().instance().get(&DataKey::Token).expect("not initialized");
        let contribution: i128 = env.storage().instance().get(&DataKey::ContributionAmount).expect("not initialized");
        let pot = contribution * (max_members as i128);

        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&env.current_contract_address(), &recipient, &pot);

        env.events().publish((Symbol::new(&env, "payout"),), (recipient.clone(), pot, current_cycle));

        Self::clear_approvals(&env, &op_hash);

        if current_cycle >= max_members {
            env.storage().instance().set(&DataKey::Completed, &true);
            env.events().publish((Symbol::new(&env, "completed"),), ());
        } else {
            let interval: u64 = env.storage().instance().get(&DataKey::CycleIntervalSecs).expect("not initialized");
            env.storage().instance().set(&DataKey::CurrentCycle, &(current_cycle + 1));
            env.storage().instance().set(&DataKey::NextPayoutTime, &(env.ledger().timestamp() + interval));
        }
    }

    /// Upgrade contract WASM. Requires M-of-N approvals.
    ///
    /// `op_hash` = SHA-256("upgrade:<new_wasm_hash_hex>") computed off-chain.
    pub fn upgrade(env: Env, caller: Address, op_hash: BytesN<32>, new_wasm_hash: BytesN<32>) {
        caller.require_auth();
        Self::assert_is_signer(&env, &caller);
        Self::assert_approved(&env, &op_hash);

        env.deployer().update_current_contract_wasm(new_wasm_hash.clone());
        Self::clear_approvals(&env, &op_hash);

        env.events().publish((Symbol::new(&env, "upgraded"),), (new_wasm_hash,));
    }

    // ── Read-only ─────────────────────────────────────────────────────────────

    pub fn get_state(env: Env) -> (u32, u32, u64, bool) {
        let current_cycle: u32 = env.storage().instance().get(&DataKey::CurrentCycle).unwrap_or(0);
        let max_members: u32 = env.storage().instance().get(&DataKey::MaxMembers).unwrap_or(0);
        let next_payout_time: u64 = env.storage().instance().get(&DataKey::NextPayoutTime).unwrap_or(0);
        let completed: bool = env.storage().instance().get(&DataKey::Completed).unwrap_or(false);
        (current_cycle, max_members, next_payout_time, completed)
    }

    pub fn get_members(env: Env) -> Vec<Address> {
        env.storage().instance().get(&DataKey::Members).unwrap_or(vec![&env])
    }

    pub fn get_payout_order(env: Env) -> Vec<u32> {
        env.storage().instance().get(&DataKey::PayoutOrder).unwrap_or(vec![&env])
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    fn assert_is_signer(env: &Env, addr: &Address) {
        let signers: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::MultisigSigners)
            .expect("not initialized");
        if !signers.contains(addr) {
            panic!("not an authorised signer");
        }
    }

    fn assert_approved(env: &Env, op_hash: &BytesN<32>) {
        let threshold: u32 = env
            .storage()
            .instance()
            .get(&DataKey::MultisigThreshold)
            .expect("not initialized");
        let now = env.ledger().timestamp();
        let expiry: u64 = env
            .storage()
            .instance()
            .get(&DataKey::ApprovalExpiry(op_hash.clone()))
            .unwrap_or(0);
        if expiry == 0 || now > expiry {
            panic!("no valid approvals for this operation");
        }
        let approvals: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::Approvals(op_hash.clone()))
            .unwrap_or(Vec::new(env));
        if approvals.len() < threshold {
            panic!("insufficient approvals: need M-of-N signatures");
        }
    }

    fn clear_approvals(env: &Env, op_hash: &BytesN<32>) {
        env.storage().instance().remove(&DataKey::Approvals(op_hash.clone()));
        env.storage().instance().remove(&DataKey::ApprovalExpiry(op_hash.clone()));
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        token::{Client as TokenClient, StellarAssetClient},
        Env,
    };

    fn make_op_hash(env: &Env, tag: &str) -> BytesN<32> {
        // Simple deterministic test hash — not SHA-256, just fills bytes with tag length
        let mut bytes = [0u8; 32];
        let b = tag.as_bytes();
        for (i, &byte) in b.iter().enumerate().take(32) {
            bytes[i] = byte;
        }
        BytesN::from_array(env, &bytes)
    }

    fn setup(env: &Env) -> (Vec<Address>, Vec<Address>, Address, TokenClient, AjoContractClient) {
        let signer1 = Address::generate(env);
        let signer2 = Address::generate(env);
        let signers = vec![env, signer1.clone(), signer2.clone()];

        let members = vec![
            env,
            Address::generate(env),
            Address::generate(env),
            Address::generate(env),
        ];

        let token_id = env.register_stellar_asset_contract(signer1.clone());
        let token = TokenClient::new(env, &token_id);
        let token_admin = StellarAssetClient::new(env, &token_id);

        for m in members.iter() {
            token_admin.mint(m, &1_000_000_000);
        }

        let contract_id = env.register_contract(None, AjoContract);
        let client = AjoContractClient::new(env, &contract_id);

        // 2-of-2 multisig
        client.initialize(&signers, &2, &token_id, &100_000_000, &3, &86400);

        (signers, members, token_id, token, client)
    }

    #[test]
    fn test_full_cycle_with_multisig() {
        let env = Env::default();
        env.mock_all_auths();

        let (signers, members, _token_id, token, client) = setup(&env);

        for m in members.iter() {
            client.join(m);
        }

        let (cycle, max, _, completed) = client.get_state();
        assert_eq!(cycle, 1);
        assert_eq!(max, 3);
        assert!(!completed);

        env.ledger().with_mut(|l| l.timestamp = 86401);

        // Both signers approve payout for cycle 1
        let op_hash = make_op_hash(&env, "payout:1");
        client.approve_operation(&signers.get(0).unwrap(), &op_hash);
        client.approve_operation(&signers.get(1).unwrap(), &op_hash);

        client.payout(&signers.get(0).unwrap(), &op_hash);
        assert_eq!(token.balance(&members.get(0).unwrap()), 1_100_000_000);

        for m in members.iter() { client.contribute(m); }
        env.ledger().with_mut(|l| l.timestamp = 172802);

        let op_hash2 = make_op_hash(&env, "payout:2");
        client.approve_operation(&signers.get(0).unwrap(), &op_hash2);
        client.approve_operation(&signers.get(1).unwrap(), &op_hash2);
        client.payout(&signers.get(0).unwrap(), &op_hash2);

        for m in members.iter() { client.contribute(m); }
        env.ledger().with_mut(|l| l.timestamp = 259203);

        let op_hash3 = make_op_hash(&env, "payout:3");
        client.approve_operation(&signers.get(0).unwrap(), &op_hash3);
        client.approve_operation(&signers.get(1).unwrap(), &op_hash3);
        client.payout(&signers.get(0).unwrap(), &op_hash3);

        let (_, _, _, completed) = client.get_state();
        assert!(completed);
    }

    #[test]
    #[should_panic(expected = "insufficient approvals")]
    fn test_payout_without_enough_approvals_panics() {
        let env = Env::default();
        env.mock_all_auths();
        let (signers, members, _, _, client) = setup(&env);
        for m in members.iter() { client.join(m); }
        env.ledger().with_mut(|l| l.timestamp = 86401);

        // Only 1 of 2 required approvals
        let op_hash = make_op_hash(&env, "payout:1");
        client.approve_operation(&signers.get(0).unwrap(), &op_hash);
        client.payout(&signers.get(0).unwrap(), &op_hash);
    }

    #[test]
    #[should_panic(expected = "not an authorised signer")]
    fn test_non_signer_cannot_approve() {
        let env = Env::default();
        env.mock_all_auths();
        let (_, _, _, _, client) = setup(&env);
        let outsider = Address::generate(&env);
        let op_hash = make_op_hash(&env, "payout:1");
        client.approve_operation(&outsider, &op_hash);
    }

    #[test]
    #[should_panic(expected = "already contributed this cycle")]
    fn test_double_contribute_panics() {
        let env = Env::default();
        env.mock_all_auths();
        let (_, members, _, _, client) = setup(&env);
        for m in members.iter() { client.join(m); }
        client.contribute(&members.get(0).unwrap());
    }
}

#[cfg(test)]
mod integration_tests;
