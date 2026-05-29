"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import styles from "./CircleWaitlist.module.css";

interface Props {
  circleId: string;
  circleName: string;
  initialIsOnWaitlist: boolean;
  initialPosition: number | null;
}

export function CircleWaitlist({
  circleId,
  circleName,
  initialIsOnWaitlist,
  initialPosition,
}: Props) {
  const router = useRouter();
  const [isOnWaitlist, setIsOnWaitlist] = useState(initialIsOnWaitlist);
  const [position, setPosition] = useState<number | null>(initialPosition);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleJoin = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/circles/${circleId}/waitlist`, {
        method: "POST",
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      setIsOnWaitlist(true);
      setPosition(json.data.position);
      setSuccess("Successfully joined the waitlist!");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join waitlist");
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/circles/${circleId}/waitlist`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      setIsOnWaitlist(false);
      setPosition(null);
      setSuccess("Successfully left the waitlist.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to leave waitlist");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.badge}>Circle Full</div>
        <h3 className={styles.title}>Circle Waitlist</h3>
      </div>
      <p className={styles.description}>
        This rotating savings circle is currently at maximum capacity. Join the waitlist to be notified instantly via SMS if an active member leaves.
      </p>

      {isOnWaitlist && position !== null && (
        <div className={styles.statusBox}>
          <div className={styles.positionIndicator}>
            <span className={styles.positionLabel}>Your Waitlist Position</span>
            <span className={styles.positionNumber}>#{position}</span>
          </div>
          <p className={styles.statusHelp}>
            You will be automatically contacted the moment a spot opens up in {circleName}.
          </p>
        </div>
      )}

      {error && <div className={styles.error} role="alert">{error}</div>}
      {success && <div className={styles.success} role="status">{success}</div>}

      <div className={styles.actions}>
        {isOnWaitlist ? (
          <Button
            variant="ghost"
            className="btn--full"
            onClick={handleLeave}
            loading={loading}
            disabled={loading}
          >
            Leave Waitlist
          </Button>
        ) : (
          <Button
            variant="accent"
            className="btn--full"
            onClick={handleJoin}
            loading={loading}
            disabled={loading}
          >
            Join Waitlist
          </Button>
        )}
      </div>
    </div>
  );
}
