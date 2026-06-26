# Requirements Document

## Introduction

Circle Chat adds a persistent message thread to each savings circle, giving members a dedicated space to coordinate payout timing, share updates, and communicate without leaving the app. Each circle has exactly one thread. Messages are stored in the database and delivered in real-time via the existing Socket.io WebSocket infrastructure. Only active members of a circle may read or post messages.

## Glossary

- **Chat_API**: The Next.js API route layer responsible for reading and writing circle messages (`src/app/api/circles/[id]/chat/route.ts`).
- **Chat_Service**: The server-side service module that executes parameterized SQL queries against the `circle_messages` table.
- **Chat_UI**: The client-side React component (`CircleChat`) rendered on the circle detail page.
- **Circle**: A rotating savings group stored in the `circles` table.
- **Active_Member**: A user whose row in the `members` table has `status = 'active'` for the given circle.
- **Message**: A single text post in a circle's thread, stored in the `circle_messages` table.
- **WebSocket_Server**: The existing Socket.io server defined in `src/server/websocket.ts`.
- **Realtime_Hook**: The existing `useRealtimeUpdates` React hook in `src/hooks/useRealtimeUpdates.ts`.
- **Session**: A NextAuth.js JWT session obtained via `getServerSession(authOptions)`.

---

## Requirements

### Requirement 1: Message Storage

**User Story:** As a circle member, I want my messages to be saved, so that I can read the conversation history when I return to the circle page.

#### Acceptance Criteria

1. THE Chat_Service SHALL store each Message in a `circle_messages` table with columns: `id` (UUID), `circle_id` (UUID FK → circles), `user_id` (VARCHAR FK → users), `content` (TEXT), and `created_at` (TIMESTAMP DEFAULT NOW()).
2. THE Chat_Service SHALL enforce a maximum content length of 1000 characters per Message at the database constraint level.
3. WHEN a Message is stored, THE Chat_Service SHALL record the `user_id` of the author exactly as provided by the authenticated Session.
4. THE Chat_Service SHALL index the `circle_messages` table on `circle_id` and `created_at` to support efficient chronological retrieval.

---

### Requirement 2: Post a Message

**User Story:** As an active circle member, I want to post a message to my circle's thread, so that I can communicate with other members.

#### Acceptance Criteria

1. WHEN an authenticated user submits a POST request to `/api/circles/[id]/chat`, THE Chat_API SHALL verify the user has an active Session before processing the request.
2. WHEN a POST request is received and the requesting user is not an Active_Member of the circle, THE Chat_API SHALL return HTTP 403 with a descriptive error.
3. WHEN a POST request is received with a missing or empty `content` field, THE Chat_API SHALL return HTTP 400 with a descriptive validation error.
4. WHEN a POST request is received with `content` exceeding 1000 characters, THE Chat_API SHALL return HTTP 400 with a descriptive validation error.
5. WHEN a valid POST request is received from an Active_Member, THE Chat_API SHALL persist the Message via the Chat_Service and return HTTP 201 with the created Message object.
6. WHEN a Message is successfully persisted, THE Chat_API SHALL emit a `chat:message` WebSocket event to the `circle:{id}` room via the WebSocket_Server.

---

### Requirement 3: Retrieve Messages

**User Story:** As an active circle member, I want to load the message history for my circle, so that I can read past conversations.

#### Acceptance Criteria

1. WHEN an authenticated user submits a GET request to `/api/circles/[id]/chat`, THE Chat_API SHALL verify the user has an active Session before processing the request.
2. WHEN a GET request is received and the requesting user is not an Active_Member of the circle, THE Chat_API SHALL return HTTP 403 with a descriptive error.
3. WHEN a valid GET request is received, THE Chat_API SHALL return messages in ascending chronological order (oldest first).
4. THE Chat_API SHALL support a `limit` query parameter (integer, 1–100, default 50) to control the number of messages returned.
5. THE Chat_API SHALL support a `before` query parameter (ISO 8601 timestamp) to enable cursor-based pagination of older messages.
6. WHEN a valid GET request is received, THE Chat_API SHALL include the author's `display_name` alongside each Message in the response.

---

### Requirement 4: Real-Time Message Delivery

**User Story:** As an active circle member, I want new messages to appear instantly without refreshing the page, so that the conversation feels live.

#### Acceptance Criteria

1. WHEN a Message is successfully persisted, THE WebSocket_Server SHALL broadcast a `chat:message` event containing the full Message object (including `id`, `circleId`, `userId`, `displayName`, `content`, `createdAt`) to all sockets in the `circle:{id}` room.
2. WHEN the Chat_UI mounts, THE Realtime_Hook SHALL subscribe to `chat:message` events for the current circle.
3. WHEN a `chat:message` event is received, THE Chat_UI SHALL append the new Message to the displayed thread without requiring a page reload.
4. WHEN the Chat_UI unmounts, THE Realtime_Hook SHALL unsubscribe from `chat:message` events for the current circle.

---

### Requirement 5: Chat UI Component

**User Story:** As a circle member, I want a clear and usable chat interface on the circle detail page, so that I can read and send messages without navigating away.

#### Acceptance Criteria

1. THE Chat_UI SHALL render a scrollable message list and a text input with a send button within the circle detail page.
2. WHEN the Chat_UI mounts, THE Chat_UI SHALL fetch the initial message history via the GET `/api/circles/[id]/chat` endpoint using React Query.
3. WHEN a user submits the message input form, THE Chat_UI SHALL POST the message to `/api/circles/[id]/chat` and clear the input field on success.
4. WHEN a POST request is in flight, THE Chat_UI SHALL disable the send button to prevent duplicate submissions.
5. WHEN the message list updates, THE Chat_UI SHALL automatically scroll to the most recent message.
6. IF the user is not an Active_Member of the circle, THE Chat_UI SHALL render a read-only notice in place of the message input.
7. WHILE the initial message history is loading, THE Chat_UI SHALL display a loading indicator.
8. IF the GET or POST request fails, THE Chat_UI SHALL display a descriptive inline error message.

---

### Requirement 6: Access Control

**User Story:** As a circle creator, I want only active members to participate in the chat, so that the conversation remains private to the group.

#### Acceptance Criteria

1. WHEN any request reaches `/api/circles/[id]/chat` without a valid Session, THE Chat_API SHALL return HTTP 401.
2. WHEN any request reaches `/api/circles/[id]/chat` from a user whose `members` row has a status other than `active`, THE Chat_API SHALL return HTTP 403.
3. THE Chat_API SHALL apply the existing `withRateLimit` middleware to the chat endpoint, limiting each IP to 30 POST requests per minute.
4. THE Chat_API SHALL use parameterized SQL queries for all database interactions to prevent SQL injection.

---

### Requirement 7: Message Pagination

**User Story:** As a circle member, I want to load older messages on demand, so that I can review conversation history without loading everything at once.

#### Acceptance Criteria

1. WHEN the Chat_UI reaches the top of the message list, THE Chat_UI SHALL display a "Load earlier messages" control.
2. WHEN the "Load earlier messages" control is activated, THE Chat_UI SHALL issue a GET request with the `before` parameter set to the `createdAt` timestamp of the oldest currently displayed Message.
3. WHEN older messages are returned, THE Chat_UI SHALL prepend them to the message list while preserving the current scroll position.
4. WHEN the GET response returns fewer messages than the requested `limit`, THE Chat_UI SHALL hide the "Load earlier messages" control.
