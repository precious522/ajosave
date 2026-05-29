# Requirements Document

## Introduction

This feature adds automated contribution reminder notifications to Ajosave. Active circle members who have not yet confirmed their contribution for the current cycle will receive SMS reminders at 24 hours and 2 hours before the cycle deadline (`next_payout_at`). The goal is to reduce missed contributions and member defaults by prompting timely payment.

The feature extends the existing cron-based notification infrastructure. A new cron endpoint will run hourly (reusing the same cadence as the payout-reminder cron) and query for circles whose deadline falls within the relevant reminder windows. It will send SMS messages only to members who have not yet confirmed their contribution and who have SMS notifications enabled.

## Glossary

- **Contribution_Reminder_Service**: The service layer component responsible for identifying members who need contribution reminders and dispatching SMS notifications.
- **Reminder_Cron**: The HTTP endpoint at `/api/cron/contribution-reminders` that is invoked on a schedule to trigger the Contribution_Reminder_Service.
- **Cycle_Deadline**: The `next_payout_at` timestamp on a circle, representing the point in time by which all members must have confirmed their contribution for the current cycle.
- **Pending_Contributor**: An active circle member whose contribution for the current cycle has a status of `pending` or has no contribution record at all (i.e., has not yet initiated or confirmed payment).
- **SMS_Notification_System**: The existing Termii-backed system comprising `src/lib/sms.ts` and `src/server/services/notification.service.ts`.
- **CRON_SECRET**: The shared secret used to authenticate requests to cron endpoints via `Authorization: Bearer <CRON_SECRET>`.
- **Reminder_Window**: A time range used to identify circles whose deadline is approaching. The 24-hour window is 23–25 hours before the deadline; the 2-hour window is 1–3 hours before the deadline.

---

## Requirements

### Requirement 1: Identify Members Requiring Contribution Reminders

**User Story:** As a circle operator, I want the system to automatically identify which active members have not yet contributed before a cycle deadline, so that reminders can be sent to the right people.

#### Acceptance Criteria

1. WHEN the Contribution_Reminder_Service is invoked, THE Contribution_Reminder_Service SHALL query all circles with `status = 'active'` and a `next_payout_at` value within a specified Reminder_Window.
2. WHEN a circle is identified within a Reminder_Window, THE Contribution_Reminder_Service SHALL retrieve all members of that circle with `status = 'active'`.
3. WHEN evaluating each active member, THE Contribution_Reminder_Service SHALL classify a member as a Pending_Contributor if the member has no contribution record for the current cycle, or if the member's contribution record for the current cycle has `status = 'pending'`.
4. THE Contribution_Reminder_Service SHALL NOT classify a member as a Pending_Contributor if the member's contribution for the current cycle has `status = 'confirmed'`.
5. THE Contribution_Reminder_Service SHALL NOT classify a member as a Pending_Contributor if the member's contribution for the current cycle has `status = 'missed'`.

---

### Requirement 2: Send 24-Hour Contribution Reminder

**User Story:** As a circle member, I want to receive an SMS reminder 24 hours before the contribution deadline, so that I have enough time to make my payment.

#### Acceptance Criteria

1. WHEN the Contribution_Reminder_Service is invoked and a circle's `next_payout_at` is between 23 and 25 hours from the current time, THE Contribution_Reminder_Service SHALL send a contribution reminder SMS to each Pending_Contributor in that circle.
2. WHEN sending a 24-hour reminder, THE SMS_Notification_System SHALL deliver a message that includes the circle name, the contribution amount in USDC, and the number of hours remaining (24).
3. IF a Pending_Contributor has `sms_notifications_enabled = false`, THEN THE Contribution_Reminder_Service SHALL skip sending an SMS to that member.
4. IF the SMS_Notification_System fails to deliver a message to a Pending_Contributor, THEN THE Contribution_Reminder_Service SHALL log the error and continue processing remaining members without throwing.

---

### Requirement 3: Send 2-Hour Contribution Reminder

**User Story:** As a circle member, I want to receive a final SMS reminder 2 hours before the contribution deadline, so that I have a last-chance prompt to contribute before being marked as defaulted.

#### Acceptance Criteria

1. WHEN the Contribution_Reminder_Service is invoked and a circle's `next_payout_at` is between 1 and 3 hours from the current time, THE Contribution_Reminder_Service SHALL send a contribution reminder SMS to each Pending_Contributor in that circle.
2. WHEN sending a 2-hour reminder, THE SMS_Notification_System SHALL deliver a message that includes the circle name, the contribution amount in USDC, and the number of hours remaining (2).
3. IF a Pending_Contributor has `sms_notifications_enabled = false`, THEN THE Contribution_Reminder_Service SHALL skip sending an SMS to that member.
4. IF the SMS_Notification_System fails to deliver a message to a Pending_Contributor, THEN THE Contribution_Reminder_Service SHALL log the error and continue processing remaining members without throwing.

---

### Requirement 4: Cron Endpoint for Contribution Reminders

**User Story:** As a system operator, I want a dedicated cron endpoint that triggers contribution reminders on a schedule, so that reminders are sent automatically without manual intervention.

#### Acceptance Criteria

1. THE Reminder_Cron SHALL expose a `GET /api/cron/contribution-reminders` HTTP endpoint.
2. WHEN a request is received at `GET /api/cron/contribution-reminders` with a valid `Authorization: Bearer <CRON_SECRET>` header, THE Reminder_Cron SHALL invoke the Contribution_Reminder_Service and return a `200 OK` response with `{ success: true }`.
3. WHEN a request is received at `GET /api/cron/contribution-reminders` without a valid `Authorization: Bearer <CRON_SECRET>` header, THE Reminder_Cron SHALL return a `401 Unauthorized` response without invoking the Contribution_Reminder_Service.
4. IF the Contribution_Reminder_Service throws an unhandled error, THEN THE Reminder_Cron SHALL return a `500` response with `{ success: false, error: "<message>" }`.
5. THE Reminder_Cron SHALL be scheduled to run hourly so that both the 24-hour and 2-hour Reminder_Windows are checked at least once per hour.

---

### Requirement 5: SMS Message Content for Contribution Reminders

**User Story:** As a circle member, I want the reminder SMS to clearly state what action I need to take and how much time I have, so that I can act quickly.

#### Acceptance Criteria

1. THE SMS_Notification_System SHALL provide a `sendContributionReminderSms` function that accepts a phone number, circle name, contribution amount in USDC, and hours remaining.
2. WHEN `sendContributionReminderSms` is called, THE SMS_Notification_System SHALL send a message that contains the circle name, the contribution amount, and the hours remaining until the deadline.
3. THE SMS_Notification_System SHALL prefix all contribution reminder messages with "Ajosave:" to maintain consistency with existing notification messages.

---

### Requirement 6: Idempotency and Duplicate Prevention

**User Story:** As a circle member, I want to receive at most one reminder per reminder window per cycle, so that I am not spammed with repeated messages.

#### Acceptance Criteria

1. WHEN the Contribution_Reminder_Service processes a circle in the 24-hour Reminder_Window, THE Contribution_Reminder_Service SHALL send at most one 24-hour reminder SMS per Pending_Contributor per cycle.
2. WHEN the Contribution_Reminder_Service processes a circle in the 2-hour Reminder_Window, THE Contribution_Reminder_Service SHALL send at most one 2-hour reminder SMS per Pending_Contributor per cycle.
3. WHILE a circle's `next_payout_at` remains within a Reminder_Window across multiple hourly cron runs, THE Contribution_Reminder_Service SHALL NOT send duplicate reminders to the same Pending_Contributor for the same window and cycle.

---

### Requirement 7: Graceful Handling of Circles Without a Deadline

**User Story:** As a system operator, I want the reminder cron to safely skip circles that have no scheduled deadline, so that the cron does not produce errors for circles in non-active states.

#### Acceptance Criteria

1. WHEN the Contribution_Reminder_Service queries for circles, THE Contribution_Reminder_Service SHALL only consider circles where `next_payout_at IS NOT NULL`.
2. IF a circle has `status != 'active'`, THEN THE Contribution_Reminder_Service SHALL exclude that circle from reminder processing.
3. IF an error occurs while processing reminders for a single circle, THEN THE Contribution_Reminder_Service SHALL log the error and continue processing remaining circles without aborting the entire run.
