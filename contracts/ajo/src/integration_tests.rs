//! Integration tests for the Ajo contract.
//!
//! These tests run against the soroban-sdk in-process sandbox (soroban testutils),
//! which provides a full Soroban environment without requiring an external node.
//!
//! Coverage:
//!   initialize → join (all members) → contribute → payout × N → complete

#[cfg(test)]
mod integration {
    use crate::{AjoContract, AjoContractClient};
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        token::{Client as TokenClient, StellarAssetClient},
        vec, Address, Env, Vec,
    };

    // ─── Helpers ──────────────────────────────────────────────────────────────

    struct Fixture {
        env: Env,
        admin: Address,
        members: Vec<Address>,
        token: TokenClient<'static>,
        client: AjoContractClient<'static>,
        contribution: i128,
        max_members: u32,
        interval: u64,
    }

    fn setup_fixture(max_members: u32) -> Fixture {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let mut members_vec = Vec::new(&env);
        for _ in 0..max_members {
            members_vec.push_back(Address::generate(&env));
        }

        let token_id = env.register_stellar_asset_contract(admin.clone());
        let token = TokenClient::new(&env, &token_id);
        let token_admin = StellarAssetClient::new(&env, &token_id);

        let contribution: i128 = 100_000_000; // 100 USDC in stroops
        // Mint enough for all cycles
        for m in members_vec.iter() {
            token_admin.mint(m, &(contribution * (max_members as i128 + 1)));
        }

        let contract_id = env.register_contract(None, AjoContract);
        let client = AjoContractClient::new(&env, &contract_id);

        let interval: u64 = 86_400; // 1 day
        client.initialize(&admin, &token_id, &contribution, &max_members, &interval);

        // SAFETY: The env outlives the fixture; we extend lifetime for convenience in tests.
        let token: TokenClient<'static> = unsafe { std::mem::transmute(token) };
        let client: AjoContractClient<'static> = unsafe { std::mem::transmute(client) };

        Fixture { env, admin, members: members_vec, token, client, contribution, max_members, interval }
    }

    // ─── Tests ────────────────────────────────────────────────────────────────

    /// Full lifecycle: initialize → join all → contribute each cycle → payout × N → complete
    #[test]
    fn test_full_lifecycle() {
        let f = setup_fixture(3);
        let Fixture { env, members, token, client, contribution, max_members, interval, .. } = &f;

        // 1. All members join
        for m in members.iter() {
            client.join(m);
        }

        let (cycle, max, _, completed) = client.get_state();
        assert_eq!(cycle, 1, "circle should start at cycle 1 after all members join");
        assert_eq!(max, *max_members);
        assert!(!completed);

        // 2. Run through every cycle
        let mut timestamp: u64 = 0;
        for cycle_num in 1..=*max_members {
            // Advance past payout time
            timestamp += interval + 1;
            env.ledger().with_mut(|l| l.timestamp = timestamp);

            let recipient = members.get(cycle_num - 1).unwrap();
            let balance_before = token.balance(&recipient);

            client.payout();

            let balance_after = token.balance(&recipient);
            let expected_pot = contribution * (*max_members as i128);
            assert_eq!(
                balance_after - balance_before,
                expected_pot,
                "cycle {cycle_num}: recipient should receive full pot"
            );

            if cycle_num < *max_members {
                let (current, _, _, done) = client.get_state();
                assert_eq!(current, cycle_num + 1);
                assert!(!done);

                // All members contribute for next cycle
                for m in members.iter() {
                    client.contribute(m);
                }
            }
        }

        let (_, _, _, completed) = client.get_state();
        assert!(completed, "circle should be marked completed after all payouts");
    }

    /// initialize: rejects duplicate initialization
    #[test]
    #[should_panic(expected = "already initialized")]
    fn test_double_initialize_panics() {
        let f = setup_fixture(2);
        let token_id = f.env.register_stellar_asset_contract(f.admin.clone());
        f.client.initialize(&f.admin, &token_id, &100_000_000, &2, &86_400);
    }

    /// initialize: rejects max_members < 2
    #[test]
    #[should_panic(expected = "max_members must be between 2 and 20")]
    fn test_initialize_too_few_members() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let token_id = env.register_stellar_asset_contract(admin.clone());
        let contract_id = env.register_contract(None, AjoContract);
        let client = AjoContractClient::new(&env, &contract_id);
        client.initialize(&admin, &token_id, &100_000_000, &1, &86_400);
    }

    /// initialize: rejects max_members > 20
    #[test]
    #[should_panic(expected = "max_members must be between 2 and 20")]
    fn test_initialize_too_many_members() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let token_id = env.register_stellar_asset_contract(admin.clone());
        let contract_id = env.register_contract(None, AjoContract);
        let client = AjoContractClient::new(&env, &contract_id);
        client.initialize(&admin, &token_id, &100_000_000, &21, &86_400);
    }

    /// join: rejects duplicate member
    #[test]
    #[should_panic(expected = "already a member")]
    fn test_join_duplicate_member() {
        let f = setup_fixture(3);
        let member = f.members.get(0).unwrap();
        f.client.join(&member);
        f.client.join(&member); // second join should panic
    }

    /// join: rejects join after circle started
    #[test]
    #[should_panic(expected = "circle already started")]
    fn test_join_after_started() {
        let f = setup_fixture(2);
        // Fill the circle (auto-starts)
        for m in f.members.iter() {
            f.client.join(m);
        }
        // Try to join with a new address after start
        let late = Address::generate(&f.env);
        f.client.join(&late);
    }

    /// join: rejects when circle is full
    #[test]
    #[should_panic(expected = "circle is full")]
    fn test_join_full_circle() {
        let f = setup_fixture(2);
        for m in f.members.iter() {
            f.client.join(m);
        }
        // Circle is now full and started; extra join should panic with "circle already started"
        // (which fires before "circle is full" since started check comes first)
        let extra = Address::generate(&f.env);
        f.client.join(&extra);
    }

    /// contribute: rejects non-member
    #[test]
    #[should_panic(expected = "not a member")]
    fn test_contribute_non_member() {
        let f = setup_fixture(2);
        for m in f.members.iter() {
            f.client.join(m);
        }
        let outsider = Address::generate(&f.env);
        f.client.contribute(&outsider);
    }

    /// contribute: rejects double contribution in same cycle
    #[test]
    #[should_panic(expected = "already contributed this cycle")]
    fn test_contribute_double() {
        let f = setup_fixture(2);
        for m in f.members.iter() {
            f.client.join(m);
        }
        let member = f.members.get(0).unwrap();
        f.client.contribute(&member); // second contribution in cycle 1
    }

    /// contribute: rejects before circle starts
    #[test]
    #[should_panic(expected = "circle not started yet")]
    fn test_contribute_before_start() {
        let f = setup_fixture(3);
        // Only one member joins — circle not started
        f.client.join(&f.members.get(0).unwrap());
        f.client.contribute(&f.members.get(0).unwrap());
    }

    /// payout: rejects before payout time
    #[test]
    #[should_panic(expected = "payout time not reached")]
    fn test_payout_too_early() {
        let f = setup_fixture(2);
        for m in f.members.iter() {
            f.client.join(m);
        }
        f.client.payout(); // timestamp is 0, payout time is interval+1
    }

    /// payout: rejects after circle completed
    #[test]
    #[should_panic(expected = "circle already completed")]
    fn test_payout_after_complete() {
        let f = setup_fixture(2);
        for m in f.members.iter() {
            f.client.join(m);
        }

        // Cycle 1 payout
        f.env.ledger().with_mut(|l| l.timestamp = f.interval + 1);
        f.client.payout();

        // Contribute for cycle 2
        for m in f.members.iter() {
            f.client.contribute(m);
        }

        // Cycle 2 payout (completes circle)
        f.env.ledger().with_mut(|l| l.timestamp = f.interval * 2 + 2);
        f.client.payout();

        // Third payout should panic
        f.env.ledger().with_mut(|l| l.timestamp = f.interval * 3 + 3);
        f.client.payout();
    }

    /// get_members: returns correct member list
    #[test]
    fn test_get_members() {
        let f = setup_fixture(3);
        assert_eq!(f.client.get_members().len(), 0);

        f.client.join(&f.members.get(0).unwrap());
        assert_eq!(f.client.get_members().len(), 1);

        for i in 1..3u32 {
            f.client.join(&f.members.get(i).unwrap());
        }
        assert_eq!(f.client.get_members().len(), 3);
    }

    /// get_state: returns zeroed state before initialization (via default)
    #[test]
    fn test_get_state_before_start() {
        let f = setup_fixture(3);
        let (cycle, _, _, completed) = f.client.get_state();
        assert_eq!(cycle, 0);
        assert!(!completed);
    }

    /// Pot distribution: each member ends up net-positive after receiving payout
    #[test]
    fn test_net_positive_for_all_members() {
        let f = setup_fixture(3);
        let Fixture { env, members, token, client, contribution, max_members, interval, .. } = &f;

        let initial_balances: Vec<i128> = {
            let mut v = Vec::new(&env);
            for m in members.iter() {
                v.push_back(token.balance(&m));
            }
            v
        };

        for m in members.iter() {
            client.join(m);
        }

        let mut timestamp: u64 = 0;
        for cycle_num in 1..=*max_members {
            timestamp += interval + 1;
            env.ledger().with_mut(|l| l.timestamp = timestamp);
            client.payout();
            if cycle_num < *max_members {
                for m in members.iter() {
                    client.contribute(m);
                }
            }
        }

        // Every member should have received the pot once and paid contribution × max_members
        // Net = pot - (contribution × max_members) = 0 for non-recipients, pot for recipient
        // But since each member IS the recipient exactly once, net = 0 for all (break-even)
        for (i, m) in members.iter().enumerate() {
            let final_balance = token.balance(&m);
            let initial = initial_balances.get(i as u32).unwrap();
            // Each member paid contribution × max_members and received pot (= contribution × max_members) once
            assert_eq!(
                final_balance, initial,
                "member {i} should break even after full circle"
            );
        }
    }
}
