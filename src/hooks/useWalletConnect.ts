"use client";

/**
 * useWalletConnect — WalletConnect session management for Stellar mobile wallets.
 *
 * Uses the Stellar WalletConnect URI scheme to generate a pairing URI,
 * display a QR code on desktop, and a deep link on mobile (LOBSTR, xBull, etc.).
 *
 * Session is persisted in localStorage so it survives page refreshes.
 * Disconnect clears the session.
 *
 * NOTE: Requires NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID in environment.
 * Get a project ID at https://cloud.walletconnect.com
 */

import { useState, useEffect, useCallback } from "react";

const SESSION_KEY = "ajosave_wc_session";

export interface WalletSession {
  publicKey: string;
  walletName: string;
  pairingUri: string;
}

export function useWalletConnect() {
  const [session, setSession] = useState<WalletSession | null>(null);
  const [pairingUri, setPairingUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) setSession(JSON.parse(stored));
    } catch {
      // ignore parse errors
    }
  }, []);

  const connect = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
      if (!projectId) throw new Error("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set");

      // Dynamically import WalletConnect to avoid SSR issues
      const { SignClient } = await import("@walletconnect/sign-client");

      const client = await SignClient.init({
        projectId,
        metadata: {
          name: "Ajosave",
          description: "Trustless rotating savings circles on Stellar",
          url: "https://www.ajosave.app",
          icons: ["https://www.ajosave.app/icon.png"],
        },
      });

      const { uri, approval } = await client.connect({
        requiredNamespaces: {
          stellar: {
            methods: ["stellar_signAndSubmitXDR", "stellar_signXDR"],
            chains: ["stellar:testnet"],
            events: ["accountsChanged"],
          },
        },
      });

      if (!uri) throw new Error("Failed to generate pairing URI");
      setPairingUri(uri);

      // Wait for wallet approval
      const sessionData = await approval();
      const accounts = sessionData.namespaces.stellar?.accounts ?? [];
      const publicKey = accounts[0]?.split(":")[2] ?? "";
      const walletName = sessionData.peer.metadata.name;

      const newSession: WalletSession = { publicKey, walletName, pairingUri: uri };
      localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
      setSession(newSession);
      setPairingUri(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setPairingUri(null);
    setError(null);
  }, []);

  return { session, pairingUri, loading, error, connect, disconnect };
}
