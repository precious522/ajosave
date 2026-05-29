"use client";

import { useEffect, useState } from "react";
import type { PayoutHistoryRow } from "@/app/api/circles/[id]/payouts/route";
import { format } from "date-fns";
import styles from "./PayoutHistory.module.css";

const STELLAR_EXPLORER = "https://stellar.expert/explorer/testnet/tx";

interface Props {
  circleId: string;
}

export function PayoutHistory({ circleId }: Props) {
  const [payouts, setPayouts] = useState<PayoutHistoryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/circles/${circleId}/payouts`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setPayouts(json.data);
        else setError(json.error);
      })
      .catch(() => setError("Failed to load payout history."));
  }, [circleId]);

  if (error) return <p className={styles.error}>{error}</p>;

  if (!payouts) {
    return (
      <div className={styles.skeletonWrap}>
        {[1, 2, 3].map((i) => (
          <div key={i} className={`${styles.skeletonRow} skeleton`} />
        ))}
      </div>
    );
  }

  if (payouts.length === 0) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon} aria-hidden="true">📭</span>
        <p>No payouts have been made yet.</p>
        <p className={styles.emptyHint}>Payouts appear here once each cycle completes.</p>
      </div>
    );
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Cycle</th>
            <th>Recipient</th>
            <th>Amount (USDC)</th>
            <th>Date</th>
            <th>Tx Hash</th>
          </tr>
        </thead>
        <tbody>
          {payouts.map((p) => (
            <tr key={p.id}>
              <td>{p.cycleNumber}</td>
              <td>{p.recipientName}</td>
              <td>{parseFloat(p.amountUsdc).toFixed(2)}</td>
              <td>{format(new Date(p.paidAt), "MMM d, yyyy")}</td>
              <td>
                <a
                  href={`${STELLAR_EXPLORER}/${p.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.txLink}
                  title={p.txHash}
                >
                  {p.txHash.slice(0, 8)}…{p.txHash.slice(-6)}
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
