"use client";

import { useCallback, useState, useEffect } from "react";
import type { Circle } from "@/types";
import { CircleCard } from "@/components/circle/CircleCard";
import { ConnectionStatus } from "@/components/ui/ConnectionStatus";
import { EmptyState } from "@/components/ui/EmptyState";
import { usePolling } from "@/hooks/usePolling";
import Link from "next/link";
import styles from "./LiveDashboard.module.css";

interface LiveDashboardProps {
  initialCircles: Circle[];
}

export function LiveDashboard({ initialCircles }: LiveDashboardProps) {
  const [circles, setCircles] = useState<Circle[]>(initialCircles);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [newCirclesCount, setNewCirclesCount] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const fetchCircles = useCallback(async () => {
    const res = await fetch("/api/circles?filter=mine");
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    return json.data as Circle[];
  }, []);

  const { isConnected } = usePolling({
    fetchFn: fetchCircles,
    interval: 10000, // Poll every 10 seconds for user dashboard
    enabled: true,
    onSuccess: (data) => {
      const prevCount = circles.length;
      const newCount = data.length;
      if (prevCount > 0 && newCount > prevCount) {
        setNewCirclesCount(newCount - prevCount);
        setTimeout(() => setNewCirclesCount(0), 3000);
      }
      setCircles(data);
      setLastUpdate(new Date());
    },
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem("ajosave:onboarding");
      const parsed = stored ? JSON.parse(stored) : null;
      if (!parsed?.seen) setShowOnboarding(true);
    } catch {}
  }, []);

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>My Circles</h1>
        <div className={styles.headerActions}>
          <ConnectionStatus isConnected={isConnected} lastUpdate={lastUpdate || undefined} />
          <Link href="/circles/create" className="btn btn--accent">
            + New Circle
          </Link>
        </div>
      </div>

      {newCirclesCount > 0 && (
        <div className={styles.newItemsBanner} role="status" aria-live="polite">
          🎉 {newCirclesCount} new circle{newCirclesCount !== 1 ? "s" : ""} available!
        </div>
      )}

      {circles.length === 0 ? (
        <EmptyState
          illustration="circles"
          title="Start your savings journey"
          description="You haven't joined any circles yet. Create your own or browse open circles to get started."
          ctas={[
            { label: "Create your first circle", href: "/circles/create", variant: "primary" },
            { label: "Browse circles", href: "/circles", variant: "secondary" },
          ]}
        />
      ) : (
        <div className={styles.grid}>
          {circles.map((circle) => (
            <CircleCard key={circle.id} circle={circle} members={[]} />
          ))}
        </div>
      )}

      {showOnboarding && (
        // Lazy-load to keep bundle small
        //@ts-ignore
        <Onboarding onClose={() => setShowOnboarding(false)} />
      )}
    </>
  );
}
