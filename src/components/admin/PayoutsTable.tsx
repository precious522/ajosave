"use client";

import type { AdminPayoutRow } from "@/server/services/admin.service";
import { format } from "date-fns";
import { CopyableText } from "@/components/ui/CopyableText";
import styles from "./admin.module.css";

const explorerNetwork =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet" ? "mainnet" : "testnet";
const STELLAR_EXPLORER = `https://stellar.expert/explorer/${explorerNetwork}/tx`;

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
              <td className={styles.monospace}>
                <CopyableText
                  text={payout.recipientUserId}
                  displayText={`${payout.recipientUserId.slice(0, 12)}…`}
                  label="Copy user ID"
                />
              </td>
              <td>#{payout.cycleNumber}</td>
              <td>{parseFloat(payout.amountUsdc).toFixed(2)}</td>
              <td>
                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${payout.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.monospace}
                  style={{ color: "var(--color-brand-primary)", textDecoration: "underline" }}
                  aria-label={`View transaction ${payout.txHash} on Stellar Explorer (opens in new tab)`}
                >
                  <CopyableText
                    text={payout.txHash}
                    displayText={`${payout.txHash.slice(0, 16)}…`}
                    label="Copy transaction hash"
                  />
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
