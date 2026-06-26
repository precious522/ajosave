# Setup & Deployment Guide: Payout Service Refactoring

## Prerequisites

### System Requirements
- Node.js 18+ (for async/await support)
- PostgreSQL 12+ with superuser or CREATE TABLE privileges
- npm or yarn package manager

### Verify Installation
```bash
# Check Node.js version
node --version  # Should be v18.0.0 or higher

# Check PostgreSQL
psql --version  # Should be PostgreSQL 12 or higher

# Connect to PostgreSQL
psql -h localhost -U postgres -c "SELECT version();"
```

---

## Step 1: Create Database Schema

### Option A: Using psql (Direct)
```bash
# Connect to your Ajosave database
psql -h localhost -U postgres -d ajosave_db -f docs/schema.sql

# Verify table creation
psql -h localhost -U postgres -d ajosave_db -c "\dt payouts"
```

### Option B: Using Docker (If PostgreSQL is in container)
```bash
# From workspace root
docker-compose exec postgres psql -U postgres ajosave_db -f /docs/schema.sql
```

### Option C: Manual SQL Execution
```bash
# Start PostgreSQL shell
psql -h localhost -U postgres -d ajosave_db

# Then paste the contents of docs/schema.sql
\i docs/schema.sql

# Verify
\dt payouts
```

### Verify Schema Creation
```sql
-- Check payouts table exists
SELECT * FROM information_schema.tables 
WHERE table_name = 'payouts';

-- Check indexes
SELECT indexname FROM pg_indexes WHERE tablename = 'payouts';

-- Expected indexes:
-- ✓ idx_payouts_circle_id
-- ✓ idx_payouts_cycle  
-- ✓ idx_payouts_member_id
-- ✓ idx_payouts_paid_at
```

---

## Step 2: Environment Configuration

### Update .env File
```bash
# Copy current .env if not present
cp .env.example .env

# Verify DATABASE_URL is set
cat .env | grep DATABASE_URL
```

### Environment Variables
```bash
# .env or .env.local file
DATABASE_URL="postgresql://username:password@localhost:5432/ajosave_db?schema=public"

# For SSL connections (production)
# DATABASE_URL="postgresql://user:pass@db.example.com/ajosave_db?schema=public&sslmode=require"
```

### Validate Connection
```bash
# Test database connectivity
npm run test -- --testPathPattern="db.ts"

# Or manually test
node -e "
const pg = require('pg');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT NOW()', (err, res) => {
  console.log(err ? 'Connection failed:' + err : 'Connected! Time:', res.rows[0]);
  process.exit(0);
});
"
```

---

## Step 3: Deploy Code Changes

### Pull Latest Code
```bash
git pull origin main
# Or if you've already made changes:
# The files are already updated:
# - src/server/services/payout.service.ts
# - src/server/services/__tests__/payout.service.test.ts
```

### Install Dependencies (if needed)
```bash
npm install
```

---

## Step 4: Type Check & Test

### Run TypeScript Compiler
```bash
npm run type-check

# Should succeed with no errors
# If errors appear, check:
# 1. Payout interface matches database fields
# 2. Query return types are correct
# 3. Mock types in tests are accurate
```

### Run All Tests
```bash
# Run all tests including payout tests
npm test

# Or run only payout tests
npm test -- payout.service.test.ts

# Watch mode (re-run on file changes)
npm run test:watch
```

### Expected Test Output
```
 PASS  src/server/services/__tests__/payout.service.test.ts
  processCyclePayout
    happy path
      ✓ sends payment for the correct total pot and returns a payout record
      ✓ does NOT mark circle completed when cycles remain  
      ✓ marks circle completed when last member is paid
      ✓ returns payout record from database query
      ✓ retrieves payouts from database for a circle
    error cases
      ✓ throws 'Circle not found' when circle does not exist
      ✓ throws 'Circle is not active' when circle status is 'open'
      ✓ throws 'Circle is not active' when circle status is 'completed'
      ✓ throws 'Circle is not active' when circle status is 'cancelled'
      ✓ propagates Stellar SDK errors
  getPayoutsByCircle
    ✓ returns empty array for a circle with no payouts

Test Suites: 1 passed, 1 total
Tests:       11 passed, 11 total
```

---

## Step 5: Local Development

### Start Development Server
```bash
# Start watching and compiling
npm run dev

# Service will be available at http://localhost:3000
```

### Test Endpoints
```bash
# Test health check
curl http://localhost:3000/api/health

# Create a test circle
curl -X POST http://localhost:3000/api/circles \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Circle",
    "contributionFiat": 50000,
    "contributionCurrency": "NGN",
    "maxMembers": 5,
    "cycleFrequency": "monthly"
  }'

# Retrieve payouts (should be empty initially)
curl http://localhost:3000/api/circles/CIRCLE_ID/payouts
```

### Database Inspection During Development
```bash
# In another terminal, connect to PostgreSQL
psql -h localhost -U postgres -d ajosave_db

# Inspect payouts table
SELECT * FROM payouts ORDER BY paid_at DESC LIMIT 5;

# Monitor active connections
SELECT * FROM pg_stat_activity WHERE datname = 'ajosave_db';
```

---

## Step 6: Staging Deployment

### Build for Production
```bash
npm run build

# Check build output
ls -la .next/
```

### Database Backup (Always do this before deploying)
```bash
# Backup existing database
pg_dump -h localhost -U postgres ajosave_db > backup-$(date +%Y%m%d-%H%M%S).sql

# Store backup securely
aws s3 cp backup-*.sql s3://my-bucket/backups/
```

### Deploy to Staging
```bash
# Using Vercel (if configured)
vercel --prod --token=$VERCEL_TOKEN

# Or using custom deployment
npm run build && npm run start
```

### Post-Deployment Verification
```bash
# API test from deployed environment
curl https://staging.ajosave.app/api/health

# Check that new payouts go to database
# Process a test payout and verify database row exists
psql -h staging-db.example.com -U postgres ajosave_db -c "SELECT COUNT(*) FROM payouts;"
```

---

## Step 7: Production Deployment

### Production Checklist
- [ ] All tests passing (`npm test`)
- [ ] No TypeScript errors (`npm run type-check`)
- [ ] Database schema applied to production
- [ ] DATABASE_URL environment variable is set
- [ ] Database backup completed
- [ ] Staging environment tested
- [ ] Rollback plan documented
- [ ] (Optional) Distributed lock implementation completed

### Production Deployment Command
```bash
# Tag release in git
git tag -a v1.0.0-db-refactor -m "Refactor payout storage to PostgreSQL"
git push origin v1.0.0-db-refactor

# Deploy (via CI/CD or manual)
# If using Vercel:
vercel --prod --token=$VERCEL_TOKEN

# If using Docker:
docker build -t ajosave:1.0.0-db-refactor .
docker push ajosave:1.0.0-db-refactor
# Update deployment configuration
```

### Monitor in Production
```bash
# Check application logs for errors
# If using Vercel:
vercel logs --prod

# If using custom hosting:
tail -f /var/log/ajosave/application.log

# Monitor database performance
# Check slow query log (from production database)
SELECT query, calls, mean_time 
FROM pg_stat_statements 
WHERE query LIKE '%payouts%' 
ORDER BY mean_time DESC;
```

---

## Troubleshooting

### Issue: "role postgres does not exist"
```bash
# Create PostgreSQL user if missing
sudo -u postgres createuser -s postgres

# Or for superuser with password
sudo -u postgres createuser -s -P postgres
```

### Issue: "database ajosave_db does not exist"
```bash
# Create database
psql -h localhost -U postgres -c "CREATE DATABASE ajosave_db;"

# Verify
psql -h localhost -U postgres -l | grep ajosave_db
```

### Issue: Database connection timeout
```bash
# Check PostgreSQL is running
systemctl status postgresql

# Or if using Docker:
docker-compose ps

# Check connection string format
echo $DATABASE_URL  # Should be: postgresql://user:pass@host:port/db
```

### Issue: Tests fail with "Cannot find module @/lib/db"
```bash
# Ensure TypeScript paths are configured
cat tsconfig.json | grep "@/"

# Should show path alias configuration
# Run with TypeScript loader:
npm test -- --extensionsToTreatAsEsm=.ts
```

### Issue: "INSERT INTO payouts violates foreign key constraint"
```sql
-- Check foreign key references exist
SELECT COUNT(*) FROM circles WHERE id = 'CIRCLE_ID';
SELECT COUNT(*) FROM members WHERE id = 'MEMBER_ID';

-- If missing, data integrity issue - check application logic
```

---

## Rollback Plan

### If Deployment Fails

**Option 1: Revert to previous code**
```bash
git revert HEAD
git push origin main

# Redeploy previous version without database changes
npm run build && npm run start
```

**Option 2: Keep database, revert code only**
```bash
# Service will still work with old code
# New payouts won't be recorded automatically
# Manually migrate data if needed (see schema.sql comments)
```

**Option 3: Full rollback with database restore**
```bash
# Restore database backup
psql -h localhost -U postgres ajosave_db < backup-TIMESTAMP.sql

# Revert code
git checkout HEAD~1 -- src/server/services/payout.service.ts
npm run build && npm run start
```

---

## Performance Tuning (if needed)

### Increase Connection Pool Size
If experiencing "too many connections":
```typescript
// src/lib/db.ts
const pool = new Pool({
  max: 20,  // Increased from 10
  idleTimeoutMillis: 30_000
});
```

### Add Query Caching Layer
```bash
# Install Redis
npm install redis

# Implement caching wrapper in payout.service.ts
// Cache getPayoutsByCircle results for 5 minutes
```

### Monitor Query Performance
```sql
-- Slow query log
ALTER SYSTEM SET log_min_duration_statement = 500;  -- Log queries > 500ms
SELECT pg_reload_conf();

-- Analyze slow queries
EXPLAIN ANALYZE 
SELECT * FROM payouts WHERE circle_id = $1 ORDER BY cycle_number;
```

---

## Support & Documentation

- **Detailed Migration Guide:** [docs/payout-db-refactoring.md](./payout-db-refactoring.md)
- **Query Reference:** [docs/payout-queries-reference.md](./payout-queries-reference.md)
- **Refactoring Summary:** [REFACTORING_SUMMARY.md](../REFACTORING_SUMMARY.md)
- **GitHub Issues:** Create issue with `[payout-service]` tag

---

## Estimated Timeline

| Task | Time |
|------|------|
| Schema creation | 5 min |
| Environment setup | 5 min |
| Code deployment | 5 min |
| Tests & verification | 10 min |
| Staging deployment | 15 min |
| Production deployment | 10 min |
| Post-deployment monitoring | Ongoing |
| **Total** | **~50 minutes** |

---

## Testnet Faucet (Development Only)

When `STELLAR_NETWORK=testnet`, a built-in faucet endpoint lets developers fund a Stellar account with testnet XLM and USDC in one step.

### API

```
POST /api/stellar/faucet
Content-Type: application/json
Authorization: session cookie (must be logged in)

{ "publicKey": "G..." }
```

**Response**
```json
{ "success": true, "data": { "xlmFunded": true, "usdcTxHash": "abc123..." } }
```

Blocked with `403` on mainnet.

### UI Button

The `FundTestnetButton` component (at `src/components/wallet/FundTestnetButton.tsx`) renders only when `NEXT_PUBLIC_STELLAR_NETWORK=testnet`. Add it to any wallet-connected page:

```tsx
import FundTestnetButton from "@/components/wallet/FundTestnetButton";

<FundTestnetButton publicKey={stellarPublicKey} onSuccess={(txHash) => console.log(txHash)} />
```

### Rate Limiting

The endpoint is rate-limited to **5 requests per 10 minutes** per IP to prevent abuse.

### What it does

1. Calls Friendbot (`https://friendbot.stellar.org?addr=<key>`) to create the account and fund it with 10,000 XLM.
2. Sends **100 USDC** from the server wallet to the account.

> **Requirement:** The server wallet (`STELLAR_SERVER_SECRET_KEY`) must hold a USDC trustline and sufficient balance. Fund it once via [Stellar Laboratory](https://laboratory.stellar.org) on testnet.
