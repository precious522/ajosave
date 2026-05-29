"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Dispute } from "@/types";
import styles from "./DisputeList.module.css";

interface DisputeListProps {
  disputes: Dispute[];
}

export function DisputeList({ disputes }: DisputeListProps) {
  const router = useRouter();
  const [resolving, setResolving] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [txHash, setTxHash] = useState("");

  const handleResolve = async (disputeId: string, status: "resolved" | "rejected") => {
    if (!notes.trim()) {
      alert("Please enter resolution notes");
      return;
    }

    setResolving(disputeId);
    try {
      const res = await fetch("/api/admin/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disputeId,
          status,
          resolutionNotes: notes,
          txHash: status === "resolved" ? txHash : undefined,
          contributionId: disputes.find((d) => d.id === disputeId)?.contributionId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to resolve dispute");
      }

      setNotes("");
      setTxHash("");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setResolving(null);
    }
  };

  if (disputes.length === 0) {
    return <p className={styles.empty}>No disputes</p>;
  }

  return (
    <div className={styles.list}>
      {disputes.map((dispute) => (
        <div key={dispute.id} className={styles.item}>
          <div className={styles.header}>
            <span className={`${styles.status} ${styles[`status-${dispute.status}`]}`}>
              {dispute.status}
            </span>
            <span className={styles.date}>
              {new Date(dispute.createdAt).toLocaleDateString()}
            </span>
          </div>

          <p className={styles.reason}>{dispute.reason}</p>

          {dispute.paystackReference && (
            <p className={styles.ref}>
              <strong>Paystack Ref:</strong> {dispute.paystackReference}
            </p>
          )}

          {dispute.status === "open" && (
            <div className={styles.actions}>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Resolution notes..."
                className={styles.textarea}
              />
              {resolving === dispute.id && (
                <input
                  type="text"
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                  placeholder="TX Hash (if confirming contribution)"
                  className={styles.input}
                />
              )}
              <div className={styles.buttons}>
                <button
                  onClick={() => handleResolve(dispute.id, "resolved")}
                  disabled={resolving !== null}
                  className={styles.btnResolve}
                >
                  {resolving === dispute.id ? "Confirming..." : "Confirm Contribution"}
                </button>
                <button
                  onClick={() => handleResolve(dispute.id, "rejected")}
                  disabled={resolving !== null}
                  className={styles.btnReject}
                >
                  {resolving === dispute.id ? "Rejecting..." : "Reject"}
                </button>
              </div>
            </div>
          )}

          {dispute.status !== "open" && (
            <div className={styles.resolved}>
              <p>
                <strong>Resolution:</strong> {dispute.resolutionNotes}
              </p>
              <p className={styles.resolvedBy}>
                Resolved by {dispute.resolvedBy} on{" "}
                {dispute.resolvedAt && new Date(dispute.resolvedAt).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
