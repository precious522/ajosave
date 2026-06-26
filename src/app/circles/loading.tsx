import { CircleCardSkeleton } from "@/components/circle/CircleCardSkeleton";
import styles from "./page.module.css";

export default function CirclesLoading() {
  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <div className="skeleton" style={{ width: 160, height: 32, borderRadius: "var(--radius-md)" }} />
          <div className="skeleton" style={{ width: 120, height: 36, borderRadius: "var(--radius-md)" }} />
        </div>
        <div className={styles.grid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <CircleCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
