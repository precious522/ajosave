# Requirements Document

## Introduction

AjoSave users currently enter their Stellar public key by hand in two places: the Edit Profile form (`src/app/profile/page.tsx`) and the Join Circle form (`src/components/circle/JoinCircleForm.tsx`). Manual entry is error-prone and creates friction for users who already manage their Stellar identity through the Freighter browser extension wallet.

This feature integrates the `@stellar/freighter-api` SDK to let users connect their Freighter wallet and have their Stellar public key auto-populated in both forms. Users who do not have Freighter installed retain the existing manual text-entry experience unchanged.

## Glossary

- **Freighter**: A Stellar-network browser extension wallet that exposes a JavaScript API for requesting account access.
- **Freighter_API**: The `@stellar/freighter-api` npm package (`@stellar/freighter-api`) used to communicate with the Freighter extension.
- **Connect_Button**: The "Connect Wallet" UI control that initiates the Freighter connection flow.
- **Public_Key**: A 56-character Stellar account address beginning with `G`, used to receive payouts.
- **Profile_Form**: The Edit Profile form on `src/app/profile/page.tsx` that contains the `stellarPublicKey` field.
- **Join_Form**: The Join Circle form in `src/components/circle/JoinCircleForm.tsx` that contains the `stellarPublicKey` field.
- **Wallet_Hook**: A shared React custom hook (`useFreighterWallet`) that encapsulates all Freighter_API interactions.
- **Connection_State**: One of four states the wallet integration can be in: `not_installed`, `disconnected`, `connecting`, or `connected`.
- **Network_Mismatch**: The condition where Freighter is connected to a Stellar network (e.g., testnet) that differs from the network the application expects (e.g., mainnet/pubnet).

---

## Requirements

### Requirement 1: Freighter Installation Detection

**User Story:** As a user visiting any page with a Stellar public key field, I want the UI to know whether Freighter is installed, so that I am shown the appropriate input experience without having to do anything.

#### Acceptance Criteria

1. WHEN the Profile_Form or Join_Form mounts, THE Wallet_Hook SHALL check whether the Freighter extension is present in the browser environment.
2. WHEN Freighter is detected as installed, THE Wallet_Hook SHALL set the Connection_State to `disconnected`.
3. WHEN Freighter is not detected, THE Wallet_Hook SHALL set the Connection_State to `not_installed`.
4. THE Wallet_Hook SHALL complete the installation check within 500 ms of component mount.
5. IF the installation check throws an unexpected error, THEN THE Wallet_Hook SHALL set the Connection_State to `not_installed` and log the error to the console.

---

### Requirement 2: Connect Wallet Button — Profile Form

**User Story:** As a user on the Profile page who has Freighter installed, I want a "Connect Wallet" button next to the Stellar Public Key field, so that I can populate my key automatically without typing it.

#### Acceptance Criteria

1. WHILE the Connection_State is `disconnected`, THE Profile_Form SHALL render the Connect_Button alongside the `stellarPublicKey` text input.
2. WHILE the Connection_State is `not_installed`, THE Profile_Form SHALL render only the `stellarPublicKey` text input with a helper text link directing the user to install Freighter.
3. WHEN the user activates the Connect_Button, THE Wallet_Hook SHALL set the Connection_State to `connecting` and request account access from Freighter_API.
4. WHILE the Connection_State is `connecting`, THE Connect_Button SHALL be disabled and display a loading indicator.
5. WHEN Freighter_API returns a valid Public_Key, THE Wallet_Hook SHALL set the Connection_State to `connected` and populate the `stellarPublicKey` form field with the returned Public_Key.
6. WHILE the Connection_State is `connected`, THE Profile_Form SHALL display the connected Public_Key in the `stellarPublicKey` field and replace the Connect_Button with a "Disconnect" control.
7. WHEN the user activates the "Disconnect" control, THE Wallet_Hook SHALL set the Connection_State to `disconnected` and clear the `stellarPublicKey` form field.
8. WHILE the Connection_State is `connected`, THE Profile_Form SHALL allow the user to edit the `stellarPublicKey` field manually to override the wallet-provided value.

---

### Requirement 3: Connect Wallet Button — Join Circle Form

**User Story:** As a user joining a circle who has Freighter installed, I want the same "Connect Wallet" affordance in the Join Circle form, so that I do not have to copy-paste my Stellar key.

#### Acceptance Criteria

1. WHILE the Connection_State is `disconnected`, THE Join_Form SHALL render the Connect_Button alongside the `stellarPublicKey` text input.
2. WHILE the Connection_State is `not_installed`, THE Join_Form SHALL render only the `stellarPublicKey` text input with a helper text link directing the user to install Freighter.
3. WHEN the user activates the Connect_Button in the Join_Form, THE Wallet_Hook SHALL set the Connection_State to `connecting` and request account access from Freighter_API.
4. WHEN Freighter_API returns a valid Public_Key, THE Wallet_Hook SHALL populate the `stellarPublicKey` field in the Join_Form with the returned Public_Key.
5. WHILE the Connection_State is `connected`, THE Join_Form SHALL allow the user to edit the `stellarPublicKey` field manually to override the wallet-provided value.
6. WHILE the Connection_State is `connected`, THE Join_Form SHALL display a "Disconnect" control that, when activated, clears the `stellarPublicKey` field and returns the Connection_State to `disconnected`.

---

### Requirement 4: Shared Wallet Hook

**User Story:** As a developer, I want a single reusable hook that encapsulates all Freighter interactions, so that both the Profile_Form and Join_Form share consistent behaviour without duplicating logic.

#### Acceptance Criteria

1. THE Wallet_Hook SHALL expose the current Connection_State, the retrieved Public_Key (or `null`), a `connect` function, a `disconnect` function, and an `error` field.
2. WHEN the `connect` function is called, THE Wallet_Hook SHALL invoke `Freighter_API.requestAccess` and update Connection_State accordingly.
3. WHEN the `disconnect` function is called, THE Wallet_Hook SHALL set Connection_State to `disconnected` and set the Public_Key to `null`.
4. THE Wallet_Hook SHALL be usable independently in both the Profile_Form and Join_Form without shared global state between instances.
5. THE Wallet_Hook SHALL validate that the Public_Key returned by Freighter_API is exactly 56 characters and begins with `G` before setting it on the form field.
6. IF the Public_Key returned by Freighter_API fails validation, THEN THE Wallet_Hook SHALL set an error message and set the Connection_State to `disconnected`.

---

### Requirement 5: Error Handling — User Rejects Connection

**User Story:** As a user who declines the Freighter permission prompt, I want the form to return to its previous state with a clear message, so that I can choose to enter my key manually instead.

#### Acceptance Criteria

1. WHEN the user dismisses or rejects the Freighter permission prompt, THE Wallet_Hook SHALL set the Connection_State to `disconnected`.
2. WHEN the user rejects the Freighter permission prompt, THE Wallet_Hook SHALL set an error message of "Connection request was rejected. You can enter your Stellar key manually."
3. WHEN the Connection_State returns to `disconnected` after a rejection, THE Profile_Form and Join_Form SHALL display the error message and re-enable the Connect_Button.
4. WHEN the user activates the Connect_Button again after a prior rejection, THE Wallet_Hook SHALL clear the previous error and retry the connection request.

---

### Requirement 6: Error Handling — Freighter Locked

**User Story:** As a user whose Freighter wallet is installed but locked, I want a clear message telling me to unlock it, so that I know what action to take.

#### Acceptance Criteria

1. WHEN Freighter_API returns a locked-wallet error, THE Wallet_Hook SHALL set the Connection_State to `disconnected`.
2. WHEN Freighter_API returns a locked-wallet error, THE Wallet_Hook SHALL set an error message of "Your Freighter wallet is locked. Please unlock it and try again."
3. WHEN the Connection_State returns to `disconnected` after a locked-wallet error, THE Profile_Form and Join_Form SHALL display the error message and re-enable the Connect_Button.

---

### Requirement 7: Error Handling — Network Mismatch

**User Story:** As a user whose Freighter is connected to the wrong Stellar network, I want a warning that explains the mismatch, so that I can switch networks before proceeding.

#### Acceptance Criteria

1. WHEN Freighter_API returns a Public_Key but the active network reported by Freighter_API does not match the application's expected network, THE Wallet_Hook SHALL set the Connection_State to `disconnected`.
2. WHEN a Network_Mismatch is detected, THE Wallet_Hook SHALL set an error message that names both the detected network and the expected network (e.g., "Freighter is connected to Testnet, but this app requires Pubnet. Please switch networks in Freighter and try again.").
3. WHEN a Network_Mismatch is detected, THE Profile_Form and Join_Form SHALL display the error message and re-enable the Connect_Button.

---

### Requirement 8: Graceful Fallback — Freighter Not Installed

**User Story:** As a user who does not have Freighter installed, I want the Stellar public key field to work exactly as it does today, so that the new feature does not break my existing workflow.

#### Acceptance Criteria

1. WHILE the Connection_State is `not_installed`, THE Profile_Form SHALL render the `stellarPublicKey` text input in its current form without any Connect_Button.
2. WHILE the Connection_State is `not_installed`, THE Join_Form SHALL render the `stellarPublicKey` text input in its current form without any Connect_Button.
3. WHILE the Connection_State is `not_installed`, THE Profile_Form SHALL display helper text containing a link to the Freighter installation page (`https://freighter.app`).
4. WHILE the Connection_State is `not_installed`, THE Join_Form SHALL display helper text containing a link to the Freighter installation page (`https://freighter.app`).
5. THE Profile_Form and Join_Form SHALL submit the `stellarPublicKey` value to their respective API endpoints unchanged, regardless of whether the value was populated by Freighter or typed manually.

---

### Requirement 9: Accessibility

**User Story:** As a user who relies on assistive technology, I want the Connect Wallet button and all wallet-related status messages to be accessible, so that I can use the feature with a screen reader or keyboard.

#### Acceptance Criteria

1. THE Connect_Button SHALL have an accessible name of "Connect Freighter Wallet".
2. WHILE the Connection_State is `connecting`, THE Connect_Button SHALL have `aria-busy="true"` and `aria-disabled="true"`.
3. WHEN an error message is set, THE Profile_Form and Join_Form SHALL render the error in an element with `role="alert"` so that screen readers announce it immediately.
4. WHEN the Connection_State changes to `connected`, THE Profile_Form and Join_Form SHALL render a status message with `role="status"` confirming the wallet is connected and showing the first 8 and last 4 characters of the Public_Key.
5. THE Connect_Button and "Disconnect" control SHALL be reachable and operable via keyboard navigation.

---

### Requirement 10: Package Installation

**User Story:** As a developer setting up the feature, I want the Freighter API package added to the project dependencies, so that the integration can be built.

#### Acceptance Criteria

1. THE System SHALL add `@stellar/freighter-api` as a production dependency in `package.json`.
2. THE System SHALL pin `@stellar/freighter-api` to an exact version to ensure reproducible builds.
3. THE Wallet_Hook SHALL import exclusively from `@stellar/freighter-api` and SHALL NOT import from `@stellar/stellar-sdk` for wallet connectivity purposes.
