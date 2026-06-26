# Vercel Production Setup

## Dashboard environment variables

The following secrets **must** be added in the Vercel dashboard under  
**Project → Settings → Environment Variables** (Production + Preview scopes).

| Variable | Description |
|---|---|
| `NEXTAUTH_URL` | Production URL, e.g. `https://ajosave.app` |
| `NEXTAUTH_SECRET` | Random 32-byte secret (`openssl rand -base64 32`) |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `STELLAR_AJO_CONTRACT_ID` | Deployed Soroban contract ID |
| `STELLAR_SERVER_SECRET_KEY` | Stellar keypair secret for server signing |
| `PAYSTACK_SECRET_KEY` | Paystack secret key |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | Paystack public key |
| `NEXT_PUBLIC_APP_URL` | Production URL (same as `NEXTAUTH_URL`) |
| `TERMII_API_KEY` | Termii SMS API key |
| `CRON_SECRET` | Secret checked by `/api/cron/cycle` to reject unauthorized calls |

Non-secret values (network, asset code, etc.) are already set in `vercel.json`.

## Deployment settings

- **Production branch**: `main` (set in Vercel dashboard → Git → Production Branch)
- **Preview deployments**: enabled for all PRs via `github.autoAlias: true` in `vercel.json`
- **Cron job**: `POST /api/cron/cycle` runs every hour (`0 * * * *`)

## Verifying the cron

After deploying, confirm the cron appears under  
**Project → Settings → Cron Jobs** in the Vercel dashboard.
