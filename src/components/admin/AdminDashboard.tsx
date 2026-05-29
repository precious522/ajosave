"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminCircleRow } from "@/server/services/admin.service";
import type { AdminPayoutRow } from "@/server/services/admin.service";
import { CirclesTable } from "./CirclesTable";
import { PayoutsTable } from "./PayoutsTable";
import { AnalyticsDashboard } from "./AnalyticsDashboard";
import { ConnectionStatus } from "@/components/ui/ConnectionStatus";
import { usePolling } from "@/hooks/usePolling";
import styles from "../admin.module.css";

type Tab = "circles" | "payouts" | "analytics";

export function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("circles");
  const [circles, setCircles] = useState<AdminCircleRow[]>([]);
  const [payouts, setPayouts] = useState<AdminPayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [newItemsCount, setNewItemsCount] = useState(0);

  // Fetch function for circles
  const fetchCircles = useCallback(async () => {
    const res = await fetch("/api/admin/circles");
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    return json.data as AdminCircleRow[];
  }, []);

  // Fetch function for payouts
  const fetchPayouts = useCallback(async () => {
    const res = await fetch("/api/admin/payouts");
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    return json.data as AdminPayoutRow[];
  }, []);

  // Polling for circles
  const {
    data: circlesData,
    isConnected: circlesConnected,
    error: circlesError,
  } = usePolling({
    fetchFn: fetchCircles,
    interval: 5000,
    enabled: tab === "circles",
    onSuccess: (data) => {
      const prevCount = circles.length;
      const newCount = data.length;
      if (prevCount > 0 && newCount > prevCount) {
        setNewItemsCount(newCount - prevCount);
        setTimeout(() => setNewItemsCount(0), 3000);
      }
      setCircles(data);
      setLastUpdate(new Date());
      setLoading(false);
    },
    onError: (err) => {
      setError(err.message);
      setLoading(false);
    },
  });

  // Polling for payouts
  const {
    data: payoutsData,
    isConnected: payoutsConnected,
    error: payoutsError,
  } = usePolling({
    fetchFn: fetchPayouts,
    interval: 5000,
    enabled: tab === "payouts",
    onSuccess: (data) => {
      const prevCount = payouts.length;
      const newCount = data.length;
      if (prevCount > 0 && newCount > prevCount) {
        setNewItemsCount(newCount - prevCount);
        setTimeout(() => setNewItemsCount(0), 3000);
      }
      setPayouts(data);
      setLastUpdate(new Date());
      setLoading(false);
    },
    onError: (err) => {
      setError(err.message);
      setLoading(false);
    },
  });

  const isConnected = tab === "circles" ? circlesConnected : tab === "payouts" ? payoutsConnected : true;
  const currentError = tab === "circles" ? circlesError : tab === "payouts" ? payoutsError : null;

  useEffect(() => {
    if (currentError) {
      setError(currentError.message);
    } else {
      setError(null);
    }
  }, [currentError]);

  return (
    <>
      <div className={styles.header}>
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
          <button
            className={styles.tab}
            aria-selected={tab === "analytics"}
            onClick={() => setTab("analytics")}
          >
            Performance & Analytics
          </button>
        </div>
        <ConnectionStatus isConnected={isConnected} lastUpdate={lastUpdate || undefined} />
      </div>

      {newItemsCount > 0 && (
        <div className={styles.newItemsBanner}>
          🎉 {newItemsCount} new {tab === "circles" ? "circle" : "payout"}
          {newItemsCount !== 1 ? "s" : ""} added!
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}

      {tab === "analytics" ? (
        <AnalyticsDashboard />
      ) : loading ? (
        <div className={styles.loading}>Loading…</div>
      ) : tab === "circles" ? (
        <CirclesTable circles={circles} />
      ) : (
        <PayoutsTable payouts={payouts} />
      )}
    </>
  );
}
