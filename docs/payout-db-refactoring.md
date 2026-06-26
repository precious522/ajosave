# Database Refactoring: In-Memory Map → PostgreSQL

## Overview
This document describes the refactoring of `payout.service.ts` from in-memory array storage to PostgreSQL database persistence, enabling horizontal scalability and data durability.

## What Changed

### Before (In-Memory)
```typescript
// In-memory payout log — replace with DB
const payouts: Payout[] = [];

export async function getPayoutsByCircle(circleId: string): Promise<Payout[]> {
  return payouts.filter((p) => p.circleId === circleId);
}
```

### After (PostgreSQL)
```typescript
export async function getPayoutsByCircle(circleId: string): Promise<Payout[]> {
  const { rows } = await query<Payout>(
    `SELECT id, circle_id as "circleId", recipient_member_id as "recipientMemberId" ...
     FROM payouts WHERE circle_id = $1 ORDER BY cycle_number ASC`,
    [circleId]
  );
  return rows;
}
```

## Key Benefits

| Feature | In-Memory | PostgreSQL |
|---------|-----------|-----------|
| Data Persistence | ❌ Lost on restart | ✅ Durable |
| Horizontal Scaling | ❌ Single instance only | ✅ Multiple instances |
| Query Performance | O(n) filter | O(1) indexed lookup |
| Data Reliability | ❌ No backup | ✅ Full ACID support |
| Multi-Service Access | ❌ Instance-local | ✅ Shared data layer |

## Database Schema

### Payouts Table
```sql
CREATE TABLE payouts (
  id UUID PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES circles(id),
  recipient_member_id UUID NOT NULL REFERENCES members(id),
  cycle_number INTEGER NOT NULL,
  amount_usdc NUMERIC(20, 7) NOT NULL,
  tx_hash VARCHAR(255) NOT NULL UNIQUE,
  paid_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  INDEX idx_payouts_circle_id (circle_id),
  INDEX idx_payouts_cycle (circle_id, cycle_number)
);
```

**Related Tables** (already in schema):
- `circles` - Referenced via `circle_id` FK
- `members` - Referenced via `recipient_member_id` FK

## Migration Steps

### 1. Database Setup
Execute the schema migration:
```bash
psql -h localhost -U postgres -d ajosave_db -f docs/schema.sql
```

Or using your deployment tool:
```bash
npm run migrate:up  # If you have Flyway/Liquibase configured
```

### 2. Verify Schema
```sql
-- Connect to your database
psql -h localhost -U postgres -d ajosave_db

-- Check payouts table exists
\dt payouts

-- Verify foreign keys
\d payouts
```

### 3. Deploy Updated Code
The service methods have been updated to use `query()` from `@/lib/db`:

**Updated Methods:**
- `processCyclePayout()` - Now persists payout to DB via INSERT
- `getPayoutsByCircle()` - Now queries payouts from DB

### 4. Run Tests
```bash
npm test -- payout.service.test.ts
```

All tests mock the database layer via `jest.mock("@/lib/db")`.

## Scalability Assurance

### ✅ Stateless Service
The refactored service is **completely stateless**:
- ❌ No module-level variables holding data
- ❌ No local caches
- ✅ All data read/written to PostgreSQL
- ✅ Multiple instances can run concurrently

### Configuration
Ensure your deployment has:
```bash
# .env configuration
DATABASE_URL="postgresql://user:password@localhost:5432/ajosave_db?schema=public"
```

### ⚠️ Known Limitation: Distributed Locking
**File:** [payout-lock.ts](../src/server/services/payout-lock.ts)

The `withPayoutLock()` mutex still uses an in-process Set:
```typescript
const locks = new Set<string>();
```

**Impact:** In single-instance deployments, this prevents concurrent payouts (correct behavior).
In multi-instance deployments, **race conditions are possible**.

**Solution for Production:**
Replace with distributed lock (Redis):
```typescript
import { redisClient } from "@/lib/redis";

export async function withPayoutLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const lockKey = `payout-lock:${key}`;
  const acquired = await redisClient.set(lockKey, "1", { EX: 30, NX: true });
  
  if (!acquired) throw new PayoutLockError(key);
  try {
    return await fn();
  } finally {
    await redisClient.del(lockKey);
  }
}
```

## Backward Compatibility

### API Contract
✅ **Unchanged** - All function signatures remain the same:
```typescript
processCyclePayout(circleId: string, recipientStellarKey: string): Promise<Payout>
getPayoutsByCircle(circleId: string): Promise<Payout[]>
```

### Data Model
✅ **Compatible** - The Payout interface matches database schema exactly:
```typescript
export interface Payout {
  id: string;
  circleId: string;
  recipientMemberId: string;
  cycleNumber: number;
  amountUsdc: string;
  txHash: string;
  paidAt: Date;
}
```

## Performance Characteristics

### Query Complexity
| Operation | In-Memory | PostgreSQL |
|-----------|-----------|-----------|
| Create payout | O(1) | O(n) - Insert + potential locks |
| Get payouts for circle | O(n) - Full scan | O(log n) - Indexed |
| Delete payouts | N/A - No delete | O(log n) |

### Index Strategy
Queries use these indexes for optimal performance:
- `idx_payouts_circle_id` - Fast lookup by circle
- `idx_payouts_cycle` - Composite index for (circle, cycle) queries
- `tx_hash` - Unique constraint prevents duplicates

## Monitoring & Logging

### Add Monitoring Queries
```sql
-- Check payout volume
SELECT circle_id, COUNT(*) as payout_count 
FROM payouts 
GROUP BY circle_id;

-- Verify recent payouts
SELECT * FROM payouts WHERE paid_at > NOW() - INTERVAL '24 hours';

-- Check for missing recipientMemberId (data quality)
SELECT COUNT(*) FROM payouts WHERE recipient_member_id IS NULL;
```

### Application Logging
The service now logs database operations through the standard `query()` interface.
Enable query logging in PostgreSQL for debugging:
```sql
ALTER SYSTEM SET log_min_duration_statement = 1000;  -- Log queries > 1 second
SELECT pg_reload_conf();
```

## Troubleshooting

### Issue: "table payouts does not exist"
**Solution:** Run schema migration - `docs/schema.sql` wasn't executed

### Issue: Foreign key violation on circle_id
**Solution:** Ensure circle exists before inserting payout. The service calls `getCircleById()` which throws if not found.

### Issue: Slow getPayoutsByCircle queries
**Solution:** Verify indexes exist:
```sql
SELECT * FROM pg_indexes WHERE tablename = 'payouts';
```

## Rollback Plan
If issues arise:

1. **Keep in-memory backup** (temporary):
   ```typescript
   const payoutCache: Map<string, Payout[]> = new Map();
   ```

2. **Revert service**:
   ```bash
   git checkout HEAD~1 -- src/server/services/payout.service.ts
   ```

3. **Populate cache from DB**:
   ```typescript
   const allPayouts = await query("SELECT * FROM payouts");
   // Rebuild cache
   ```

## Testing Strategy

### Unit Tests
- ✅ All mocked with `jest.mock("@/lib/db")`
- ✅ Query calls verified via `toHaveBeenCalledWith()`

### Integration Tests (Optional)
For end-to-end testing with real database:
```bash
npm run test:integration -- payout.service.test.ts
```

### Load Testing
Ensure horizontal scalability:
```bash
# Simulate concurrent instances
for i in {1..5}; do
  npm run dev &
done
# Run load test
```

## Summary

| Aspect | Status |
|--------|--------|
| Code Refactoring | ✅ Complete |
| Schema Creation | ✅ Complete |
| Test Updates | ✅ Complete |
| Scalability | ✅ Stateless design |
| Backward Compatibility | ✅ API unchanged |
| Production Ready | ⚠️ See distributed locking note |
