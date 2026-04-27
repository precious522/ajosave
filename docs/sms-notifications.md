# SMS Notifications System

## Overview

Ajosave uses Termii SMS API to send automated notifications to members about important circle events. This keeps members informed and engaged throughout the savings cycle.

## Notification Types

### 1. Payout Reminders
**Trigger:** 24 hours before a member's scheduled payout  
**Recipient:** The member who will receive the next payout  
**Frequency:** Once per payout cycle  
**Example:**
```
Ajosave: Your payout of 50.0000000 USDC from "Lagos Girls Monthly Ajo" will be processed in 24 hours. Make sure your Stellar wallet is ready!
```

### 2. Payout Processed
**Trigger:** When a payout is successfully sent  
**Recipients:** All active members in the circle  
**Frequency:** Once per payout  
**Example:**
```
Ajosave: Payout of 50.0000000 USDC processed for Fatima in "Lagos Girls Monthly Ajo". Check your circle dashboard for details.
```

### 3. Contribution Confirmed
**Trigger:** When a member's payment is verified by Paystack  
**Recipient:** The contributing member  
**Frequency:** Once per contribution  
**Example:**
```
Ajosave: Your contribution of 10.0000000 USDC to "Lagos Girls Monthly Ajo" (Cycle 3) has been confirmed. Thank you!
```

### 4. Missed Contribution
**Trigger:** When a member fails to contribute by the cycle deadline  
**Recipient:** The member who missed the contribution  
**Frequency:** Once per missed cycle  
**Example:**
```
Ajosave: You missed your contribution of 10.0000000 USDC to "Lagos Girls Monthly Ajo". Your status is now "defaulted" and you cannot receive future payouts. Contact support if this is an error.
```

### 5. Join Request Approved
**Trigger:** When a circle creator approves a join request (private circles only)  
**Recipient:** The approved member  
**Frequency:** Once per approval  
**Example:**
```
Ajosave: Your join request for "Lagos Girls Monthly Ajo" has been approved! You'll be notified when the circle starts.
```

### 6. Join Request Rejected
**Trigger:** When a circle creator rejects a join request (private circles only)  
**Recipient:** The rejected member  
**Frequency:** Once per rejection  
**Example:**
```
Ajosave: Your join request for "Lagos Girls Monthly Ajo" has been declined by the creator.
```

## Opt-Out Mechanism

Users can disable SMS notifications from their settings page:

1. Navigate to `/settings`
2. Toggle "SMS Notifications" off
3. Changes take effect immediately

**Note:** Even with SMS disabled, users will still receive OTP codes for authentication (required for security).

## Implementation

### Database Schema

```sql
ALTER TABLE users ADD COLUMN sms_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE;
```

### Service Layer

All SMS notifications go through `notification.service.ts`, which:
1. Checks if the user has notifications enabled
2. Retrieves the user's phone number
3. Calls the appropriate SMS function
4. Handles errors gracefully (logs but doesn't throw)

### Cron Jobs

Two cron endpoints handle scheduled notifications:

#### `/api/cron/reminders` (Hourly)
- Finds circles with payouts due in 23-25 hours
- Sends reminder SMS to recipients
- Authorization: `Bearer <CRON_SECRET>`

#### `/api/cron/missed-contributions` (Daily)
- Finds circles past their payout date
- Identifies members who haven't contributed
- Marks them as "defaulted"
- Sends missed contribution SMS

### Vercel Cron Configuration

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/reminders",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/cron/missed-contributions",
      "schedule": "0 0 * * *"
    }
  ]
}
```

### GitHub Actions Alternative

If not using Vercel Cron, create `.github/workflows/cron.yml`:

```yaml
name: Scheduled Tasks

on:
  schedule:
    - cron: '0 * * * *'  # Hourly reminders
    - cron: '0 0 * * *'  # Daily missed contributions

jobs:
  reminders:
    runs-on: ubuntu-latest
    steps:
      - name: Send Payout Reminders
        run: |
          curl -X GET https://ajosave.app/api/cron/reminders \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"

  missed-contributions:
    runs-on: ubuntu-latest
    steps:
      - name: Process Missed Contributions
        run: |
          curl -X GET https://ajosave.app/api/cron/missed-contributions \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

## Testing

### Manual Testing

```bash
# Test payout reminder
curl -X POST http://localhost:3000/api/test/sms \
  -H "Content-Type: application/json" \
  -d '{
    "type": "payout_reminder",
    "userId": "user_123",
    "circleName": "Test Circle",
    "amount": "50.0000000"
  }'

# Test contribution confirmation
curl -X POST http://localhost:3000/api/test/sms \
  -H "Content-Type: application/json" \
  -d '{
    "type": "contribution_confirmed",
    "userId": "user_123",
    "circleName": "Test Circle",
    "amount": "10.0000000",
    "cycleNumber": 1
  }'
```

### Unit Tests

```typescript
import { notifyPayoutReminder } from "@/server/services/notification.service";

describe("SMS Notifications", () => {
  it("should send payout reminder to user with notifications enabled", async () => {
    // Mock user with notifications enabled
    // Mock SMS service
    // Assert SMS was sent
  });

  it("should not send SMS to user with notifications disabled", async () => {
    // Mock user with notifications disabled
    // Assert SMS was not sent
  });
});
```

## Cost Estimation

Termii SMS pricing (Nigeria):
- ~₦2.50 per SMS

For a circle with 10 members over 10 cycles:
- Payout reminders: 10 SMS × ₦2.50 = ₦25
- Payout processed: 10 cycles × 10 members × ₦2.50 = ₦250
- Contribution confirmations: 10 cycles × 10 members × ₦2.50 = ₦250
- **Total: ~₦525 per circle**

## Rate Limiting

Termii has rate limits:
- 100 SMS per second
- 10,000 SMS per day (default)

For high-volume deployments, consider:
1. Batching SMS sends
2. Queueing with Redis/Bull
3. Upgrading Termii plan

## Error Handling

All SMS functions:
- Log errors but don't throw (non-blocking)
- Return gracefully on failure
- Don't retry automatically (avoid duplicate SMS)

## Privacy & Compliance

- Phone numbers are stored securely in PostgreSQL
- SMS opt-out is honored immediately
- No SMS content contains sensitive data (wallet keys, passwords)
- Users can request data deletion (GDPR compliance)

## Future Enhancements

- [ ] WhatsApp notifications (Termii supports this)
- [ ] Email notifications as fallback
- [ ] Customizable notification preferences (per event type)
- [ ] SMS delivery status tracking
- [ ] Multi-language support
