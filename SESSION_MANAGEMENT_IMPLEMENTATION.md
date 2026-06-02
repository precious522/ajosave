# Session Management Implementation

## Overview
This document describes the implementation of session management with active session list for issue #339.

## Features Implemented

### 1. Database Schema
- **sessions table** (migration: `1748700000000_add-sessions-table.ts`)
  - `id`: UUID primary key
  - `user_id`: Foreign key to users table
  - `token_hash`: SHA-256 hash of JWT session ID
  - `device_name`: Friendly device name (e.g., "Chrome on Windows")
  - `device_type`: mobile, desktop, tablet, or unknown
  - `browser`: Browser name
  - `os`: Operating system
  - `ip_address`: IP address (supports IPv6)
  - `user_agent`: Full user agent string
  - `last_active_at`: Timestamp of last activity
  - `created_at`: Session creation timestamp
  - `expires_at`: Session expiration timestamp

### 2. Backend Implementation

#### Session Management Library (`src/lib/sessions.ts`)
- `createSession()`: Create new session record
- `getUserSessions()`: Get all active sessions for a user
- `getSessionByTokenHash()`: Retrieve session by token hash
- `revokeSession()`: Revoke a specific session
- `revokeAllOtherSessions()`: Sign out all devices except current
- `revokeAllSessions()`: Sign out from all devices
- `updateSessionActivity()`: Update last active timestamp
- `cleanupExpiredSessions()`: Remove expired sessions
- `parseUserAgent()`: Extract device info from user agent string
- `hashToken()`: SHA-256 hash for secure token storage

#### Authentication Updates (`src/lib/auth.ts`)
- Added `sessionId` to JWT token payload
- Implemented session creation on sign-in via events callback
- Session ID format: `{userId}-{timestamp}-{random}`
- Sessions automatically created when users log in

#### API Endpoints

**GET /api/v1/sessions**
- Returns all active sessions for the authenticated user
- Marks the current session with `isCurrent: true`
- Response includes device info, IP, and last active time

**DELETE /api/v1/sessions/:sessionId**
- Revokes a specific session
- Requires authentication
- Only allows users to revoke their own sessions

**POST /api/v1/sessions/revoke-all**
- Query param: `keepCurrent=true` to keep current session active
- Revokes all sessions for the user
- Returns count of revoked sessions

**POST /api/v1/cron/cleanup-sessions**
- Cron job to clean up expired sessions
- Requires cron authentication
- Should be scheduled to run daily

### 3. Frontend Implementation

#### Settings Page (`src/app/settings/page.tsx`)
Added "Active Sessions" section with:
- List of all active sessions
- Device icon based on device type (📱 mobile, 💻 desktop)
- Device name, browser, and OS information
- IP address and last active time
- "Current" badge for the active session
- Individual "Sign Out" button for each session (except current)
- "Sign Out All Other Devices" button
- Real-time relative timestamps (e.g., "5 minutes ago")
- Success/error messages for session operations

#### UI Features
- Loading states while fetching sessions
- Confirmation dialog before signing out all devices
- Disabled state for buttons during operations
- Responsive design matching existing settings page style
- Empty state when no sessions found

### 4. Security Features

- **Token Hashing**: JWT session IDs are hashed with SHA-256 before storage
- **User Isolation**: Users can only view and revoke their own sessions
- **Automatic Cleanup**: Expired sessions are removed via cron job
- **IP Tracking**: Records IP address for security auditing
- **Device Fingerprinting**: Tracks device type, browser, and OS
- **Session Expiration**: Sessions expire after 7 days (matches JWT refresh token TTL)

## Usage

### For Users
1. Navigate to Settings page
2. Scroll to "Active Sessions" section
3. View all devices where you're signed in
4. Click "Sign Out" to revoke a specific session
5. Click "Sign Out All Other Devices" to revoke all except current

### For Administrators
- Schedule the cleanup cron job to run daily:
  ```bash
  curl -X POST https://your-domain.com/api/v1/cron/cleanup-sessions \
    -H "Authorization: Bearer YOUR_CRON_SECRET"
  ```

## Database Migration

The sessions table migration already exists in the codebase:
```bash
npm run migrate
```

## Testing

### Manual Testing
1. Sign in from multiple devices/browsers
2. Navigate to Settings → Active Sessions
3. Verify all sessions are listed
4. Test revoking individual sessions
5. Test "Sign Out All Other Devices"
6. Verify revoked sessions cannot access protected resources

### API Testing
```bash
# Get sessions
curl -X GET https://your-domain.com/api/v1/sessions \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN"

# Revoke specific session
curl -X DELETE https://your-domain.com/api/v1/sessions/SESSION_ID \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN"

# Revoke all other sessions
curl -X POST https://your-domain.com/api/v1/sessions/revoke-all?keepCurrent=true \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN"
```

## Future Enhancements

- [ ] Email notifications when new device signs in
- [ ] Geolocation based on IP address
- [ ] Session activity history
- [ ] Suspicious activity detection
- [ ] Two-factor authentication for sensitive operations
- [ ] Session naming/labeling by users
- [ ] Export session history

## Files Changed/Created

### Created
- `src/lib/sessions.ts` - Session management utilities
- `src/lib/session-middleware.ts` - Session tracking middleware
- `src/app/api/v1/sessions/route.ts` - List sessions endpoint
- `src/app/api/v1/sessions/[sessionId]/route.ts` - Revoke session endpoint
- `src/app/api/v1/sessions/revoke-all/route.ts` - Revoke all sessions endpoint
- `src/app/api/v1/cron/cleanup-sessions/route.ts` - Cleanup cron job
- `migrations/1748700000000_add-sessions-table.ts` - Database migration (already existed)

### Modified
- `src/lib/auth.ts` - Added session creation on sign-in
- `src/app/settings/page.tsx` - Added active sessions UI
- `scripts/migrate.ts` - Fixed TypeScript compilation issues

## Acceptance Criteria ✅

- [x] Active sessions stored in DB (device, IP, last active)
- [x] Session list shown in profile settings
- [x] Individual session revocation
- [x] 'Sign out all' button

## Issue Reference
Closes #339
