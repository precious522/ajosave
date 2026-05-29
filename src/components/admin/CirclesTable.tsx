"use client";

import { useState } from "react";
import type { AdminCircleRow } from "@/server/services/admin.service";
import { CircleStatusBadge } from "@/components/ui/CircleStatusBadge";
import { Button } from "@/components/ui/Button";
import { CopyableText } from "@/components/ui/CopyableText";
import { format } from "date-fns";
import { getCurrencySymbol, SupportedCurrency } from "@/lib/currency";
import styles from "../admin.module.css";

interface CirclesTableProps {
  circles: AdminCircleRow[];
}

export function CirclesTable({ circles }: CirclesTableProps) {
  const [payingOut, setPayingOut] = useState<string | null>(null);
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [payoutSuccess, setPayoutSuccess] = useState<{ message: string; txHash: string } | null>(null);

  const getCircleCurrencySymbol = (currency: string) => getCurrencySymbol(currency as SupportedCurrency);

  const handleManualPayout = async (circleId: string) => {
    setPayingOut(circleId);
    setPayoutError(null);
    setPayoutSuccess(null);

    try {
      const res = await fetch(`/api/admin/circles/${circleId}/payout`, { method: "POST" });
      const json = await res.json();

      if (!json.success) throw new Error(json.error);

      setPayoutSuccess({
        message: "Payout triggered successfully",
        txHash: json.data.txHash,
      });
      setTimeout(() => setPayoutSuccess(null), 5000);
    } catch (err) {
      setPayoutError(err instanceof Error ? err.message : "Payout failed");
    } finally {
      setPayingOut(null);
    }
  };

  if (circles.length === 0) {
    return <div className={styles.empty}><p>No circles found.</p></div>;
  }

  return (
    <>
      {payoutError && <div className={styles.error}>{payoutError}</div>}
      {payoutSuccess && (
        <div style={{ background: "rgba(34, 197, 94, 0.1)", border: "1px solid var(--color-success)", borderRadius: "var(--radius-md)", padding: "var(--space-4) var(--space-6)", color: "var(--color-success)", marginBottom: "var(--space-6)" }}>
          {payoutSuccess.message} — TX:{" "}
          <CopyableText
            text={payoutSuccess.txHash}
            displayText={`${payoutSuccess.txHash.slice(0, 16)}…`}
            label="Copy transaction hash"
          />
        </div>
      )}

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Circle Name</th>
              <th>Status</th>
              <th>Members</th>
              <th>Contribution</th>
              <th>Cycle</th>
              <th>Next Payout</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {circles.map((circle) => (
              <tr key={circle.id}>
                <td>{circle.name}</td>
                <td className={styles.statusCell}>
                  <CircleStatusBadge status={circle.status} />
                </td>
                <td>{circle.memberCount} / {circle.maxMembers}</td>
                <td>
                  {getCircleCurrencySymbol(circle.contributionCurrency)}
                  {circle.contributionFiat.toLocaleString()}
                </td>
                <td>{circle.currentCycle > 0 ? `#${circle.currentCycle}` : "—"}</td>
                <td>
                  {circle.nextPayoutAt
                    ? format(new Date(circle.nextPayoutAt), "MMM d, yyyy HH:mm")
                    : "—"}
                </td>
                <td className={styles.actionCell}>
                  {circle.status === "active" && (
                    <Button
                      size="sm"
                      variant="accent"
                      onClick={() => handleManualPayout(circle.id)}
                      loading={payingOut === circle.id}
                      disabled={payingOut !== null}
                    >
                      Trigger Payout
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
