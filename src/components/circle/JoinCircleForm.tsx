"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { getCurrencySymbol, SupportedCurrency } from "@/lib/currency";
import type { Circle } from "@/types";
import styles from "./JoinCircleForm.module.css";
import { useFreighterWallet } from "@/hooks/useFreighterWallet";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";

interface Props {
  circle: Circle;
  token?: string;
  inviteValid?: boolean;
}

export function JoinCircleForm({ circle, token, inviteValid }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stellarPublicKey, setStellarPublicKey] = useState("");
  const [optimisticCount, setOptimisticCount] = useState(circle.memberCount ?? 0);

  const { connectionState, publicKey, error: walletError, connect, disconnect } = useFreighterWallet();

  useEffect(() => {
    // Check if user has a saved Stellar key; show warning if not
    fetch("/api/v1/profile")
      .then((r) => r.json())
      .then((json) => {
        if (json.success && !json.data.stellarPublicKey) setNoSavedKey(true);
        if (json.success && json.data.stellarPublicKey) setStellarPublicKey(json.data.stellarPublicKey);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (publicKey !== null) {
      setStellarPublicKey(publicKey);
    }
  }, [publicKey]);

  useEffect(() => {
    if (connectionState === "disconnected") {
      setStellarPublicKey("");
    }
  }, [connectionState]);

  const currencySymbol = getCurrencySymbol(circle.contributionCurrency as SupportedCurrency);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Optimistic update: increment member count immediately
    setOptimisticCount((c) => c + 1);

    try {
      const res = await fetch(`/api/circles/${circle.id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          stellarPublicKey,
          token // We pass the token to the API so it can verify if it's a private circle
        }),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      router.push(`/circles/${circle.id}?joined=true`);
      router.refresh();
    } catch (err) {
      // Revert optimistic update on error
      setOptimisticCount((c) => c - 1);
      setError(err instanceof Error ? err.message : "Failed to join circle");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      {noSavedKey && (
        <div role="alert" style={{ background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.4)", borderRadius: "var(--radius-md)", padding: "var(--space-3) var(--space-4)", marginBottom: "var(--space-4)", fontSize: "0.875rem", color: "var(--color-warning)" }}>
          ⚠️ You have no Stellar public key saved. Payouts will be sent to the key you enter below. <a href="/profile" style={{ textDecoration: "underline" }}>Save it in your profile</a> to avoid re-entering it each time.
        </div>
      )}
      <div className={styles.info}>
        <p>You are joining <strong>{circle.name}</strong>.</p>
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Contribution</span>
            <span className={styles.statValue}>
              {currencySymbol}
              {circle.contributionFiat.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Frequency</span>
            <span className={styles.statValue}>{circle.cycleFrequency}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Members</span>
            <span className={styles.statValue}>{optimisticCount} / {circle.maxMembers}</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="stellarPublicKey" className={styles.label}>
            Stellar Public Key
          </label>
          <input
            id="stellarPublicKey"
            type="text"
            className={styles.input}
            placeholder="G..."
            required
            value={stellarPublicKey}
            onChange={(e) => setStellarPublicKey(e.target.value)}
            disabled={loading}
          />
          <p className={styles.help}>
            This is where your payouts will be sent. Make sure it's a valid Stellar address.
          </p>
          {connectionState !== "not_installed" && (
            <ConnectWalletButton
              connectionState={connectionState}
              onConnect={connect}
              onDisconnect={disconnect}
              publicKey={publicKey}
            />
          )}
          {connectionState === "not_installed" && (
            <p className={styles.help}>
              Don&apos;t have a Stellar wallet?{" "}
              <a href="https://freighter.app" target="_blank" rel="noopener noreferrer">
                Install Freighter
              </a>
            </p>
          )}
          {walletError && (
            <p role="alert" style={{ color: "var(--color-error)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
              {walletError}
            </p>
          )}
        </div>

        {error && (
          <div role="alert" className={styles.toast}>
            {error}
          </div>
        )}

        <Button
          type="submit"
          className="btn--full"
          loading={loading}
          disabled={loading}
        >
          {circle.circleType === "private" && !inviteValid ? "Request to Join" : "Join Circle"}
        </Button>
      </form>
    </div>
  );
}
