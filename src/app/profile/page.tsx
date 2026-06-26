"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";
import type { ProfileData } from "@/app/api/v1/profile/route";
import type { ReferralData } from "@/app/api/referral/route";

export default function ProfilePage() {
  const { status } = useSession();
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [form, setForm] = useState({ displayName: "", email: "", stellarPublicKey: "", smsNotificationsEnabled: true, emailNotificationsEnabled: true });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [referral, setReferral] = useState<ReferralData | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);
  const [hasUsdcTrustline, setHasUsdcTrustline] = useState<boolean | null>(null);
  const [referralCode, setReferralCode] = useState("");
  const [referralMsg, setReferralMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [applyingCode, setApplyingCode] = useState(false);
  const [copied, setCopied] = useState(false);
  type Cert = { circleId: string; circleName: string; cyclesCompleted: number; totalSavedUsdc: string; txHash: string; issuedAt: string };
  const [certificates, setCertificates] = useState<Cert[]>([]);
  const [certificates, setCertificates] = useState<import("@/server/services/certificate.service").Certificate[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/v1/profile")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setProfile(json.data);
          setForm({
            displayName: json.data.displayName ?? "",
            email: json.data.email ?? "",
            stellarPublicKey: json.data.stellarPublicKey ?? "",
            smsNotificationsEnabled: json.data.smsNotificationsEnabled,
            emailNotificationsEnabled: json.data.emailNotificationsEnabled,
          });
        }
      });
    fetch("/api/referral")
      .then((r) => r.json())
      .then((json) => { if (json.success) setReferral(json.data); });
    fetch("/api/v1/users/me/certificates")
      .then((r) => r.json())
      .then((json) => { if (json.success) setCertificates(json.data); })
      .catch(() => {});
  }, [status]);

  // Fetch USDC balance whenever the saved key changes
  useEffect(() => {
    const key = profile?.stellarPublicKey;
    if (!key) { setUsdcBalance(null); setHasUsdcTrustline(null); return; }
    fetch(`/api/stellar/balance?publicKey=${encodeURIComponent(key)}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setUsdcBalance(json.data.balance);
          setHasUsdcTrustline(json.data.hasTrustline);
        }
      })
      .catch(() => {});
  }, [profile?.stellarPublicKey]);

  const handleCopyCode = () => {
    if (!referral?.referralCode) return;
    navigator.clipboard.writeText(referral.referralCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleApplyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setApplyingCode(true);
    setReferralMsg(null);
    try {
      const res = await fetch("/api/referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: referralCode }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setReferralMsg({ type: "success", text: "Referral code applied! Your referrer earned a reputation boost." });
      setReferral((r) => r && { ...r, referredBy: referralCode });
      setReferralCode("");
    } catch (err) {
      setReferralMsg({ type: "error", text: err instanceof Error ? err.message : "Failed to apply code." });
    } finally {
      setApplyingCode(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: form.displayName }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setMessage({ type: "success", text: "Profile updated." });
      setProfile((p) => p && { ...p, displayName: form.displayName });
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

        {/* ── Referral ── */}
        <section className="card" style={{ marginBottom: "var(--space-6)" }}>
          <h2 className={styles.sectionTitle}>Referral Program</h2>
          {referral ? (
            <>
              <p className={styles.referralDesc}>
                Share your code and earn +5 reputation for every friend who joins.
              </p>
              <div className={styles.referralCodeRow}>
                <span className={styles.referralCode}>{referral.referralCode}</span>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={handleCopyCode}
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className={styles.referralStat}>
                Friends referred: <strong>{referral.referralCount}</strong>
              </p>
              {referral.referredBy && (
                <p className={styles.referralStat}>
                  Referred by: <strong>{referral.referredBy}</strong>
                </p>
              )}
              {!referral.referredBy && (
                <form onSubmit={handleApplyCode} className={styles.referralForm}>
                  <input
                    className="input"
                    placeholder="Enter a referral code"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    maxLength={16}
                    style={{ flex: 1 }}
                  />
                  <button type="submit" className="btn btn--primary btn--sm" disabled={applyingCode || !referralCode}>
                    {applyingCode ? <span className="btn-spinner" aria-hidden="true" /> : "Apply"}
                  </button>
                </form>
              )}
              {referralMsg && (
                <p className={`${styles.message} ${styles[referralMsg.type]}`} role="status">
                  {referralMsg.text}
                </p>
              )}
            </>
          ) : (
            <div className={`${styles.referralCode} skeleton`} style={{ height: "2rem", width: "8rem" }} />
          )}
        </section>

        {/* ── Notification preferences ── */}
        <section className="card" style={{ marginBottom: "var(--space-6)" }}>
          <h2 className={styles.sectionTitle}>Notification Preferences</h2>
          <div className="input-group" style={{ marginBottom: "var(--space-3)" }}>
            <label className="input-label">
              <input
                type="checkbox"
                checked={form.smsNotificationsEnabled}
                onChange={(e) => setForm((f) => ({ ...f, smsNotificationsEnabled: e.target.checked }))}
                style={{ marginRight: "0.5rem" }}
              />
              SMS Notifications
            </label>
          </div>
          <div className="input-group">
            <label className="input-label">
              <input
                type="checkbox"
                checked={form.emailNotificationsEnabled}
                onChange={(e) => setForm((f) => ({ ...f, emailNotificationsEnabled: e.target.checked }))}
                style={{ marginRight: "0.5rem" }}
              />
              Email Notifications
            </label>
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
              <label className="input-label" htmlFor="displayName">
                Display Name
                <span className={styles.charCount} aria-live="polite">
                  {form.displayName.length}/50
                </span>
              </label>
              <input
                id="displayName"
                className="input"
                value={form.displayName}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                maxLength={50}
                placeholder="Your name"
                required
              />
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="stellarAddress">Stellar Address</label>
              <input
                id="stellarAddress"
                className="input"
                value={form.stellarPublicKey}
                onChange={(e) => {
                  setForm((f) => ({ ...f, stellarPublicKey: e.target.value }));
                  setStellarKeyError(null);
                }}
                placeholder="GXXXXXX…"
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
                  Don't have a Stellar wallet?{" "}
                  <a href="https://freighter.app" target="_blank" rel="noopener noreferrer">
                    Install Freighter
                  </a>
                </small>
              )}
              {stellarKeyError && (
                <p role="alert" style={{ color: "var(--color-error)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
                  {stellarKeyError}
                </p>
              )}
              {walletError && (
                <p role="alert" style={{ color: "var(--color-error)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
                  {walletError}
                </p>
              )}
              {profile?.stellarPublicKey && usdcBalance !== null && (
                <p style={{ color: "var(--color-success)", fontSize: "0.875rem", marginTop: "0.5rem" }}>
                  USDC balance: <strong>{parseFloat(usdcBalance).toFixed(2)} USDC</strong>
                </p>
              )}
              {profile.stellarPublicKey && hasUsdcTrustline === false && (
                <div role="alert" style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid var(--color-error)", borderRadius: "var(--radius-md)", padding: "var(--space-3) var(--space-4)", marginTop: "0.5rem", fontSize: "0.875rem", color: "var(--color-error)" }}>
                  ⚠️ <strong>Missing USDC Trustline:</strong> Your Stellar account does not have a USDC trustline. Payouts will fail. Please add a USDC trustline via your wallet.
                </div>
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
