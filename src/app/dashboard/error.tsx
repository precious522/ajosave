"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import styles from "../error.module.css";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className={styles.container}>
      <div className={styles.inner}>
        <h2 className={styles.title}>Failed to load dashboard</h2>
        <p className={styles.message}>
          We couldn&apos;t load your circles. Please try again.
        </p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
