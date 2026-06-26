# Payout Service - Database Query Reference

## Active Queries in Code

### 1. Create/Insert Payout
**Location:** `payout.service.ts` - `processCyclePayout()`

```sql
INSERT INTO payouts (id, circle_id, recipient_member_id, cycle_number, amount_usdc, tx_hash, paid_at)
VALUES ($1, $2, $3, $4, $5, $6, NOW())
RETURNING id, circle_id as "circleId", recipient_member_id as "recipientMemberId", 
          cycle_number as "cycleNumber", amount_usdc as "amountUsdc", tx_hash as "txHash", paid_at as "paidAt"
```

**Parameters:**
- `$1`: payout ID (UUID)
- `$2`: circle ID (UUID)
- `$3`: recipient member ID (UUID)
- `$4`: cycle number (INTEGER)
- `$5`: total pot amount (NUMERIC)
- `$6`: Stellar transaction hash (VARCHAR)

**Returns:** Single Payout record with all fields

---

### 2. Retrieve Payouts by Circle
**Location:** `payout.service.ts` - `getPayoutsByCircle(circleId)`

```sql
SELECT id, circle_id as "circleId", recipient_member_id as "recipientMemberId",
       cycle_number as "cycleNumber", amount_usdc as "amountUsdc", tx_hash as "txHash", paid_at as "paidAt"
FROM payouts
WHERE circle_id = $1
ORDER BY cycle_number ASC
```

**Parameters:**
- `$1`: circle ID (UUID)

**Returns:** Array of Payout records sorted by cycle

---

## Useful Admin Queries

### Check Payouts for Specific Circle
```sql
SELECT * FROM payouts 
WHERE circle_id = 'YOUR_CIRCLE_ID' 
ORDER BY cycle_number DESC;
```

### Total Payout Amount by Circle
```sql
SELECT 
  circle_id,
  COUNT(*) as payout_count,
  SUM(amount_usdc::numeric) as total_paid
FROM payouts
GROUP BY circle_id
ORDER BY total_paid DESC;
```

### Recent Payouts (Last 24 hours)
```sql
SELECT 
  p.id,
  p.circle_id,
  c.name as circle_name,
  p.cycle_number,
  p.amount_usdc,
  p.paid_at
FROM payouts p
JOIN circles c ON p.circle_id = c.id
WHERE p.paid_at > NOW() - INTERVAL '24 hours'
ORDER BY p.paid_at DESC;
```

### Verify Referential Integrity
```sql
-- Find payouts with missing circle references
SELECT COUNT(*) 
FROM payouts 
LEFT JOIN circles ON payouts.circle_id = circles.id
WHERE circles.id IS NULL;

-- Find payouts with missing member references
SELECT COUNT(*) 
FROM payouts 
LEFT JOIN members ON payouts.recipient_member_id = members.id
WHERE members.id IS NULL;
```

### Check for Duplicate Transactions
```sql
-- Should return 0 rows (tx_hash is UNIQUE)
SELECT tx_hash, COUNT(*) 
FROM payouts 
GROUP BY tx_hash 
HAVING COUNT(*) > 1;
```

### Payment Status by Member
```sql
SELECT 
  m.user_id,
  m.position,
  COUNT(p.id) as payouts_received,
  SUM(p.amount_usdc::numeric) as total_received,
  MAX(p.paid_at) as last_payout
FROM members m
LEFT JOIN payouts p ON m.id = p.recipient_member_id
WHERE m.circle_id = 'YOUR_CIRCLE_ID'
GROUP BY m.user_id, m.position
ORDER BY m.position;
```

### Database Indexes Performance
```sql
-- Check index usage
SELECT 
  schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename = 'payouts';

-- Analyze slow queries
EXPLAIN ANALYZE
SELECT * FROM payouts 
WHERE circle_id = 'YOUR_CIRCLE_ID' 
ORDER BY cycle_number ASC;
```

---

## Schema Verification Commands

### View Payouts Table Definition
```sql
\d payouts
```

### View All Indexes on Payouts Table
```sql
SELECT 
  indexname, 
  indexdef
FROM pg_indexes 
WHERE tablename = 'payouts';
```

### Check Foreign Key Constraints
```sql
SELECT 
  constraint_name, 
  table_name, 
  column_name, 
  foreign_table_name, 
  foreign_column_name
FROM information_schema.key_column_usage
WHERE table_name = 'payouts' AND foreign_table_name IS NOT NULL;
```

### Table Size and Row Count
```sql
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
  n_live_tup as row_count
FROM pg_stat_user_tables
WHERE tablename = 'payouts';
```

---

## Parameterized Query Pattern

All queries use PostgreSQL parameterized syntax (`$1, $2, etc.`) with placeholders to prevent SQL injection.

**Example from code:**
```typescript
await query<Payout>(
  `SELECT * FROM payouts WHERE circle_id = $1`,
  [circleId]  // Parameters array - safely bound by PostgreSQL driver
);
```

✅ **Safe** - Parameters are type-safe and escaped by the driver
❌ **Never do this:** `` `SELECT * FROM payouts WHERE circle_id = '${circleId}'` ``

---

## Connection Pool Configuration

**File:** `src/lib/db.ts`

```typescript
const pool = new Pool({
  connectionString: serverConfig.database.url,
  max: 10,                      // Max concurrent connections
  idleTimeoutMillis: 30_000,    // Close idle connections after 30s
  connectionTimeoutMillis: 5_000 // Timeout on new connections
});
```

For high-throughput scenarios, consider increasing `max` from 10 to 20-30.

---

## Debugging Tips

### Enable PostgreSQL Query Logging
```sql
ALTER SYSTEM SET log_min_duration_statement = 1000;  -- Log queries > 1 second
SELECT pg_reload_conf();

-- View logs
tail -f /var/log/postgresql/postgresql.log | grep "SELECT * FROM payouts"
```

### Test Database Connection
```bash
# From Node.js/TypeScript
import { query } from "@/lib/db";

const result = await query("SELECT NOW()");
console.log(result.rows[0]);  // Should show current timestamp
```

### Check Active Connections
```sql
SELECT 
  datname,
  usename,
  application_name,
  state,
  query
FROM pg_stat_activity
WHERE datname = 'ajosave_db';
```
