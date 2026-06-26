import { query } from "@/lib/db";
import type { Metadata } from "next";
import type { PlatformStats } from "@/app/api/analytics/route";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Platform Analytics | Ajosave",
  description: "Live statistics for the Ajosave savings platform.",
};

// Revalidate every 5 minutes
export const revalidate = 300;

async function getStats(): Promise<PlatformStats> {
  const { rows } = await query<PlatformStats>(`
    SELECT
      COUNT(*)::int                                                   AS "totalCircles",
      COUNT(*) FILTER (WHERE status = 'active')::int                 AS "activeCircles",
      COUNT(*) FILTER (WHERE status = 'completed')::int              AS "completedCircles",
      COALESCE(
        (SELECT SUM(amount_usdc)::text FROM payouts), '0'
      )                                                               AS "totalUsdcDistributed",
      COALESCE(
        (SELECT COUNT(*)::int FROM members WHERE status = 'active'), 0
      )                                                               AS "totalMembers",
      ROUND(AVG(max_members))::int                                    AS "avgCircleSize",
      ROUND(AVG(
        CASE cycle_frequency
          WHEN 'weekly'   THEN 7
          WHEN 'biweekly' THEN 14
          WHEN 'monthly'  THEN 30
        END
      ))::int                                                         AS "avgCycleDurationDays"
    FROM circles
  `);
  return rows[0];
}

export default async function AnalyticsPage() {
  const stats = await getStats();

  const statCards = [
    { label: "Total Circles", value: stats.totalCircles ?? 0, icon: "⭕" },
    { label: "Active Circles", value: stats.activeCircles ?? 0, icon: "🟢", highlight: true },
    { label: "Completed Circles", value: stats.completedCircles ?? 0, icon: "✅" },
    {
      label: "Total USDC Distributed",
      value: `$${parseFloat(stats.totalUsdcDistributed ?? "0").toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: "💰",
      highlight: true,
    },
    { label: "Active Members", value: stats.totalMembers ?? 0, icon: "👥" },
    { label: "Avg Circle Size", value: `${stats.avgCircleSize ?? 0} members`, icon: "📊" },
    { label: "Avg Cycle Duration", value: `${stats.avgCycleDurationDays ?? 0} days`, icon: "📅" },
  ];

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <h1 className={styles.title}>Platform Analytics</h1>
          <p className={styles.subtitle}>
            Live statistics for the Ajosave savings platform. Updated every 5 minutes.
          </p>
        </div>

        <div className={styles.grid}>
          {statCards.map((card) => (
            <div
              key={card.label}
              className={`card ${styles.statCard} ${card.highlight ? styles.highlight : ""}`}
            >
              <span className={styles.statIcon} aria-hidden="true">{card.icon}</span>
              <span className={styles.statValue}>{card.value}</span>
              <span className={styles.statLabel}>{card.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
