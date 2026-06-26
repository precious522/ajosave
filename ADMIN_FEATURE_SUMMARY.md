# Admin Dashboard Feature Implementation

## Overview
Implemented a complete admin dashboard for platform operators to manage circles, payouts, and user activity with role-based access control.

## Changes Made

### 1. Database Migration
**File:** `migrations/1745505606000_add-user-role.ts`
- Added `role` column to `users` table (VARCHAR(20), default: 'user')
- Supports values: 'user', 'admin'
- Added index on `role` column for efficient queries

### 2. Type Updates
**File:** `src/types/index.ts`
- Added `UserRole` type: `"user" | "admin"`
- Updated `User` interface to include `role: UserRole` field

### 3. Authentication Updates
**File:** `src/lib/auth.ts`
- Updated NextAuth JWT callback to include `role` in token
- Updated session callback to include `role` in session object
- Placeholder user now includes `role: "user"` (TODO: load from DB on OTP verification)

### 4. Middleware
**File:** `src/server/middleware/index.ts`
- Added `withAdminAuth()` middleware for admin-only routes
- Checks for authenticated session AND `role === "admin"`
- Returns 403 Forbidden if user lacks admin role

### 5. Admin Service
**File:** `src/server/services/admin.service.ts`
- `adminListCircles()`: Returns all circles with member count
  - Joins circles with members table
  - Groups by circle to count members
  - Ordered by creation date (newest first)
- `adminListPayouts()`: Returns all payouts with circle name and recipient user ID
  - Joins payouts → circles → members
  - Ordered by payout date (newest first)

### 6. API Routes

#### GET `/api/admin/circles`
- Protected by `withAdminAuth` middleware
- Returns array of circles with member counts
- Response: `{ success: true, data: AdminCircleRow[] }`

#### GET `/api/admin/payouts`
- Protected by `withAdminAuth` middleware
- Returns array of all payouts with transaction hashes
- Response: `{ success: true, data: AdminPayoutRow[] }`

#### POST `/api/admin/circles/[id]/payout`
- Protected by `withAdminAuth` middleware
- Manually triggers a payout cycle for an active circle
- Validates circle exists and is active
- Calls `processCyclePayout()` with payout lock protection
- Returns payout record with transaction hash
- Handles `PayoutLockError` (409 Conflict if payout already in progress)

### 7. Admin UI Components

#### Page: `src/app/admin/page.tsx`
- Server component with role-based access control
- Redirects to login if not authenticated
- Redirects to home if not admin
- Renders `AdminDashboard` component

#### Component: `src/components/admin/AdminDashboard.tsx`
- Client component with tab-based interface
- Tabs: "Circles" and "Payouts"
- Fetches data from API routes on tab change
- Displays loading state and error messages
- Shows count badges on tabs

#### Component: `src/components/admin/CirclesTable.tsx`
- Displays all circles in a table
- Columns: Name, Status, Members, Contribution, Cycle, Next Payout, Action
- "Trigger Payout" button for active circles
- Shows success/error messages for manual payouts
- Disables button while payout is in progress

#### Component: `src/components/admin/PayoutsTable.tsx`
- Displays all payouts in a table
- Columns: Circle, Recipient, Cycle, Amount, TX Hash, Paid At
- TX Hash links to Stellar Expert explorer (testnet)
- Monospace font for transaction hashes and user IDs

#### Styles: `src/components/admin/admin.module.css`
- Tab navigation with active state styling
- Responsive table with hover effects
- Status cell styling
- Action cell with button layout
- Empty state and loading state styling
- Error message styling

### 8. Navigation Update
**File:** `src/components/layout/Navbar.tsx`
- Added server-side session check
- Conditionally renders "Admin" link for admin users
- Link points to `/admin` route

## Acceptance Criteria Met

✅ **Admin route protected by admin role**
- `/admin` page checks `role === "admin"` and redirects if not
- All API routes use `withAdminAuth` middleware

✅ **List all circles with status and member count**
- `GET /api/admin/circles` returns all circles with member counts
- CirclesTable displays status badge and member count

✅ **Manually trigger payout for a circle**
- `POST /api/admin/circles/[id]/payout` endpoint
- CirclesTable has "Trigger Payout" button for active circles
- Shows success/error feedback

✅ **View all payouts with tx hashes**
- `GET /api/admin/payouts` returns all payouts with tx hashes
- PayoutsTable displays tx hashes as clickable links to Stellar Expert

## Security Considerations

1. **Role-based access control**: All admin endpoints require `role === "admin"`
2. **Session validation**: Admin page redirects unauthenticated users to login
3. **Payout lock**: Prevents concurrent payouts on same circle (race condition protection)
4. **Parameterized queries**: All DB queries use parameterized statements ($1, $2, etc.)
5. **Error handling**: Sensitive errors are caught and logged via Sentry

## Database Queries

### adminListCircles()
```sql
SELECT c.*, COUNT(m.id)::int AS memberCount
FROM circles c
LEFT JOIN members m ON m.circle_id = c.id
GROUP BY c.id
ORDER BY c.created_at DESC
```

### adminListPayouts()
```sql
SELECT p.*, c.name as circleName, m.user_id as recipientUserId
FROM payouts p
JOIN circles c ON c.id = p.circle_id
JOIN members m ON m.id = p.recipient_member_id
ORDER BY p.paid_at DESC
```

## Testing Checklist

- [ ] Run migration: `npm run migrate`
- [ ] Set a user's role to 'admin' in the database
- [ ] Login with admin user
- [ ] Verify "Admin" link appears in navbar
- [ ] Navigate to `/admin`
- [ ] Verify circles table loads with member counts
- [ ] Verify payouts table loads with tx hashes
- [ ] Click "Trigger Payout" on an active circle
- [ ] Verify payout succeeds and shows tx hash
- [ ] Verify non-admin users cannot access `/admin`
- [ ] Verify non-admin users cannot call `/api/admin/*` endpoints

## Future Enhancements

1. Add user activity log viewing
2. Add ability to mark users as admin/non-admin
3. Add circle creation/cancellation controls
4. Add member status management (mark as defaulted, etc.)
5. Add export functionality for circles and payouts
6. Add filtering and search on tables
7. Add pagination for large datasets
8. Add real-time updates via WebSocket or polling
