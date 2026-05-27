import type { Metadata } from "next";
import { listOpenCircles } from "@/server/services/circle.service";
import { CircleCard } from "@/components/circle/CircleCard";
import { CircleFilters } from "@/components/circle/CircleFilters";
import { EmptyState } from "@/components/ui/EmptyState";
import Link from "next/link";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Browse Circles" };

interface Props {
  searchParams: {
    page?: string;
    frequency?: string;
    minAmount?: string;
    maxAmount?: string;
    search?: string;
    status?: string;
    currency?: string;
  };
}

export default async function CirclesPage({ searchParams }: Props) {
  const page = searchParams.page ? parseInt(searchParams.page, 10) : 1;
  const { data: circles } = await listOpenCircles(page, 20, {
    frequency: searchParams.frequency as any,
    minAmount: searchParams.minAmount ? parseInt(searchParams.minAmount, 10) : undefined,
    maxAmount: searchParams.maxAmount ? parseInt(searchParams.maxAmount, 10) : undefined,
    search: searchParams.search,
    status: searchParams.status as any,
    currency: searchParams.currency,
  });

  const hasFilters = !!(searchParams.search || searchParams.frequency || searchParams.minAmount || searchParams.maxAmount || searchParams.status || searchParams.currency);

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <h1 className={styles.title}>
            {searchParams.status ? `${searchParams.status.charAt(0).toUpperCase() + searchParams.status.slice(1)} Circles` : 'Open Circles'}
          </h1>
          <Link href="/circles/create" className="btn btn--accent">+ New Circle</Link>
        </div>

        <CircleFilters />

        {circles.length === 0 ? (
          <EmptyState
            illustration={hasFilters ? "search" : "circles"}
            title={hasFilters ? "No circles match your filters" : "No open circles yet"}
            description={
              hasFilters
                ? "Try adjusting your search or filters to find what you're looking for."
                : "Be the first to start a savings circle and invite others to join."
            }
            ctas={
              hasFilters
                ? [{ label: "Clear all filters", href: "/circles", variant: "secondary" }]
                : [
                    { label: "Create a circle", href: "/circles/create", variant: "primary" },
                  ]
            }
          />
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
