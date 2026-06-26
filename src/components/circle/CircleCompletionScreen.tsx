import Link from "next/link";
import type { Circle, Member } from "@/types";
import { getCurrencySymbol, SupportedCurrency } from "@/lib/currency";
import { format } from "date-fns";
import styles from "./CircleCompletionScreen.module.css";

interface CircleCompletionScreenProps {
  circle: Circle;
  members: Member[];
}

export function CircleCompletionScreen({ circle, members }: CircleCompletionScreenProps) {
  const currencySymbol = getCurrencySymbol(circle.contributionCurrency as SupportedCurrency);
  const totalSaved = circle.contributionFiat * circle.maxMembers * circle.currentCycle;
  const duration = circle.createdAt
    ? `${format(new Date(circle.createdAt), "MMM yyyy")} – ${format(new Date(circle.updatedAt), "MMM yyyy")}`
    : null;

  const shareText = encodeURIComponent(
    `🎉 Our savings circle "${circle.name}" just completed on Ajosave! ${members.length} members saved ${currencySymbol}${totalSaved.toLocaleString()} together. Join the next one at ajosave.app`
  );
  const twitterUrl = `https://twitter.com/intent/tweet?text=${shareText}`;
  const whatsappUrl = `https://wa.me/?text=${shareText}`;

  return (
    <div className={styles.wrapper}>
      <div className={styles.confetti} aria-hidden="true">🎉</div>
      <h1 className={styles.heading}>Circle Complete! 🏆</h1>
      <p className={styles.sub}>
        Every member has been paid out. Great job staying committed!
      </p>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>
            {currencySymbol}{totalSaved.toLocaleString()}
          </span>
          <span className={styles.statLabel}>Total Saved</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{members.length}</span>
          <span className={styles.statLabel}>Members</span>
        </div>
        {duration && (
          <div className={styles.stat}>
            <span className={styles.statValue}>{circle.currentCycle}</span>
            <span className={styles.statLabel}>Cycles Completed</span>
          </div>
        )}
      </div>

      {duration && <p className={styles.duration}>{duration}</p>}

      <div className={styles.actions}>
        <a
          href={twitterUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn--secondary btn--sm"
        >
          Share on X (Twitter)
        </a>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn--secondary btn--sm"
        >
          Share on WhatsApp
        </a>
        <Link href="/circles/create" className="btn btn--primary btn--sm">
          Start a New Circle
        </Link>
      </div>
    </div>
  );
}
