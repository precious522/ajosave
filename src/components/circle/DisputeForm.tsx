"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import styles from "./DisputeForm.module.css";

interface DisputeFormProps {
  circleId: string;
  contributionId?: string;
  memberId: string;
  onSuccess?: () => void;
}

export function DisputeForm({ circleId, contributionId, memberId, onSuccess }: DisputeFormProps) {
  const router = useRouter();
  const [type, setType] = useState<"missed_payout" | "wrong_amount" | "other">("other");
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");
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
          contributionId: contributionId || undefined,
          memberId,
          type,
          reason,
          evidence: evidence || undefined,
          paystackReference: paystackRef || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create dispute");
      }

      setReason("");
      setEvidence("");
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
        <label htmlFor="type" className={styles.label}>Dispute Type *</label>
        <select
          id="type"
          value={type}
          onChange={(e) => setType(e.target.value as typeof type)}
          className={styles.select}
          required
        >
          <option value="missed_payout">Missed Payout</option>
          <option value="wrong_amount">Wrong Amount</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div className={styles.field}>
        <label htmlFor="reason" className={styles.label}>Description *</label>
        <textarea
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Describe the issue in detail..."
          className={styles.textarea}
          required
          minLength={10}
          maxLength={500}
        />
        <span className={styles.hint}>{reason.length}/500</span>
      </div>

      <div className={styles.field}>
        <label htmlFor="evidence" className={styles.label}>Evidence (optional)</label>
        <textarea
          id="evidence"
          value={evidence}
          onChange={(e) => setEvidence(e.target.value)}
          placeholder="Transaction IDs, screenshots descriptions, or any supporting information..."
          className={styles.textarea}
          maxLength={1000}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="paystack" className={styles.label}>Paystack Reference (optional)</label>
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
