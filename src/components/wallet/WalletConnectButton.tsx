"use client";

import { useEffect, useState } from "react";
import { useWalletConnect } from "@/hooks/useWalletConnect";
import { Button } from "@/components/ui/Button";
import styles from "./WalletConnectButton.module.css";

/**
 * WalletConnectButton
 *
 * - Desktop: shows QR code for scanning with LOBSTR / xBull mobile app
 * - Mobile: shows a deep link button to open the wallet directly
 * - Session persists across page refreshes via localStorage
 * - Disconnect clears the session
 */
export function WalletConnectButton() {
  const { session, pairingUri, loading, error, connect, disconnect } = useWalletConnect();
  const [isMobile, setIsMobile] = useState(false);
  const [QRCode, setQRCode] = useState<React.ComponentType<{ value: string; size: number }> | null>(null);

  useEffect(() => {
    setIsMobile(/Mobi|Android|iPhone/i.test(navigator.userAgent));
  }, []);

  // Dynamically load QR code renderer only on desktop when needed
  useEffect(() => {
    if (pairingUri && !isMobile) {
      import("qrcode.react").then((mod) => setQRCode(() => mod.QRCodeSVG));
    }
  }, [pairingUri, isMobile]);

  if (session) {
    return (
      <div className={styles.connected}>
        <span className={styles.wallet}>
          🔗 {session.walletName} · {session.publicKey.slice(0, 6)}…{session.publicKey.slice(-4)}
        </span>
        <Button variant="ghost" size="sm" onClick={disconnect}>
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Button variant="accent" onClick={connect} loading={loading}>
        Connect Stellar Wallet
      </Button>

      {error && <p className={styles.error}>{error}</p>}

      {pairingUri && (
        <div className={styles.pairing} role="dialog" aria-label="Connect wallet">
          {isMobile ? (
            <a
              href={`lobstr://wc?uri=${encodeURIComponent(pairingUri)}`}
              className={styles.deepLink}
            >
              Open in LOBSTR
            </a>
          ) : (
            <div className={styles.qr}>
              <p className={styles.qrLabel}>Scan with your Stellar wallet</p>
              {QRCode ? (
                <QRCode value={pairingUri} size={220} />
              ) : (
                <p className={styles.qrLabel}>Loading QR…</p>
              )}
              <p className={styles.qrHint}>Works with LOBSTR, xBull, and other WalletConnect wallets</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
