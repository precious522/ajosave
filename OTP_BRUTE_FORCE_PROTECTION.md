# OTP Brute-Force Protection Implementation

## Issue Resolved
**Issue:** OTP endpoint has no attempt limiting. An attacker can brute-force 6-digit OTPs (1M combinations).

**Priority:** Critical | **Effort:** Small

## Acceptance Criteria - All Met ✅

- ✅ Max 5 OTP attempts per phone number per 10 minutes
- ✅ Account locked for 30 minutes after 5 failures
- ✅ Lockout status returned in API response
- ✅ Attempts tracked in Redis

## Architecture

### Protection Mechanism

The OTP brute-force protection uses a multi-layered approach:

1. **Attempt Tracking** - Failed OTP verification attempts tracked per phone number in Redis
2. **Lockout Enforcement** - Account locked after 5 failed attempts within 10 minutes
3. **Time-Based Expiry** - Lockout expires after 30 minutes
4. **Status Reporting** - Detailed lockout status returned in API responses

### Redis Keys

```
otp_failures:{phone}     - Counter of failed OTP attempts (expires after 10 minutes)
lockout:{phone}          - Lockout flag (expires after 30 minutes)
otp:{phone}              - Stored OTP value (expires after 10 minutes)
```

### Constants

```typescript
MAX_FAILURES = 5                    // Maximum failed attempts
FAILURE_WINDOW = 10 * 60            // 10 minutes in seconds
LOCKOUT_DURATION = 30 * 60          // 30 minutes in seconds
```

## API Endpoints

### 1. Send OTP Endpoint

**Endpoint:** `POST /api/auth/send-otp` or `POST /api/v1/auth/send-otp`

**Request:**
```json
{
  "phone": "+234..."
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "OTP sent successfully"
  }
}
```

**Locked Response (423):**
```json
{
  "success": false,
  "error": "Account locked due to too many failed attempts. Please try again in 30 minutes.",
  "data": {
    "lockout": {
      "isLocked": true,
      "attempts": 5,
      "remainingAttempts": 0,
      "lockoutExpiresAt": 1234567890,
      "lockoutRemainingSeconds": 1800
    }
  }
}
```

### 2. Verify OTP Endpoint

**Endpoint:** `POST /api/auth/verify-otp` or `POST /api/v1/auth/verify-otp`

**Request:**
```json
{
  "phone": "+234...",
  "otp": "123456"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "OTP verified successfully",
    "user": {
      "id": "user-uuid",
      "phone": "+234...",
      "displayName": "User Name",
      "role": "user"
    }
  }
}
```

**Invalid OTP Response (401):**
```json
{
  "success": false,
  "error": "Invalid or expired OTP. Please try again.",
  "data": {
    "lockout": {
      "isLocked": false,
      "attempts": 3,
      "remainingAttempts": 2
    }
  }
}
```

**Locked Response (423):**
```json
{
  "success": false,
  "error": "Account locked due to too many failed attempts. Please try again in 30 minutes.",
  "data": {
    "lockout": {
      "isLocked": true,
      "attempts": 5,
      "remainingAttempts": 0,
      "lockoutExpiresAt": 1234567890,
      "lockoutRemainingSeconds": 1800
    }
  }
}
```

## Implementation Details

### Lockout Status Interface

```typescript
interface LockoutStatus {
  isLocked: boolean;                    // Whether account is currently locked
  attempts: number;                     // Number of failed attempts
  remainingAttempts: number;            // Attempts left before lockout
  lockoutExpiresAt?: number;            // Unix timestamp when lockout expires
  lockoutRemainingSeconds?: number;     // Seconds until lockout expires
}
```

### Core Functions

#### `getLockoutStatus(phone: string): Promise<LockoutStatus>`
Returns detailed lockout status for a phone number.

**Returns:**
- `isLocked`: true if account is locked
- `attempts`: current failed attempt count
- `remainingAttempts`: attempts left before lockout
- `lockoutExpiresAt`: Unix timestamp of lockout expiry (if locked)
- `lockoutRemainingSeconds`: seconds until lockout expires (if locked)

#### `recordFailure(phone: string): Promise<LockoutStatus>`
Records a failed OTP attempt and returns updated status.

**Behavior:**
1. Increments failure counter for phone number
2. Sets 10-minute expiry on first failure
3. Locks account if failures >= 5
4. Returns updated lockout status

#### `resetLockout(phone: string): Promise<void>`
Resets all failure tracking and lockout state for a phone number.

**Called on:**
- Successful OTP verification
- Manual admin unlock (future feature)

#### `isLockedOut(phone: string): Promise<boolean>`
Simple boolean check if phone number is locked out.

## Security Analysis

### Attack Scenarios Mitigated

1. **Brute-Force Attack**
   - Attacker tries all 1M possible 6-digit OTPs
   - Limited to 5 attempts per 10 minutes
   - Would take 200,000 * 10 minutes = 2,000,000 minutes (1,389 days) to exhaust all combinations
   - Account locked for 30 minutes after 5 failures

2. **Distributed Attack**
   - Multiple attackers targeting same phone number
   - All attempts tracked per phone number (not per IP)
   - Lockout applies to all attackers

3. **Rapid-Fire Attacks**
   - Attacker sends many requests in quick succession
   - Rate limiting on send-otp endpoint (5 requests per 10 minutes per IP)
   - Lockout after 5 failed verifications

### Remaining Considerations

1. **Phone Number Enumeration**
   - Attackers can determine valid phone numbers by send-otp response
   - Mitigation: Return same response for valid/invalid numbers (future enhancement)

2. **Lockout Bypass**
   - Attacker waits 30 minutes for lockout to expire
   - Mitigation: Implement progressive lockout (longer delays after repeated lockouts)

3. **SMS Interception**
   - If SMS is intercepted, OTP can be used
   - Mitigation: Implement 2FA, device binding, or push notifications

## Testing

### Manual Testing

1. **Test Lockout After 5 Failures**
   ```bash
   # Attempt 1-4: Invalid OTP
   curl -X POST http://localhost:3000/api/auth/verify-otp \
     -H "Content-Type: application/json" \
     -d '{"phone": "+234...", "otp": "000000"}'
   
   # Response shows: remainingAttempts: 1
   
   # Attempt 5: Invalid OTP (triggers lockout)
   curl -X POST http://localhost:3000/api/auth/verify-otp \
     -H "Content-Type: application/json" \
     -d '{"phone": "+234...", "otp": "000000"}'
   
   # Response shows: isLocked: true, status: 423
   ```

2. **Test Lockout Status in Send OTP**
   ```bash
   curl -X POST http://localhost:3000/api/auth/send-otp \
     -H "Content-Type: application/json" \
     -d '{"phone": "+234..."}'
   
   # Response shows lockout status if account is locked
   ```

3. **Test Lockout Expiry**
   ```bash
   # Wait 30 minutes, then try again
   # Should be able to send OTP and verify again
   ```

### Automated Testing

```bash
npm run test -- src/lib/lockout.test.ts
npm run test -- src/app/api/auth/verify-otp/__tests__/route.test.ts
```

## Monitoring

### Metrics to Track

1. **Failed OTP Attempts** - Number of failed verification attempts per phone
2. **Lockout Events** - How many accounts are locked out
3. **Lockout Duration** - Average time accounts remain locked
4. **Repeat Offenders** - Phone numbers with multiple lockouts

### Alerts

- Alert if single phone number has > 10 lockouts in 24 hours
- Alert if > 1000 lockout events in 1 hour (potential attack)
- Alert if OTP verification failure rate > 50%

## Configuration

### Environment Variables

No new environment variables required. Uses existing:
- `REDIS_URL` - Redis connection for tracking attempts
- `NODE_ENV` - For development OTP logging

### Tuning Parameters

To adjust protection levels, modify constants in `src/lib/lockout.ts`:

```typescript
const MAX_FAILURES = 5;              // Increase for more lenient, decrease for stricter
const FAILURE_WINDOW = 10 * 60;      // Increase window for longer tracking period
const LOCKOUT_DURATION = 30 * 60;    // Increase for longer lockout period
```

## Deployment Checklist

- [x] Lockout utility implemented with Redis tracking
- [x] Send OTP endpoint returns lockout status
- [x] Verify OTP endpoint returns lockout status
- [x] Both v0 and v1 API versions updated
- [x] Error responses include lockout details
- [x] Documentation complete
- [ ] Deploy to staging
- [ ] Test with real SMS provider
- [ ] Monitor for false positives
- [ ] Deploy to production
- [ ] Set up monitoring and alerts

## Troubleshooting

### Issue: "Account locked" but user hasn't made 5 attempts

**Possible Causes:**
- Multiple users sharing same phone number
- Automated systems retrying failed requests
- Previous lockout not yet expired

**Solution:**
- Check Redis for lockout key: `redis-cli get lockout:{phone}`
- Manually clear lockout if needed: `redis-cli del lockout:{phone}`

### Issue: Lockout not being enforced

**Possible Causes:**
- Redis connection issue
- Lockout key expired prematurely
- Code not checking lockout status

**Solution:**
- Verify Redis is running and accessible
- Check Redis TTL: `redis-cli ttl lockout:{phone}`
- Review logs for errors

### Issue: Users complaining about frequent lockouts

**Possible Causes:**
- Legitimate users making typos
- Slow SMS delivery causing retries
- Shared phone numbers

**Solution:**
- Increase MAX_FAILURES to 10
- Increase FAILURE_WINDOW to 15 minutes
- Implement SMS delivery confirmation

## Future Enhancements

1. **Progressive Lockout** - Longer lockout periods after repeated offenses
2. **IP-Based Tracking** - Track attempts per IP in addition to phone number
3. **Whitelist Management** - Allow admins to whitelist phone numbers
4. **SMS Delivery Confirmation** - Verify SMS was delivered before counting attempts
5. **Device Fingerprinting** - Bind OTP to device to prevent sharing
6. **Email Fallback** - Send OTP via email if SMS fails
7. **Biometric Verification** - Require fingerprint/face ID for sensitive operations
8. **Risk Scoring** - Adjust lockout based on risk assessment

## References

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [NIST Digital Identity Guidelines](https://pages.nist.gov/800-63-3/)
- [Rate Limiting Best Practices](https://cloud.google.com/architecture/rate-limiting-strategies-techniques)
