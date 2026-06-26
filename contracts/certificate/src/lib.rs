//! Ajosave Certificate Contract
//!
//! Issues non-transferable on-chain completion certificates to members who
//! finish a full savings circle. Each certificate is a persistent storage
//! record keyed by (member_address, circle_id).
//!
//! ## Functions
//! - `mint`   — admin mints a certificate for a member (idempotent)
//! - `get`    — read a certificate by member + circle
//! - `has`    — check whether a certificate exists

#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, BytesN, Env, String, Symbol};

// ─── Storage keys ─────────────────────────────────────────────────────────────

#[contracttype]
pub enum DataKey {
    Admin,
    /// Certificate keyed by (member_address, circle_id_bytes)
    Cert(Address, BytesN<32>),
}

// ─── Certificate data ─────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub struct Certificate {
    pub member:          Address,
    pub circle_id:       BytesN<32>,
    pub circle_name:     String,
    pub cycles_completed: u32,
    pub total_saved_usdc: i128, // in stroops (7 decimal places)
    pub issued_at:       u64,   // Unix timestamp (ledger close time)
}

// ─── Contract ─────────────────────────────────────────────────────────────────

#[contract]
pub struct CertificateContract;

#[contractimpl]
impl CertificateContract {
    /// One-time initialisation — sets the admin address.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    /// Mint a certificate for `member` on completion of `circle_id`.
    /// Idempotent: calling again for the same (member, circle_id) is a no-op.
    pub fn mint(
        env: Env,
        member: Address,
        circle_id: BytesN<32>,
        circle_name: String,
        cycles_completed: u32,
        total_saved_usdc: i128,
    ) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let key = DataKey::Cert(member.clone(), circle_id.clone());
        if env.storage().persistent().has(&key) {
            return; // idempotent
        }

        let cert = Certificate {
            member,
            circle_id,
            circle_name,
            cycles_completed,
            total_saved_usdc,
            issued_at: env.ledger().timestamp(),
        };

        env.storage().persistent().set(&key, &cert);

        env.events().publish(
            (Symbol::new(&env, "cert_minted"),),
            cert,
        );
    }

    /// Retrieve a certificate. Returns None if not found.
    pub fn get(env: Env, member: Address, circle_id: BytesN<32>) -> Option<Certificate> {
        env.storage()
            .persistent()
            .get(&DataKey::Cert(member, circle_id))
    }

    /// Check whether a certificate exists for (member, circle_id).
    pub fn has(env: Env, member: Address, circle_id: BytesN<32>) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::Cert(member, circle_id))
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    fn setup() -> (Env, CertificateContractClient<'static>, Address) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, CertificateContract);
        let client = CertificateContractClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        client.initialize(&admin);
        (env, client, admin)
    }

    fn circle_id(env: &Env) -> BytesN<32> {
        BytesN::from_array(env, &[1u8; 32])
    }

    #[test]
    fn mint_and_get() {
        let (env, client, _) = setup();
        let member = Address::generate(&env);
        let cid = circle_id(&env);
        let name = String::from_str(&env, "Test Circle");

        client.mint(&member, &cid, &name, &3, &300_000_000);

        let cert = client.get(&member, &cid).unwrap();
        assert_eq!(cert.cycles_completed, 3);
        assert_eq!(cert.total_saved_usdc, 300_000_000);
        assert!(client.has(&member, &cid));
    }

    #[test]
    fn mint_is_idempotent() {
        let (env, client, _) = setup();
        let member = Address::generate(&env);
        let cid = circle_id(&env);
        let name = String::from_str(&env, "Test Circle");

        client.mint(&member, &cid, &name, &3, &300_000_000);
        client.mint(&member, &cid, &name, &3, &300_000_000); // second call — no panic
    }

    #[test]
    fn get_returns_none_for_missing() {
        let (env, client, _) = setup();
        let member = Address::generate(&env);
        let cid = circle_id(&env);
        assert!(client.get(&member, &cid).is_none());
        assert!(!client.has(&member, &cid));
    }

    #[test]
    #[should_panic(expected = "already initialized")]
    fn double_initialize_panics() {
        let (env, client, admin) = setup();
        client.initialize(&admin);
    }
}
