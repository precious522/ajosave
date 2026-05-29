"use client";

import styles from "./ConnectionStatus.module.css";

interface ConnectionStatusProps {
  isConnected: boolean;
  lastUpdate?: Date;
}

export function ConnectionStatus({ isConnected, lastUpdate }: ConnectionStatusProps) {
  const statusLabel = isConnected ? "Live connection" : "Disconnected";
  return (
    <div className={styles.container}>
      <div
        className={`${styles.indicator} ${isConnected ? styles.connected : styles.disconnected}`}
        aria-label={statusLabel}
      >
        <span className={styles.dot} aria-hidden="true" />
        <span className={styles.text}>
          {isConnected ? "Live" : "Disconnected"}
        </span>
      </div>
      {lastUpdate && isConnected && (
        <span className={styles.timestamp} aria-label={`Last updated at ${new Date(lastUpdate).toLocaleTimeString()}`}>
          Updated {new Date(lastUpdate).toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}
