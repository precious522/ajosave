"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminCircleRow, AdminPayoutRow } from "@/server/services/admin.service";
import type { Dispute } from "@/types";
import { CirclesTable } from "./CirclesTable";
import { PayoutsTable } from "./PayoutsTable";
import { AnalyticsDashboard } from "./AnalyticsDashboard";
import { DisputeList } from "./DisputeList";
import { ConnectionStatus } from "@/components/ui/ConnectionStatus";
import { usePolling } from "@/hooks/usePolling";
import styles from "./admin.module.css";

const CirclesTable = lazy(() => import("./CirclesTable").then((mod) => ({ default: mod.CirclesTable })));
const PayoutsTable = lazy(() => import("./PayoutsTable").then((mod) => ({ default: mod.PayoutsTable })));
const AnalyticsDashboard = lazy(() => import("./AnalyticsDashboard").then((mod) => ({ default: mod.AnalyticsDashboard })));

type Tab = "circles" | "payouts" | "disputes" | "users" | "analytics";

interface PlatformStats {
  totalCircles: number;
  activeCircles: number;
  totalUsers: number;
  totalSavedUsdc: string;
  openDisputes: number;
}

interface AdminUser {
  id: string;
  displayName: string;
  phone: string;
  email: string | null;
  role: string;
  reputationScore: number;
  createdAt: string;
}

export function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("circles");
  const [circles, setCircles] = useState<AdminCircleRow[]>([]);
  const [payouts, setPayouts] = useState<AdminPayoutRow[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [newItemsCount, setNewItemsCount] = useState(0);

  const fetchCircles = useCallback(async () => {
    const res = await fetch("/api/admin/circles");
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    return json.data as AdminCircleRow[];
  }, []);

  const fetchPayouts = useCallback(async () => {
    const res = await fetch("/api/admin/payouts");
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    return json.data as AdminPayoutRow[];
  }, []);

  const fetchDisputes = useCallback(async () => {
    const res = await fetch("/api/admin/disputes");
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    return json.data as Dispute[];
  }, []);

  const fetchStats = useCallback(async () => {
    const res = await fetch("/api/admin/stats");
    const json = await res.json();
    if (json.success) setStats(json.data);
  }, []);

  const fetchUsers = useCallback(async (search: string) => {
    const url = search ? `/api/admin/users?search=${encodeURIComponent(search)}` : "/api/admin/users";
    const res = await fetch(url);
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    return json.data as AdminUser[];
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const { isConnected: circlesConnected, error: circlesError } = usePolling({
    fetchFn: fetchCircles,
    interval: 5000,
    enabled: tab === "circles",
    onSuccess: (data) => {
      const prevCount = circles.length;
      if (prevCount > 0 && data.length > prevCount) {
        setNewItemsCount(data.length - prevCount);
        setTimeout(() => setNewItemsCount(0), 3000);
      }
      setCircles(data);
      setLastUpdate(new Date());
      setLoading(false);
    },
    onError: (err) => { setError(err.message); setLoading(false); },
  });

  const { isConnected: payoutsConnected, error: payoutsError } = usePolling({
    fetchFn: fetchPayouts,
    interval: 5000,
    enabled: tab === "payouts",
    onSuccess: (data) => {
      const prevCount = payouts.length;
      if (prevCount > 0 && data.length > prevCount) {
        setNewItemsCount(data.length - prevCount);
        setTimeout(() => setNewItemsCount(0), 3000);
      }
      setPayouts(data);
      setLastUpdate(new Date());
      setLoading(false);
    },
    onError: (err) => { setError(err.message); setLoading(false); },
  });

  const { isConnected: disputesConnected, error: disputesError } = usePolling({
    fetchFn: fetchDisputes,
    interval: 10000,
    enabled: tab === "disputes",
    onSuccess: (data) => {
      setDisputes(data);
      setLastUpdate(new Date());
      setLoading(false);
    },
    onError: (err) => { setError(err.message); setLoading(false); },
  });

  // Load users when tab switches to users
  useEffect(() => {
    if (tab !== "users") return;
    setLoading(true);
    fetchUsers(userSearch)
      .then((data) => { setUsers(data); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [tab, userSearch, fetchUsers]);

  const isConnected =
    tab === "circles" ? circlesConnected :
    tab === "payouts" ? payoutsConnected :
    tab === "disputes" ? disputesConnected : true;

  const currentError =
    tab === "circles" ? circlesError :
    tab === "payouts" ? payoutsError :
    tab === "disputes" ? disputesError : null;

  useEffect(() => {
    setError(currentError?.message ?? null);
  }, [currentError]);

  return (
    <>
      {/* Platform Stats */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "var(--space-4)", marginBottom: "var(--space-8)" }}>
          {[
            { label: "Total Circles", value: stats.totalCircles },
            { label: "Active Circles", value: stats.activeCircles },
            { label: "Total Users", value: stats.totalUsers },
            { label: "Total Saved (USDC)", value: parseFloat(stats.totalSavedUsdc).toFixed(2) },
            { label: "Open Disputes", value: stats.openDisputes },
          ].map(({ label, value }) => (
            <div key={label} className="card" style={{ textAlign: "center", padding: "var(--space-4)" }}>
              <div style={{ fontSize: "var(--text-2xl)", fontWeight: "var(--font-bold)", color: "var(--color-brand-primary)" }}>{value}</div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)", marginTop: "var(--space-1)" }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      <div className={styles.header}>
        <div className={styles.tabs} role="tablist" aria-label="Admin sections">
          {(["circles", "payouts", "disputes", "users", "analytics"] as Tab[]).map((t) => (
            <button
              key={t}
              className={styles.tab}
              role="tab"
              aria-selected={tab === t}
              onClick={() => { setTab(t); setLoading(true); setError(null); }}
            >
              {t === "circles" ? `Circles (${circles.length})` :
               t === "payouts" ? `Payouts (${payouts.length})` :
               t === "disputes" ? `Disputes (${disputes.length})` :
               t === "users" ? "Users" :
               "Analytics"}
            </button>
          ))}
        </div>
        <ConnectionStatus isConnected={isConnected} lastUpdate={lastUpdate || undefined} />
      </div>

      {newItemsCount > 0 && (
        <div className={styles.newItemsBanner} role="status" aria-live="polite">
          🎉 {newItemsCount} new {tab === "circles" ? "circle" : "payout"}{newItemsCount !== 1 ? "s" : ""} added!
        </div>
      )}

      {error && <div className={styles.error} role="alert">{error}</div>}

      {tab === "analytics" ? (
        <Suspense fallback={<div className={styles.loading}>Loading analytics dashboard…</div>}>
          <AnalyticsDashboard />
        </Suspense>
      ) : loading ? (
        <div className={styles.loading}>Loading…</div>
      ) : tab === "circles" ? (
        <div role="tabpanel">
          <CirclesTable circles={circles} />
        </div>
      ) : tab === "payouts" ? (
        <div role="tabpanel">
          <PayoutsTable payouts={payouts} />
        </div>
      ) : tab === "disputes" ? (
        <div role="tabpanel">
          <DisputeList disputes={disputes} />
        </div>
      ) : (
        <div role="tabpanel">
          <div style={{ marginBottom: "var(--space-4)" }}>
            <input
              type="search"
              placeholder="Search by name, phone, or email…"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              style={{ padding: "var(--space-3)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", width: "100%", maxWidth: 400, background: "var(--color-bg)", color: "var(--color-text-primary)", fontSize: "var(--text-sm)" }}
            />
          </div>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Reputation</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.displayName}</td>
                    <td>{u.phone}</td>
                    <td>{u.email ?? "—"}</td>
                    <td>{u.role}</td>
                    <td>{u.reputationScore}</td>
                    <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--color-text-secondary)" }}>No users found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
