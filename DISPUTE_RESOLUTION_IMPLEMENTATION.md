# Dispute Resolution Mechanism — Issue #122

## Overview

A complete dispute resolution system allowing members to raise disputes when they believe their contributions were not recorded, and admins to review and manually confirm contributions.

---

## Database Schema

### New Table: `disputes`

```sql
CREATE TABLE disputes (
  id UUID PRIMARY KEY,
  contribution_id UUID NOT NULL REFERENCES contributions(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  paystack_reference VARCHAR(255),
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'rejected')),
  resolution_notes TEXT,
  resolved_by VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMP
);

CREATE INDEX disputes_circle_id ON disputes(circle_id);
CREATE INDEX disputes_member_id ON disputes(member_id);
CREATE INDEX disputes_status ON disputes(status);
CREATE INDEX disputes_contribution_id ON disputes(contribution_id);
```

---

## API Endpoints

### 1. Create Dispute (Member)

**POST** `/api/circles/{circleId}/disputes`

**Request:**
```json
{
  "contributionId": "uuid",
  "memberId": "uuid",
  "reason": "I paid via Paystack but it shows as missed",
  "paystackReference": "1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "contributionId": "uuid",
    "memberId": "uuid",
    "circleId": "uuid",
    "paystackReference": "1234567890",
    "reason": "I paid via Paystack but it shows as missed",
    "status": "open",
    "createdAt": "2026-04-28T17:00:00Z"
  }
}
```

### 2. List Disputes (Admin)

**GET** `/api/circles/{circleId}/disputes`

Returns all disputes for a circle, ordered by creation date (newest first).

### 3. Resolve Dispute (Admin)

**POST** `/api/admin/disputes`

**Request:**
```json
{
  "disputeId": "uuid",
  "status": "resolved",
  "resolutionNotes": "Verified payment in Paystack dashboard. Contribution confirmed.",
  "txHash": "optional-tx-hash",
  "contributionId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "resolved",
    "resolutionNotes": "Verified payment in Paystack dashboard. Contribution confirmed.",
    "resolvedBy": "admin-user-id",
    "resolvedAt": "2026-04-28T17:30:00Z"
  }
}
```

---

## Service Layer

### `src/server/services/dispute.service.ts`

**Functions:**

- `createDispute(contributionId, memberId, circleId, reason, paystackReference?)` — Create a new dispute
- `getDisputesByCircle(circleId)` — Fetch all disputes for a circle
- `getDisputesByMember(memberId)` — Fetch all disputes raised by a member
- `resolveDispute(disputeId, status, resolutionNotes, resolvedBy)` — Resolve a dispute
- `confirmContributionFromDispute(disputeId, contributionId, txHash)` — Mark contribution as confirmed

---

## Frontend Components

### 1. DisputeForm (Member)

**Location:** `src/components/circle/DisputeForm.tsx`

Allows members to raise a dispute with:
- Reason (10-500 chars)
- Optional Paystack reference
- Form validation and error handling

### 2. DisputeList (Admin)

**Location:** `src/components/admin/DisputeList.tsx`

Displays all disputes with:
- Status badge (open/resolved/rejected)
- Member reason and Paystack reference
- Resolution interface for open disputes
- Resolution history for closed disputes

---

## Workflow

### Member Raises Dispute

1. Member navigates to their contribution in dashboard
2. Clicks "Raise Dispute" button
3. Fills form with reason and optional Paystack reference
4. Submits via `POST /api/circles/{circleId}/disputes`
5. Dispute created with status `open`

### Admin Reviews & Resolves

1. Admin views disputes in admin panel
2. Reviews member's reason and Paystack reference
3. Verifies payment in Paystack dashboard
4. Either:
   - **Confirms:** Enters resolution notes + TX hash → contribution marked as `confirmed`
   - **Rejects:** Enters rejection reason → dispute marked as `rejected`
5. Member receives notification of resolution

---

## Types

```typescript
export type DisputeStatus = "open" | "resolved" | "rejected";

export interface Dispute {
  id: string;
  contributionId: string;
  memberId: string;
  circleId: string;
  paystackReference?: string;
  reason: string;
  status: DisputeStatus;
  resolutionNotes?: string;
  resolvedBy?: string;
  createdAt: Date;
  resolvedAt?: Date;
}
```

---

## Files Created/Modified

- ✅ `migrations/1746100000000_add-dispute-resolution.ts` — Database schema
- ✅ `src/types/index.ts` — Dispute type definitions
- ✅ `src/server/services/dispute.service.ts` — Service layer
- ✅ `src/app/api/circles/[id]/disputes/route.ts` — Member API
- ✅ `src/app/api/admin/disputes/route.ts` — Admin API
- ✅ `src/components/circle/DisputeForm.tsx` — Member form component
- ✅ `src/components/circle/DisputeForm.module.css` — Form styling
- ✅ `src/components/admin/DisputeList.tsx` — Admin list component
- ✅ `src/components/admin/DisputeList.module.css` — List styling

---

## Acceptance Criteria Met

- ✅ Member can raise a dispute with Paystack reference
- ✅ Admin reviews and can manually confirm contribution
- ✅ Dispute history stored in database
- ✅ Full audit trail (who resolved, when, notes)

---

## Future Enhancements

- Automated Paystack API verification
- Email notifications on dispute resolution
- Dispute appeal mechanism
- Dispute statistics dashboard
- Automatic dispute resolution based on Paystack webhook verification
