import Link from "next/link";
import type { Circle, Member } from "@/types";
import { CircleStatusBadge } from "@/components/ui/CircleStatusBadge";
import { getCurrencySymbol, SupportedCurrency } from "@/lib/currency";
import { format } from "date-fns";
import styles from "./CircleCard.module.css";

interface CircleCardProps {
  circle: Circle;
  members: Member[];
  showJoin?: boolean;
}

export function CircleCard({ circle, members, showJoin = false }: CircleCardProps) {
  const currentMemberCount = members.length > 0 ? members.length : (circle.memberCount ?? 0);
  const spotsLeft = circle.maxMembers - currentMemberCount;
  const currencySymbol = getCurrencySymbol(circle.contributionCurrency as SupportedCurrency);

  return (
    <article className={styles.card}>
      <div className={styles.header}>
        <h3 className={styles.name}>{circle.name}</h3>
        <CircleStatusBadge status={circle.status} />
      </div>
      {(circle as Circle & { category?: string }).category && (
        <span className={styles.category}>{(circle as Circle & { category?: string }).category}</span>
      )}

      <div className={styles.amount}>
        {currencySymbol}
        {circle.contributionFiat.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
        <span className={styles.freq}>/ {circle.cycleFrequency}</span>
      </div>

      <div className={styles.meta}>
        <span>{currentMemberCount} / {circle.maxMembers} members</span>
        {circle.nextPayoutAt && (
          <span>Next payout: {format(new Date(circle.nextPayoutAt), "MMM d, yyyy")}</span>
        )}
      </div>

      <div className={styles.progress}>
        <div
          className={styles.progressBar}
          style={{ width: `${(currentMemberCount / circle.maxMembers) * 100}%` }}
          role="progressbar"
          aria-label={`${currentMemberCount} of ${circle.maxMembers} members joined`}
          aria-valuenow={currentMemberCount}
          aria-valuemin={0}
          aria-valuemax={circle.maxMembers}
        />
      </div>

      {showJoin && circle.status === "open" && (
        spotsLeft > 0 ? (
          <Link href={`/circles/${circle.id}/join`} className="btn btn--accent btn--sm btn--full">
            Join Circle — {spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} left
          </Link>
        ) : (
          <Link href={`/circles/${circle.id}`} className="btn btn--secondary btn--sm btn--full">
            Circle Full — View Details / Join Waitlist
          </Link>
        )
      )}

      {!showJoin && (
        <Link href={`/circles/${circle.id}`} className="btn btn--secondary btn--sm btn--full">
          View Details
        </Link>
      )}
    </article>
  );
}
