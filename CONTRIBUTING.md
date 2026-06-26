# Contributing to Ajosave

Thank you for your interest in Ajosave! This guide covers everything you need to go from zero to a working local environment, run the test suite, deploy the smart contract to testnet, and open a pull request.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Local Setup](#local-setup)
- [Environment Variables](#environment-variables)
- [Running the App](#running-the-app)
- [Running Tests](#running-tests)
- [Smart Contract Development](#smart-contract-development)
- [Commit Convention](#commit-convention)
- [Pull Request Process](#pull-request-process)
- [Reporting Issues](#reporting-issues)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Next.js App                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Public Pages│  │  API Routes  │  │  Server Services │  │
│  │  /circles    │  │  /api/circles│  │  circle.service  │  │
│  │  /dashboard  │  │  /api/auth   │  │  payout.service  │  │
│  │  /auth/login │  │  /api/cron   │  │  scheduler       │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
   Paystack (NGN)       PostgreSQL DB         Stellar Network
   (contributions)      (circle records)      (USDC + Soroban)
                                                    │
                                          ┌─────────────────┐
                                          │   Ajo Contract   │
                                          │  (Soroban/Rust)  │
                                          │  Auto-rotation   │
                                          │  Trustless payout│
                                          └─────────────────┘
```

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), TypeScript, Vanilla CSS |
| Backend | Next.js Route Handlers, server services layer |
| Blockchain | Stellar, Soroban smart contracts (Rust) |
| Stablecoin | USDC on Stellar |
| Payments | Paystack (NGN on-ramp) |
| SMS/OTP | Termii |
| Database | PostgreSQL |
| Cache/Queue | Redis |

Key directories:

```
src/
├── app/api/          # Next.js Route Handlers (REST API)
├── server/
│   ├── services/     # Business logic (circle, payout, scheduler)
│   └── middleware/   # Auth, rate limiting, error handling
├── lib/              # Stellar SDK, Paystack, SMS, Auth helpers
└── types/            # TypeScript types + Zod schemas
contracts/
└── ajo/              # Soroban smart contract (Rust)
```

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 20 | [nodejs.org](https://nodejs.org) |
| npm | ≥ 10 | bundled with Node |
| Rust | stable | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| wasm32 target | — | `rustup target add wasm32-unknown-unknown` |
| Stellar CLI | latest | [Installation guide](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli) |
| PostgreSQL | ≥ 14 | [postgresql.org](https://www.postgresql.org/download/) |
| Redis | ≥ 7 | [redis.io](https://redis.io/docs/getting-started/) |

> **Docker alternative:** `docker compose up -d` starts PostgreSQL and Redis locally without manual installation.

---

## Local Setup

```bash
# 1. Clone the repo
git clone https://github.com/JosephOnuh/ajosave.git
cd ajosave

# 2. Install Node dependencies
npm install

# 3. Copy and fill in environment variables
cp .env.example .env.local
# Edit .env.local — see the Environment Variables section below

# 4. Start PostgreSQL and Redis (skip if already running)
docker compose up -d

# 5. Run database migrations
npm run migrate

# 6. Start the development server
npm run dev
```

The app is now available at [http://localhost:3000](http://localhost:3000).  
API documentation (Swagger UI) is at [http://localhost:3000/api/docs](http://localhost:3000/api/docs).

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the values below. Variables marked **required** must be set for the app to start.

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXTAUTH_SECRET` | ✅ | Random string ≥ 32 chars — `openssl rand -base64 32` |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `REDIS_URL` | ✅ | Redis connection string |
| `STELLAR_NETWORK` | ✅ | `testnet` or `mainnet` |
| `STELLAR_AJO_CONTRACT_ID` | ✅ | Deployed Soroban contract address |
| `STELLAR_SERVER_SECRET_KEY` | ✅ | Stellar secret key for the platform wallet |
| `PAYSTACK_SECRET_KEY` | ✅ | Paystack secret key (from dashboard) |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | ✅ | Paystack public key |
| `TERMII_API_KEY` | ✅ | Termii API key for SMS OTP |
| `CRON_SECRET` | ✅ | Secret for the `/api/cron/cycle` endpoint |
| `SENTRY_DSN` | optional | Sentry error tracking DSN |
| `SLACK_WEBHOOK_URL` | optional | Slack alerts webhook |

For local development you can use the Stellar testnet and Paystack test keys — no real funds are involved.

---

## Running the App

```bash
npm run dev          # Development server with hot reload
npm run build        # Production build
npm run start        # Start production build
npm run lint         # ESLint
npm run lint:fix     # ESLint with auto-fix
npm run type-check   # TypeScript type check (no emit)
npm run format       # Prettier format all files
```

---

## Running Tests

### JavaScript / TypeScript tests (Jest)

```bash
npm test                  # Run all tests (passes with no tests)
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage report
```

Tests live alongside the code they test in `__tests__/` directories:

```
src/server/middleware/__tests__/rateLimit.test.ts
src/server/services/__tests__/payout.service.test.ts
```

### Smart contract tests (Rust)

```bash
npm run contract:test
# or directly:
cd contracts && cargo test
```

Contract tests are in `contracts/ajo/src/lib.rs` under `#[cfg(test)]`.

---

## Smart Contract Development

The Ajo contract lives in `contracts/ajo/`. See [`contracts/ajo/README.md`](contracts/ajo/README.md) for the full technical reference (lifecycle, storage layout, events, security model).

### Build

```bash
npm run contract:build
# Outputs: contracts/target/wasm32-unknown-unknown/release/ajo.wasm
```

### Deploy to testnet

```bash
# Ensure STELLAR_SERVER_SECRET_KEY is set in your environment
STELLAR_NETWORK=testnet npm run contract:deploy
```

The deploy script (`scripts/deploy-contract.ts`) uploads the WASM, deploys the contract, and prints the new contract ID. Update `STELLAR_AJO_CONTRACT_ID` in your `.env.local`.

### Testnet contract

| Field | Value |
|-------|-------|
| Network | Stellar Testnet |
| Contract ID | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |
| Explorer | [View on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC) |

CI automatically re-deploys the contract to testnet on every merge to `main`.

---

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

[optional body]

[optional footer: Closes #<issue>]
```

Common types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`.

Examples:

```
feat(circle): add member kick functionality
fix(contract): prevent payout before all contributions received
docs: add smart contract README
test(middleware): add rate limit tests
```

---

## Pull Request Process

1. **Branch from `develop`:**
   ```bash
   git checkout develop
   git pull
   git checkout -b feat/your-feature
   ```

2. **Make your changes** with tests where applicable.

3. **Verify locally:**
   ```bash
   npm run type-check
   npm run lint
   npm test
   npm run contract:test   # if you touched the contract
   ```

4. **Open a PR against `develop`** and fill in the PR template.

5. PRs require **one approval** to merge. Security-sensitive contract changes require **two approvals**.

6. Reference the issue in your PR description: `Closes #<issue-number>`.

---

## Reporting Issues

- **Bugs** → [Bug Report template](.github/ISSUE_TEMPLATE/bug_report.md)
- **Features** → [Feature Request template](.github/ISSUE_TEMPLATE/feature_request.md)
- **Security vulnerabilities** → **security@ajosave.app** only (do not open a public issue)
