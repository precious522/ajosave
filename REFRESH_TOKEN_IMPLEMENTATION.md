# Refresh Token Implementation

## Overview

This document describes the refresh token flow implementation for Ajosave, addressing the security issue of long-lived authentication tokens. The implementation follows OAuth 2.0 best practices with token rotation and httpOnly cookie storage.

## Acceptance Criteria - Implementation Status

✅ **Access token expires in 15 minutes** - Implemented in `src/lib/refresh-tokens.ts` (ACCESS_TOKEN_TTL = 900 seconds)

✅ **Refresh token expires in 7 days** - Implemented in `src/lib/refresh-tokens.ts` (REFRESH_TOKEN_TTL = 604,800 seconds)

✅ **Refresh endpoint issues new access token** - Implemented at `POST /api/auth/refresh` and `POST /api/v1/auth/refresh`

✅ **Refresh token stored in httpOnly cookie** - Implemented with secure, httpOnly, sameSite=lax flags

✅ **Old refresh token invalidated on use** - Implemented via `revokeRefreshToken()` function with database tracking

## Architecture

### Token Types

1. **Access Token (JWT)**
   - Expires: 15 minutes
   - Format: JWT signed with NEXTAUTH_SECRET
   - Storage: HTTP Authorization header (Bearer token)
   - Contains: user ID, phone, role, expiry times
   - Used for: API request authentication

2. **Refresh Token**
   - Expires: 7 days
   - Format: Random 32-byte hex string
   - Storage: httpOnly cookie (secure, sameSite=lax)
   - Database: Stored as SHA-256 hash in `refresh_tokens` table
   - Used for: Obtaining new access tokens

### Database Schema

New table: `refresh_tokens`

```sql
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX idx_refresh_tokens_revoked_at ON refresh_tokens(revoked_at);
```

## API Endpoints

### 1. Login (Existing - Enhanced)

**Endpoint:** `POST /api/auth/[...nextauth]` (via CredentialsProvider)

**Changes:**
- On successful OTP verification, generates a refresh token
- Stores refresh token in database
- Returns JWT access token (15-minute expiry)
- Sets refresh token in httpOnly cookie

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-uuid",
      "phone": "+234...",
      "role": "user"
    }
  }
}
```

**Cookies Set:**
- `refreshToken`: httpOnly, secure, sameSite=lax, maxAge=604800

### 2. Refresh Token Endpoint (New)

**Endpoint:** `POST /api/auth/refresh` or `POST /api/v1/auth/refresh`

**Request:**
```json
{
  "refreshToken": "token_string"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "new_jwt_token",
    "expiresIn": 900
  }
}
```

**Cookies Set:**
- `refreshToken`: New token (old one revoked)

**Error Cases:**
- 400: Missing refresh token
- 401: Invalid, expired, or revoked refresh token
- 401: User not found
- 500: Server error

**Flow:**
1. Client sends refresh token (from cookie or request body)
2. Server verifies token hash against database
3. Server checks token is not revoked and not expired
4. Server revokes old token (marks revoked_at = NOW())
5. Server generates new refresh token
6. Server issues new access token (JWT)
7. Server sets new refresh token in httpOnly cookie
8. Client receives new access token in response body

### 3. Logout Endpoint (Enhanced)

**Endpoint:** `POST /api/auth/logout` or `POST /api/v1/auth/logout`

**Changes:**
- Revokes ALL refresh tokens for the user
- Clears refresh token cookie

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

**Cookies Cleared:**
- `refreshToken`: maxAge=0

### 4. Token Cleanup Cron Job (New)

**Endpoint:** `GET /api/cron/cleanup-tokens`

**Authentication:** Bearer token in Authorization header (must match CRON_SECRET)

**Response:**
```json
{
  "success": true,
  "data": {
    "deletedCount": 42
  }
}
```

**Purpose:** Removes expired refresh tokens from database to prevent table bloat

**Recommended Frequency:** Daily

## Security Features

### 1. Token Rotation
- Old refresh token is revoked immediately upon use
- Prevents token reuse attacks
- Enables detection of token theft (if old token used again)

### 2. httpOnly Cookies
- Refresh token stored in httpOnly cookie (not accessible to JavaScript)
- Prevents XSS attacks from stealing tokens
- Secure flag set in production (HTTPS only)
- sameSite=lax prevents CSRF attacks

### 3. Token Hashing
- Refresh tokens stored as SHA-256 hashes in database
- Raw token never stored
- Even if database is compromised, tokens cannot be used

### 4. Short-Lived Access Tokens
- 15-minute expiry limits exposure window
- Reduces impact of access token compromise
- Automatic refresh via refresh token

### 5. Revocation Tracking
- All refresh tokens tracked in database
- Can revoke all user tokens on logout
- Can revoke specific tokens if needed
- Revocation is immediate (no cache delay)

### 6. Expiry Validation
- Tokens checked against expires_at timestamp
- Expired tokens rejected immediately
- Cleanup job removes old records

## Implementation Files

### New Files
- `src/lib/refresh-tokens.ts` - Token management utilities
- `src/app/api/auth/refresh/route.ts` - Refresh endpoint
- `src/app/api/v1/auth/refresh/route.ts` - V1 refresh endpoint
- `src/app/api/cron/cleanup-tokens/route.ts` - Cleanup cron job
- `migrations/1746700000000_add-refresh-tokens-table.ts` - Database migration

### Modified Files
- `src/lib/auth.ts` - Updated JWT callback to generate refresh tokens
- `src/app/api/auth/logout/route.ts` - Enhanced to revoke all tokens
- `src/app/api/v1/auth/logout/route.ts` - Enhanced to revoke all tokens

## Client Implementation

### Storing Tokens

```typescript
// Access token from response body
const { accessToken, expiresIn } = response.data;

// Refresh token automatically in httpOnly cookie (no client action needed)
// Browser automatically sends cookie with requests
```

### Using Access Token

```typescript
// Include in Authorization header
const headers = {
  'Authorization': `Bearer ${accessToken}`
};

fetch('/api/protected', { headers });
```

### Handling Token Expiry

```typescript
// Option 1: Automatic refresh on 401
if (response.status === 401) {
  const refreshResponse = await fetch('/api/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: getCookie('refreshToken') })
  });
  
  if (refreshResponse.ok) {
    const { accessToken } = await refreshResponse.json();
    // Retry original request with new token
  } else {
    // Redirect to login
  }
}

// Option 2: Proactive refresh before expiry
const refreshThreshold = 60; // 1 minute before expiry
if (Date.now() / 1000 > (expiresAt - refreshThreshold)) {
  // Call refresh endpoint
}
```

### Logout

```typescript
await fetch('/api/auth/logout', { method: 'POST' });
// Redirect to login
```

## Environment Variables

No new environment variables required. Uses existing:
- `NEXTAUTH_SECRET` - JWT signing secret
- `CRON_SECRET` - Cron job authentication
- `DATABASE_URL` - PostgreSQL connection

## Migration Steps

1. Run database migration:
   ```bash
   npm run migrate
   ```

2. Deploy updated code with:
   - Updated `src/lib/auth.ts`
   - New refresh token utilities
   - New endpoints

3. Set up cron job to call `GET /api/cron/cleanup-tokens` daily

4. Update client code to:
   - Use new refresh endpoint
   - Handle token expiry
   - Include Authorization header with access token

## Testing

### Manual Testing

1. **Login Flow**
   ```bash
   curl -X POST http://localhost:3000/api/auth/[...nextauth] \
     -H "Content-Type: application/json" \
     -d '{"phone": "+234...", "otp": "123456"}'
   ```

2. **Refresh Token**
   ```bash
   curl -X POST http://localhost:3000/api/auth/refresh \
     -H "Content-Type: application/json" \
     -d '{"refreshToken": "token_from_cookie"}'
   ```

3. **Logout**
   ```bash
   curl -X POST http://localhost:3000/api/auth/logout \
     -H "Cookie: refreshToken=..."
   ```

4. **Cleanup Cron**
   ```bash
   curl -X GET http://localhost:3000/api/cron/cleanup-tokens \
     -H "Authorization: Bearer $CRON_SECRET"
   ```

### Automated Testing

See `src/app/api/auth/refresh/__tests__/route.test.ts` for comprehensive test suite.

## Monitoring

### Metrics to Track

1. **Token Refresh Rate** - How often tokens are refreshed
2. **Token Revocation Rate** - How often tokens are revoked
3. **Refresh Endpoint Latency** - Performance of refresh endpoint
4. **Failed Refresh Attempts** - Potential security issues
5. **Expired Token Cleanup** - Database maintenance

### Alerts

- Alert if refresh endpoint latency > 500ms
- Alert if failed refresh attempts spike
- Alert if cleanup job fails

## Troubleshooting

### Issue: "Invalid or expired refresh token"

**Causes:**
- Token has expired (> 7 days old)
- Token has been revoked
- Token hash doesn't match database
- User has logged out

**Solution:**
- Redirect user to login
- Generate new tokens

### Issue: Access token not working after refresh

**Causes:**
- New access token not being used
- Old access token still being used
- Token format incorrect

**Solution:**
- Verify Authorization header format: `Bearer <token>`
- Check token expiry time
- Verify token was successfully refreshed

### Issue: Refresh token cookie not being set

**Causes:**
- HTTPS not enabled in production (secure flag blocks cookie)
- Cookie domain mismatch
- Browser privacy settings

**Solution:**
- Ensure HTTPS in production
- Verify domain configuration
- Check browser console for cookie warnings

## Future Enhancements

1. **Device Tracking** - Track which devices have refresh tokens
2. **Token Binding** - Bind tokens to IP address or device fingerprint
3. **Refresh Token Rotation Policy** - Rotate tokens more frequently
4. **Multi-Factor Authentication** - Require MFA for sensitive operations
5. **Token Introspection** - Endpoint to check token validity
6. **Revocation Notifications** - Notify user when tokens are revoked

## References

- [OAuth 2.0 Refresh Token Best Practices](https://tools.ietf.org/html/draft-ietf-oauth-security-topics)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [NextAuth.js JWT Strategy](https://next-auth.js.org/configuration/pages#jwt-strategy)
