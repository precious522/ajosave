# Refresh Token Implementation - Change Summary

## Issue Resolved
**Issue:** Current auth tokens have no rotation. Implement refresh token flow to limit exposure of long-lived tokens.

**Priority:** High | **Effort:** Medium

## Acceptance Criteria - All Met ✅

- ✅ Access token expires in 15 minutes
- ✅ Refresh token expires in 7 days
- ✅ Refresh endpoint issues new access token
- ✅ Refresh token stored in httpOnly cookie
- ✅ Old refresh token invalidated on use

## Files Created

### Core Implementation
1. **`src/lib/refresh-tokens.ts`** (95 lines)
   - `generateRefreshToken()` - Creates and stores new refresh tokens
   - `verifyRefreshToken()` - Validates token and checks revocation status
   - `revokeRefreshToken()` - Marks token as revoked after use
   - `revokeAllUserTokens()` - Revokes all tokens for a user (logout)
   - `cleanupExpiredTokens()` - Removes expired tokens from database
   - `getTokenExpiries()` - Returns token expiry timestamps
   - Constants: ACCESS_TOKEN_TTL (15 min), REFRESH_TOKEN_TTL (7 days)

2. **`src/app/api/auth/refresh/route.ts`** (110 lines)
   - POST endpoint for token refresh
   - Validates refresh token
   - Revokes old token
   - Issues new access token (JWT)
   - Sets new refresh token in httpOnly cookie
   - Comprehensive error handling

3. **`src/app/api/v1/auth/refresh/route.ts`** (110 lines)
   - V1 API version of refresh endpoint
   - Same functionality as v0

4. **`src/app/api/cron/cleanup-tokens/route.ts`** (35 lines)
   - Cron job endpoint for token cleanup
   - Removes expired tokens from database
   - Requires CRON_SECRET authentication

5. **`migrations/1746700000000_add-refresh-tokens-table.ts`** (40 lines)
   - Creates `refresh_tokens` table
   - Stores token hashes (not raw tokens)
   - Tracks expiry and revocation status
   - Includes indexes for performance

### Documentation
6. **`REFRESH_TOKEN_IMPLEMENTATION.md`** (400+ lines)
   - Complete implementation guide
   - Architecture overview
   - API endpoint documentation
   - Security features explained
   - Client implementation examples
   - Testing instructions
   - Troubleshooting guide
   - Future enhancements

7. **`REFRESH_TOKEN_CHANGES.md`** (this file)
   - Summary of changes
   - Files modified/created
   - Testing instructions

### Tests
8. **`src/app/api/auth/refresh/__tests__/route.test.ts`** (150+ lines)
   - Comprehensive test suite
   - Tests for all error cases
   - Tests for successful refresh
   - Tests for secure cookie in production

## Files Modified

### 1. `src/lib/auth.ts`
**Changes:**
- Added import: `generateRefreshToken`, `getTokenExpiries` from refresh-tokens
- Updated JWT callback to generate refresh token on initial sign-in
- Stores refresh token in JWT token object
- Uses `getTokenExpiries()` for consistent expiry times

**Before:**
```typescript
if (user) {
  token.id = user.id;
  token.accessTokenExpires = now + ACCESS_TOKEN_TTL;
  token.refreshTokenExpires = now + REFRESH_TOKEN_TTL;
  return token;
}
```

**After:**
```typescript
if (user) {
  const refreshToken = await generateRefreshToken(user.id);
  token.id = user.id;
  token.refreshToken = refreshToken;
  const expiries = getTokenExpiries();
  token.accessTokenExpires = expiries.accessTokenExpires;
  token.refreshTokenExpires = expiries.refreshTokenExpires;
  return token;
}
```

### 2. `src/app/api/auth/logout/route.ts`
**Changes:**
- Added import: `revokeAllUserTokens` from refresh-tokens
- Now revokes ALL refresh tokens for the user
- Clears refresh token cookie
- Returns proper ApiResponse format
- Improved error handling

**Before:**
```typescript
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
```

**After:**
```typescript
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Not authenticated" },
      { status: 401 }
    );
  }
  const userId = (session.user as { id?: string }).id;
  await revokeAllUserTokens(userId);
  const response = NextResponse.json<ApiResponse<{ message: string }>>(
    { success: true, data: { message: "Logged out successfully" } },
    { status: 200 }
  );
  response.cookies.set("refreshToken", "", { maxAge: 0, ... });
  return response;
}
```

### 3. `src/app/api/v1/auth/logout/route.ts`
**Changes:**
- Same as v0 logout endpoint
- Enhanced with token revocation and cookie clearing

## Database Migration

Run the migration to create the refresh_tokens table:

```bash
npm run migrate
```

This creates:
- `refresh_tokens` table with columns:
  - `id` (UUID, primary key)
  - `user_id` (FK to users)
  - `token_hash` (SHA-256 hash of token)
  - `expires_at` (expiry timestamp)
  - `revoked_at` (revocation timestamp, nullable)
  - `created_at` (creation timestamp)
- Indexes on user_id, expires_at, revoked_at

## Security Features Implemented

1. **Token Rotation**
   - Old refresh token revoked immediately upon use
   - Prevents token reuse attacks
   - Enables detection of token theft

2. **httpOnly Cookies**
   - Refresh token stored in httpOnly cookie
   - Prevents XSS attacks
   - Secure flag in production (HTTPS only)
   - sameSite=lax prevents CSRF

3. **Token Hashing**
   - Refresh tokens stored as SHA-256 hashes
   - Raw token never stored in database
   - Database compromise doesn't expose tokens

4. **Short-Lived Access Tokens**
   - 15-minute expiry limits exposure window
   - Automatic refresh via refresh token
   - Reduces impact of token compromise

5. **Revocation Tracking**
   - All tokens tracked in database
   - Can revoke all user tokens on logout
   - Revocation is immediate

## Testing Instructions

### Manual Testing

1. **Login and get tokens:**
   ```bash
   curl -X POST http://localhost:3000/api/auth/[...nextauth] \
     -H "Content-Type: application/json" \
     -d '{"phone": "+234...", "otp": "123456"}'
   ```

2. **Refresh token:**
   ```bash
   curl -X POST http://localhost:3000/api/auth/refresh \
     -H "Content-Type: application/json" \
     -d '{"refreshToken": "token_from_cookie"}'
   ```

3. **Verify old token is revoked:**
   ```bash
   # Try to use old token again - should fail
   curl -X POST http://localhost:3000/api/auth/refresh \
     -H "Content-Type: application/json" \
     -d '{"refreshToken": "old_token"}'
   # Expected: 401 Invalid or expired refresh token
   ```

4. **Logout:**
   ```bash
   curl -X POST http://localhost:3000/api/auth/logout \
     -H "Cookie: refreshToken=..."
   ```

5. **Cleanup cron job:**
   ```bash
   curl -X GET http://localhost:3000/api/cron/cleanup-tokens \
     -H "Authorization: Bearer $CRON_SECRET"
   ```

### Automated Testing

```bash
npm run test -- src/app/api/auth/refresh/__tests__/route.test.ts
```

## Deployment Checklist

- [ ] Run database migration: `npm run migrate`
- [ ] Deploy updated code
- [ ] Set up cron job to call `/api/cron/cleanup-tokens` daily
- [ ] Update client code to use new refresh endpoint
- [ ] Test login flow end-to-end
- [ ] Test token refresh flow
- [ ] Test logout flow
- [ ] Monitor refresh endpoint performance
- [ ] Monitor failed refresh attempts

## Environment Variables

No new environment variables required. Uses existing:
- `NEXTAUTH_SECRET` - JWT signing secret
- `CRON_SECRET` - Cron job authentication
- `DATABASE_URL` - PostgreSQL connection
- `NODE_ENV` - For secure cookie flag

## Performance Considerations

- **Database Queries:** 3-4 queries per refresh (verify, revoke, generate, get user)
- **Token Hashing:** SHA-256 hash computed on each verify/revoke
- **Cookie Size:** ~64 bytes (32-byte token as hex string)
- **Cleanup Job:** Should run daily to prevent table bloat

## Monitoring Recommendations

Track these metrics:
- Token refresh rate (requests/minute)
- Token revocation rate
- Refresh endpoint latency (p50, p95, p99)
- Failed refresh attempts (401 errors)
- Expired token cleanup count

## Rollback Plan

If issues occur:
1. Revert code changes to previous version
2. Keep refresh_tokens table (no data loss)
3. Existing sessions continue to work
4. New logins will use old flow (no refresh tokens)

## Future Enhancements

- Device tracking (track which devices have tokens)
- Token binding (bind to IP or device fingerprint)
- Faster refresh token rotation
- Multi-factor authentication
- Token introspection endpoint
- Revocation notifications

## References

- OAuth 2.0 Refresh Token Best Practices
- OWASP Authentication Cheat Sheet
- NextAuth.js JWT Strategy Documentation
