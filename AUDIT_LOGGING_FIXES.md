# Admin Audit Logging - Bug Fixes

## Summary
Fixed critical bugs in the audit logging implementation that would have caused runtime errors when logging admin actions.

## Issues Fixed

### 1. Incorrect Function Call in V0 Payout Endpoint
**File:** `src/app/api/admin/circles/[id]/payout/route.ts`

**Issue:** The `logAuditAction()` function was called with incorrect argument order. The function signature expects:
```typescript
logAuditAction(
  actorId: string,
  action: AuditAction,
  targetType: AuditTargetType,
  targetId: string,
  options?: {...}
)
```

But it was being called as:
```typescript
await logAuditAction("TRIGGER_PAYOUT", "PAYOUT", params.id, {...})
```

**Fix:** Corrected the call to include `actorId` as the first parameter:
```typescript
await logAuditAction(actorId, "TRIGGER_PAYOUT", "PAYOUT", params.id, {...})
```

### 2. Missing Audit Logging in V1 Payout Endpoint
**File:** `src/app/api/v1/admin/circles/[id]/payout/route.ts`

**Issue:** The V1 payout endpoint had no audit logging, while the V0 endpoint did. This created inconsistency in audit trail coverage.

**Fix:** Added complete audit logging to V1 endpoint:
- Imported required modules: `getServerSession`, `logAuditAction`, `getRequestContext`, `authOptions`
- Updated JSDoc to document audit logging
- Added session retrieval to get `actorId`
- Added audit log call with same details as V0 endpoint
- Logs: `TRIGGER_PAYOUT` action with circle name, recipient, cycle, amount, and tx hash

### 3. Migration Function Ordering Issue
**File:** `migrations/1746800000000_add-audit-logs-table.ts`

**Issue:** The migration was creating the trigger before the function it depends on, which would cause a migration failure:
```typescript
// WRONG ORDER - trigger created before function
pgm.sql(`CREATE TRIGGER audit_logs_immutable ...`);
pgm.sql(`CREATE OR REPLACE FUNCTION raise_immutable_error() ...`);
```

**Fix:** Reordered to create the function first:
```typescript
// CORRECT ORDER - function created before trigger
pgm.sql(`CREATE OR REPLACE FUNCTION raise_immutable_error() ...`);
pgm.createTable("audit_logs", {...});
pgm.sql(`CREATE TRIGGER audit_logs_immutable ...`);
```

## Verification

### Type Safety
- ✅ No TypeScript compilation errors
- ✅ All function signatures match their implementations
- ✅ Proper type annotations for all parameters

### Consistency
- ✅ Both V0 and V1 payout endpoints now log audit actions
- ✅ Both endpoints use identical logging logic
- ✅ Both endpoints capture same audit details

### Database Integrity
- ✅ Migration function ordering corrected
- ✅ Trigger will properly reference function
- ✅ Immutability constraint will work as intended

## Testing Recommendations

### Unit Tests
```bash
npm run test -- src/server/services/audit.service.test.ts
```

### Integration Tests
1. Trigger payout via V0 endpoint and verify audit log created
2. Trigger payout via V1 endpoint and verify audit log created
3. Query audit logs API and verify both entries appear
4. Verify IP address and user agent are captured

### Database Tests
```sql
-- Verify immutability
UPDATE audit_logs SET action = 'OTHER' WHERE id = 'test-id';
-- Should raise: "Audit logs are immutable and cannot be modified or deleted"

DELETE FROM audit_logs WHERE id = 'test-id';
-- Should raise: "Audit logs are immutable and cannot be modified or deleted"
```

## Deployment Steps

1. **Run migration:**
   ```bash
   npm run migrate
   ```

2. **Deploy code:**
   - Push to staging
   - Run integration tests
   - Verify audit logs are created for payout actions

3. **Monitor:**
   - Check audit log volume
   - Verify no errors in logs
   - Confirm immutability works

## Commit Information

**Commit:** `bcd3244`
**Branch:** `feat/admin-audit-logging`
**Message:** "fix: correct audit logging function calls and migration order"

**Changes:**
- 3 files modified
- 37 insertions
- 13 deletions

## Files Modified

1. `migrations/1746800000000_add-audit-logs-table.ts`
   - Reordered function and trigger creation
   - Function now created before trigger

2. `src/app/api/admin/circles/[id]/payout/route.ts`
   - Fixed `logAuditAction()` call with correct parameter order
   - Added `actorId` as first parameter

3. `src/app/api/v1/admin/circles/[id]/payout/route.ts`
   - Added complete audit logging implementation
   - Logs `TRIGGER_PAYOUT` action with full context
   - Captures IP address and user agent

## Status

✅ **All fixes applied and committed**
✅ **Ready for deployment**
✅ **No breaking changes**
✅ **Backward compatible**

