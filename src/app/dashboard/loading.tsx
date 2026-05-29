import styles from "./page.module.css";

export default function DashboardLoading() {
  return (
    <div className={styles.page}>
      <div className="container">
        <div className="skeleton" style={{ width: 200, height: 32, borderRadius: "var(--radius-md)", marginBottom: "var(--space-8)" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div className="skeleton" style={{ width: "50%", height: 20, borderRadius: "var(--radius-sm)" }} />
                <div className="skeleton" style={{ width: 64, height: 22, borderRadius: "var(--radius-full)" }} />
              </div>
              <div className="skeleton" style={{ width: "70%", height: 16, borderRadius: "var(--radius-sm)" }} />
              <div className="skeleton" style={{ width: "40%", height: 16, borderRadius: "var(--radius-sm)" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
