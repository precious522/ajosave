# Implementation Plan: Circle Chat

## Overview

Implement a persistent, real-time message thread for each savings circle. The work proceeds in five incremental stages: database schema, service layer, API route, WebSocket integration, and the React UI — each building on the previous so nothing is left unconnected.

## Tasks

- [x] 1. Add the `circle_messages` database migration
  - Create `migrations/1746200000000_add-circle-messages-table.ts` following the pattern in `migrations/1746100000000_add-contribution-reminders-table.ts`
  - Define the table with columns: `id` (UUID PK), `circle_id` (UUID FK → circles CASCADE), `user_id` (VARCHAR FK → users CASCADE), `content` (TEXT with `char_length` check 1–1000), `created_at` (TIMESTAMP DEFAULT NOW())
  - Add composite index `idx_circle_messages_circle_created` on `(circle_id, created_at)`
  - Implement `down()` to drop the table
  - _Requirements: 1.1, 1.2, 1.4_

- [x] 2. Add `CircleMessage` type and extend WebSocket types
  - [x] 2.1 Add `CircleMessage` interface to `src/types/index.ts`
    - Fields: `id`, `circleId`, `userId`, `displayName`, `content`, `createdAt` (ISO string)
    - _Requirements: 1.1, 3.6_

  - [x] 2.2 Extend `WebSocketEvents` and add `broadcastChatMessage()` in `src/server/websocket.ts`
    - Add `"chat:message"` key to the `WebSocketEvents` interface with fields matching `CircleMessage`
    - Add `broadcastChatMessage(circleId: string, message: WebSocketEvents["chat:message"]): void` following the `broadcastContributionConfirmed` pattern
    - _Requirements: 4.1, 2.6_

- [x] 3. Implement `chat.service.ts`
  - [x] 3.1 Create `src/server/services/chat.service.ts` with `postMessage()`
    - Import `query` from `@/lib/db` and `CircleMessage` from `@/types`
    - `postMessage(circleId, userId, content)`: INSERT into `circle_messages`, then SELECT with JOIN on `users` to return the full `CircleMessage` including `displayName`
    - Use camelCase column aliases matching the pattern in `circle.service.ts`
    - _Requirements: 1.3, 2.5, 3.6_

  - [ ]* 3.2 Write property test for `postMessage` — author identity round-trip
    - **Property 2: Author identity round-trip**
    - For any valid `content`, `postMessage(circleId, userId, content).userId` SHALL equal the original `userId`
    - **Validates: Requirements 1.3, 2.5**

  - [ ]* 3.3 Write property test for `postMessage` — response includes display_name
    - **Property 7: Response includes display_name**
    - For any valid `content`, the returned `CircleMessage.displayName` SHALL be a non-empty string
    - **Validates: Requirements 3.6, 4.1**

  - [x] 3.4 Add `getMessages()` to `src/server/services/chat.service.ts`
    - `getMessages(circleId, options?)`: SELECT with JOIN on `users`, WHERE `circle_id = $1 AND ($2::timestamp IS NULL OR created_at < $2)`, ORDER BY `created_at ASC`, LIMIT `$3`
    - Accept `GetMessagesOptions` interface: `{ limit?: number; before?: string }`
    - Default `limit` to 50; clamp to [1, 100]
    - _Requirements: 3.3, 3.4, 3.5_

  - [ ]* 3.5 Write property test for `getMessages` — chronological ordering invariant
    - **Property 4: Chronological ordering invariant**
    - For any set of stored messages, `getMessages(circleId)` SHALL return them in strictly ascending `createdAt` order
    - **Validates: Requirements 3.3**

  - [ ]* 3.6 Write property test for `getMessages` — cursor pagination correctness
    - **Property 5: Cursor pagination correctness**
    - For any ISO timestamp `before`, every message returned by `getMessages(circleId, { before })` SHALL have `createdAt` strictly less than `before`
    - **Validates: Requirements 3.5**

  - [ ]* 3.7 Write property test for `getMessages` — limit parameter enforcement
    - **Property 6: Limit parameter enforcement**
    - For any integer `limit` in [1, 100], `getMessages(circleId, { limit })` SHALL return at most `limit` messages; with no `limit`, at most 50
    - **Validates: Requirements 3.4**

  - [ ]* 3.8 Write unit tests for `chat.service.ts`
    - `postMessage` with content at boundaries (1 char, 1000 chars) succeeds
    - `getMessages` with no options returns up to 50 messages
    - `getMessages` with `before` excludes messages at or after the timestamp
    - _Requirements: 1.2, 3.3, 3.4, 3.5_

- [x] 4. Checkpoint — service layer complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement the chat API route
  - [x] 5.1 Create `src/app/api/circles/[id]/chat/route.ts` with GET handler
    - Wrap with `withErrorHandler`; call `getServerSession` → 401 if no session
    - Query `members` table to verify `status = 'active'` for the requesting user → 403 if not active member
    - Parse and validate `limit` (integer 1–100, default 50) and `before` (valid ISO 8601) query params → 400 on invalid
    - Call `getMessages(circleId, { limit, before })` and return `200 ApiResponse<CircleMessage[]>`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 6.1, 6.2, 6.4_

  - [x] 5.2 Add POST handler to `src/app/api/circles/[id]/chat/route.ts`
    - Wrap with `withErrorHandler` and `withRateLimit({ limit: 30, windowMs: 60_000 })`
    - Auth check (401), active-member check (403), content validation (400 for empty or >1000 chars)
    - Call `postMessage(circleId, userId, content)`, then `broadcastChatMessage(circleId, message)`
    - Return `201 ApiResponse<CircleMessage>`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 6.1, 6.2, 6.3, 6.4_

  - [ ]* 5.3 Write property test for the API route — content length enforcement
    - **Property 1: Content length enforcement**
    - For any `content` with length > 1000, POST SHALL return 400; for length in [1, 1000], POST SHALL return 201
    - **Validates: Requirements 1.2, 2.3, 2.4**

  - [ ]* 5.4 Write property test for the API route — active-member access control
    - **Property 3: Active-member access control**
    - For any user with member `status` other than `'active'`, both GET and POST SHALL return 403
    - **Validates: Requirements 2.2, 3.2, 6.2**

  - [ ]* 5.5 Write unit tests for the API route
    - GET without session → 401; GET with non-active member → 403; GET with active member → 200
    - POST without session → 401; POST with non-active member → 403; POST with empty content → 400; POST with content > 1000 chars → 400
    - POST with valid content → 201; `broadcastChatMessage` called once
    - _Requirements: 2.1–2.6, 3.1–3.2, 6.1–6.3_

- [x] 6. Checkpoint — API route complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Extend `useRealtimeUpdates` hook
  - Add `onChatMessage?: (data: WebSocketEvents["chat:message"]) => void` to the `UseRealtimeUpdatesOptions` interface in `src/hooks/useRealtimeUpdates.ts`
  - Inside the `useEffect`, add `if (onChatMessage) { socket.on("chat:message", onChatMessage); }` following the existing `onContributionConfirmed` pattern
  - Add `onChatMessage` to the `useEffect` dependency array
  - _Requirements: 4.2, 4.4_

- [x] 8. Build the `CircleChat` component
  - [x] 8.1 Create `src/components/circle/CircleChat.tsx`
    - Accept props: `circleId: string`, `isActiveMember: boolean`, `currentUserId: string`
    - Use `useQuery` (React Query) to fetch initial messages from `GET /api/circles/[id]/chat`
    - Use `useMutation` to POST new messages; clear input on success; keep input populated on error
    - Use `useRealtimeUpdates({ circleId, onChatMessage })` to append incoming `chat:message` events to the local message list (increment list by exactly one per event)
    - Render a scrollable message list; auto-scroll to the newest message on list update
    - Render a text input + send button for active members; disable send button while mutation is in flight
    - Render a read-only notice for non-active members
    - Show a loading indicator while the initial query is loading
    - Show an inline error message on GET or POST failure
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 4.2, 4.3, 4.4_

  - [ ]* 8.2 Write property test for `CircleChat` — UI appends incoming real-time messages
    - **Property 9: UI appends incoming real-time messages**
    - For any `chat:message` WebSocket event received while the component is mounted, the message SHALL be appended to the end of the list and the list length SHALL increase by exactly one
    - **Validates: Requirements 4.3**

  - [ ]* 8.3 Write property test for `CircleChat` — pagination cursor uses oldest visible message
    - **Property 10: Pagination cursor uses oldest visible message**
    - When "Load earlier messages" is activated, the GET request SHALL include `before` equal to the `createdAt` of the oldest displayed message
    - **Validates: Requirements 7.2**

  - [ ]* 8.4 Write property test for `CircleChat` — load-more control visibility
    - **Property 11: Load-more control visibility**
    - The "Load earlier messages" control SHALL be visible iff the response count equals the requested `limit`; hidden when fewer messages are returned
    - **Validates: Requirements 7.4**

  - [ ]* 8.5 Write unit tests for `CircleChat.tsx`
    - Renders message list, input, and send button for active members
    - Renders read-only notice for non-active members
    - Shows loading indicator while fetching
    - Shows error message on fetch failure
    - Disables send button while POST is in flight
    - Clears input on successful POST
    - _Requirements: 5.1–5.8_

  - [x] 8.6 Create `src/components/circle/CircleChat.module.css`
    - Scoped styles for the chat container, message list, individual messages, author name, timestamp, input area, send button, and load-earlier control
    - Follow the CSS Modules pattern used in `CircleCard.module.css`
    - _Requirements: 5.1_

- [x] 9. Wire `CircleChat` into the circle detail page
  - Modify `src/app/circles/[id]/page.tsx` to import and render `<CircleChat>` below the existing grid
  - Determine `isActiveMember` from the existing `members` array (`members.some(m => m.userId === userId && m.status === 'active')`)
  - Pass `circleId={circle.id}`, `isActiveMember`, and `currentUserId={userId ?? ''}` as props
  - Only render `<CircleChat>` when `userId` is defined (user is logged in)
  - _Requirements: 5.1, 5.6, 6.1_

- [x] 10. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use `fast-check` (already installed as a dev dependency)
- Unit tests use Jest + `@testing-library/react` (already configured)
- The WebSocket broadcast is fire-and-forget; a failed broadcast does not roll back the DB insert
- The `before` cursor is an ISO 8601 timestamp; pass it as `$2::timestamp` in SQL to handle null safely
