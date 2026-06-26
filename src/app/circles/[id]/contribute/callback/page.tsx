"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import styles from "./page.module.css";

type Status = "verifying" | "success" | "failed";

export default function ContributeCallbackPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const reference = searchParams.get("reference");
  const [status, setStatus] = useState<Status>("verifying");

  useEffect(() => {
    if (!reference) { setStatus("failed"); return; }
    fetch(`/api/circles/${params.id}/contribute/verify?reference=${reference}`)
      .then((r) => r.json())
      .then((json) => {
        setStatus(json.success && json.data.status === "success" ? "success" : "failed");
      })
      .catch(() => setStatus("failed"));
  }, [params.id, reference]);

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.inner}>
          {status === "verifying" && (
            <>
              <div className={styles.spinner} aria-label="Verifying payment" />
              <p className={styles.message}>Verifying your payment…</p>
            </>
          )}
          {status === "success" && (
            <>
              <div className={styles.icon} aria-hidden>✓</div>
              <h1 className={styles.title}>Payment confirmed!</h1>
              <p className={styles.message}>Your contribution for this cycle has been recorded.</p>
              <Button onClick={() => router.push(`/circles/${params.id}`)}>Back to circle</Button>
            </>
          )}
          {status === "failed" && (
            <>
              <div className={`${styles.icon} ${styles.iconError}`} aria-hidden>✕</div>
              <h1 className={styles.title}>Payment failed</h1>
              <p className={styles.message}>We couldn&apos;t verify your payment. Please try again.</p>
              <Button onClick={() => router.push(`/circles/${params.id}`)}>Back to circle</Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
