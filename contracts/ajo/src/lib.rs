//! Ajosave Ajo Contract
//!
//! A trustless rotating savings circle (Ajo/Esusu) on Stellar Soroban.
//!
//! ## Lifecycle
//! 1. `initialize` — admin sets up the circle parameters
//! 2. `join`       — members join by locking their first contribution
//! 3. `contribute` — members pay each cycle
//! 4. `payout`     — admin triggers payout to the next member in rotation
//! 5. Circle completes when all members have received their payout

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, token, vec, Address, BytesN, Env, Symbol, Vec,
};

// ─── Storage keys ─────────────────────────────────────────────────────────────

#[contracttype]
pub enum DataKey {
    Admin,
    Token,
    ContributionAmount,
    MaxMembers,
    CycleIntervalSecs,
    Members,
    PayoutOrder,           // Vec<u32> — indices into Members array for payout order
    CurrentCycle,
    NextPayoutTime,
    Contributions(Address, u32), // (member, cycle) → bool
    Completed,
}

// ─── Contract ─────────────────────────────────────────────────────────────────

#[contract]
pub struct AjoContract;

#[contractimpl]
impl AjoContract {
    /// Initialize the circle. Called once by the platform.
    ///
    /// * `admin`               – platform address that triggers payouts
    /// * `token`               – USDC token contract address
    /// * `contribution_amount` – USDC amount each member contributes per cycle (in stroops)
    /// * `max_members`         – total number of members (= total cycles)
    /// * `cycle_interval_secs` – seconds between payouts (e.g. 2592000 = 30 days)
    pub fn initialize(
        env: Env,
        admin: Address,
        token: Address,
        contribution_amount: i128,
        max_members: u32,
        cycle_interval_secs: u64,
    ) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        if max_members < 2 || max_members > 20 {
            panic!("max_members must be between 2 and 20");
        }
        if contribution_amount <= 0 {
            panic!("contribution_amount must be positive");
        }

        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
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
            (admin, max_members, contribution_amount),
        );
    }

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

        // Transfer first contribution
        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&member, &env.current_contract_address(), &amount);

        // Record contribution for cycle 1
        env.storage().instance().set(&DataKey::Contributions(member.clone(), 1), &true);

        members.push_back(member.clone());
        env.storage().instance().set(&DataKey::Members, &members);

        // Auto-start when full
        if members.len() == max_members {
            let interval: u64 = env.storage().instance().get(&DataKey::CycleIntervalSecs).expect("not initialized");
            let next_payout = env.ledger().timestamp() + interval;
            env.storage().instance().set(&DataKey::CurrentCycle, &1u32);
            env.storage().instance().set(&DataKey::NextPayoutTime, &next_payout);

            env.events().publish((Symbol::new(&env, "started"),), (max_members,));
        }

        env.events().publish((Symbol::new(&env, "joined"),), (member,));
    }

    /// Contribute for the current cycle. Must be called before payout.
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

    /// Set payout order for randomized circles. Admin-only, must be called before circle starts.
    /// 
    /// * `order` – Vec<u32> of member indices (0-based) in desired payout order
    pub fn set_payout_order(env: Env, order: Vec<u32>) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).expect("not initialized");
        admin.require_auth();

        let current_cycle: u32 = env.storage().instance().get(&DataKey::CurrentCycle).expect("not initialized");
        if current_cycle > 0 {
            panic!("cannot set payout order after circle starts");
        }

        let max_members: u32 = env.storage().instance().get(&DataKey::MaxMembers).expect("not initialized");
        if order.len() != max_members {
            panic!("payout order length must equal max_members");
        }

        env.storage().instance().set(&DataKey::PayoutOrder, &order);
    }

    /// Trigger payout to the current cycle's recipient. Only callable by admin after next_payout_time.
    pub fn payout(env: Env) {
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

        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&env.current_contract_address(), &recipient, &pot);

        env.events().publish((Symbol::new(&env, "payout"),), (recipient.clone(), pot, current_cycle));

        // Advance or complete
        if current_cycle >= max_members {
            env.storage().instance().set(&DataKey::Completed, &true);
            env.events().publish((Symbol::new(&env, "completed"),), ());
        } else {
            let interval: u64 = env.storage().instance().get(&DataKey::CycleIntervalSecs).expect("not initialized");
            env.storage().instance().set(&DataKey::CurrentCycle, &(current_cycle + 1));
            env.storage().instance().set(&DataKey::NextPayoutTime, &(env.ledger().timestamp() + interval));
        }
    }

    /// Read-only: get circle state.
    pub fn get_state(env: Env) -> (u32, u32, u64, bool) {
        let current_cycle: u32 = env.storage().instance().get(&DataKey::CurrentCycle).unwrap_or(0);
        let max_members: u32 = env.storage().instance().get(&DataKey::MaxMembers).unwrap_or(0);
        let next_payout_time: u64 = env.storage().instance().get(&DataKey::NextPayoutTime).unwrap_or(0);
        let completed: bool = env.storage().instance().get(&DataKey::Completed).unwrap_or(false);
        (current_cycle, max_members, next_payout_time, completed)
    }

    /// Read-only: get all members.
    pub fn get_members(env: Env) -> Vec<Address> {
        env.storage().instance().get(&DataKey::Members).unwrap_or(vec![&env])
    }

    /// Read-only: get payout order (indices into members array).
    pub fn get_payout_order(env: Env) -> Vec<u32> {
        env.storage().instance().get(&DataKey::PayoutOrder).unwrap_or(vec![&env])
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
            .get(&DataKey::Admin)
            .expect("not initialized");
        admin.require_auth();

        env.deployer().update_current_contract_wasm(new_wasm_hash.clone());

        env.events()
            .publish((Symbol::new(&env, "upgraded"),), (new_wasm_hash,));
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

    fn setup(env: &Env) -> (Address, Vec<Address>, Address, TokenClient, AjoContractClient) {
        let admin = Address::generate(env);
        let members = vec![
            &env,
            Address::generate(env),
            Address::generate(env),
            Address::generate(env),
        ];

        let token_id = env.register_stellar_asset_contract(admin.clone());
        let token = TokenClient::new(env, &token_id);
        let token_admin = StellarAssetClient::new(env, &token_id);

        // Mint 1000 USDC to each member
        for m in members.iter() {
            token_admin.mint(m, &1_000_000_000);
        }

        let contract_id = env.register_contract(None, AjoContract);
        let client = AjoContractClient::new(env, &contract_id);

        client.initialize(&admin, &token_id, &100_000_000, &3, &86400);

        (admin, members, token_id, token, client)
    }

    #[test]
    fn test_full_cycle() {
        let env = Env::default();
        env.mock_all_auths();

        let (admin, members, _token_id, token, client) = setup(&env);

        // All 3 members join
        for m in members.iter() {
            client.join(m);
        }

        let (cycle, max, _, completed) = client.get_state();
        assert_eq!(cycle, 1);
        assert_eq!(max, 3);
        assert!(!completed);

        // Advance past payout time
        env.ledger().with_mut(|l| l.timestamp = 86401);

        // Payout cycle 1
        client.payout();
        assert_eq!(token.balance(&members.get(0).unwrap()), 1_100_000_000); // got 300 back, paid 100 = net +200

        // Contribute for cycle 2
        for m in members.iter() {
            client.contribute(m);
        }

        env.ledger().with_mut(|l| l.timestamp = 172802);
        client.payout();

        // Contribute for cycle 3
        for m in members.iter() {
            client.contribute(m);
        }

        env.ledger().with_mut(|l| l.timestamp = 259203);
        client.payout();

        let (_, _, _, completed) = client.get_state();
        assert!(completed);
    }

    #[test]
    #[should_panic(expected = "payout time not reached")]
    fn test_early_payout_panics() {
        let env = Env::default();
        env.mock_all_auths();
        let (_, members, _, _, client) = setup(&env);
        for m in members.iter() { client.join(m); }
        client.payout(); // should panic — time not reached
    }

    #[test]
    #[should_panic(expected = "already contributed this cycle")]
    fn test_double_contribute_panics() {
        let env = Env::default();
        env.mock_all_auths();
        let (_, members, _, _, client) = setup(&env);
        for m in members.iter() { client.join(m); }
        client.contribute(&members.get(0).unwrap()); // second contribution same cycle
    }
}

#[cfg(test)]
mod integration_tests;