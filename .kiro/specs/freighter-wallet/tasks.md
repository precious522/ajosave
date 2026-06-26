# Implementation Plan: Freighter Wallet Integration

## Overview

Integrate `@stellar/freighter-api` into AjoSave so users can connect their Freighter browser extension wallet and have their Stellar public key auto-populated in the Edit Profile form and the Join Circle form. The implementation is entirely client-side: a shared hook (`useFreighterWallet`) encapsulates all Freighter API interactions, a shared `ConnectWalletButton` component renders the appropriate UI, and both forms are wired up independently.

## Tasks

- [x] 1. Install dependencies
  - Add `@stellar/freighter-api@3.1.0` as a pinned production dependency in `package.json`
  - Add `fast-check` as a dev dependency in `package.json`
  - Run `npm install` to update `package-lock.json`
  - _Requirements: 10.1, 10.2_

- [x] 2. Create the `useFreighterWallet` shared hook
  - [x] 2.1 Implement `useFreighterWallet` in `src/hooks/useFreighterWallet.ts`
    - Export `ConnectionState` type: `"not_installed" | "disconnected" | "connecting" | "connected"`
    - Export `UseFreighterWalletReturn` interface with `connectionState`, `publicKey`, `error`, `connect`, `disconnect`
    - On mount: guard with `typeof window !== 'undefined'`, call `isConnected()` from `@stellar/freighter-api`; set state to `disconnected` if installed, `not_installed` if not (or if the call throws — log error to console)
    - `connect()`: set state to `connecting` and clear `error`; call `requestAccess()`; validate key (56 chars, starts with `G`); call `getNetwork()` and verify `network === "PUBLIC"` (case-insensitive); set `connected` + `publicKey` on success
    - Error mapping: rejection (`"rejected"` / `"denied"` in error string) → rejection message; locked (`"locked"`) → locked message; network mismatch → message naming both networks; invalid key → invalid key message; unexpected → generic message with `console.error`
    - `disconnect()`: reset `connectionState` to `disconnected`, `publicKey` to `null`, `error` to `null`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.1, 5.2, 6.1, 6.2, 7.1, 7.2, 10.3_

  - [ ]* 2.2 Write property test — Property 1: Valid public keys are always accepted
    - **Property 1: Valid public keys are always accepted**
    - For any string that is exactly 56 characters and begins with `G`, when `requestAccess()` returns that string and `getNetwork()` returns `"PUBLIC"`, the hook SHALL set `connectionState` to `"connected"` and `publicKey` to that string
    - Use `fc.string({ minLength: 55, maxLength: 55 }).map(s => 'G' + s)` as the generator
    - **Validates: Requirements 4.5, 2.5, 3.4**

  - [ ]* 2.3 Write property test — Property 2: Invalid public keys are always rejected
    - **Property 2: Invalid public keys are always rejected**
    - For any string that is not exactly 56 characters or does not begin with `G`, when `requestAccess()` returns that string, the hook SHALL set `connectionState` to `"disconnected"` and `error` to a non-null value
    - Use `fc.oneof(fc.string().filter(s => s.length !== 56), fc.string({ minLength: 56, maxLength: 56 }).filter(s => !s.startsWith('G')))` as the generator
    - **Validates: Requirements 4.5, 4.6**

  - [ ]* 2.4 Write property test — Property 3: Network mismatch error names both networks
    - **Property 3: Network mismatch error names both networks**
    - For any network name string that is not `"PUBLIC"` (case-insensitive), when `getNetwork()` returns that name after a successful `requestAccess()`, the hook SHALL set `connectionState` to `"disconnected"` and the `error` string SHALL contain both the detected network name and the word `"Pubnet"`
    - Use `fc.string().filter(s => s.toUpperCase() !== 'PUBLIC')` as the generator
    - **Validates: Requirements 7.1, 7.2**

  - [ ]* 2.5 Write example-based unit tests for `useFreighterWallet`
    - Test file: `src/hooks/__tests__/useFreighterWallet.test.ts`
    - Mock `@stellar/freighter-api` via `jest.mock`
    - Cover: mount with `isConnected()` → true (state = `disconnected`); mount with `isConnected()` → false (state = `not_installed`); mount with `isConnected()` throwing (state = `not_installed`, `console.error` called); `connect()` transitions `connecting` → `connected`; rejection error message; locked-wallet error message; network mismatch error message; `disconnect()` resets state and `publicKey`; two instances are independent; calling `connect()` after rejection clears previous error
    - _Requirements: 1.1, 1.2, 1.3, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.4, 6.1, 6.2, 7.1, 7.2_

- [x] 3. Create the `ConnectWalletButton` component
  - [x] 3.1 Implement `ConnectWalletButton` in `src/components/wallet/ConnectWalletButton.tsx`
    - Props: `{ connectionState: ConnectionState, onConnect: () => void, onDisconnect: () => void, publicKey: string | null }`
    - `not_installed`: render `null`
    - `disconnected`: render enabled button with `aria-label="Connect Freighter Wallet"`
    - `connecting`: render disabled button with `aria-busy="true"` and `aria-disabled="true"` and a spinner element
    - `connected`: render "Disconnect" button with `aria-label="Disconnect Freighter Wallet"` plus a `role="status"` element showing `"Connected: {publicKey.slice(0,8)}…{publicKey.slice(-4)}"`
    - _Requirements: 2.1, 2.3, 2.4, 2.6, 2.7, 3.1, 3.3, 9.1, 9.2, 9.4, 9.5_

  - [x] 3.2 Create `src/components/wallet/ConnectWalletButton.module.css`
    - Add styles for the connect/disconnect button and the connected status message
    - _Requirements: 2.1, 2.6_

  - [ ]* 3.3 Write property test — Property 4: Error messages always appear in a `role="alert"` element
    - **Property 4: Error messages always appear in a role="alert" element**
    - For any non-empty error string, when the parent form renders with that error, the error text SHALL appear inside a DOM element with `role="alert"`
    - Use `fc.string({ minLength: 1 })` as the generator
    - Test file: `src/components/wallet/__tests__/ConnectWalletButton.test.tsx`
    - **Validates: Requirements 9.3**

  - [ ]* 3.4 Write property test — Property 5: Connected status always shows correct key truncation
    - **Property 5: Connected status always shows correct key truncation**
    - For any valid Stellar public key (56 chars, starts with `G`), when the hook is in `"connected"` state with that key, the rendered status message SHALL contain the first 8 characters and the last 4 characters of the key
    - Use `fc.string({ minLength: 55, maxLength: 55 }).map(s => 'G' + s)` as the generator
    - Test file: `src/components/wallet/__tests__/ConnectWalletButton.test.tsx`
    - **Validates: Requirements 9.4**

  - [ ]* 3.5 Write example-based unit tests for `ConnectWalletButton`
    - Test file: `src/components/wallet/__tests__/ConnectWalletButton.test.tsx`
    - Cover: renders nothing when `not_installed`; renders enabled button with accessible name when `disconnected`; renders disabled button with `aria-busy` and `aria-disabled` when `connecting`; renders Disconnect button and status message when `connected`; calls `onConnect` on click; calls `onDisconnect` on click; buttons are keyboard-operable
    - _Requirements: 9.1, 9.2, 9.4, 9.5_

- [x] 4. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Integrate wallet into the Profile page
  - [x] 5.1 Modify `src/app/profile/page.tsx` to wire up the hook and button
    - Call `useFreighterWallet()` at the top of the component
    - Add `useEffect` that watches `publicKey`: when non-null, call `setForm(f => ({ ...f, stellarPublicKey: publicKey }))`
    - Add `useEffect` that watches `connectionState`: when it transitions to `"disconnected"`, clear `stellarPublicKey` to `""`
    - In the `stellarPublicKey` input group: render `<ConnectWalletButton>` when `connectionState !== 'not_installed'`; render install helper text with link to `https://freighter.app` when `connectionState === 'not_installed'`; render error in a `role="alert"` element when `error` is non-null
    - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.5, 2.6, 2.7, 2.8, 5.3, 6.3, 7.3, 8.1, 8.3, 8.5, 9.3, 9.4_

  - [ ]* 5.2 Write integration tests for the Profile page
    - Test file: `src/app/profile/__tests__/page.test.tsx`
    - Mock `useFreighterWallet`, `next-auth/react`, `next/navigation`, and `fetch`
    - Cover: `not_installed` → no Connect button, install link present; `disconnected` → Connect button alongside input; `connected` with key → input value equals key, Disconnect control present; connecting auto-populates input; disconnecting clears input; error renders in `role="alert"`; form submits with wallet-provided key unchanged
    - _Requirements: 2.1, 2.2, 2.5, 2.6, 2.7, 5.3, 8.1, 8.3, 8.5, 9.3_

- [x] 6. Integrate wallet into the Join Circle form
  - [x] 6.1 Modify `src/components/circle/JoinCircleForm.tsx` to wire up the hook and button
    - Call `useFreighterWallet()` at the top of the component
    - Add `useEffect` that watches `publicKey`: when non-null, call `setStellarPublicKey(publicKey)`
    - Add `useEffect` that watches `connectionState`: when it transitions to `"disconnected"`, clear `stellarPublicKey` to `""`
    - In the `stellarPublicKey` field group: render `<ConnectWalletButton>` when `connectionState !== 'not_installed'`; render install helper text with link to `https://freighter.app` when `connectionState === 'not_installed'`; render error in a `role="alert"` element when `error` is non-null
    - _Requirements: 1.1, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 5.3, 6.3, 7.3, 8.2, 8.4, 8.5, 9.3, 9.4_

  - [ ]* 6.2 Write integration tests for the Join Circle form
    - Test file: `src/components/circle/__tests__/JoinCircleForm.test.tsx`
    - Mock `useFreighterWallet`, `next/navigation`, and `fetch`
    - Cover the same scenarios as the Profile page integration tests, adapted for the Join Circle form context
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 3.6, 5.3, 8.2, 8.4, 8.5, 9.3_

- [x] 7. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Properties 1–3 are tested in the hook test file; Properties 4–5 are tested in the component test file
- The `role="alert"` error element is rendered by the parent form (Profile page / Join Circle form), not by `ConnectWalletButton` itself — Property 4 tests should render the full parent form with a mocked hook returning an error
- The SSR guard (`typeof window !== 'undefined'`) must be in place before any Freighter API call in the hook
- `@stellar/freighter-api` must be imported exclusively in the hook; neither form nor button should import from it directly
