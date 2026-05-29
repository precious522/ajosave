"use client";

import { useState, useEffect, useMemo } from "react";
import styles from "./AnalyticsDashboard.module.css";

interface DailyAnalyticsRow {
  date: string;
  total_saved: string;
  active_circles: number;
  completion_rate: number;
  default_rate: number;
}

interface CircleAnalytics {
  circleId: string;
  circleName: string;
  creatorId: string;
  status: string;
  totalContributionsCount: number;
  confirmedContributionsCount: number;
  missedContributionsCount: number;
  totalSaved: string;
  completionRate: number;
  defaultRate: number;
  activeMembersCount: number;
  defaultedMembersCount: number;
}

type SortKey = "circleName" | "status" | "totalSaved" | "completionRate" | "defaultRate" | "activeMembersCount";
type SortOrder = "asc" | "desc";

export function AnalyticsDashboard() {
  const [data, setData] = useState<{
    dailyAnalytics: DailyAnalyticsRow[];
    circleAnalytics: CircleAnalytics[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Table search and sorting
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("completionRate");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Chart tooltip states
  const [hoveredSavedPoint, setHoveredSavedPoint] = useState<DailyAnalyticsRow | null>(null);
  const [hoveredCirclesPoint, setHoveredCirclesPoint] = useState<DailyAnalyticsRow | null>(null);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const res = await fetch("/api/admin/analytics");
        const json = await res.json();
        if (!json.success) {
          throw new Error(json.error || "Failed to fetch analytics");
        }
        setData(json.data);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to load analytics");
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, []);

  // Format currencies
  const formatCurrency = (val: string | number) => {
    const num = typeof val === "string" ? parseFloat(val) : val;
    return `$${num.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Sort and filter circle data
  const sortedAndFilteredCircles = useMemo(() => {
    if (!data?.circleAnalytics) return [];
    
    return data.circleAnalytics
      .filter((circle) => {
        const searchLower = search.toLowerCase();
        return (
          circle.circleName.toLowerCase().includes(searchLower) ||
          circle.creatorId.toLowerCase().includes(searchLower) ||
          circle.circleId.toLowerCase().includes(searchLower)
        );
      })
      .sort((a, b) => {
        let valA: string | number = a[sortKey];
        let valB: string | number = b[sortKey];

        if (sortKey === "totalSaved") {
          valA = parseFloat(a.totalSaved);
          valB = parseFloat(b.totalSaved);
        }

        if (typeof valA === "string" && typeof valB === "string") {
          return sortOrder === "asc"
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        } else if (typeof valA === "number" && typeof valB === "number") {
          return sortOrder === "asc" ? valA - valB : valB - valA;
        }
        return 0;
      });
  }, [data?.circleAnalytics, search, sortKey, sortOrder]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("desc");
    }
  };

  // Pre-calculate latest values for KPI cards
  const kpis = useMemo(() => {
    if (!data?.dailyAnalytics || data.dailyAnalytics.length === 0) {
      return {
        totalSaved: "0",
        activeCircles: 0,
        avgCompletionRate: 100,
        avgDefaultRate: 0,
      };
    }
    const latest = data.dailyAnalytics[data.dailyAnalytics.length - 1];
    return {
      totalSaved: latest.total_saved,
      activeCircles: latest.active_circles,
      avgCompletionRate: Number(latest.completion_rate),
      avgDefaultRate: Number(latest.default_rate),
    };
  }, [data?.dailyAnalytics]);

  // Dynamic calculations for custom SVG total saved over time chart
  const savedChartPath = useMemo(() => {
    if (!data?.dailyAnalytics || data.dailyAnalytics.length < 2) return "";
    const chartWidth = 500;
    const chartHeight = 180;
    const points = data.dailyAnalytics;
    
    const maxVal = Math.max(...points.map((p) => parseFloat(p.total_saved)), 10);
    const minVal = 0;
    const range = maxVal - minVal;

    return points
      .map((p, idx) => {
        const x = (idx / (points.length - 1)) * chartWidth;
        const y = chartHeight - ((parseFloat(p.total_saved) - minVal) / range) * chartHeight;
        return `${x},${y}`;
      })
      .join(" ");
  }, [data?.dailyAnalytics]);

  // Dynamic calculations for custom SVG active circles bar chart
  const circlesChartBars = useMemo(() => {
    if (!data?.dailyAnalytics || data.dailyAnalytics.length === 0) return [];
    const chartWidth = 500;
    const chartHeight = 180;
    const points = data.dailyAnalytics;
    
    const maxVal = Math.max(...points.map((p) => p.active_circles), 5);
    const minVal = 0;
    const range = maxVal - minVal;
    
    const barWidth = Math.max(2, (chartWidth / points.length) * 0.7);
    const gap = (chartWidth / points.length) * 0.3;

    return points.map((p, idx) => {
      const x = idx * (barWidth + gap) + gap / 2;
      const height = ((p.active_circles - minVal) / range) * chartHeight;
      const y = chartHeight - height;
      return {
        x,
        y,
        width: barWidth,
        height: Math.max(height, 2),
        data: p,
      };
    });
  }, [data?.dailyAnalytics]);

  // Risk categorization helper
  const getRiskLabel = (defaultRate: number) => {
    if (defaultRate > 15) return <span className={styles.rateLow}>High Risk ({defaultRate}%)</span>;
    if (defaultRate > 5) return <span className={styles.rateMed}>Medium Risk ({defaultRate}%)</span>;
    return <span className={styles.rateHigh}>Low Risk ({defaultRate}%)</span>;
  };

  if (loading) {
    return <div className={styles.loading}>Gathering circle metrics and building charts...</div>;
  }

  if (error) {
    return <div className={styles.error}>Error: {error}</div>;
  }

  // Handle export trigger
  const handleExport = () => {
    window.open("/api/admin/analytics/export", "_blank");
  };

  return (
    <div className={styles.container}>
      <div className={styles.topRow}>
        <div>
          <h2 className={styles.chartTitle}>Circle Performance & Financial Health</h2>
          <p className={styles.chartSubtitle}>Monitor ROSCA completion rates, user default patterns, and savings volume growth.</p>
        </div>
        <button className={styles.exportBtn} onClick={handleExport}>
          📥 Export CSV Reports
        </button>
      </div>

      {/* Metric Cards Grid */}
      <div className={styles.metricsGrid}>
        <div className={`${styles.metricCard} ${styles.saved}`}>
          <span className={styles.metricLabel}>Total Savings Volume</span>
          <span className={styles.metricValue}>{formatCurrency(kpis.totalSaved)}</span>
          <span className={styles.metricSubtitle}>Across all locked & completed circles</span>
        </div>
        <div className={`${styles.metricCard} ${styles.active}`}>
          <span className={styles.metricLabel}>Active Rotating Circles</span>
          <span className={styles.metricValue}>{kpis.activeCircles}</span>
          <span className={styles.metricSubtitle}>Currently running savings cycles</span>
        </div>
        <div className={`${styles.metricCard} ${styles.completion}`}>
          <span className={styles.metricLabel}>Circle Completion Rate</span>
          <span className={styles.metricValue}>{kpis.avgCompletionRate.toFixed(1)}%</span>
          <span className={styles.metricSubtitle}>Completed vs cancelled circles</span>
        </div>
        <div className={`${styles.metricCard} ${styles.default}`}>
          <span className={styles.metricLabel}>Contribution Default Rate</span>
          <span className={styles.metricValue}>{kpis.avgDefaultRate.toFixed(1)}%</span>
          <span className={styles.metricSubtitle}>Missed vs confirmed payments</span>
        </div>
      </div>

      {/* Charts section */}
      <div className={styles.chartsGrid}>
        {/* Total Saved over Time Line Chart */}
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <span className={styles.chartTitle}>Savings Volume Trend (USDC)</span>
            <span className={styles.chartSubtitle}>
              {hoveredSavedPoint 
                ? `On ${hoveredSavedPoint.date}: ${formatCurrency(hoveredSavedPoint.total_saved)}`
                : "Hover over the chart to see historical totals"}
            </span>
          </div>
          <div className={styles.chartBody}>
            {data?.dailyAnalytics && data.dailyAnalytics.length > 1 ? (
              <svg className={styles.interactiveChart} viewBox="0 0 500 180">
                <defs>
                  <linearGradient id="savedGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                {/* Gridlines */}
                <line x1="0" y1="45" x2="500" y2="45" stroke="var(--color-border-subtle, #f0f0f0)" strokeDasharray="3" />
                <line x1="0" y1="90" x2="500" y2="90" stroke="var(--color-border-subtle, #f0f0f0)" strokeDasharray="3" />
                <line x1="0" y1="135" x2="500" y2="135" stroke="var(--color-border-subtle, #f0f0f0)" strokeDasharray="3" />

                {/* Area path */}
                <path
                  d={`M 0,180 L ${savedChartPath} L 500,180 Z`}
                  fill="url(#savedGrad)"
                />
                
                {/* Line path */}
                <polyline
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="3"
                  points={savedChartPath}
                />

                {/* Interactive Points on Line */}
                {data.dailyAnalytics.map((point, idx) => {
                  const chartWidth = 500;
                  const chartHeight = 180;
                  const maxVal = Math.max(...data.dailyAnalytics.map((p) => parseFloat(p.total_saved)), 10);
                  const minVal = 0;
                  const range = maxVal - minVal;
                  
                  const x = (idx / (data.dailyAnalytics.length - 1)) * chartWidth;
                  const y = chartHeight - ((parseFloat(point.total_saved) - minVal) / range) * chartHeight;

                  return (
                    <circle
                      key={point.date}
                      cx={x}
                      cy={y}
                      r={hoveredSavedPoint?.date === point.date ? 6 : 0}
                      fill="#10b981"
                      stroke="#ffffff"
                      strokeWidth="2"
                      style={{ cursor: "pointer", transition: "all 0.15s ease" }}
                    />
                  );
                })}

                {/* Invisible hover overlay rectangles */}
                {data.dailyAnalytics.map((point, idx) => {
                  const width = 500 / data.dailyAnalytics.length;
                  const x = idx * width;
                  return (
                    <rect
                      key={`rect-${point.date}`}
                      x={x}
                      y="0"
                      width={width}
                      height="180"
                      fill="transparent"
                      onMouseEnter={() => setHoveredSavedPoint(point)}
                      onMouseLeave={() => setHoveredSavedPoint(null)}
                    />
                  );
                })}
              </svg>
            ) : (
              <div className={styles.chartSubtitle}>Insufficient historical data to render savings trends.</div>
            )}
          </div>
        </div>

        {/* Active Circles Bar Chart & Donut Rings combo */}
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <span className={styles.chartTitle}>Operational Health Rates</span>
            <span className={styles.chartSubtitle}>Distribution of successful circle closures versus default rates.</span>
          </div>
          <div className={styles.chartBody}>
            <div className={styles.donutWrapper}>
              {/* Completion Donut */}
              <div className={styles.donutContainer}>
                <svg className={styles.donutSvg} width="120" height="120">
                  <circle className={styles.donutBg} cx="60" cy="60" r="48" />
                  <circle
                    className={styles.donutVal}
                    cx="60"
                    cy="60"
                    r="48"
                    strokeDasharray={`${2 * Math.PI * 48}`}
                    strokeDashoffset={`${2 * Math.PI * 48 * (1 - kpis.avgCompletionRate / 100)}`}
                    style={{ stroke: "#10b981" }}
                  />
                </svg>
                <div className={styles.donutTextContainer}>
                  <span className={styles.donutPercent}>{kpis.avgCompletionRate.toFixed(1)}%</span>
                  <span className={styles.donutLabel}>Completion</span>
                </div>
              </div>

              {/* Default Donut */}
              <div className={styles.donutContainer}>
                <svg className={styles.donutSvg} width="120" height="120">
                  <circle className={styles.donutBg} cx="60" cy="60" r="48" />
                  <circle
                    className={styles.donutVal}
                    cx="60"
                    cy="60"
                    r="48"
                    strokeDasharray={`${2 * Math.PI * 48}`}
                    strokeDashoffset={`${2 * Math.PI * 48 * (1 - kpis.avgDefaultRate / 100)}`}
                    style={{ stroke: "#ef4444" }}
                  />
                </svg>
                <div className={styles.donutTextContainer}>
                  <span className={styles.donutPercent}>{kpis.avgDefaultRate.toFixed(1)}%</span>
                  <span className={styles.donutLabel}>Defaults</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Per-circle Analytics Table Section */}
      <div className={styles.tableSection}>
        <div className={styles.tableActions}>
          <h3 className={styles.chartTitle}>Per-Circle Admin Analytics</h3>
          <div className={styles.searchWrapper}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search circles by name or creator ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="tableContainer">
          <table className="table">
            <thead>
              <tr>
                <th onClick={() => handleSort("circleName")} className={styles.sortableHeader}>
                  Circle Name {sortKey === "circleName" ? (sortOrder === "asc" ? "🔼" : "🔽") : ""}
                </th>
                <th onClick={() => handleSort("status")} className={styles.sortableHeader}>
                  Status {sortKey === "status" ? (sortOrder === "asc" ? "🔼" : "🔽") : ""}
                </th>
                <th>Members (Active / Total)</th>
                <th onClick={() => handleSort("totalSaved")} className={styles.sortableHeader}>
                  Total Saved {sortKey === "totalSaved" ? (sortOrder === "asc" ? "🔼" : "🔽") : ""}
                </th>
                <th onClick={() => handleSort("completionRate")} className={styles.sortableHeader}>
                  Completion Rate {sortKey === "completionRate" ? (sortOrder === "asc" ? "🔼" : "🔽") : ""}
                </th>
                <th onClick={() => handleSort("defaultRate")} className={styles.sortableHeader}>
                  Default Rate {sortKey === "defaultRate" ? (sortOrder === "asc" ? "🔼" : "🔽") : ""}
                </th>
                <th>Risk Classification</th>
              </tr>
            </thead>
            <tbody>
              {sortedAndFilteredCircles.length > 0 ? (
                sortedAndFilteredCircles.map((circle) => (
                  <tr key={circle.circleId}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{circle.circleName}</div>
                      <div className="monospace" style={{ fontSize: 10 }}>{circle.circleId}</div>
                    </td>
                    <td>
                      <span className={`${styles.badge} ${styles[circle.status] || ""}`}>
                        {circle.status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 500 }}>{circle.activeMembersCount}</span>
                      <span style={{ color: "var(--color-text-muted)", margin: "0 4px" }}>/</span>
                      <span style={{ color: "var(--color-text-secondary)" }}>
                        {circle.activeMembersCount + circle.defaultedMembersCount}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{formatCurrency(circle.totalSaved)}</span>
                    </td>
                    <td>
                      <span 
                        className={
                          circle.completionRate >= 90 
                            ? styles.rateHigh 
                            : circle.completionRate >= 70 
                            ? styles.rateMed 
                            : styles.rateLow
                        }
                      >
                        {circle.completionRate.toFixed(1)}%
                      </span>
                    </td>
                    <td>
                      <span
                        className={
                          circle.defaultRate === 0
                            ? styles.rateHigh
                            : circle.defaultRate <= 10
                            ? styles.rateMed
                            : styles.rateLow
                        }
                      >
                        {circle.defaultRate.toFixed(1)}%
                      </span>
                    </td>
                    <td>
                      {getRiskLabel(circle.defaultRate)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className={styles.empty}>
                    No circles matched your search query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
