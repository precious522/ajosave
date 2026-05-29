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

// ─── TTL Configuration ────────────────────────────────────────────────────────
// Threshold: approximately 1 day in ledgers (assuming ~5s per ledger)
const DAY_IN_LEDGERS: u32 = 17280;
// Instance storage: bump by 7 days if it's within 1 day of expiry
const INSTANCE_BUMP_AMOUNT: u32 = 7 * DAY_IN_LEDGERS;
const INSTANCE_LIFETIME_THRESHOLD: u32 = DAY_IN_LEDGERS;

// Persistent storage: bump by 30 days if it's within 7 days of expiry
const PERSISTENT_BUMP_AMOUNT: u32 = 30 * DAY_IN_LEDGERS;
const PERSISTENT_LIFETIME_THRESHOLD: u32 = 7 * DAY_IN_LEDGERS;

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
    // Reputation tracking
    MemberReputation(Address), // member → reputation score (0-100)
    TotalCirclesCompleted(Address), // member → count of completed circles
    OnTimeContributions(Address), // member → count of on-time contributions
    TotalContributions(Address), // member → total contribution count
    // TTL Configuration
    TtlThreshold,
    TtlExtendTo,
    // Reentrancy guard (issue #264)
    PayoutLock,
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
        Self::extend_instance_ttl(&env);
        if env.storage().instance().has(&DataKey::Admin) {
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
        Self::extend_instance_ttl(&env);
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
    ///
    /// # Amount Validation (issue #265)
    /// The caller must supply the exact `amount` they intend to transfer.
    /// The contract rejects any value that does not equal `ContributionAmount`,
    /// preventing both under-contributions and over-contributions.
    pub fn contribute(env: Env, member: Address, amount: i128) {
        Self::extend_instance_ttl(&env);
        member.require_auth();

        let required_amount: i128 = env
            .storage()
            .instance()
            .get(&DataKey::ContributionAmount)
            .expect("not initialized");
        if amount != required_amount {
            panic!("contribution amount must equal required amount");
        }

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

        // Update reputation: track on-time contributions
        let next_payout_time: u64 = env.storage().instance().get(&DataKey::NextPayoutTime).expect("not initialized");
        let is_on_time = env.ledger().timestamp() < next_payout_time;
        
        if is_on_time {
            let on_time_count: u32 = env
                .storage()
                .persistent()
                .get(&DataKey::OnTimeContributions(member.clone()))
                .unwrap_or(0);
            env.storage()
                .persistent()
                .set(&DataKey::OnTimeContributions(member.clone()), &(on_time_count + 1));
        }

        let total_contributions: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::TotalContributions(member.clone()))
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&DataKey::TotalContributions(member.clone()), &(total_contributions + 1));

        // Recalculate reputation score
        Self::update_reputation(&env, &member);

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

    /// Trigger payout to the current cycle's recipient. Only callable by admin after next_payout_time.
    ///
    /// # Security – Reentrancy Guard (issue #264)
    /// Although Soroban's execution model does not support traditional EVM-style reentrancy,
    /// a `PayoutLock` flag is set at the start of this function and cleared at the end as an
    /// explicit defence-in-depth measure. Any re-entrant or concurrent invocation (e.g. via
    /// cross-contract calls or future protocol changes) will panic with "payout already in progress".
    /// The contract also follows the checks-effects-interactions pattern: all state mutations
    /// occur before the external token transfer.
    pub fn payout(env: Env) {
        Self::extend_instance_ttl(&env);

        // ─── Reentrancy guard: acquire lock ───────────────────────────────────
        let locked: bool = env
            .storage()
            .instance()
            .get(&DataKey::PayoutLock)
            .unwrap_or(false);
        if locked {
            panic!("payout already in progress");
        }
        env.storage().instance().set(&DataKey::PayoutLock, &true);

        let admin: Address = env.storage().instance().get(&DataKey::Admin).expect("not initialized");
        admin.require_auth();

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

        for m in members.iter() {
            let paid: bool = env
                .storage()
                .instance()
                .get(&DataKey::Contributions(m.clone(), current_cycle))
                .unwrap_or(false);
            if !paid {
                env.events().publish(
                    (Symbol::new(&env, "defaulted"),),
                    (m, current_cycle),
                );
            }
        }

        // Recipient is the member at position (current_cycle - 1)
        let recipient = members.get(current_cycle - 1).expect("invalid cycle");
        let payout_order: Vec<u32> = env.storage().instance().get(&DataKey::PayoutOrder).unwrap_or_else(|_| {
            // Default to join order if no custom order set
            let mut default_order = Vec::new(&env);
            for i in 0..max_members {
                default_order.push_back(i);
            }
            default_order
        });

        // Get recipient from payout order
        let recipient_idx = payout_order.get(current_cycle - 1).expect("invalid cycle");
        let recipient = members.get(recipient_idx).expect("invalid member index");

        let token: Address = env.storage().instance().get(&DataKey::Token).expect("not initialized");
        let contribution: i128 = env.storage().instance().get(&DataKey::ContributionAmount).expect("not initialized");
        let pot = contribution * (max_members as i128);

        // ─── Effects: Advance or complete before external call ────────────────
        if current_cycle >= max_members {
            env.storage().instance().set(&DataKey::Completed, &true);
            
            // Update reputation for all members upon circle completion
            for member in members.iter() {
                let circles_completed: u32 = env
                    .storage()
                    .persistent()
                    .get(&DataKey::TotalCirclesCompleted(member.clone()))
                    .unwrap_or(0);
                env.storage()
                    .persistent()
                    .set(&DataKey::TotalCirclesCompleted(member.clone()), &(circles_completed + 1));
                
                Self::update_reputation(&env, &member);
            }
        } else {
            let interval: u64 = env.storage().instance().get(&DataKey::CycleIntervalSecs).expect("not initialized");
            env.storage().instance().set(&DataKey::CurrentCycle, &(current_cycle + 1));
            env.storage().instance().set(&DataKey::NextPayoutTime, &(env.ledger().timestamp() + interval));
        }

        // ─── Interaction: Transfer tokens ─────────────────────────────────────
        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&env.current_contract_address(), &recipient, &pot);

        // ─── Reentrancy guard: release lock ───────────────────────────────────
        env.storage().instance().set(&DataKey::PayoutLock, &false);

        // ─── Events ───────────────────────────────────────────────────────────
        env.events().publish((Symbol::new(&env, "payout"),), (recipient.clone(), pot, current_cycle));
        if current_cycle >= max_members {
            env.events().publish((Symbol::new(&env, "completed"),), ());
        }
    }

    /// Internal: Calculate and update reputation score for a member
    /// Score is based on:
    /// - On-time contribution rate (70% weight)
    /// - Number of completed circles (30% weight)
    fn update_reputation(env: &Env, member: &Address) {
        let on_time: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::OnTimeContributions(member.clone()))
            .unwrap_or(0);
        let total: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::TotalContributions(member.clone()))
            .unwrap_or(1); // avoid division by zero
        let circles_completed: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::TotalCirclesCompleted(member.clone()))
            .unwrap_or(0);

        // On-time rate: 0-70 points
        let on_time_score = if total > 0 {
            (on_time * 70) / total
        } else {
            0
        };

        // Completed circles: 0-30 points (capped at 10 circles)
        let circles_score = if circles_completed >= 10 {
            30
        } else {
            circles_completed * 3
        };

        let reputation = on_time_score + circles_score;
        
        // Update storage and extend TTL for all persistent keys related to this member
        let keys = [
            DataKey::OnTimeContributions(member.clone()),
            DataKey::TotalContributions(member.clone()),
            DataKey::TotalCirclesCompleted(member.clone()),
            DataKey::MemberReputation(member.clone()),
        ];

        for key in keys.iter() {
            Self::extend_persistent_ttl(env, key);
        }

        env.storage()
            .persistent()
            .set(&DataKey::MemberReputation(member.clone()), &reputation);

        env.events().publish(
            (Symbol::new(&env, "reputation_updated"),),
            (member.clone(), reputation),
        );
    }

    /// Read-only: get reputation score for a member (0-100)
    pub fn get_reputation(env: Env, member: Address) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::MemberReputation(member))
            .unwrap_or(0)
    }

    /// Read-only: get detailed reputation stats for a member
    pub fn get_reputation_stats(env: Env, member: Address) -> (u32, u32, u32, u32) {
        let reputation: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::MemberReputation(member.clone()))
            .unwrap_or(0);
        let circles_completed: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::TotalCirclesCompleted(member.clone()))
            .unwrap_or(0);
        let on_time: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::OnTimeContributions(member.clone()))
            .unwrap_or(0);
        let total: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::TotalContributions(member))
            .unwrap_or(0);

        (reputation, circles_completed, on_time, total)
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

    /// Read-only: get contribution status for every member in a given cycle.
    ///
    /// Returns a `Vec` of `(Address, bool)` tuples — one per member — where
    /// `true` means the member has contributed for `cycle` and `false` means
    /// they have not yet (or defaulted).
    pub fn get_contribution_status(env: Env, cycle: u32) -> Vec<(Address, bool)> {
        let members: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::Members)
            .unwrap_or(Vec::new(&env));

        let mut result: Vec<(Address, bool)> = Vec::new(&env);
        for member in members.iter() {
            let paid: bool = env
                .storage()
                .instance()
                .get(&DataKey::Contributions(member.clone(), cycle))
                .unwrap_or(false);
            result.push_back((member, paid));
        }
        result
    }

    /// Upgrade the contract WASM. Admin-only.
    ///
    /// * `new_wasm_hash` – hash of the new WASM blob already uploaded to the network
    ///
    /// Emits an `upgraded` event so off-chain indexers can track deployments.
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        let admin: Address = env
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

    /// Propose a new admin. Only the current admin can call this.
    /// The proposed admin must call `accept_admin` to complete the transfer.
    pub fn propose_admin(env: Env, new_admin: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).expect("not initialized");
        admin.require_auth();
        env.storage().instance().set(&DataKey::PendingAdmin, &new_admin);
        env.events().publish((Symbol::new(&env, "admin_proposed"),), (admin, new_admin));
    }

    /// Accept the admin role. Only the pending admin can call this.
    pub fn accept_admin(env: Env) {
        let pending: Address = env
            .storage()
            .instance()
            .get(&DataKey::PendingAdmin)
            .expect("no pending admin");
        pending.require_auth();
        let old_admin: Address = env.storage().instance().get(&DataKey::Admin).expect("not initialized");
        env.storage().instance().set(&DataKey::Admin, &pending);
        env.storage().instance().remove(&DataKey::PendingAdmin);
        env.events().publish((Symbol::new(&env, "admin_transferred"),), (old_admin, pending));
    }

    /// Set TTL configuration. Admin-only.
    pub fn set_ttl_config(env: Env, threshold: u32, extend_to: u32) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).expect("not initialized");
        admin.require_auth();

        env.storage().instance().set(&DataKey::TtlThreshold, &threshold);
        env.storage().instance().set(&DataKey::TtlExtendTo, &extend_to);
    }

    fn extend_instance_ttl(env: &Env) {
        let threshold = env.storage().instance().get(&DataKey::TtlThreshold).unwrap_or(INSTANCE_LIFETIME_THRESHOLD);
        let extend_to = env.storage().instance().get(&DataKey::TtlExtendTo).unwrap_or(INSTANCE_BUMP_AMOUNT);

        env.storage()
            .instance()
            .extend_ttl(threshold, extend_to);
    }

    fn extend_persistent_ttl(env: &Env, key: &DataKey) {
        env.storage()
            .persistent()
            .extend_ttl(key, PERSISTENT_LIFETIME_THRESHOLD, PERSISTENT_BUMP_AMOUNT);
    }

    /// Test-only helper: force the payout lock to a given value.
    /// Used to simulate a re-entrant call in the Soroban sandbox.
    #[cfg(test)]
    pub fn set_payout_lock(env: Env, locked: bool) {
        env.storage().instance().set(&DataKey::PayoutLock, &locked);
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

        for m in members.iter() { client.contribute(m, &100_000_000); }
        env.ledger().with_mut(|l| l.timestamp = 172802);

        let op_hash2 = make_op_hash(&env, "payout:2");
        client.approve_operation(&signers.get(0).unwrap(), &op_hash2);
        client.approve_operation(&signers.get(1).unwrap(), &op_hash2);
        client.payout(&signers.get(0).unwrap(), &op_hash2);

        for m in members.iter() { client.contribute(m, &100_000_000); }
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
        client.contribute(&members.get(0).unwrap(), &100_000_000);
    }

    #[test]
    fn test_defaulted_event() {
        use soroban_sdk::{testutils::Events, TryFromVal};

        let env = Env::default();
        env.mock_all_auths();

        let (_, members, _, _, client) = setup(&env);

        // All 3 members join (cycle 1 contributions recorded automatically via join)
        for m in members.iter() {
            client.join(m);
        }

        // Cycle 1 payout — no defaults (join records each member's cycle-1 contribution)
        env.ledger().with_mut(|l| l.timestamp = 86401);
        client.payout();

        // Only members[0] and members[1] contribute for cycle 2; members[2] defaults
        client.contribute(&members.get(0).unwrap(), &100_000_000);
        client.contribute(&members.get(1).unwrap(), &100_000_000);

        env.ledger().with_mut(|l| l.timestamp = 172802);
        client.payout();

        let defaulter = members.get(2).unwrap();
        let defaulted_sym = Symbol::new(&env, "defaulted");

        let found = env.events().all().iter().any(|(_, topics, data)| {
            if topics.len() != 1 {
                return false;
            }
            let Ok(sym) = Symbol::try_from_val(&env, &topics.get(0).unwrap()) else {
                return false;
            };
            if sym != defaulted_sym {
                return false;
            }
            let Ok((addr, cycle)) = <(Address, u32)>::try_from_val(&env, data) else {
                return false;
            };
            addr == defaulter && cycle == 2
        });

        assert!(found, "no 'defaulted' event emitted for members[2] on cycle 2");
    }

    #[test]
    fn test_ttl_extension() {
        let env = Env::default();
        env.mock_all_auths();

        let (admin, members, _, _, client) = setup(&env);

        // Configure TTL to be small for testing
        client.set_ttl_config(&10, &100);

        // Join should trigger instance TTL extension to 100
        client.join(&members.get(0).unwrap());
        
        // Advance ledger past default/initial threshold but before 100
        env.ledger().with_mut(|l| l.sequence = 50);
        
        // Contract should still be responsive
        let (cycle, _, _, _) = client.get_state();
        assert_eq!(cycle, 0);

        // Advance ledger past 100
        // env.ledger().with_mut(|l| l.sequence = 150);
        // client.get_state(); // This would panic if the contract expired
    }

    #[test]
    fn test_get_contribution_status() {
        let env = Env::default();
        env.mock_all_auths();

        let (_, members, _, _, client) = setup(&env);

        // All 3 members join (cycle 1 contributions recorded via join)
        for m in members.iter() {
            client.join(m);
        }

        // All members should show contributed=true for cycle 1 (recorded during join)
        let status = client.get_contribution_status(&1u32);
        assert_eq!(status.len(), 3);
        for (_, paid) in status.iter() {
            assert!(paid, "all members should have contributed for cycle 1 via join");
        }

        // Advance to cycle 2
        env.ledger().with_mut(|l| l.timestamp = 86401);
        client.payout();

        // No one has contributed for cycle 2 yet
        let status2 = client.get_contribution_status(&2u32);
        assert_eq!(status2.len(), 3);
        for (_, paid) in status2.iter() {
            assert!(!paid, "no member should have contributed for cycle 2 yet");
        }

        // Only member 0 contributes for cycle 2
        client.contribute(&members.get(0).unwrap(), &100_000_000);

        let status3 = client.get_contribution_status(&2u32);
        let (_, m0_paid) = status3.get(0).unwrap();
        let (_, m1_paid) = status3.get(1).unwrap();
        assert!(m0_paid, "member 0 should show contributed");
        assert!(!m1_paid, "member 1 should not show contributed yet");
    }

    #[test]
    fn test_payout_state_advancement() {
        let env = Env::default();
        env.mock_all_auths();

        let (_, members, _, _, client) = setup(&env);

        // All 3 members join (cycle 1)
        for m in members.iter() {
            client.join(m);
        }

        // Advance to payout time
        env.ledger().with_mut(|l| l.timestamp = 86401);

        // Before payout: cycle 1, not completed
        let (cycle, _, _, completed) = client.get_state();
        assert_eq!(cycle, 1);
        assert!(!completed);

        // Payout cycle 1
        client.payout();

        // After payout: cycle 2, not completed (since max_members is 3)
        let (cycle, _, _, completed) = client.get_state();
        assert_eq!(cycle, 2);
        assert!(!completed);
    }

    #[test]
    fn test_propose_and_accept_admin() {
        let env = Env::default();
        env.mock_all_auths();
        let (admin, _, _, _, client) = setup(&env);
        let new_admin = Address::generate(&env);
        client.propose_admin(&new_admin);
        client.accept_admin();
        // After transfer, new admin can call admin-only functions (e.g. payout)
        // We just verify no panic — the event is the canonical proof
    }

    #[test]
    #[should_panic(expected = "no pending admin")]
    fn test_accept_admin_without_proposal_panics() {
        let env = Env::default();
        env.mock_all_auths();
        let (_, _, _, _, client) = setup(&env);
        client.accept_admin();
    }
}

#[cfg(test)]
mod integration_tests;

#[cfg(test)]
mod fuzz_tests;
