"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";
import type { ProfileData } from "@/app/api/profile/route";
import { useFreighterWallet } from "@/hooks/useFreighterWallet";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const { connectionState, publicKey, error: walletError, connect, disconnect } = useFreighterWallet();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [form, setForm] = useState({ displayName: "", email: "", stellarPublicKey: "" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/profile")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setProfile(json.data);
          setForm({
            displayName: json.data.displayName ?? "",
            email: json.data.email ?? "",
            stellarPublicKey: json.data.stellarPublicKey ?? "",
          });
        }
      });
  }, [status]);

  useEffect(() => {
    if (publicKey !== null) {
      setForm((f) => ({ ...f, stellarPublicKey: publicKey }));
    }
  }, [publicKey]);

  useEffect(() => {
    if (connectionState === "disconnected") {
      setForm((f) => ({ ...f, stellarPublicKey: "" }));
    }
  }, [connectionState]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setMessage({ type: "success", text: "Profile updated." });
      setProfile((p) => p && { ...p, ...form });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Save failed." });
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading" || !profile) {
    return (
      <div className={styles.page}>
        <div className="container">
          <div className={styles.skeleton_title} />
          <div className={styles.skeleton_card} />
        </div>
      </div>
    );
  }

  const { reputationScore, contributionStats } = profile;
  const reputationLabel =
    reputationScore >= 80 ? "Excellent" :
    reputationScore >= 60 ? "Good" :
    reputationScore >= 40 ? "Fair" : "Building";

  return (
    <div className={styles.page}>
      <div className="container">
        <h1 className={styles.title}>My Profile</h1>

        {/* ── Reputation ── */}
        <section className="card" style={{ marginBottom: "var(--space-6)" }}>
          <h2 className={styles.sectionTitle}>Reputation Score</h2>
          <div className={styles.reputationRow}>
            <div className={styles.scoreCircle} data-level={reputationLabel.toLowerCase()}>
              <span className={styles.scoreNumber}>{reputationScore}</span>
              <span className={styles.scoreMax}>/100</span>
            </div>
            <div className={styles.reputationMeta}>
              <span className={styles.reputationLabel}>{reputationLabel}</span>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${reputationScore}%` }} />
              </div>
            </div>
          </div>
        </section>

        {/* ── Contribution history ── */}
        <section className="card" style={{ marginBottom: "var(--space-6)" }}>
          <h2 className={styles.sectionTitle}>Contribution History</h2>
          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{contributionStats.total}</span>
              <span className={styles.statLabel}>Total</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statValue} style={{ color: "var(--color-success)" }}>
                {contributionStats.confirmed}
              </span>
              <span className={styles.statLabel}>Confirmed</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statValue} style={{ color: "var(--color-error)" }}>
                {contributionStats.missed}
              </span>
              <span className={styles.statLabel}>Missed</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statValue}>
                {contributionStats.total > 0
                  ? `${Math.round((contributionStats.confirmed / contributionStats.total) * 100)}%`
                  : "—"}
              </span>
              <span className={styles.statLabel}>On-time rate</span>
            </div>
          </div>
        </section>

        {/* ── Editable fields ── */}
        <section className="card">
          <h2 className={styles.sectionTitle}>Edit Profile</h2>
          <form onSubmit={handleSave} className={styles.form}>
            <div className="input-group">
              <label className="input-label" htmlFor="phone">Phone</label>
              <input id="phone" className="input" value={profile.phone} disabled aria-disabled="true" />
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="displayName">Display Name</label>
              <input
                id="displayName"
                className="input"
                value={form.displayName}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                maxLength={80}
                placeholder="Your name"
              />
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className="input"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="you@example.com"
              />
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="stellarPublicKey">Stellar Public Key</label>
              <input
                id="stellarPublicKey"
                className="input"
                value={form.stellarPublicKey}
                onChange={(e) => setForm((f) => ({ ...f, stellarPublicKey: e.target.value }))}
                placeholder="GXXXXXXX…"
                spellCheck={false}
              />
              {connectionState !== "not_installed" && (
                <ConnectWalletButton
                  connectionState={connectionState}
                  onConnect={connect}
                  onDisconnect={disconnect}
                  publicKey={publicKey}
                />
              )}
              {connectionState === "not_installed" && (
                <small className="input-hint">
                  Don&apos;t have a Stellar wallet?{" "}
                  <a href="https://freighter.app" target="_blank" rel="noopener noreferrer">
                    Install Freighter
                  </a>
                </small>
              )}
              {walletError && (
                <p role="alert" style={{ color: "var(--color-error)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
                  {walletError}
                </p>
              )}
            </div>

            {message && (
              <p className={`${styles.message} ${styles[message.type]}`} role="status">
                {message.text}
              </p>
            )}

            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? <span className="btn-spinner" aria-hidden="true" /> : null}
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
