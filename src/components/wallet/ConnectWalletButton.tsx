"use client";

import { ConnectionState } from "@/hooks/useFreighterWallet";
import styles from "./ConnectWalletButton.module.css";

interface ConnectWalletButtonProps {
  connectionState: ConnectionState;
  onConnect: () => void;
  onDisconnect: () => void;
  publicKey: string | null;
}

export function ConnectWalletButton({
  connectionState,
  onConnect,
  onDisconnect,
  publicKey,
}: ConnectWalletButtonProps): JSX.Element | null {
  if (connectionState === "not_installed") {
    return null;
  }

  if (connectionState === "disconnected") {
    return (
      <button
        type="button"
        className={styles.connectButton}
        aria-label="Connect Freighter Wallet"
        onClick={onConnect}
      >
        Connect Wallet
      </button>
    );
  }

  if (connectionState === "connecting") {
    return (
      <button
        type="button"
        className={styles.connectingButton}
        aria-label="Connect Freighter Wallet"
        aria-busy="true"
        aria-disabled="true"
        disabled
      >
        <span className={styles.spinner} aria-hidden="true" />
        Connecting…
      </button>
    );
  }

  // connectionState === "connected"
  return (
    <>
      <p role="status" className={styles.statusMessage}>
        Connected: {publicKey!.slice(0, 8)}…{publicKey!.slice(-4)}
      </p>
      <button
        type="button"
        className={styles.connectButton}
        aria-label="Disconnect Freighter Wallet"
        onClick={onDisconnect}
      >
        Disconnect
      </button>
    </>
  );
}
