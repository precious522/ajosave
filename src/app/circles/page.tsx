import type { Metadata } from "next";
import { listOpenCircles } from "@/server/services/circle.service";
import { CircleCard } from "@/components/circle/CircleCard";
import { CircleFilters } from "@/components/circle/CircleFilters";
import { Pagination } from "@/components/ui/Pagination";
import Link from "next/link";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Browse Circles" };

const PAGE_SIZE = 20;

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
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10));
  const { data: circles, total } = await listOpenCircles(page, PAGE_SIZE, {
    frequency: searchParams.frequency as any,
    minAmount: searchParams.minAmount ? parseInt(searchParams.minAmount, 10) : undefined,
    maxAmount: searchParams.maxAmount ? parseInt(searchParams.maxAmount, 10) : undefined,
    search: searchParams.search,
    status: searchParams.status as any,
    currency: searchParams.currency,
  });

  const heading = searchParams.status
    ? `${searchParams.status.charAt(0).toUpperCase() + searchParams.status.slice(1)} Circles`
    : "Open Circles";

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <h1 className={styles.title}>{heading}</h1>
          <Link href="/circles/create" className="btn btn--accent">+ New Circle</Link>
        </div>

        <CircleFilters />

        {circles.length === 0 ? (
          <div className={styles.empty}>
            <p>{page > 1 ? "No more circles on this page." : "No circles found matching your criteria."}</p>
            {page > 1
              ? <Link href="/circles" className="btn btn--secondary">Back to first page</Link>
              : <Link href="/circles" className="btn btn--secondary">Clear all filters</Link>
            }
          </div>
        ) : (
          <>
            <div className={styles.grid}>
              {circles.map((circle) => (
                <CircleCard key={circle.id} circle={circle} members={[]} showJoin />
              ))}
            </div>
            <Pagination page={page} total={total} limit={PAGE_SIZE} />
          </>
        )}
      </div>
    </div>
  );
}
