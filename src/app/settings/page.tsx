"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import { DeleteAccountButton } from "@/components/ui/DeleteAccountButton";
import styles from "./page.module.css";

interface SessionInfo {
  id: string;
  deviceName: string;
  deviceType: string;
  browser: string;
  os: string;
  ipAddress: string;
  lastActiveAt: string;
  createdAt: string;
  isCurrent: boolean;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionMessage, setSessionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [revokingSession, setRevokingSession] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  useEffect(() => {
    if (session) {
      fetchSessions();
    }
  }, [session]);

  const fetchSessions = async () => {
    setSessionsLoading(true);
    try {
      const res = await fetch("/api/v1/sessions");
      const json = await res.json();
      if (json.success) {
        setSessions(json.data.sessions);
      }
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    setRevokingSession(sessionId);
    setSessionMessage(null);
    try {
      const res = await fetch(`/api/v1/sessions/${sessionId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error);
      }
      setSessionMessage({ type: "success", text: "Session revoked successfully" });
      await fetchSessions();
    } catch (error) {
      setSessionMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to revoke session",
      });
    } finally {
      setRevokingSession(null);
    }
  };

  const handleRevokeAllSessions = async () => {
    if (!confirm("Are you sure you want to sign out all other devices? You will remain signed in on this device.")) {
      return;
    }
    setRevokingAll(true);
    setSessionMessage(null);
    try {
      const res = await fetch("/api/v1/sessions/revoke-all?keepCurrent=true", {
        method: "POST",
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error);
      }
      setSessionMessage({
        type: "success",
        text: `Signed out from ${json.data.revokedCount} device(s)`,
      });
      await fetchSessions();
    } catch (error) {
      setSessionMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to revoke sessions",
      });
    } finally {
      setRevokingAll(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    return date.toLocaleDateString();
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case "mobile":
        return "📱";
      case "tablet":
        return "📱";
      case "desktop":
        return "💻";
      default:
        return "🖥️";
    }
  };

  const handleToggleSms = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/user/sms-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !smsEnabled }),
      });

      const json = await res.json();
      
      if (!json.success) {
        throw new Error(json.error);
      }

      setSmsEnabled(!smsEnabled);
      setMessage({
        type: "success",
        text: `SMS notifications ${!smsEnabled ? "enabled" : "disabled"} successfully`,
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to update preferences",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <p>Please sign in to access settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>Settings</h1>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Notifications</h2>
          
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <h3 className={styles.settingName}>SMS Notifications</h3>
              <p className={styles.settingDesc}>
                Receive text messages for payout reminders, contribution confirmations, 
                and important circle updates.
              </p>
            </div>
            
            <div className={styles.settingControl}>
              <label className={styles.toggle} aria-label={`SMS notifications: ${smsEnabled ? "enabled" : "disabled"}`}>
                <input
                  type="checkbox"
                  checked={smsEnabled}
                  onChange={handleToggleSms}
                  disabled={loading}
                  aria-checked={smsEnabled}
                />
                <span className={styles.slider} aria-hidden="true"></span>
              </label>
              <span className={styles.status} aria-live="polite">
                {smsEnabled ? "Enabled" : "Disabled"}
              </span>
            </div>
          </div>

          {message && (
            <div
              className={`${styles.message} ${styles[message.type]}`}
              role="alert"
            >
              {message.text}
            </div>
          )}

          <div className={styles.notificationTypes}>
            <h4 className={styles.typesTitle}>You will receive SMS for:</h4>
            <ul className={styles.typesList}>
              <li>📱 Payout reminders (24 hours before your turn)</li>
              <li>💰 Payout confirmations (when any member receives payout)</li>
              <li>✅ Contribution confirmations (when your payment is verified)</li>
              <li>⚠️ Missed contribution alerts</li>
              <li>👥 Join request approvals/rejections (for private circles)</li>
            </ul>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Active Sessions</h2>
          <p className={styles.settingDesc}>
            Manage devices where you&apos;re currently signed in. You can sign out from individual devices or all devices at once.
          </p>

          {sessionMessage && (
            <div className={`${styles.message} ${styles[sessionMessage.type]}`}>
              {sessionMessage.text}
            </div>
          )}

          {sessionsLoading ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#718096" }}>
              Loading sessions...
            </div>
          ) : sessions.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#718096" }}>
              No active sessions found.
            </div>
          ) : (
            <>
              <div style={{ marginTop: "1.5rem", marginBottom: "1rem" }}>
                {sessions.map((sess) => (
                  <div key={sess.id} className={styles.settingItem}>
                    <div className={styles.settingInfo}>
                      <h3 className={styles.settingName}>
                        {getDeviceIcon(sess.deviceType)} {sess.deviceName}
                        {sess.isCurrent && (
                          <span
                            style={{
                              marginLeft: "0.5rem",
                              fontSize: "0.75rem",
                              padding: "0.25rem 0.5rem",
                              background: "#48bb78",
                              color: "white",
                              borderRadius: "4px",
                              fontWeight: "600",
                            }}
                          >
                            Current
                          </span>
                        )}
                      </h3>
                      <p className={styles.settingDesc}>
                        IP: {sess.ipAddress} • Last active: {formatDate(sess.lastActiveAt)}
                        <br />
                        Signed in: {formatDate(sess.createdAt)}
                      </p>
                    </div>
                    <div className={styles.settingControl}>
                      {!sess.isCurrent && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleRevokeSession(sess.id)}
                          loading={revokingSession === sess.id}
                          disabled={revokingSession !== null}
                        >
                          Sign Out
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {sessions.length > 1 && (
                <div style={{ marginTop: "1.5rem" }}>
                  <Button
                    variant="secondary"
                    onClick={handleRevokeAllSessions}
                    loading={revokingAll}
                    disabled={revokingAll}
                  >
                    Sign Out All Other Devices
                  </Button>
                </div>
              )}
            </>
          )}
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Account Information</h2>
          
          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Phone</span>
              <span className={styles.infoValue}>{session.user?.phone || "Not set"}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Display Name</span>
              <span className={styles.infoValue}>{session.user?.name || "Not set"}</span>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Danger Zone</h2>
          <p className={styles.settingDesc}>Permanently delete your account and all data.</p>
          <div style={{ marginTop: "var(--space-4)" }}>
            <DeleteAccountButton />
          </div>
        </section>
      </div>
    </div>
  );
}
