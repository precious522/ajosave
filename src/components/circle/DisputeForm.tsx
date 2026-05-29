"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import styles from "./DisputeForm.module.css";

interface DisputeFormProps {
  circleId: string;
  contributionId: string;
  memberId: string;
  onSuccess?: () => void;
}

export function DisputeForm({ circleId, contributionId, memberId, onSuccess }: DisputeFormProps) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [paystackRef, setPaystackRef] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`/api/circles/${circleId}/disputes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contributionId,
          memberId,
          reason,
          paystackReference: paystackRef || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create dispute");
      }

      setReason("");
      setPaystackRef("");
      onSuccess?.();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <h3 className={styles.title}>Raise a Dispute</h3>

      <div className={styles.field}>
        <label htmlFor="reason" className={styles.label}>
          Reason for Dispute *
        </label>
        <textarea
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Describe why you believe your contribution was not recorded..."
          className={styles.textarea}
          required
          minLength={10}
          maxLength={500}
        />
        <span className={styles.hint}>{reason.length}/500</span>
      </div>

      <div className={styles.field}>
        <label htmlFor="paystack" className={styles.label}>
          Paystack Reference (optional)
        </label>
        <Input
          id="paystack"
          type="text"
          value={paystackRef}
          onChange={(e) => setPaystackRef(e.target.value)}
          placeholder="e.g., 1234567890"
        />
      </div>

      {error && <div className={styles.error} role="alert">{error}</div>}

      <Button
        type="submit"
        disabled={loading || !reason.trim()}
        loading={loading}
        className={styles.submit}
      >
        Submit Dispute
      </Button>
    </form>
  );
}
