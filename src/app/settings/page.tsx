"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import styles from "./page.module.css";

export default function SettingsPage() {
  const { data: session } = useSession();
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={smsEnabled}
                  onChange={handleToggleSms}
                  disabled={loading}
                />
                <span className={styles.slider}></span>
              </label>
              <span className={styles.status}>
                {smsEnabled ? "Enabled" : "Disabled"}
              </span>
            </div>
          </div>

          {message && (
            <div className={`${styles.message} ${styles[message.type]}`}>
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
      </div>
    </div>
  );
}
