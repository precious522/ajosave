"use client";

import type { AdminPayoutRow } from "@/server/services/admin.service";
import { format } from "date-fns";
import styles from "../admin.module.css";

interface PayoutsTableProps {
  payouts: AdminPayoutRow[];
}

export function PayoutsTable({ payouts }: PayoutsTableProps) {
  if (payouts.length === 0) {
    return <div className={styles.empty}><p>No payouts found.</p></div>;
  }

  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Circle</th>
            <th>Recipient</th>
            <th>Cycle</th>
            <th>Amount (USDC)</th>
            <th>TX Hash</th>
            <th>Paid At</th>
          </tr>
        </thead>
        <tbody>
          {payouts.map((payout) => (
            <tr key={payout.id}>
              <td>{payout.circleName}</td>
              <td className={styles.monospace}>{payout.recipientUserId.slice(0, 12)}…</td>
              <td>#{payout.cycleNumber}</td>
              <td>{parseFloat(payout.amountUsdc).toFixed(2)}</td>
              <td>
                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${payout.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.monospace}
                  style={{ color: "var(--color-brand-primary)", textDecoration: "underline" }}
                >
                  {payout.txHash.slice(0, 16)}…
                </a>
              </td>
              <td>{format(new Date(payout.paidAt), "MMM d, yyyy HH:mm")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
