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
  const [acting, setActing] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [txHash, setTxHash] = useState<Record<string, string>>({});

  const handleAction = async (
    disputeId: string,
    status: "investigating" | "resolved" | "rejected",
    contributionId?: string
  ) => {
    if (status !== "investigating" && !notes[disputeId]?.trim()) {
      alert("Please enter resolution notes");
      return;
    }
    setActing(disputeId);
    try {
      const res = await fetch("/api/admin/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disputeId,
          status,
          resolutionNotes: notes[disputeId],
          txHash: status === "resolved" ? txHash[disputeId] : undefined,
          contributionId: status === "resolved" ? contributionId : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update dispute");
      }
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setActing(null);
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
            <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
              <span className={`${styles.status} ${styles[`status-${dispute.status}`]}`}>
                {dispute.status}
              </span>
              <span style={{ fontSize: "var(--text-xs)", background: "var(--color-bg-elevated)", padding: "2px 8px", borderRadius: "var(--radius-sm)", color: "var(--color-text-secondary)" }}>
                {dispute.type?.replace("_", " ") ?? "other"}
              </span>
            </div>
            <span className={styles.date}>
              {new Date(dispute.createdAt).toLocaleDateString()}
            </span>
          </div>

          <p className={styles.reason}>{dispute.reason}</p>

          {dispute.evidence && (
            <p className={styles.ref}>
              <strong>Evidence:</strong> {dispute.evidence}
            </p>
          )}

          {dispute.paystackReference && (
            <p className={styles.ref}>
              <strong>Paystack Ref:</strong> {dispute.paystackReference}
            </p>
          )}

          {(dispute.status === "open" || dispute.status === "investigating") && (
            <div className={styles.actions}>
              {dispute.status === "open" && (
                <button
                  onClick={() => handleAction(dispute.id, "investigating")}
                  disabled={acting !== null}
                  className={styles.btnResolve}
                  style={{ marginBottom: "var(--space-2)" }}
                >
                  {acting === dispute.id ? "Updating…" : "Mark Investigating"}
                </button>
              )}
              <textarea
                value={notes[dispute.id] ?? ""}
                onChange={(e) => setNotes((n) => ({ ...n, [dispute.id]: e.target.value }))}
                placeholder="Resolution notes..."
                className={styles.textarea}
              />
              <input
                type="text"
                value={txHash[dispute.id] ?? ""}
                onChange={(e) => setTxHash((t) => ({ ...t, [dispute.id]: e.target.value }))}
                placeholder="TX Hash (if confirming contribution)"
                className={styles.input}
              />
              <div className={styles.buttons}>
                <button
                  onClick={() => handleAction(dispute.id, "resolved", dispute.contributionId)}
                  disabled={acting !== null}
                  className={styles.btnResolve}
                >
                  {acting === dispute.id ? "Confirming…" : "Confirm Contribution"}
                </button>
                <button
                  onClick={() => handleAction(dispute.id, "rejected")}
                  disabled={acting !== null}
                  className={styles.btnReject}
                >
                  {acting === dispute.id ? "Rejecting…" : "Reject"}
                </button>
              </div>
            </div>
          )}

          {dispute.status !== "open" && dispute.status !== "investigating" && (
            <div className={styles.resolved}>
              <p><strong>Resolution:</strong> {dispute.resolutionNotes}</p>
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
