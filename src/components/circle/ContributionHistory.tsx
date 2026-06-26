"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import styles from "./PayoutHistory.module.css";
import type { ContributionRow } from "@/server/services/contribution.service";

interface Props {
  circleId: string;
  initialData?: { data: ContributionRow[]; total: number };
}

export function ContributionHistory({ circleId, initialData }: Props) {
  const [rows, setRows] = useState<ContributionRow[] | null>(initialData?.data ?? null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState<number | null>(initialData?.total ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) return;
    setRows(null);
    setError(null);
    fetch(`/api/circles/${circleId}/contributions?page=${page}&limit=20`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) throw new Error(json.error || "Failed to load");
        setRows(json.data.data);
        setTotal(json.data.total);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load contributions"));
  }, [circleId, page, initialData]);

  if (error) return <p className={styles.error}>{error}</p>;

  if (!rows) {
    return (
      <div className={styles.skeletonWrap}>
        {[1, 2, 3].map((i) => <div key={i} className={`${styles.skeletonRow} skeleton`} />)}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon} aria-hidden>🧾</span>
        <p>No contributions yet.</p>
      </div>
    );
  }

  const totalPages = total ? Math.ceil(total / 20) : 1;

  return (
    <div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Cycle</th>
              <th>Member</th>
              <th>Amount (USDC)</th>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.cycleNumber}</td>
                <td>{r.memberName}</td>
                <td>{parseFloat(r.amountUsdc).toFixed(2)}</td>
                <td>{format(new Date(r.createdAt), "MMM d, yyyy")}</td>
                <td>{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px" }}>
        <div>
          Page {page} of {totalPages}
        </div>
        <div>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn btn--ghost">Prev</button>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn btn--ghost" style={{ marginLeft: 8 }}>Next</button>
        </div>
      </div>
    </div>
  );
}
