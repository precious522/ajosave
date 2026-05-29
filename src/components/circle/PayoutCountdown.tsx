"use client";

import { useEffect, useState, useCallback } from "react";
import styles from "./PayoutCountdown.module.css";

interface Props {
  nextPayoutAt: Date | string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isDue: boolean;
}

export function PayoutCountdown({ nextPayoutAt }: Props) {
  const calculateTimeLeft = useCallback((): TimeLeft => {
    const target = new Date(nextPayoutAt).getTime();
    const now = new Date().getTime();
    const difference = target - now;

    if (difference <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, isDue: true };
    }

    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / 1000 / 60) % 60),
      seconds: Math.floor((difference / 1000) % 60),
      isDue: false,
    };
  }, [nextPayoutAt]);

  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);

  useEffect(() => {
    // Initial sync to client time
    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      const updated = calculateTimeLeft();
      setTimeLeft(updated);
      
      if (updated.isDue) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [calculateTimeLeft]);

  // Don't render until client-side sync to avoid hydration mismatch
  if (!timeLeft) {
    return (
      <div className={styles.container} aria-hidden="true">
        <span className={styles.label}>Calculating time...</span>
        <div className={styles.skeleton}></div>
      </div>
    );
  }

  if (timeLeft.isDue) {
    return (
      <div className={styles.container}>
        <span className={styles.label}>Next Payout</span>
        <div className={styles.due}>Payout due</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <span className={styles.label}>Next Payout In</span>
      <div className={styles.timer}>
        <TimeUnit value={timeLeft.days} label="Days" />
        <TimeUnit value={timeLeft.hours} label="Hrs" />
        <TimeUnit value={timeLeft.minutes} label="Min" />
        <TimeUnit value={timeLeft.seconds} label="Sec" />
      </div>
    </div>
  );
}

function TimeUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className={styles.unit}>
      <span className={styles.value}>{value.toString().padStart(2, "0")}</span>
      <span className={styles.unitLabel}>{label}</span>
    </div>
  );
}
