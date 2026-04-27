# Secrets Security Audit

## Audit Summary

All secrets are loaded exclusively from environment variables via `src/server/config/index.ts`.
No secrets are hardcoded in source code.

## Secret Inventory

| Variable | Description | Sensitivity |
|---|---|---|
| `NEXTAUTH_SECRET` | NextAuth JWT signing key | Critical |
| `STELLAR_SERVER_SECRET_KEY` | Stellar keypair for on-chain transactions | Critical |
| `PAYSTACK_SECRET_KEY` | Paystack API secret for payment processing | Critical |
| `TERMII_API_KEY` | SMS/OTP delivery | High |
| `DATABASE_URL` | PostgreSQL connection string (includes password) | High |
| `REDIS_URL` | Redis connection string | High |
| `CRON_SECRET` | Bearer token for cron endpoint auth | High |
| `SENTRY_AUTH_TOKEN` | Sentry release upload token | Medium |
| `SLACK_WEBHOOK_URL` | Slack alert webhook | Medium |

## .gitignore Verification

`.env.local` and all `.env.*.local` variants are listed in `.gitignore`. Verified ✓

## Production Secret Storage

### Vercel (recommended for Next.js)

Store all secrets in **Vercel Environment Variables** (Settings → Environment Variables).
Mark each as "Production" only. They are encrypted at rest and injected at build/runtime.

```
vercel env add STELLAR_SERVER_SECRET_KEY production
vercel env add PAYSTACK_SECRET_KEY production
vercel env add NEXTAUTH_SECRET production
# ... repeat for each secret
```

### AWS Secrets Manager (alternative)

For self-hosted or AWS-based deployments, store secrets in AWS Secrets Manager and
fetch them at startup using the AWS SDK. Never log or print secret values.

```ts
// Example: fetch at startup (not per-request)
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({ region: "us-east-1" });
const { SecretString } = await client.send(
  new GetSecretValueCommand({ SecretId: "ajosave/production" })
);
const secrets = JSON.parse(SecretString!);
```

## Secret Rotation Procedure

### 1. NEXTAUTH_SECRET

1. Generate a new secret: `openssl rand -base64 32`
2. Update in Vercel: `vercel env rm NEXTAUTH_SECRET production && vercel env add NEXTAUTH_SECRET production`
3. Redeploy. All existing sessions are invalidated — users must re-login.

### 2. STELLAR_SERVER_SECRET_KEY

1. Generate a new Stellar keypair on testnet/mainnet via Stellar Laboratory or CLI:
   ```
   stellar keys generate new-server-key --network testnet
   ```
2. Fund the new account (testnet: friendbot; mainnet: transfer XLM).
3. Update `STELLAR_SERVER_SECRET_KEY` in Vercel.
4. Redeploy. The old keypair can be deactivated by removing its signers.

### 3. PAYSTACK_SECRET_KEY

1. Log in to [Paystack Dashboard](https://dashboard.paystack.com) → Settings → API Keys.
2. Roll the secret key.
3. Update `PAYSTACK_SECRET_KEY` in Vercel immediately after rolling.
4. Redeploy within the grace period Paystack provides.

### 4. DATABASE_URL / REDIS_URL

1. Rotate the password in your database provider (Supabase, RDS, etc.).
2. Update `DATABASE_URL` in Vercel.
3. Redeploy. Connection pool will reconnect with the new credentials.

### 5. TERMII_API_KEY / CRON_SECRET / SENTRY_AUTH_TOKEN

1. Regenerate in the respective provider dashboard.
2. Update in Vercel and redeploy.

## CI Secrets

CI secrets (used in GitHub Actions) are stored in **GitHub Actions Secrets**
(Settings → Secrets and variables → Actions). They are never printed in logs.

Current CI secrets required:
- `CODECOV_TOKEN`
- `STELLAR_TESTNET_SECRET_KEY` (deploy-contract-testnet job)

## Scanning

The `security` workflow (`.github/workflows/security.yml`) runs on every push.
Additionally, enable **GitHub Secret Scanning** and **Dependabot alerts** in the
repository settings to catch accidental secret commits automatically.
