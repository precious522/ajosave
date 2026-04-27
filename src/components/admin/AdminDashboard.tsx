"use client";

import { useEffect, useState } from "react";
import type { AdminCircleRow } from "@/server/services/admin.service";
import type { AdminPayoutRow } from "@/server/services/admin.service";
import { CirclesTable } from "./CirclesTable";
import { PayoutsTable } from "./PayoutsTable";
import styles from "../admin.module.css";

type Tab = "circles" | "payouts";

export function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("circles");
  const [circles, setCircles] = useState<AdminCircleRow[]>([]);
  const [payouts, setPayouts] = useState<AdminPayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        if (tab === "circles") {
          const res = await fetch("/api/admin/circles");
          const json = await res.json();
          if (!json.success) throw new Error(json.error);
          setCircles(json.data);
        } else {
          const res = await fetch("/api/admin/payouts");
          const json = await res.json();
          if (!json.success) throw new Error(json.error);
          setPayouts(json.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [tab]);

  return (
    <>
      <div className={styles.tabs}>
        <button
          className={styles.tab}
          aria-selected={tab === "circles"}
          onClick={() => setTab("circles")}
        >
          Circles ({circles.length})
        </button>
        <button
          className={styles.tab}
          aria-selected={tab === "payouts"}
          onClick={() => setTab("payouts")}
        >
          Payouts ({payouts.length})
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {loading ? (
        <div className={styles.loading}>Loading…</div>
      ) : tab === "circles" ? (
        <CirclesTable circles={circles} />
      ) : (
        <PayoutsTable payouts={payouts} />
      )}
    </>
  );
}
