# Implementation Plan: Contribution Reminders

## Overview

Implement automated SMS reminders for active circle members who have not yet confirmed their contribution before the cycle deadline. The feature adds a new `contribution_reminders` idempotency table, extends the SMS and notification layers, adds a new scheduler function with 24h/2h window logic, and exposes a new cron endpoint — all following existing patterns in the codebase.

## Tasks

- [x] 1. Create the `contribution_reminders` migration
  - Create `migrations/1746100000000_add-contribution-reminders-table.ts` using `node-pg-migrate` following the pattern of `migrations/1745505605000_initial-schema.ts`
  - Define the `contribution_reminders` table with columns: `id` (UUID PK), `member_id` (UUID FK → `members.id` ON DELETE CASCADE), `cycle_number` (INTEGER, CHECK > 0), `reminder_type` (VARCHAR(4), CHECK IN ('24h','2h')), `sent_at` (TIMESTAMP DEFAULT NOW())
  - Add `UNIQUE (member_id, cycle_number, reminder_type)` constraint — this is the idempotency guarantee
  - Add index `idx_contribution_reminders_member` on `(member_id, cycle_number)`
  - Implement `down()` to drop the table
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 2. Add `sendContributionReminderSms` to the SMS layer
  - [x] 2.1 Implement `sendContributionReminderSms` in `src/lib/sms.ts`
    - Add the function after the existing `sendMissedContributionSms` function, following the same pattern as `sendPayoutReminderSms`
    - Message format: `Ajosave: Your contribution of <amount> USDC to "<circleName>" is due in <hoursLeft> hours. Please contribute now to avoid being marked as defaulted!`
    - Signature: `sendContributionReminderSms(phone: string, circleName: string, amount: string, hoursLeft: number): Promise<void>`
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ]* 2.2 Write property test for SMS message content (Property 3)
    - **Property 3: SMS message content**
    - Generate arbitrary circle names (including special characters, Unicode), amounts, and hours values (24 or 2) using `fast-check`
    - Mock `sendSms` and capture the message argument
    - Assert the captured message contains the circle name, the amount, the hours value, and starts with "Ajosave:"
    - Tag: `// Feature: contribution-reminders, Property 3: SMS message content`
    - **Validates: Requirements 2.2, 3.2, 5.2, 5.3**

- [x] 3. Add `notifyContributionReminder` to the notification service
  - [x] 3.1 Implement `notifyContributionReminder` in `src/server/services/notification.service.ts`
    - Add the import for `sendContributionReminderSms` from `@/lib/sms`
    - Follow the exact pattern of `notifyPayoutReminder`: call `canSendSms`, then `getUserPhone`, then `sendContributionReminderSms` inside a try/catch that logs but does not throw
    - Signature: `notifyContributionReminder(userId: string, circleName: string, amount: string, hoursLeft: number): Promise<void>`
    - _Requirements: 2.1, 2.3, 2.4, 3.1, 3.3, 3.4_

  - [ ]* 3.2 Write unit tests for `notifyContributionReminder`
    - Test: skips sending when `sms_notifications_enabled = false`
    - Test: skips sending when user has no phone number
    - Test: catches and logs SMS errors without throwing
    - Test: calls `sendContributionReminderSms` with correct arguments when user is eligible
    - Mock `@/lib/db` and `@/lib/sms` following the pattern in `src/app/api/circles/[id]/contribute/__tests__/route.test.ts`
    - _Requirements: 2.3, 2.4, 3.3, 3.4_

  - [ ]* 3.3 Write property test for opt-out enforcement (Property 4)
    - **Property 4: Opt-out is always respected**
    - Generate arbitrary `userId` strings with `sms_notifications_enabled = false` mocked in the DB
    - Call `notifyContributionReminder` for each generated user
    - Assert `sendContributionReminderSms` (and the underlying `sendSms`) is never called
    - Tag: `// Feature: contribution-reminders, Property 4: Opt-out is always respected`
    - **Validates: Requirements 2.3, 3.3**

- [x] 4. Implement `sendContributionReminders` in the scheduler service
  - [x] 4.1 Implement the core `sendContributionReminders` function in `src/server/services/scheduler.service.ts`
    - Add the function after `processMissedContributions`, importing `notifyContributionReminder` from `./notification.service`
    - Define `WINDOWS` constant: `[{ hoursLeft: 24, lowerBound: '23 hours', upperBound: '25 hours' }, { hoursLeft: 2, lowerBound: '1 hour', upperBound: '3 hours' }]`
    - For each window, query circles: `status = 'active' AND next_payout_at IS NOT NULL AND next_payout_at > NOW() + INTERVAL '<lower>' AND next_payout_at < NOW() + INTERVAL '<upper>'`
    - For each circle, query active members (`status = 'active'`)
    - For each member, check if they are a Pending_Contributor: no contribution record for `current_cycle`, or contribution with `status = 'pending'`
    - Check idempotency: `SELECT 1 FROM contribution_reminders WHERE member_id = $1 AND cycle_number = $2 AND reminder_type = $3`
    - If not already reminded: call `notifyContributionReminder`, then `INSERT INTO contribution_reminders (...) ON CONFLICT DO NOTHING`
    - Wrap each circle's processing in try/catch — log errors and continue
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 3.1, 6.1, 6.2, 6.3, 7.1, 7.2, 7.3_

  - [ ]* 4.2 Write property test for circle window filtering (Property 1)
    - **Property 1: Circle window filtering**
    - Generate arbitrary arrays of circles with random `status` values and `next_payout_at` offsets using `fast-check`
    - Extract and test the filtering predicate (active, non-null deadline, within window bounds) in isolation
    - Assert the filtered result contains exactly the circles that satisfy all three conditions
    - Tag: `// Feature: contribution-reminders, Property 1: Circle window filtering`
    - **Validates: Requirements 1.1, 7.1, 7.2**

  - [ ]* 4.3 Write property test for pending contributor classification (Property 2)
    - **Property 2: Pending contributor classification**
    - Generate arbitrary members paired with arbitrary contribution states: no record, `pending`, `confirmed`, `missed`
    - Extract and test the classification predicate in isolation
    - Assert a member is classified as Pending_Contributor if and only if they have no record or their record has `status = 'pending'`
    - Tag: `// Feature: contribution-reminders, Property 2: Pending contributor classification`
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.5**

  - [ ]* 4.4 Write property test for per-circle fault isolation (Property 5)
    - **Property 5: Per-circle fault isolation**
    - Generate an arbitrary list of mock circles where a random subset throws during processing
    - Mock `@/lib/db` so the failing circles throw and the passing circles resolve normally
    - Call `sendContributionReminders` and assert it resolves without throwing
    - Assert that non-failing circles were processed (their `notifyContributionReminder` was called)
    - Tag: `// Feature: contribution-reminders, Property 5: Per-circle fault isolation`
    - **Validates: Requirements 2.4, 3.4, 7.3**

  - [ ]* 4.5 Write property test for idempotency (Property 6)
    - **Property 6: Idempotency — at most one reminder per window per cycle**
    - Generate an arbitrary Pending_Contributor and simulate N ≥ 2 invocations of `sendContributionReminders` for the same circle/cycle/window
    - Use an in-memory set to simulate the `contribution_reminders` unique constraint (first INSERT succeeds, subsequent ones are no-ops)
    - Assert `sendContributionReminderSms` is called exactly once across all N invocations
    - Tag: `// Feature: contribution-reminders, Property 6: Idempotency — at most one reminder per window per cycle`
    - **Validates: Requirements 6.1, 6.2, 6.3**

- [x] 5. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Create the cron endpoint
  - [x] 6.1 Create `src/app/api/cron/contribution-reminders/route.ts`
    - Mirror the structure of `src/app/api/cron/reminders/route.ts` exactly
    - Import `sendContributionReminders` from `@/server/services/scheduler.service`
    - Import `verifyCronSecret` from `@/lib/cron-auth`
    - `GET` handler: call `verifyCronSecret(req)`, return 401 if invalid; call `sendContributionReminders()` in try/catch; return `200 { success: true, message: "Contribution reminders sent successfully" }` on success; return `500 { success: false, error: message }` on error
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 6.2 Write unit tests for the cron endpoint
    - Test: returns 401 when `Authorization` header is missing
    - Test: returns 401 when token is wrong
    - Test: returns 200 with `{ success: true }` when auth is valid and service succeeds
    - Test: returns 500 with `{ success: false, error: ... }` when service throws
    - Mock `@/lib/cron-auth` and `@/server/services/scheduler.service`
    - Follow the `@jest-environment node` pattern from existing test files
    - _Requirements: 4.2, 4.3, 4.4_

  - [ ]* 6.3 Write property test for unauthorized request rejection (Property 7)
    - **Property 7: Unauthorized requests are always rejected**
    - Generate arbitrary strings as `Authorization` header values (excluding the exact valid secret) using `fast-check`
    - Call the `GET` handler with each generated header value
    - Assert all return 401 and that `sendContributionReminders` is never called
    - Tag: `// Feature: contribution-reminders, Property 7: Unauthorized requests are always rejected`
    - **Validates: Requirements 4.3**

- [x] 7. Update `docs/sms-notifications.md`
  - Add a new "Contribution Reminder" section under "Notification Types" documenting:
    - Trigger: hourly cron, 24h and 2h before `next_payout_at`
    - Recipients: active members with no confirmed contribution for the current cycle
    - Frequency: at most once per reminder window per cycle (idempotent)
    - Example messages for both the 24h and 2h variants
  - Add the new `/api/cron/contribution-reminders` endpoint to the "Cron Jobs" section with its hourly schedule
  - Add the new endpoint to the Vercel Cron and GitHub Actions configuration examples
  - _Requirements: 4.5_

- [x] 8. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests use `fast-check` (already a transitive dependency); each is tagged with `// Feature: contribution-reminders, Property N: ...`
- The `UNIQUE (member_id, cycle_number, reminder_type)` constraint in the migration is the primary idempotency mechanism — `ON CONFLICT DO NOTHING` in the scheduler relies on it
- All new code is additive; no existing functions are modified
