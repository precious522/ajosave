import styles from "./CircleCard.module.css";

export function CircleCardSkeleton() {
  return (
    <article className={styles.card} aria-hidden>
      <div className={styles.header}>
        <div className="skeleton" style={{ width: "55%", height: 18, borderRadius: "var(--radius-sm)" }} />
        <div className="skeleton" style={{ width: 60, height: 22, borderRadius: "var(--radius-full)" }} />
      </div>
      <div className="skeleton" style={{ width: "40%", height: 28, borderRadius: "var(--radius-sm)" }} />
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
        <div className="skeleton" style={{ width: "50%", height: 14, borderRadius: "var(--radius-sm)" }} />
      </div>
      <div className={styles.progress}>
        <div className="skeleton" style={{ width: "60%", height: "100%", borderRadius: "var(--radius-full)" }} />
      </div>
      <div className="skeleton" style={{ width: "100%", height: 32, borderRadius: "var(--radius-md)" }} />
    </article>
  );
}
