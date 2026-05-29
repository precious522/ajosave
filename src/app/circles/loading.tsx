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
            <div key={i} className="card" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              <div className="skeleton" style={{ width: "60%", height: 20, borderRadius: "var(--radius-sm)" }} />
              <div className="skeleton" style={{ width: "40%", height: 16, borderRadius: "var(--radius-sm)" }} />
              <div className="skeleton" style={{ width: "80%", height: 16, borderRadius: "var(--radius-sm)" }} />
              <div className="skeleton" style={{ width: 100, height: 32, borderRadius: "var(--radius-md)", marginTop: "var(--space-2)" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
