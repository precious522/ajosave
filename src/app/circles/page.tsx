import type { Metadata } from "next";
import { listOpenCircles } from "@/server/services/circle.service";
import { CircleCard } from "@/components/circle/CircleCard";
import { CIRCLE_CATEGORIES } from "@/types";
import Link from "next/link";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Browse Circles" };

export default async function CirclesPage({
  searchParams,
}: {
  searchParams: { category?: string };
}) {
  const category = searchParams.category;
  const circles = await listOpenCircles(category);

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <h1 className={styles.title}>Open Circles</h1>
          <Link href="/circles/create" className="btn btn--accent">+ New Circle</Link>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
          <Link href="/circles" className={`btn btn--sm ${!category ? "btn--primary" : "btn--secondary"}`}>All</Link>
          {CIRCLE_CATEGORIES.map((cat) => (
            <Link
              key={cat}
              href={`/circles?category=${cat}`}
              className={`btn btn--sm ${category === cat ? "btn--primary" : "btn--secondary"}`}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </Link>
          ))}
        </div>

        {circles.length === 0 ? (
          <div className={styles.empty}>
            <p>No open circles yet.</p>
            <Link href="/circles/create" className="btn btn--primary">Be the first to create one</Link>
          </div>
        ) : (
          <div className={styles.grid}>
            {circles.map((circle) => (
              <CircleCard key={circle.id} circle={circle} members={[]} showJoin />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
